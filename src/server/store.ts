import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { DemoStateSchema, type ChangePreviewInput, type DemoState, type MissingItemInput, type PantryResult, type PrepReminder, type ShoppingListItem, toPantryResult } from "../shared/types.js";
import { buildRecipeMatch, getRecipe, missingShoppingItems, normalizeIngredientName, validateMissingItems } from "./recipe.js";

type PreparedCommit =
  | { action: "add_to_shopping_list"; recipeId: string; servings: number; items: MissingItemInput[] }
  | { action: "set_prep_reminder"; recipeId: string; delayMinutes: number }
  | { action: "mark_item_bought"; itemId: string }
  | { action: "remove_shopping_item"; itemId: string }
  | { action: "mark_cooked"; recipeId: string; servings: number }
  | { action: "set_pantry_item"; itemId: string; amount: number }
  | { action: "cancel_prep_reminder"; reminderId: string };

export type CommitInput = PreparedCommit & { confirmationToken: string };

type StoredConfirmation = {
  expected: PreparedCommit;
  expiresAt: number;
};

type ChangePreview = {
  confirmationToken: string;
  action: string;
  summary: string;
  items: MissingItemInput[];
};

const countableUnits = new Set(["can", "each", "cloves"]);
const roundAmount = (amount: number) => Math.round(amount * 100) / 100;

function parseState(json: string, path: string): DemoState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Local demo data at " + path + " is not valid JSON. Run npm run data:reset to restore the demo.");
  }
  const result = DemoStateSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Local demo data at " + path + " has an unsupported shape. Run npm run data:reset to restore the demo.");
  }
  return result.data;
}

function stableJson(value: unknown): string {
  const sortObject = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sortObject);
    if (input && typeof input === "object") {
      return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, sortObject(child)]));
    }
    return input;
  };
  return JSON.stringify(sortObject(value));
}

function commitFromPreview(state: DemoState, input: ChangePreviewInput): { commit: PreparedCommit; summary: string; items: MissingItemInput[] } {
  switch (input.action) {
    case "add_to_shopping_list": {
      const recipe = getRecipe(input.recipeId);
      const items = missingShoppingItems(buildRecipeMatch(state, recipe.id, input.servings));
      if (!items.length) throw new Error("Everything needed for this recipe is already in your pantry or on your list.");
      return {
        commit: { ...input, items },
        summary: "Add " + items.map((item) => item.amount + " " + item.unit + " " + item.name).join(", ") + " to your shopping list.",
        items,
      };
    }
    case "set_prep_reminder": {
      const recipe = getRecipe(input.recipeId);
      return { commit: input, summary: "Set a local reminder for " + recipe.name + " in " + input.delayMinutes + " minutes.", items: [] };
    }
    case "mark_item_bought": {
      const item = state.shoppingList.find((candidate) => candidate.id === input.itemId);
      if (!item) throw new Error("That shopping item is no longer on your list.");
      if (item.checked) throw new Error("That shopping item has already been marked as bought.");
      return { commit: input, summary: "Mark " + item.name + " as bought and add " + item.amount + " " + item.unit + " to your pantry.", items: [] };
    }
    case "remove_shopping_item": {
      const item = state.shoppingList.find((candidate) => candidate.id === input.itemId);
      if (!item) throw new Error("That shopping item is no longer on your list.");
      return { commit: input, summary: "Remove " + item.name + " from your shopping list.", items: [] };
    }
    case "mark_cooked": {
      const recipe = getRecipe(input.recipeId);
      const match = buildRecipeMatch(state, recipe.id, input.servings);
      const missing = match.ingredients.filter((ingredient) => ingredient.missingAmount > 0);
      if (missing.length) throw new Error("Add the remaining ingredients to your pantry before marking this cooked: " + missing.map((item) => item.name).join(", ") + ".");
      return { commit: input, summary: "Mark " + recipe.name + " cooked for " + input.servings + " and deduct its ingredients from your pantry.", items: [] };
    }
    case "set_pantry_item": {
      const item = state.pantry.find((candidate) => candidate.id === input.itemId);
      if (!item) throw new Error("That pantry item is no longer available.");
      if (countableUnits.has(item.unit) && !Number.isInteger(input.amount)) {
        throw new Error("Use a whole number for " + item.unit + " pantry quantities.");
      }
      return { commit: input, summary: "Set " + item.name + " to " + input.amount + " " + item.unit + " in your pantry.", items: [] };
    }
    case "cancel_prep_reminder": {
      const reminder = state.reminders.find((candidate) => candidate.id === input.reminderId);
      if (!reminder) throw new Error("That reminder is no longer available.");
      return { commit: input, summary: "Cancel the reminder for " + reminder.recipeName + ".", items: [] };
    }
  }
}

