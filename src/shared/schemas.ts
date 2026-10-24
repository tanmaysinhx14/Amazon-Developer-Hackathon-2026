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

const ChangePreviewActionSchema = z.enum([
  "add_to_shopping_list",
  "set_prep_reminder",
  "mark_item_bought",
  "remove_shopping_item",
  "mark_cooked",
  "set_pantry_item",
  "cancel_prep_reminder",
]);

export const ChangePreviewInputSchema = z.object({
  action: ChangePreviewActionSchema,
  recipeId: z.string().min(1).max(80).optional(),
  servings: z.number().int().min(1).max(6).optional(),
  delayMinutes: z.number().int().min(5).max(180).optional(),
  itemId: z.string().min(1).optional(),
  amount: z.number().finite().min(0).max(10000).optional(),
  reminderId: z.string().min(1).optional(),
}).strict().superRefine((input, context) => {
  const requiredFields: Record<typeof input.action, readonly string[]> = {
    add_to_shopping_list: ["recipeId", "servings"],
    set_prep_reminder: ["recipeId", "delayMinutes"],
    mark_item_bought: ["itemId"],
    remove_shopping_item: ["itemId"],
    mark_cooked: ["recipeId", "servings"],
    set_pantry_item: ["itemId", "amount"],
    cancel_prep_reminder: ["reminderId"],
  };
  const allowedFields = new Set(["action", ...requiredFields[input.action]]);
  for (const field of requiredFields[input.action]) {
    if (input[field as keyof typeof input] === undefined) {
      context.addIssue({ code: "custom", path: [field], message: `${field} is required for ${input.action}.` });
    }
  }
  for (const field of ["recipeId", "servings", "delayMinutes", "itemId", "amount", "reminderId"] as const) {
    if (input[field] !== undefined && !allowedFields.has(field)) {
      context.addIssue({ code: "custom", path: [field], message: `${field} is not used by ${input.action}.` });
    }
  }
});

export type ChangePreviewInput =
  | { action: "add_to_shopping_list"; recipeId: string; servings: number }
  | { action: "set_prep_reminder"; recipeId: string; delayMinutes: number }
  | { action: "mark_item_bought"; itemId: string }
  | { action: "remove_shopping_item"; itemId: string }
  | { action: "mark_cooked"; recipeId: string; servings: number }
  | { action: "set_pantry_item"; itemId: string; amount: number }
  | { action: "cancel_prep_reminder"; reminderId: string };

export function parseChangePreviewInput(value: unknown): ChangePreviewInput {
  return ChangePreviewInputSchema.parse(value) as ChangePreviewInput;
}

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

export const toPantryResult = (state: { pantry: unknown[]; shoppingList: unknown[]; reminders: unknown[] }) => PantryResultSchema.parse({
  items: state.pantry,
  shoppingList: state.shoppingList,
  reminders: state.reminders,
});
