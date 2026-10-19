# TableReady build specification

## Product

TableReady helps a busy household decide what to make from food already on hand. The demo uses a deterministic conversation matcher and a self-hosted MCP server to plan a vegetarian or vegan dinner, fill shopping gaps, track bought ingredients, cook a selected recipe, and keep pantry quantities current.

This is a **local Alexa+ simulation**. It does not connect to Alexa+, use an AI model or AWS service, accept voice input, send phone or system notifications, or contact grocery services. The conversation panel maps typed text and suggestion chips to a fixed set of intents; recipe and household data come from local code and JSON.

## Experience and interaction rules

1. On opening the app, the browser MCP client connects to the local /mcp endpoint, completes initialize, calls tools/list, then reads the pantry and searches the default recipe query.
2. The user chooses servings (1–6), a maximum preparation time (5–120 minutes), and vegetarian or vegan. Defaults are two servings, 25 minutes, and vegetarian.
3. find_recipes returns recipes within the time limit. Results are ranked by pantry-match count, then preparation time. Each result shows pantry stock, shopping-list coverage, and the amount still needed.
4. The recipe carousel shows one selected result at a time, with its recipe-authored description, scaled ingredients, and cooking steps. The user can move between alternatives.
5. Before any saved change, preview_change returns a short-lived, one-use confirmation token and an exact summary. The browser shows that summary in a keyboard-accessible dialog. Only the matching write tool accepts that token. A token expires after ten minutes or after one use. Stale ingredient quantities are checked again inside the serialized write.
6. Shopping items can be marked bought, which adds their quantities to the pantry, or removed. mark_cooked deducts the selected recipe's ingredients only when the pantry covers them. Pantry quantities can be set directly after confirmation.
7. Reminder records are local data only. Show only the next future reminder in the “Up next” card. When one becomes due, show an in-page “Time to start cooking” banner; the user can clear it by cancelling the reminder. No reminder is delivered outside the page.
8. The conversation panel handles deterministic intents for recipe search, adding missing items, setting reminders, marking an item bought, removing a named item, reading the pantry, setting pantry quantities, and marking the selected recipe cooked. Every data change uses the same preview and write tools as the buttons.
9. The household avatar opens a short local-data menu. “My pantry” links to the pantry editor.

Persistent data changes always require a matching server-issued confirmation token. Canceling the dialog leaves saved data unchanged. Show success only after persistence completes. Return focus to the control that opened the dialog, trap Tab within it, and set the app background inert until it closes.

## Required visible states

- Local simulation label, MCP connection status, and negotiated protocol version.
- Recipe match count, serving count, preparation time, pantry and shopping coverage, exact remaining shortfalls, and authored cooking steps.
- Carousel controls for alternatives; an empty result state with a working “Try 25 minutes” search action.
- Inline validation for servings or time outside their accepted ranges; do not issue a recipe tool call for invalid values.
- Conversation cards and suggestion chips; typed utterances are matched deterministically without a model.
- Connection, initialization, tool-list, validation, and tool-call failures with a useful message and a retry path.
- An MCP request trace showing actual initialization, tool discovery, and calls, including HTTP outcomes and inspectable payloads.
- Persisted pantry, shopping-list, bought status, and reminder records after reload.
- The next future reminder, due banner, and an explicit local-only reminder explanation.

## Technology and local run model

- Node.js 22 and npm.
- TypeScript, React, and Vite for the browser UI.
- Express for the local server.
- Official MCP TypeScript SDK for both browser client and server.
- Zod 4 shared schemas validate MCP tool inputs, outputs, and client structuredContent.
- MCP Streamable HTTP at /mcp, served by Express. Vite proxies /mcp to the local Express process so the browser uses one origin.
- The client uses protocol version 2025-11-25. Its trace shows the initialization handshake before tool discovery and calls.
- Local state is JSON in data/runtime-state.json; data/seed.json is the committed reset source. Ignore runtime state and generated build output.
- npm run dev starts Vite and the MCP server. npm run build creates a production client bundle. npm start serves the built client and MCP endpoint locally. npm run data:reset restores the seed. npm test runs the Vitest suite.
- Bind servers to loopback by default. Do not add cloud services, public hosting, API credentials, or external integrations.

## MCP tools

Every tool has a Zod input and output schema, a title, annotations, and object-shaped structuredContent. Tools also return a readable JSON text block. Invalid arguments return an MCP error without changing saved data.

### get_pantry

- Input: an empty object.
- Result: items, shoppingList, and reminders from current local state.
- Read-only and idempotent. Pantry rows include ID, name, amount, unit, and category. Shopping rows include amount, unit, source recipe, and checked state. Reminder rows include recipe, scheduled time, and creation time.

### find_recipes

- Input: servings integer 1–6, maxPrepMinutes integer 5–120, and diet vegetarian or vegan.
- Result: recipes with ID, name, description, diet, servings, prepMinutes, ingredients, steps, and pantryMatchCount.
- Ingredients include name, amount, unit, pantryAmount, missingAmount, shoppingAmount, and toBuyAmount. Countable units (can, each, cloves) scale up with Math.ceil; measured units are rounded to two decimal places.
- Vegetarian searches include vegan and vegetarian recipes. Vegan searches include only vegan recipes. The result list is ordered by number of fully matched ingredients, then preparation time.
- Does not change saved data.

