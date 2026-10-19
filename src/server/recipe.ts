import type { DemoState, Diet, MissingItemInput, RecipeMatch } from "../shared/types.js";

export type RecipeDefinition = {
  id: string;
  name: string;
  description: string;
  diet: "vegan" | "vegetarian";
  prepMinutes: number;
  baseServings: number;
  ingredients: ReadonlyArray<{ name: string; amount: number; unit: MissingItemInput["unit"] }>;
  steps: ReadonlyArray<string>;
};

export const RECIPES: readonly RecipeDefinition[] = [
  {
    id: "coconut-chickpea-curry",
    name: "Coconut chickpea curry",
    description: "A soft, fragrant curry with greens and fluffy rice. Comforting, quick, and pantry friendly.",
    diet: "vegan",
    prepMinutes: 22,
    baseServings: 2,
    ingredients: [
      { name: "Chickpeas", amount: 1, unit: "can" },
      { name: "Coconut milk", amount: 200, unit: "ml" },
      { name: "Baby spinach", amount: 100, unit: "g" },
      { name: "Red onion", amount: 1, unit: "each" },
      { name: "Garlic", amount: 2, unit: "cloves" },
      { name: "Passata", amount: 150, unit: "ml" },
      { name: "Basmati rice", amount: 150, unit: "g" },
      { name: "Lime", amount: 1, unit: "each" },
    ],
    steps: [
      "Rinse the rice, then simmer it in salted water until tender. Drain and keep warm.",
      "Soften the sliced onion in a little oil. Stir in the garlic, chickpeas, and passata.",
      "Pour in the coconut milk and simmer gently for 10 minutes. Fold in the spinach until just wilted.",
      "Finish with lime juice, season to taste, and spoon the curry over the rice.",
    ],
  },
  {
    id: "tomato-butter-beans",
    name: "Tomato butter beans with couscous",
    description: "Creamy beans in a bright tomato sauce, served over quick, fluffy couscous.",
    diet: "vegan",
    prepMinutes: 18,
    baseServings: 2,
    ingredients: [
      { name: "Butter beans", amount: 2, unit: "can" },
      { name: "Cherry tomatoes", amount: 200, unit: "g" },
      { name: "Baby spinach", amount: 50, unit: "g" },
      { name: "Couscous", amount: 120, unit: "g" },
      { name: "Lemon", amount: 1, unit: "each" },
      { name: "Garlic", amount: 1, unit: "cloves" },
      { name: "Red onion", amount: 1, unit: "each" },
    ],
    steps: [
      "Cover the couscous with boiling water, then let it stand until fluffy.",
      "Soften the onion and garlic in a little oil, then stir in the tomatoes and beans.",
      "Simmer until the tomatoes soften. Fold in the spinach and season with lemon.",
      "Fluff the couscous with a fork and spoon the beans over the top.",
    ],
  },
  {
    id: "chickpea-tacos",
    name: "Smoky chickpea tacos",
    description: "Crisp-edged spiced chickpeas with crunchy cabbage and a squeeze of lime.",
    diet: "vegan",
    prepMinutes: 20,
    baseServings: 2,
    ingredients: [
      { name: "Chickpeas", amount: 1, unit: "can" },
      { name: "Tortillas", amount: 4, unit: "each" },
      { name: "Red cabbage", amount: 150, unit: "g" },
      { name: "Avocado", amount: 1, unit: "each" },
      { name: "Lime", amount: 1, unit: "each" },
      { name: "Smoked paprika", amount: 5, unit: "g" },
    ],
    steps: [
      "Drain the chickpeas, pat them dry, and toss with smoked paprika and a pinch of salt.",
      "Pan-fry the chickpeas until golden around the edges.",
      "Warm the tortillas and finely shred the cabbage.",
      "Fill the tortillas with chickpeas, cabbage, avocado, and lime juice.",
    ],
  },
  {
    id: "lemon-spinach-pasta",
    name: "Lemon spinach pasta",
    description: "A bright, silky pasta with wilted greens, garlic, and a little parmesan.",
    diet: "vegetarian",
    prepMinutes: 19,
    baseServings: 2,
    ingredients: [
      { name: "Pasta", amount: 180, unit: "g" },
      { name: "Baby spinach", amount: 80, unit: "g" },
      { name: "Lemon", amount: 1, unit: "each" },
      { name: "Garlic", amount: 2, unit: "cloves" },
      { name: "Parmesan", amount: 40, unit: "g" },
      { name: "Olive oil", amount: 20, unit: "ml" },
    ],
    steps: [
      "Cook the pasta in salted water, saving a mug of pasta water before draining.",
      "Warm the olive oil and gently cook the sliced garlic until fragrant.",
      "Add the spinach, pasta, lemon zest, and a splash of pasta water; toss until glossy.",
      "Finish with lemon juice and finely grated parmesan.",
    ],
  },
  {
    id: "pea-coconut-dal",
    name: "Pea and coconut dal",
    description: "A mellow one-pot lentil dal with sweet peas and a bowl of rice.",
    diet: "vegan",
    prepMinutes: 25,
    baseServings: 2,
    ingredients: [
      { name: "Red lentils", amount: 150, unit: "g" },
      { name: "Coconut milk", amount: 200, unit: "ml" },
      { name: "Frozen peas", amount: 100, unit: "g" },
      { name: "Curry powder", amount: 8, unit: "g" },
      { name: "Basmati rice", amount: 120, unit: "g" },
      { name: "Red onion", amount: 1, unit: "each" },
    ],
    steps: [
      "Rinse the lentils and rice. Start the rice in a separate pan of salted water.",
      "Soften the diced onion, then stir through the curry powder and lentils.",
      "Add the coconut milk and water. Simmer until the lentils are soft, adding water as needed.",
      "Stir in the peas until hot and serve with the rice.",
    ],
  },
  {
    id: "halloumi-couscous-bowl",
    name: "Halloumi couscous bowl",
    description: "Golden halloumi over lemony couscous with crunchy cucumber and tomatoes.",
    diet: "vegetarian",
    prepMinutes: 17,
    baseServings: 2,
    ingredients: [
      { name: "Halloumi", amount: 200, unit: "g" },
      { name: "Couscous", amount: 140, unit: "g" },
      { name: "Cucumber", amount: 1, unit: "each" },
      { name: "Cherry tomatoes", amount: 150, unit: "g" },
      { name: "Lemon", amount: 1, unit: "each" },
      { name: "Olive oil", amount: 15, unit: "ml" },
    ],
    steps: [
      "Cover the couscous with boiling water and let it stand until fluffy.",
      "Slice and pan-fry the halloumi until golden on both sides.",
      "Chop the cucumber and tomatoes, then dress with lemon juice and olive oil.",
      "Serve the warm halloumi over couscous with the fresh salad.",
    ],
  },
];

