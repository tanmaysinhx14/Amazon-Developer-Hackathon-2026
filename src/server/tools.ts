import { McpServer } from "@modelcontextprotocol/server";
import {
  AddShoppingInputSchema,
  AddShoppingResultSchema,
  CancelReminderInputSchema,
  ChangePreviewInputSchema,
  ChangePreviewSchema,
  ChangeResultSchema,
  CookInputSchema,
  FindRecipesInputSchema,
  GetPantryInputSchema,
  ItemChangeInputSchema,
  PantryResultSchema,
  ReminderResultSchema,
  RecipeSearchResultSchema,
  SetPantryInputSchema,
  SetReminderInputSchema,
} from "../shared/types.js";
import { findRecipes } from "./recipe.js";
import {
  demoStore,
  pantryResult,
} from "./store.js";

export { validateMissingItems } from "./recipe.js";

function structuredResult<S extends { parse(value: unknown): unknown }>(schema: S, value: unknown) {
  const output = schema.parse(value);
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output) }],
    structuredContent: output,
  };
}

export function createTableReadyServer(store: typeof demoStore = demoStore): McpServer {
  const server = new McpServer({ name: "tableready-local", version: "1.1.0" });

  server.registerTool(
    "get_pantry",
    {
      title: "Get pantry and household plans",
      description: "Read current pantry items, shopping list, and local prep reminders.",
      inputSchema: GetPantryInputSchema,
      outputSchema: PantryResultSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async () => structuredResult(PantryResultSchema, pantryResult(await store.read())),
  );

  server.registerTool(
    "find_recipes",
    {
      title: "Find dinner recipes",
      description: "Find vegetarian or vegan dinners within the requested preparation time, ranked by pantry match and then time.",
      inputSchema: FindRecipesInputSchema,
      outputSchema: RecipeSearchResultSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ servings, maxPrepMinutes, diet }) => {
      const recipes = findRecipes(await store.read(), servings, maxPrepMinutes, diet);
      return structuredResult(RecipeSearchResultSchema, { recipes });
    },
  );

  server.registerTool(
    "preview_change",
    {
      title: "Preview a household change",
      description: "Prepare a short-lived, one-use confirmation for a shopping, pantry, cooking, or reminder change. This does not persist household data.",
      inputSchema: ChangePreviewInputSchema,
      outputSchema: ChangePreviewSchema,
      annotations: { idempotentHint: false },
    },
    async (input) => structuredResult(ChangePreviewSchema, await store.preview(input)),
  );

  server.registerTool(
    "add_to_shopping_list",
    {
      title: "Add missing recipe items",
      description: "Add the current exact remaining ingredients after presenting and receiving confirmation from the user. Requires a one-use preview token.",
      inputSchema: AddShoppingInputSchema,
      outputSchema: AddShoppingResultSchema,
      annotations: { idempotentHint: true },
    },
    async (input) => {
      const saved = await store.addShopping({ ...input, action: "add_to_shopping_list" });
      return structuredResult(AddShoppingResultSchema, { state: pantryResult(saved.state), added: saved.added });
    },
  );

  server.registerTool(
    "set_prep_reminder",
    {
      title: "Set a local prep reminder",
      description: "Save a local reminder for an available recipe after presenting and receiving confirmation. This does not send a phone or system notification.",
      inputSchema: SetReminderInputSchema,
      outputSchema: ReminderResultSchema,
      annotations: { idempotentHint: true },
    },
    async (input) => {
      const saved = await store.setReminder({ ...input, action: "set_prep_reminder" });
      return structuredResult(ReminderResultSchema, { state: pantryResult(saved.state), reminder: saved.reminder });
    },
  );

  server.registerTool(
    "mark_item_bought",
    {
      title: "Mark a shopping item bought",
      description: "Mark a listed item as bought and transfer its amount into the pantry. Requires a one-use preview token.",
      inputSchema: ItemChangeInputSchema,
      outputSchema: ChangeResultSchema,
      annotations: { idempotentHint: true },
    },
    async (input) => {
      const saved = await store.markBought({ ...input, action: "mark_item_bought" });
      return structuredResult(ChangeResultSchema, { state: pantryResult(saved.state), message: saved.value });
    },
  );

  server.registerTool(
    "remove_shopping_item",
    {
      title: "Remove a shopping item",
      description: "Remove an item from the local shopping list after confirmation.",
      inputSchema: ItemChangeInputSchema,
      outputSchema: ChangeResultSchema,
      annotations: { idempotentHint: true, destructiveHint: true },
    },
    async (input) => {
      const saved = await store.removeShoppingItem({ ...input, action: "remove_shopping_item" });
      return structuredResult(ChangeResultSchema, { state: pantryResult(saved.state), message: saved.value });
    },
  );

  server.registerTool(
    "mark_cooked",
    {
      title: "Mark a recipe cooked",
      description: "Deduct the recipe ingredients from the current pantry after checking availability and receiving confirmation.",
      inputSchema: CookInputSchema,
      outputSchema: ChangeResultSchema,
      annotations: { idempotentHint: true },
    },
    async (input) => {
      const saved = await store.markCooked({ ...input, action: "mark_cooked" });
      return structuredResult(ChangeResultSchema, { state: pantryResult(saved.state), message: saved.value });
    },
  );

  server.registerTool(
    "set_pantry_item",
    {
      title: "Set a pantry quantity",
      description: "Set the current quantity for a pantry item after presenting and receiving confirmation.",
      inputSchema: SetPantryInputSchema,
      outputSchema: ChangeResultSchema,
      annotations: { idempotentHint: true },
    },
    async (input) => {
      const saved = await store.setPantryItem({ ...input, action: "set_pantry_item" });
      return structuredResult(ChangeResultSchema, { state: pantryResult(saved.state), message: saved.value });
    },
  );

  server.registerTool(
    "cancel_prep_reminder",
    {
      title: "Cancel a prep reminder",
      description: "Cancel an upcoming local preparation reminder after confirmation.",
      inputSchema: CancelReminderInputSchema,
      outputSchema: ChangeResultSchema,
      annotations: { idempotentHint: true, destructiveHint: true },
    },
    async (input) => {
      const saved = await store.cancelReminder({ ...input, action: "cancel_prep_reminder" });
      return structuredResult(ChangeResultSchema, { state: pantryResult(saved.state), message: saved.value });
    },
  );

  server.registerResource(
    "current-pantry",
    "pantry://current",
    {
      title: "Current household pantry",
      description: "The current local pantry, shopping list, and prep reminders as JSON.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(PantryResultSchema.parse(pantryResult(await store.read()))),
      }],
    }),
  );

  server.registerPrompt(
    "plan-tonight",
    {
      title: "Plan a dinner from the current pantry",
      description: "A short, deterministic planning prompt for browsing the local pantry and finding dinner.",
      argsSchema: GetPantryInputSchema,
    },
    async () => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: "Read the current household pantry resource, then use find_recipes for a vegetarian dinner for two within 25 minutes. Explain any ingredient shortfalls. Before saving any change, call preview_change, show its exact summary, ask the person to confirm, and only then call the matching write tool with the one-use token.",
        },
      }],
    }),
  );

  return server;
}
