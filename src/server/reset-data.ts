import { resetDemoState } from "./store.js";

const state = await resetDemoState();
process.stdout.write(`Demo data restored. Pantry items: ${state.pantry.length}; shopping list: ${state.shoppingList.length}; reminders: ${state.reminders.length}.\n`);