const countableUnits = new Set(["can", "each", "cloves"]);

export function normalizeIngredientName(name: string): string {
  return name.trim().toLocaleLowerCase("en-US");
}

export function scaleIngredientAmount(amount: number, baseServings: number, servings: number, unit: string): number {
  const scaled = amount * (servings / baseServings);
  if (countableUnits.has(unit)) return Math.ceil(scaled);
  return Math.round(scaled * 100) / 100;
}

export function getRecipe(recipeId: string): RecipeDefinition {
  const recipe = RECIPES.find((candidate) => candidate.id === recipeId);
  if (!recipe) throw new Error("That recipe is not available in this demo.");
  return recipe;
}

export function buildRecipeMatch(state: DemoState, recipeId: string, servings: number): RecipeMatch {
  const recipe = getRecipe(recipeId);
  const ingredients = recipe.ingredients.map((ingredient) => {
    const amount = scaleIngredientAmount(ingredient.amount, recipe.baseServings, servings, ingredient.unit);
    const pantryItem = state.pantry.find(
      (item) => normalizeIngredientName(item.name) === normalizeIngredientName(ingredient.name) && item.unit === ingredient.unit,
    );
    const available = Math.max(0, pantryItem?.amount ?? 0);
    const pantryAmount = Math.round(Math.min(amount, available) * 100) / 100;
    const missingAmount = Math.round(Math.max(0, amount - pantryAmount) * 100) / 100;
    const listedAmount = state.shoppingList
      .filter((item) => !item.checked && normalizeIngredientName(item.name) === normalizeIngredientName(ingredient.name) && item.unit === ingredient.unit)
      .reduce((total, item) => total + item.amount, 0);
    const shoppingAmount = Math.round(Math.min(missingAmount, listedAmount) * 100) / 100;
    const rawToBuy = Math.max(0, missingAmount - shoppingAmount);
    const toBuyAmount = countableUnits.has(ingredient.unit) ? Math.ceil(rawToBuy) : Math.round(rawToBuy * 100) / 100;
    return { name: ingredient.name, amount, unit: ingredient.unit, pantryAmount, missingAmount, shoppingAmount, toBuyAmount };
  });

  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    diet: recipe.diet,
    servings,
    prepMinutes: recipe.prepMinutes,
    ingredients,
    steps: [...recipe.steps],
    pantryMatchCount: ingredients.filter((ingredient) => ingredient.missingAmount === 0).length,
  };
}

export function findRecipes(state: DemoState, servings: number, maxPrepMinutes: number, diet: Diet): RecipeMatch[] {
  return RECIPES
    .filter((recipe) => recipe.prepMinutes <= maxPrepMinutes && (diet === "vegetarian" || recipe.diet === "vegan"))
    .map((recipe) => buildRecipeMatch(state, recipe.id, servings))
    .sort((a, b) => b.pantryMatchCount - a.pantryMatchCount || a.prepMinutes - b.prepMinutes || a.name.localeCompare(b.name));
}

export function missingShoppingItems(match: RecipeMatch): MissingItemInput[] {
  return match.ingredients
    .filter((ingredient) => ingredient.toBuyAmount > 0)
    .map(({ name, toBuyAmount, unit }) => ({ name, amount: toBuyAmount, unit }));
}

export function validateMissingItems(state: DemoState, recipeId: string, servings: number, items: MissingItemInput[]): void {
  const expected = missingShoppingItems(buildRecipeMatch(state, recipeId, servings));
  if (!expected.length) throw new Error("Everything needed for this recipe is already in your pantry or on your list.");
  if (items.length !== expected.length) {
    throw new Error("The shopping list must contain every ingredient still needed for this recipe.");
  }
  for (const expectedItem of expected) {
    const submitted = items.find((item) => normalizeIngredientName(item.name) === normalizeIngredientName(expectedItem.name));
    if (!submitted || submitted.unit !== expectedItem.unit || Math.abs(submitted.amount - expectedItem.amount) > 0.001) {
      throw new Error(`The remaining amount for ${expectedItem.name} has changed. Search again and review the updated list.`);
    }
  }
}