export function createDemoStore(rootDirectory = process.cwd()) {
  const dataDirectory = resolve(rootDirectory, "data");
  const statePath = join(dataDirectory, "runtime-state.json");
  const seedPath = join(dataDirectory, "seed.json");
  const confirmations = new Map<string, StoredConfirmation>();
  let writeQueue: Promise<unknown> = Promise.resolve();

  async function writeAtomically(state: DemoState): Promise<void> {
    await mkdir(dirname(statePath), { recursive: true });
    const temporaryPath = statePath + "." + randomUUID() + ".tmp";
    try {
      await writeFile(temporaryPath, JSON.stringify(state, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
      await rename(temporaryPath, statePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  async function readSeed(): Promise<DemoState> {
    return parseState(await readFile(seedPath, "utf8"), seedPath);
  }

  async function readExistingOrSeed(): Promise<DemoState> {
    try {
      return parseState(await readFile(statePath, "utf8"), statePath);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        const seed = await readSeed();
        await writeAtomically(seed);
        return seed;
      }
      throw error;
    }
  }

  async function serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
    const current = writeQueue.then(operation, operation);
    writeQueue = current.then(() => undefined, () => undefined);
    return current;
  }

  async function read(): Promise<DemoState> {
    try {
      return parseState(await readFile(statePath, "utf8"), statePath);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return serializeWrite(readExistingOrSeed);
      }
      throw error;
    }
  }

  async function preview(input: ChangePreviewInput): Promise<ChangePreview> {
    const state = await read();
    const prepared = commitFromPreview(state, input);
    for (const [token, confirmation] of confirmations) {
      if (confirmation.expiresAt <= Date.now()) confirmations.delete(token);
    }
    const confirmationToken = randomUUID();
    confirmations.set(confirmationToken, { expected: prepared.commit, expiresAt: Date.now() + 10 * 60_000 });
    return { confirmationToken, action: input.action, summary: prepared.summary, items: prepared.items };
  }

  async function mutate<T>(
    input: CommitInput,
    operation: (state: DemoState) => { state: DemoState; value: T },
  ): Promise<{ state: DemoState; value: T }> {
    return serializeWrite(async () => {
      const state = await readExistingOrSeed();
      const { confirmationToken, ...commitInput } = input;
      const confirmation = confirmations.get(confirmationToken);
      if (!confirmation || confirmation.expiresAt <= Date.now()) {
        confirmations.delete(confirmationToken);
        throw new Error("This confirmation expired or was already used. Review the change again before saving.");
      }
      if (stableJson(confirmation.expected) !== stableJson(commitInput)) {
        throw new Error("This confirmation does not match the requested change. Review the change again before saving.");
      }
      confirmations.delete(confirmationToken);
      const result = operation(state);
      const validated = DemoStateSchema.parse(result.state);
      await writeAtomically(validated);
      return { state: validated, value: result.value };
    });
  }

  async function addShopping(input: Extract<CommitInput, { action: "add_to_shopping_list" }>): Promise<{ state: DemoState; added: ShoppingListItem[] }> {
    const saved = await mutate(input, (state) => {
      validateMissingItems(state, input.recipeId, input.servings, input.items);
      const now = new Date().toISOString();
      const added: ShoppingListItem[] = [];
      for (const candidate of input.items) {
        const existing = state.shoppingList.find((item) => !item.checked && normalizeIngredientName(item.name) === normalizeIngredientName(candidate.name) && item.unit === candidate.unit);
        if (existing) {
          existing.amount = roundAmount(existing.amount + candidate.amount);
          added.push({ ...existing });
        } else {
          const item: ShoppingListItem = {
            id: randomUUID(),
            name: candidate.name,
            amount: candidate.amount,
            unit: candidate.unit,
            sourceRecipeId: input.recipeId,
            checked: false,
            createdAt: now,
          };
          state.shoppingList.push(item);
          added.push({ ...item });
        }
      }
      return { state, value: added };
    });
    return { state: saved.state, added: saved.value };
  }

  async function setReminder(input: Extract<CommitInput, { action: "set_prep_reminder" }>): Promise<{ state: DemoState; reminder: PrepReminder }> {
    const saved = await mutate(input, (state) => {
      const recipe = getRecipe(input.recipeId);
      const now = new Date();
      const reminder: PrepReminder = {
        id: randomUUID(),
        recipeId: recipe.id,
        recipeName: recipe.name,
        scheduledAt: new Date(now.getTime() + input.delayMinutes * 60_000).toISOString(),
        createdAt: now.toISOString(),
      };
      state.reminders.push(reminder);
      return { state, value: reminder };
    });
    return { state: saved.state, reminder: saved.value };
  }

  async function markBought(input: Extract<CommitInput, { action: "mark_item_bought" }>): Promise<{ state: DemoState; value: string }> {
    return mutate(input, (state) => {
      const item = state.shoppingList.find((candidate) => candidate.id === input.itemId);
      if (!item || item.checked) throw new Error("That shopping item is no longer waiting to be bought.");
      item.checked = true;
      const pantryItem = state.pantry.find((candidate) => normalizeIngredientName(candidate.name) === normalizeIngredientName(item.name) && candidate.unit === item.unit);
      if (pantryItem) pantryItem.amount = roundAmount(pantryItem.amount + item.amount);
      else state.pantry.push({ id: randomUUID(), name: item.name, amount: item.amount, unit: item.unit, category: "Shopping" });
      return { state, value: "Added " + item.amount + " " + item.unit + " " + item.name + " to your pantry." };
    });
  }

  async function removeShoppingItem(input: Extract<CommitInput, { action: "remove_shopping_item" }>): Promise<{ state: DemoState; value: string }> {
    return mutate(input, (state) => {
      const index = state.shoppingList.findIndex((item) => item.id === input.itemId);
      if (index < 0) throw new Error("That shopping item is no longer on your list.");
      const [item] = state.shoppingList.splice(index, 1);
      return { state, value: "Removed " + item!.name + " from your shopping list." };
    });
  }

  async function markCooked(input: Extract<CommitInput, { action: "mark_cooked" }>): Promise<{ state: DemoState; value: string }> {
    return mutate(input, (state) => {
      const recipe = getRecipe(input.recipeId);
      const match = buildRecipeMatch(state, recipe.id, input.servings);
      const missing = match.ingredients.filter((ingredient) => ingredient.missingAmount > 0);
      if (missing.length) throw new Error("Cannot cook yet. Add these to your pantry first: " + missing.map((item) => item.name).join(", ") + ".");
      for (const ingredient of match.ingredients) {
        const pantryItem = state.pantry.find((item) => normalizeIngredientName(item.name) === normalizeIngredientName(ingredient.name) && item.unit === ingredient.unit);
        if (!pantryItem) throw new Error(ingredient.name + " is no longer in your pantry.");
        pantryItem.amount = roundAmount(Math.max(0, pantryItem.amount - ingredient.amount));
      }
      return { state, value: "Enjoy " + recipe.name + "! Its ingredients have been deducted from your pantry." };
    });
  }

  async function setPantryItem(input: Extract<CommitInput, { action: "set_pantry_item" }>): Promise<{ state: DemoState; value: string }> {
    return mutate(input, (state) => {
      const item = state.pantry.find((candidate) => candidate.id === input.itemId);
      if (!item) throw new Error("That pantry item is no longer available.");
      item.amount = countableUnits.has(item.unit) ? input.amount : roundAmount(input.amount);
      return { state, value: "Updated " + item.name + " to " + item.amount + " " + item.unit + "." };
    });
  }

  async function cancelReminder(input: Extract<CommitInput, { action: "cancel_prep_reminder" }>): Promise<{ state: DemoState; value: string }> {
    return mutate(input, (state) => {
      const index = state.reminders.findIndex((reminder) => reminder.id === input.reminderId);
      if (index < 0) throw new Error("That reminder is no longer available.");
      const [reminder] = state.reminders.splice(index, 1);
      return { state, value: "Cancelled the reminder for " + reminder!.recipeName + "." };
    });
  }

  async function reset(): Promise<DemoState> {
    return serializeWrite(async () => {
      const seed = await readSeed();
      await writeAtomically(seed);
      confirmations.clear();
      return seed;
    });
  }

  return {
    read,
    preview,
    addShopping,
    setReminder,
    markBought,
    removeShoppingItem,
    markCooked,
    setPantryItem,
    cancelReminder,
    reset,
  };
}

export const demoStore = createDemoStore();

export const readDemoState = demoStore.read;
export const previewChange = demoStore.preview;
export const addShoppingItems = demoStore.addShopping;
export const savePrepReminder = demoStore.setReminder;
export const markShoppingItemBought = demoStore.markBought;
export const deleteShoppingItem = demoStore.removeShoppingItem;
export const cookRecipe = demoStore.markCooked;
export const updatePantryItem = demoStore.setPantryItem;
export const cancelPrepReminder = demoStore.cancelReminder;
export const resetDemoState = demoStore.reset;

export function pantryResult(state: DemoState): PantryResult {
  return toPantryResult(state);
}

export async function builtClientExists(): Promise<boolean> {
  try {
    await access(join(resolve(process.cwd(), "dist", "client"), "index.html"));
    return true;
  } catch {
    return false;
  }
}
