import { copyFile, mkdtemp, readFile, readdir, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DemoStateSchema } from "../src/shared/types.js";
import { createDemoStore } from "../src/server/store.js";

let root = "";
let store: ReturnType<typeof createDemoStore>;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "tableready-store-"));
  await mkdir(join(root, "data"), { recursive: true });
  await copyFile(resolve(process.cwd(), "data/seed.json"), join(root, "data/seed.json"));
  store = createDemoStore(root);
});

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe("local store", () => {
  it("serializes concurrent adds, validates against each fresh state, and leaves complete atomic JSON", async () => {
    const request = { action: "add_to_shopping_list" as const, recipeId: "coconut-chickpea-curry", servings: 2 };
    const [firstPreview, secondPreview] = await Promise.all([store.preview(request), store.preview(request)]);
    const items = firstPreview.items;
    const results = await Promise.allSettled([
      store.addShopping({ action: request.action, recipeId: request.recipeId, servings: request.servings, items, confirmationToken: firstPreview.confirmationToken }),
      store.addShopping({ action: request.action, recipeId: request.recipeId, servings: request.servings, items, confirmationToken: secondPreview.confirmationToken }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const persistedText = await readFile(join(root, "data/runtime-state.json"), "utf8");
    const persisted = DemoStateSchema.parse(JSON.parse(persistedText));
    expect(persisted.shoppingList.map((item) => [item.name, item.amount])).toEqual([
      ["Baby spinach", 25],
      ["Basmati rice", 50],
      ["Lime", 1],
    ]);
    expect((await readdir(join(root, "data"))).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("rejects malformed JSON without replacing the file", async () => {
    const path = join(root, "data/runtime-state.json");
    await writeFile(path, "{not-json", "utf8");
    await expect(store.read()).rejects.toThrow(/not valid JSON/);
    expect(await readFile(path, "utf8")).toBe("{not-json");
  });

  it("requires a matching, one-use confirmation before changing the pantry", async () => {
    const current = await store.read();
    const chickpeas = current.pantry.find((item) => item.id === "chickpeas")!;
    const preview = await store.preview({ action: "set_pantry_item", itemId: chickpeas.id, amount: 2 });
    await expect(store.setPantryItem({ action: "set_pantry_item", itemId: chickpeas.id, amount: 3, confirmationToken: preview.confirmationToken })).rejects.toThrow(/does not match/);
    const saved = await store.setPantryItem({ action: "set_pantry_item", itemId: chickpeas.id, amount: 2, confirmationToken: preview.confirmationToken });
    expect(saved.state.pantry.find((item) => item.id === chickpeas.id)?.amount).toBe(2);
    await expect(store.setPantryItem({ action: "set_pantry_item", itemId: chickpeas.id, amount: 2, confirmationToken: preview.confirmationToken })).rejects.toThrow(/expired or was already used/);
    const reset = await store.reset();
    expect(reset.pantry.find((item) => item.id === chickpeas.id)?.amount).toBe(1);
    expect(reset.shoppingList).toHaveLength(0);
  });

  it("requires whole-number amounts for countable pantry items", async () => {
    const current = await store.read();
    const chickpeas = current.pantry.find((item) => item.id === "chickpeas")!;
    await expect(store.preview({ action: "set_pantry_item", itemId: chickpeas.id, amount: 1.5 })).rejects.toThrow(/whole number/);
  });
});
