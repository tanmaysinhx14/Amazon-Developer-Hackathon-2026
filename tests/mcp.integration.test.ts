import { copyFile, mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { MCP_PROTOCOL_VERSION, AddShoppingResultSchema, ChangePreviewSchema, ChangeResultSchema, PantryResultSchema, ReminderResultSchema } from "../src/shared/types.js";
import { createTableReadyServer } from "../src/server/tools.js";
import { createDemoStore } from "../src/server/store.js";

describe("MCP client/server integration", () => {
  it("discovers typed tools, previews a change, and returns structured content on commit", async () => {
    const root = await mkdtemp(join(tmpdir(), "tableready-mcp-"));
    await mkdir(join(root, "data"), { recursive: true });
    await copyFile(resolve(process.cwd(), "data/seed.json"), join(root, "data/seed.json"));
    const server = createTableReadyServer(createDemoStore(root));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client(
      { name: "tableready-test-client", version: "1.0.0" },
      { supportedProtocolVersions: [MCP_PROTOCOL_VERSION] },
    );
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const listed = await client.listTools();
      expect(listed.tools.map((tool) => tool.name)).toContain("mark_item_bought");
      expect(listed.tools.find((tool) => tool.name === "get_pantry")?.outputSchema).toBeDefined();
      expect(listed.tools.every((tool) => tool.inputSchema.type === "object")).toBe(true);
      expect(listed.tools.every((tool) => tool.annotations?.openWorldHint === false)).toBe(true);
      expect((await client.listResources()).resources.map((resource) => resource.uri)).toContain("pantry://current");
      expect((await client.listPrompts()).prompts.map((prompt) => prompt.name)).toContain("plan-tonight");

      const pantry = await client.callTool({ name: "get_pantry", arguments: {} });
      expect(PantryResultSchema.parse(pantry.structuredContent).items).toHaveLength(8);

      const previewCall = await client.callTool({ name: "preview_change", arguments: { action: "add_to_shopping_list", recipeId: "coconut-chickpea-curry", servings: 2 } });
      const preview = ChangePreviewSchema.parse(previewCall.structuredContent);
      expect(preview.items.map((item) => item.amount)).toEqual([25, 50, 1]);

      const committed = await client.callTool({
        name: "add_to_shopping_list",
        arguments: {
          confirmationToken: preview.confirmationToken,
          recipeId: "coconut-chickpea-curry",
          servings: 2,
          items: preview.items,
        },
      });
      expect(committed.isError).not.toBe(true);
      const added = AddShoppingResultSchema.parse(committed.structuredContent);
      expect(added.added).toHaveLength(3);

      for (const item of added.added) {
        const boughtPreviewCall = await client.callTool({ name: "preview_change", arguments: { action: "mark_item_bought", itemId: item.id } });
        const boughtPreview = ChangePreviewSchema.parse(boughtPreviewCall.structuredContent);
        const bought = await client.callTool({
          name: "mark_item_bought",
          arguments: { confirmationToken: boughtPreview.confirmationToken, itemId: item.id },
        });
        expect(ChangeResultSchema.parse(bought.structuredContent).state.shoppingList.find((row) => row.id === item.id)?.checked).toBe(true);
      }

      const cookPreviewCall = await client.callTool({ name: "preview_change", arguments: { action: "mark_cooked", recipeId: "coconut-chickpea-curry", servings: 2 } });
      const cookPreview = ChangePreviewSchema.parse(cookPreviewCall.structuredContent);
      const cooked = await client.callTool({
        name: "mark_cooked",
        arguments: { confirmationToken: cookPreview.confirmationToken, recipeId: "coconut-chickpea-curry", servings: 2 },
      });
      const cookedState = ChangeResultSchema.parse(cooked.structuredContent).state;
      expect(cookedState.items.find((item) => item.id === "chickpeas")?.amount).toBe(0);
      expect(cookedState.items.find((item) => item.id === "coconut-milk")?.amount).toBe(200);
      expect(cookedState.items.find((item) => item.name === "Lime")?.amount).toBe(0);

      const reminderPreviewCall = await client.callTool({ name: "preview_change", arguments: { action: "set_prep_reminder", recipeId: "tomato-butter-beans", delayMinutes: 15 } });
      const reminderPreview = ChangePreviewSchema.parse(reminderPreviewCall.structuredContent);
      const reminderCall = await client.callTool({
        name: "set_prep_reminder",
        arguments: { confirmationToken: reminderPreview.confirmationToken, recipeId: "tomato-butter-beans", delayMinutes: 15 },
      });
      const reminder = ReminderResultSchema.parse(reminderCall.structuredContent).reminder;
      expect(reminder.recipeId).toBe("tomato-butter-beans");

      const cancelPreviewCall = await client.callTool({ name: "preview_change", arguments: { action: "cancel_prep_reminder", reminderId: reminder.id } });
      const cancelPreview = ChangePreviewSchema.parse(cancelPreviewCall.structuredContent);
      const cancelled = await client.callTool({
        name: "cancel_prep_reminder",
        arguments: { confirmationToken: cancelPreview.confirmationToken, reminderId: reminder.id },
      });
      expect(ChangeResultSchema.parse(cancelled.structuredContent).state.reminders).toHaveLength(0);
    } finally {
      await client.close().catch(() => undefined);
      await server.close().catch(() => undefined);
      await rm(root, { recursive: true, force: true });
    }
  });
});
