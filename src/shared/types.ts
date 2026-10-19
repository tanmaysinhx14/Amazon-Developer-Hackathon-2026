import { z } from "zod/v4";
import * as Schemas from "./schemas.js";

export {
  MCP_PROTOCOL_VERSION,
  PantryItemSchema,
  ShoppingListItemSchema,
  PrepReminderSchema,
  DemoStateSchema,
  PantryResultSchema,
  RecipeIngredientSchema,
  RecipeMatchSchema,
  RecipeSearchResultSchema,
  MissingItemInputSchema,
  ChangePreviewInputSchema,
  ChangePreviewSchema,
  AddShoppingResultSchema,
  ReminderResultSchema,
  ChangeResultSchema,
  AddShoppingInputSchema,
  SetReminderInputSchema,
  ItemChangeInputSchema,
  CookInputSchema,
  SetPantryInputSchema,
  CancelReminderInputSchema,
  FindRecipesInputSchema,
  GetPantryInputSchema,
  toPantryResult,
} from "./schemas.js";

export type PantryItem = z.infer<typeof Schemas.PantryItemSchema>;
export type ShoppingListItem = z.infer<typeof Schemas.ShoppingListItemSchema>;
export type PrepReminder = z.infer<typeof Schemas.PrepReminderSchema>;
export type DemoState = z.infer<typeof Schemas.DemoStateSchema>;
export type PantryResult = z.infer<typeof Schemas.PantryResultSchema>;
export type RecipeIngredient = z.infer<typeof Schemas.RecipeIngredientSchema>;
export type RecipeMatch = z.infer<typeof Schemas.RecipeMatchSchema>;
export type Diet = z.infer<typeof Schemas.DietSchema>;
export type MissingItemInput = z.infer<typeof Schemas.MissingItemInputSchema>;
export type ChangePreviewInput = z.infer<typeof Schemas.ChangePreviewInputSchema>;
export type ChangePreview = z.infer<typeof Schemas.ChangePreviewSchema>;

export type RecipeSearchResult = { recipes: RecipeMatch[] };
export type AddShoppingResult = { state: PantryResult; added: ShoppingListItem[] };
export type ReminderResult = { state: PantryResult; reminder: PrepReminder };
export type ChangeResult = { state: PantryResult; message: string };