### preview_change

- Input is one of: add_to_shopping_list with recipeId and servings; set_prep_reminder with recipeId and delayMinutes; mark_item_bought with itemId; remove_shopping_item with itemId; mark_cooked with recipeId and servings; set_pantry_item with itemId and amount; or cancel_prep_reminder with reminderId.
- Result: confirmationToken, action, summary, and items.
- Creates an in-memory, one-use token that expires in ten minutes. It does not update persisted state. A token is bound to the complete reviewed change and cannot authorize another action or amount.

### add_to_shopping_list

- Input: confirmationToken, recipeId, servings, and items containing name, amount, and unit.
- The server re-reads state inside its serialized write, checks that the token matches, then recalculates the exact remaining amounts as recipe shortfall minus unchecked shopping-list coverage. Stale or repeated requests fail without a second addition.
- Result: state and added. Merge duplicate unchecked items by normalized name and unit.

### set_prep_reminder

- Input: confirmationToken, recipeId, and delayMinutes (integer 5–180).
- The server verifies that the recipe exists and the token matches.
- Result: state and reminder, with reminder.scheduledAt computed by the server. The reminder stays local and is not delivered as a notification.

### mark_item_bought

- Input: confirmationToken and itemId.
- Marks one unchecked shopping row bought and transfers its amount into the matching pantry item, or creates the pantry item when it is not present.
- Result: state and message.

### remove_shopping_item

- Input: confirmationToken and itemId.
- Removes one shopping-list row after matching the confirmation.
- Result: state and message.

### mark_cooked

- Input: confirmationToken, recipeId, and servings.
- Requires pantry stock for every scaled recipe ingredient, then deducts those ingredients in one atomic write.
- Result: state and message.

### set_pantry_item

- Input: confirmationToken, itemId, and amount.
- Sets an existing pantry item's quantity; countable units use whole quantities.
- Result: state and message.

### cancel_prep_reminder

- Input: confirmationToken and reminderId.
- Removes an existing local reminder.
- Result: state and message.

Read tools advertise readOnlyHint and idempotentHint. Persistent write tools advertise idempotentHint; removal tools also advertise destructiveHint. The server exposes the current pantry at pantry://current as JSON and the plan-tonight prompt for MCP clients.

## Seed recipes

The demo includes six vegetarian recipes, four of which are vegan:

- Coconut chickpea curry — two-serving base, 22 minutes.
- Tomato butter beans with couscous — two-serving base, 18 minutes.
- Smoky chickpea tacos — two-serving base, 20 minutes.
- Lemon spinach pasta — two-serving base, 19 minutes.
- Pea and coconut dal — two-serving base, 25 minutes.
- Halloumi couscous bowl — two-serving base, 17 minutes.

The seeded default scenario retains the original household pantry and curry. For two servings, the curry still needs 25 g baby spinach, 50 g basmati rice, and one lime.

Use concise, plausible cooking steps and no unlicensed third-party photos, logos, or copied recipe text. The app uses an original illustration/emoji treatment and no external image service.

## Failure handling and data safety

- Validate tool input on the server and output in both server handlers and browser client.
- If runtime data is missing, initialize it from the seed. Writes use a same-directory temporary file followed by atomic rename.
- Do not report a successful save until persistence completes. Keep the previous UI state on failed writes and show an actionable error.
- If local JSON cannot be parsed, show a clear error and document npm run data:reset as the recovery path; do not silently overwrite the malformed file.
- Confirmation tokens are process-local and expire after ten minutes. Restarting the server invalidates outstanding previews.
- Keep local network access restricted to loopback. Do not accept user-controlled file paths or external URLs in tool input.
- Do not include credentials, personal data, generated runtime JSON, or environment files in git.

## Tests and acceptance checks

npm test covers recipe scaling and discrete-unit rounding, shopping shortfall validation, serialized concurrent writes, atomic JSON state, malformed JSON preservation, one-use confirmation, and an MCP client/server tool/resource/prompt round trip.

- npm run dev opens the local UI and shows initialize, tools/list, and get_pantry traffic in the trace.
- The default search returns six vegetarian candidates, led by the seeded curry; its shortfalls remain 25 g spinach, 50 g rice, and one lime.
- A time limit below the shortest seeded recipe gives an accessible empty state; “Try 25 minutes” updates the form and immediately searches.
- After adding current missing items, a repeated preview cannot inflate the list; once covered, the UI says “On your list”.
- Direct write calls without a preview token, a mismatched token, an expired token, or a reused token do not persist changes.
- Marking an item bought adds it to pantry once. Marking a sufficiently stocked recipe cooked deducts its ingredients. All writes survive reload.
- Reminder cards show only future reminders, due reminders show an in-page banner, and cancelling removes the record.
- Text body is at least 12 px and trace payload text at least 11 px. Search results announce changes; a confirmation dialog makes the background inert, traps keyboard focus, and returns focus after close.
- npm test, npm run build, and npm run data:reset work. Tests use isolated temporary directories; they do not alter runtime demo data.
- The demo clearly says it is local and does not imply Alexa+ connectivity, model use, or actual push reminders.
