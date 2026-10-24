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
  parseChangePreviewInput,
  toPantryResult,
} from "../shared/types.js";
import { findRecipes } from "./recipe.js";
import { demoStore } from "./store.js";

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
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => structuredResult(PantryResultSchema, toPantryResult(await store.read())),
  );

  server.registerTool(
    "find_recipes",
    {
      title: "Find dinner recipes",
      description: "Find vegetarian or vegan dinners within the requested preparation time, ranked by pantry-match ratio and then preparation time.",
      inputSchema: FindRecipesInputSchema,
      outputSchema: RecipeSearchResultSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
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
      description: "Prepare a short-lived, one-use commit token for a shopping, pantry, cooking, or reminder change. The token binds the preview to the write; the browser client adds an explicit confirmation step. This does not persist household data.",
      inputSchema: ChangePreviewInputSchema,
      outputSchema: ChangePreviewSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => structuredResult(ChangePreviewSchema, await store.preview(parseChangePreviewInput(input))),
  );

  server.registerTool(
    "add_to_shopping_list",
    {
      title: "Add missing recipe items",
      description: "Add the current exact remaining ingredients using a matching one-use preview token. The token does not prove human approval; the browser client presents the change and asks the person to confirm.",
      inputSchema: AddShoppingInputSchema,
      outputSchema: AddShoppingResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const saved = await store.addShopping({ ...input, action: "add_to_shopping_list" });
      return structuredResult(AddShoppingResultSchema, { state: toPantryResult(saved.state), added: saved.added });
    },
  );

  server.registerTool(
    "set_prep_reminder",
    {
      title: "Set a local prep reminder",
      description: "Save a local reminder for an available recipe using a matching one-use preview token. The browser client adds an explicit confirmation step. This does not send a phone or system notification.",
      inputSchema: SetReminderInputSchema,
      outputSchema: ReminderResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const saved = await store.setReminder({ ...input, action: "set_prep_reminder" });
      return structuredResult(ReminderResultSchema, { state: toPantryResult(saved.state), reminder: saved.reminder });
    },
  );

  server.registerTool(
    "mark_item_bought",
    {
      title: "Mark a shopping item bought",
      description: "Mark a listed item as bought and transfer its amount into the pantry using a matching one-use preview token. The browser client adds an explicit confirmation step.",
      inputSchema: ItemChangeInputSchema,
      outputSchema: ChangeResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const saved = await store.markBought({ ...input, action: "mark_item_bought" });
      return structuredResult(ChangeResultSchema, { state: toPantryResult(saved.state), message: saved.value });
    },
  );

  server.registerTool(
    "remove_shopping_item",
    {
      title: "Remove a shopping item",
      description: "Remove an item from the local shopping list using a matching one-use preview token. The browser client adds an explicit confirmation step.",
      inputSchema: ItemChangeInputSchema,
      outputSchema: ChangeResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const saved = await store.removeShoppingItem({ ...input, action: "remove_shopping_item" });
      return structuredResult(ChangeResultSchema, { state: toPantryResult(saved.state), message: saved.value });
    },
  );

  server.registerTool(
    "mark_cooked",
    {
      title: "Mark a recipe cooked",
      description: "Deduct the recipe ingredients from the current pantry after checking availability and using a matching one-use preview token. The browser client adds an explicit confirmation step.",
      inputSchema: CookInputSchema,
      outputSchema: ChangeResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const saved = await store.markCooked({ ...input, action: "mark_cooked" });
      return structuredResult(ChangeResultSchema, { state: toPantryResult(saved.state), message: saved.value });
    },
  );

  server.registerTool(
    "set_pantry_item",
    {
      title: "Set a pantry quantity",
      description: "Set the current quantity for a pantry item using a matching one-use preview token. The browser client adds an explicit confirmation step.",
      inputSchema: SetPantryInputSchema,
      outputSchema: ChangeResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const saved = await store.setPantryItem({ ...input, action: "set_pantry_item" });
      return structuredResult(ChangeResultSchema, { state: toPantryResult(saved.state), message: saved.value });
    },
  );

  server.registerTool(
    "cancel_prep_reminder",
    {
      title: "Cancel a prep reminder",
      description: "Cancel a local preparation reminder using a matching one-use preview token. The browser client adds an explicit confirmation step.",
      inputSchema: CancelReminderInputSchema,
      outputSchema: ChangeResultSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const saved = await store.cancelReminder({ ...input, action: "cancel_prep_reminder" });
      return structuredResult(ChangeResultSchema, { state: toPantryResult(saved.state), message: saved.value });
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
        text: JSON.stringify(PantryResultSchema.parse(toPantryResult(await store.read()))),
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
          text: "Read the current household pantry resource, then use find_recipes for a vegetarian dinner for two within 25 minutes. Explain any ingredient shortfalls. Before saving a change, call preview_change and show its exact summary. The one-use token binds the reviewed change but does not prove human approval, so obtain explicit approval before calling the matching write tool.",
        },
      }],
    }),
  );

  return server;
}
