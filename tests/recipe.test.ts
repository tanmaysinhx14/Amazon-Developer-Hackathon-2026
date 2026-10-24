import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DemoStateSchema } from "../src/shared/types.js";
import { buildRecipeMatch, findRecipes, missingShoppingItems, scaleIngredientAmount, validateMissingItems } from "../src/server/recipe.js";

async function seedState() {
  return DemoStateSchema.parse(JSON.parse(await readFile(resolve(process.cwd(), "data/seed.json"), "utf8")));
}

describe("recipe scaling and pantry matching", () => {
  it("rounds countable quantities up for odd servings and leaves measured units fractional", () => {
    expect(scaleIngredientAmount(1, 2, 3, "can")).toBe(2);
    expect(scaleIngredientAmount(1, 2, 1, "each")).toBe(1);
    expect(scaleIngredientAmount(2, 2, 3, "cloves")).toBe(3);
    expect(scaleIngredientAmount(150, 2, 3, "g")).toBe(225);
  });

  it("computes the seeded curry shortfalls and validates those exact items", async () => {
    const state = await seedState();
    const match = buildRecipeMatch(state, "coconut-chickpea-curry", 2);
    const missing = missingShoppingItems(match);
    expect(missing).toEqual([
      { name: "Baby spinach", amount: 25, unit: "g" },
      { name: "Basmati rice", amount: 50, unit: "g" },
      { name: "Lime", amount: 1, unit: "each" },
    ]);
    expect(() => validateMissingItems(state, match.id, match.servings, missing)).not.toThrow();
    expect(() => validateMissingItems(state, match.id, match.servings, [...missing, { name: "Garlic", amount: 1, unit: "cloves" }])).toThrow(/every ingredient/);
  });

  it("subtracts unchecked shopping amounts from still-needed amounts and filters vegan recipes", async () => {
    const state = await seedState();
    state.shoppingList.push({
      id: "spinach-already-listed",
      name: "Baby spinach",
      amount: 10,
      unit: "g",
      sourceRecipeId: "coconut-chickpea-curry",
      checked: false,
      createdAt: new Date().toISOString(),
    });
    const match = buildRecipeMatch(state, "coconut-chickpea-curry", 2);
    expect(missingShoppingItems(match).find((item) => item.name === "Baby spinach")?.amount).toBe(15);
    expect(findRecipes(state, 2, 25, "vegan").every((recipe) => recipe.diet === "vegan")).toBe(true);
    expect(findRecipes(state, 2, 25, "vegetarian").some((recipe) => recipe.diet === "vegetarian")).toBe(true);
  });

  it("does not credit one recipe's shopping row to another recipe", async () => {
    const state = await seedState();
    state.shoppingList.push({
      id: "curry-lime",
      name: "Lime",
      amount: 1,
      unit: "each",
      sourceRecipeId: "coconut-chickpea-curry",
      checked: false,
      createdAt: new Date().toISOString(),
    });
    const tacos = buildRecipeMatch(state, "chickpea-tacos", 2);
    expect(tacos.ingredients.find((ingredient) => ingredient.name === "Lime")?.toBuyAmount).toBe(1);
  });
});
