import { z } from "zod/v4";

export const MCP_PROTOCOL_VERSION = "2025-11-25" as const;

export const PantryItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  amount: z.number().finite().min(0),
  unit: z.string().min(1).max(24),
  category: z.string().min(1).max(40),
});

export const ShoppingListItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  amount: z.number().finite().positive(),
  unit: z.string().min(1).max(24),
  sourceRecipeId: z.string().min(1),
  checked: z.boolean(),
  createdAt: z.string().datetime(),
});

export const PrepReminderSchema = z.object({
  id: z.string().min(1),
  recipeId: z.string().min(1),
  recipeName: z.string().min(1).max(100),
  scheduledAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export const DemoStateSchema = z.object({
  schemaVersion: z.literal(1),
  pantry: z.array(PantryItemSchema),
  shoppingList: z.array(ShoppingListItemSchema),
  reminders: z.array(PrepReminderSchema),
});

export const PantryResultSchema = z.object({
  items: z.array(PantryItemSchema),
  shoppingList: z.array(ShoppingListItemSchema),
  reminders: z.array(PrepReminderSchema),
});

export const RecipeIngredientSchema = z.object({
  name: z.string(),
  amount: z.number().finite().nonnegative(),
  unit: z.enum(["can", "ml", "g", "each", "cloves"]),
  pantryAmount: z.number().finite().nonnegative(),
  missingAmount: z.number().finite().nonnegative(),
  shoppingAmount: z.number().finite().nonnegative(),
  toBuyAmount: z.number().finite().nonnegative(),
});

export const RecipeMatchSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  diet: z.enum(["vegan", "vegetarian"]),
  servings: z.number().int().positive(),
  prepMinutes: z.number().int().positive(),
  ingredients: z.array(RecipeIngredientSchema),
  steps: z.array(z.string()),
  pantryMatchCount: z.number().int().nonnegative(),
});

export const RecipeSearchResultSchema = z.object({ recipes: z.array(RecipeMatchSchema) });

export const MissingItemInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  amount: z.number().finite().positive().max(10000),
  unit: z.enum(["can", "ml", "g", "each", "cloves"]),
});

export const ChangePreviewInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add_to_shopping_list"), recipeId: z.string().min(1).max(80), servings: z.number().int().min(1).max(6) }).strict(),
  z.object({ action: z.literal("set_prep_reminder"), recipeId: z.string().min(1).max(80), delayMinutes: z.number().int().min(5).max(180) }).strict(),
  z.object({ action: z.literal("mark_item_bought"), itemId: z.string().min(1) }).strict(),
  z.object({ action: z.literal("remove_shopping_item"), itemId: z.string().min(1) }).strict(),
  z.object({ action: z.literal("mark_cooked"), recipeId: z.string().min(1).max(80), servings: z.number().int().min(1).max(6) }).strict(),
  z.object({ action: z.literal("set_pantry_item"), itemId: z.string().min(1), amount: z.number().finite().min(0).max(10000) }).strict(),
  z.object({ action: z.literal("cancel_prep_reminder"), reminderId: z.string().min(1) }).strict(),
]);

export const ChangePreviewSchema = z.object({
  confirmationToken: z.string().min(1),
  action: z.string(),
  summary: z.string(),
  items: z.array(MissingItemInputSchema),
});

export const AddShoppingResultSchema = z.object({
  state: PantryResultSchema,
  added: z.array(ShoppingListItemSchema),
});

export const ReminderResultSchema = z.object({
  state: PantryResultSchema,
  reminder: PrepReminderSchema,
});

export const ChangeResultSchema = z.object({
  state: PantryResultSchema,
  message: z.string(),
});

export const MutationBaseInputSchema = z.object({ confirmationToken: z.string().min(1) });

export const AddShoppingInputSchema = z.object({
  confirmationToken: z.string().min(1),
  recipeId: z.string().min(1).max(80),
  servings: z.number().int().min(1).max(6),
  items: z.array(MissingItemInputSchema).min(1).max(20),
}).strict();

export const SetReminderInputSchema = z.object({
  confirmationToken: z.string().min(1),
  recipeId: z.string().min(1).max(80),
  delayMinutes: z.number().int().min(5).max(180),
}).strict();

export const ItemChangeInputSchema = z.object({ confirmationToken: z.string().min(1), itemId: z.string().min(1) }).strict();
export const CookInputSchema = z.object({ confirmationToken: z.string().min(1), recipeId: z.string().min(1), servings: z.number().int().min(1).max(6) }).strict();
export const SetPantryInputSchema = z.object({ confirmationToken: z.string().min(1), itemId: z.string().min(1), amount: z.number().finite().min(0).max(10000) }).strict();
export const CancelReminderInputSchema = z.object({ confirmationToken: z.string().min(1), reminderId: z.string().min(1) }).strict();

export const DietSchema = z.enum(["vegetarian", "vegan"]);
export const FindRecipesInputSchema = z.object({
  servings: z.number().int().min(1).max(6),
  maxPrepMinutes: z.number().int().min(5).max(120),
  diet: DietSchema,
}).strict();

export const GetPantryInputSchema = z.object({}).strict();

export const ToolErrorSchema = z.object({ message: z.string() });

export const toPantryResult = (state: { pantry: unknown[]; shoppingList: unknown[]; reminders: unknown[] }) => PantryResultSchema.parse({
  items: state.pantry,
  shoppingList: state.shoppingList,
  reminders: state.reminders,
});
