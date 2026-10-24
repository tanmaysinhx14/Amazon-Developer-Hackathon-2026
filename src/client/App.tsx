import type { Client as McpClient } from "@modelcontextprotocol/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import type { ZodType } from "zod/v4";
import {
  AddShoppingInputSchema,
  AddShoppingResultSchema,
  CancelReminderInputSchema,
  ChangePreviewInputSchema,
  ChangePreviewSchema,
  ChangeResultSchema,
  CookInputSchema,
  ItemChangeInputSchema,
  MCP_PROTOCOL_VERSION,
  PantryResultSchema,
  RecipeSearchResultSchema,
  ReminderResultSchema,
  SetPantryInputSchema,
  SetReminderInputSchema,
} from "../shared/types.js";
import type {
  AddShoppingResult,
  ChangePreview,
  ChangePreviewInput,
  ChangeResult,
  Diet,
  PantryResult,
  RecipeMatch,
  ReminderResult,
} from "../shared/types.js";

type ConnectionStatus = "connecting" | "connected" | "error";
type RpcPayload = { method?: string; id?: number | string; params?: Record<string, unknown>; result?: { isError?: boolean }; error?: unknown };
type TraceEntry = { id: number; method: string; request: string; response: string; status: number | null; elapsed: number; failed?: boolean; error?: string };
type SearchForm = { servings: string; maxPrepMinutes: string; diet: Diet };
type SearchQuery = { servings: number; maxPrepMinutes: number; diet: Diet };
type WriteToolName = "add_to_shopping_list" | "set_prep_reminder" | "mark_item_bought" | "remove_shopping_item" | "mark_cooked" | "set_pantry_item" | "cancel_prep_reminder";
type PendingDialog = {
  preview: ChangePreview;
  tool: WriteToolName;
  args: Record<string, unknown>;
  label: string;
};
type ConversationMessage = { id: number; role: "user" | "assistant"; text: string; card?: string };

const DEFAULT_QUERY: SearchQuery = { servings: 2, maxPrepMinutes: 25, diet: "vegetarian" };
const INITIAL_FORM: SearchForm = { servings: "2", maxPrepMinutes: "25", diet: "vegetarian" };
const RECIPE_EMOJIS: Record<string, string> = {
  "coconut-chickpea-curry": "🥘",
  "tomato-butter-beans": "🍲",
  "chickpea-tacos": "🌮",
  "lemon-spinach-pasta": "🍝",
  "pea-coconut-dal": "🥣",
  "halloumi-couscous-bowl": "🥗",
};
const REQUIRED_TOOLS = [
  "get_pantry", "find_recipes", "preview_change", "add_to_shopping_list", "set_prep_reminder",
  "mark_item_bought", "remove_shopping_item", "mark_cooked", "set_pantry_item", "cancel_prep_reminder",
];
const OUTPUT_SCHEMAS = {
  get_pantry: PantryResultSchema,
  find_recipes: RecipeSearchResultSchema,
  preview_change: ChangePreviewSchema,
  add_to_shopping_list: AddShoppingResultSchema,
  set_prep_reminder: ReminderResultSchema,
  mark_item_bought: ChangeResultSchema,
  remove_shopping_item: ChangeResultSchema,
  mark_cooked: ChangeResultSchema,
  set_pantry_item: ChangeResultSchema,
  cancel_prep_reminder: ChangeResultSchema,
};
type ToolName = keyof typeof OUTPUT_SCHEMAS;
const WRITE_INPUT_SCHEMAS: Record<WriteToolName, ZodType> = {
  add_to_shopping_list: AddShoppingInputSchema,
  set_prep_reminder: SetReminderInputSchema,
  mark_item_bought: ItemChangeInputSchema,
  remove_shopping_item: ItemChangeInputSchema,
  mark_cooked: CookInputSchema,
  set_pantry_item: SetPantryInputSchema,
  cancel_prep_reminder: CancelReminderInputSchema,
};
type ToolOutput<T extends ToolName> =
  T extends "get_pantry" ? PantryResult :
  T extends "find_recipes" ? { recipes: RecipeMatch[] } :
  T extends "preview_change" ? ChangePreview :
  T extends "add_to_shopping_list" ? AddShoppingResult :
  T extends "set_prep_reminder" ? ReminderResult :
  ChangeResult;

function formatAmount(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function quantity(amount: number, unit: string): string {
  return formatAmount(amount) + " " + unit;
}

function formatTime(dateString: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(dateString));
}

function formatTracePayload(value: unknown): string {
  let formatted: string;
  try { formatted = JSON.stringify(value, null, 2); } catch { formatted = String(value); }
  if (formatted.length <= 1600) return formatted;
  const lines: string[] = [];
  let length = 0;
  for (const line of formatted.split("\n")) {
    if (length + line.length + 1 > 1500) break;
    lines.push(line);
    length += line.length + 1;
  }
  return lines.join("\n") + "\n… (truncated)";
}

function parseRpcPayload(raw: string): RpcPayload | null {
  const data = raw.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
  const source = data.length ? data.join("\n") : raw;
  try {
    const parsed: unknown = JSON.parse(source);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as RpcPayload : null;
  } catch {
    return null;
  }
}

function getRpcText(raw: string): string {
  const parsed = parseRpcPayload(raw);
  return parsed ? formatTracePayload(parsed) : raw.trim().slice(0, 1500) + (raw.trim().length > 1500 ? "\n… (truncated)" : "");
}

async function readToolResult<T extends ToolName>(client: McpClient, name: T, args: Record<string, unknown>): Promise<ToolOutput<T>> {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    const message = result.content?.find((block) => block.type === "text");
    throw new Error(message?.type === "text" ? message.text : name + " failed.");
  }

  let payload: unknown = result.structuredContent;
  if (payload === undefined) {
    const text = result.content?.find((block) => block.type === "text");
    if (text?.type === "text") {
      try { payload = JSON.parse(text.text); } catch { payload = undefined; }
    }
  }
  const parsed = OUTPUT_SCHEMAS[name].safeParse(payload);
  if (!parsed.success) {
    throw new Error(name + " returned a result that failed the shared response schema.");
  }
  return parsed.data as ToolOutput<T>;
}

function validateQuery(form: SearchForm): { query?: SearchQuery; errors: { servings?: string; maxPrepMinutes?: string } } {
  const servings = Number(form.servings);
  const maxPrepMinutes = Number(form.maxPrepMinutes);
  const errors: { servings?: string; maxPrepMinutes?: string } = {};
  if (!Number.isInteger(servings) || servings < 1 || servings > 6) errors.servings = "Choose a whole number from 1 to 6.";
  if (!Number.isInteger(maxPrepMinutes) || maxPrepMinutes < 5 || maxPrepMinutes > 120) errors.maxPrepMinutes = "Choose a whole number from 5 to 120 minutes.";
  return Object.keys(errors).length ? { errors } : { query: { servings, maxPrepMinutes, diet: form.diet }, errors };
}

function App() {
  const clientRef = useRef<McpClient | null>(null);
  const connectGeneration = useRef(0);
  const traceCounter = useRef(0);
  const messageCounter = useRef(1);
  const previousFocus = useRef<HTMLElement | null>(null);
  const firstDialogButton = useRef<HTMLButtonElement | null>(null);
  const conversationInput = useRef<HTMLInputElement | null>(null);
  const recipeHeading = useRef<HTMLHeadingElement | null>(null);
  const householdTrigger = useRef<HTMLButtonElement | null>(null);
  const householdMenu = useRef<HTMLDivElement | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [state, setState] = useState<PantryResult | null>(null);
  const [form, setForm] = useState<SearchForm>(INITIAL_FORM);
  const [query, setQuery] = useState<SearchQuery>(DEFAULT_QUERY);
  const [formErrors, setFormErrors] = useState<{ servings?: string; maxPrepMinutes?: string }>({});
  const [recipes, setRecipes] = useState<RecipeMatch[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [dialog, setDialog] = useState<PendingDialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conversationText, setConversationText] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([
    { id: 1, role: "assistant", text: "Hi! Tell me how much time you have, or choose a suggestion below.", card: "TableReady can find dinner, track shopping, and update your pantry." },
  ]);
  const [reminderDelay, setReminderDelay] = useState(20);
  const [pantryAmounts, setPantryAmounts] = useState<Record<string, string>>({});
  const [householdMenuOpen, setHouseholdMenuOpen] = useState(false);
  const [dismissedDueReminderIds, setDismissedDueReminderIds] = useState<string[]>([]);
  const [clock, setClock] = useState(Date.now());

  const addTrace = useCallback((entry: Omit<TraceEntry, "id">) => {
    traceCounter.current += 1;
    setTrace((items) => [...items, { ...entry, id: traceCounter.current }].slice(-36));
  }, []);

  const connect = useCallback(async () => {
    const generation = ++connectGeneration.current;
    const isCurrent = () => generation === connectGeneration.current;
    setStatus("connecting");
    setConnectionError(null);
    const previous = clientRef.current;
    clientRef.current = null;
    if (previous) await previous.close().catch(() => undefined);
    if (!isCurrent()) return;

    const tracedFetch: typeof fetch = async (input, init) => {
      const started = performance.now();
      let rawRequest = "";
      if (typeof init?.body === "string") rawRequest = init.body;
      else if (input instanceof Request) rawRequest = await input.clone().text().catch(() => "");
      let payload: RpcPayload | undefined;
      try { payload = rawRequest ? JSON.parse(rawRequest) as RpcPayload : undefined; } catch { payload = undefined; }
      const rpcMethod = payload?.method ?? (init?.method ?? "GET") + " /mcp";
      let responseText = "";
      let responseStatus: number | null = null;
      try {
        const response = await window.fetch(input, init);
        responseStatus = response.status;
        if (payload?.method) {
          const rawResponse = await response.clone().text();
          const rpcResponse = parseRpcPayload(rawResponse);
          responseText = getRpcText(rawResponse);
          const toolName = payload.method === "tools/call" && typeof payload.params?.name === "string" ? " → " + payload.params.name : "";
          if (isCurrent()) addTrace({
              method: rpcMethod + toolName,
              request: formatTracePayload(payload),
              response: responseText || response.statusText || "(empty response)",
              status: responseStatus,
              elapsed: Math.round(performance.now() - started),
              failed: response.status >= 400 || Boolean(rpcResponse && (rpcResponse.error !== undefined || rpcResponse.result?.isError === true)),
            });
        }
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Network request failed.";
        if (payload?.method && isCurrent()) addTrace({
          method: rpcMethod,
          request: formatTracePayload(payload),
          response: "",
          status: responseStatus,
          elapsed: Math.round(performance.now() - started),
          failed: true,
          error: message,
        });
        throw error;
      }
    };

    try {
      const { Client, StreamableHTTPClientTransport } = await import("@modelcontextprotocol/client");
      if (!isCurrent()) return;
      const client = new Client(
        { name: "tableready-browser", version: "1.1.0" },
        { versionNegotiation: { mode: "legacy" }, supportedProtocolVersions: [MCP_PROTOCOL_VERSION] },
      );
      const transport = new StreamableHTTPClientTransport(new URL("/mcp", window.location.origin), { fetch: tracedFetch });
      clientRef.current = client;
      await client.connect(transport);
      if (!isCurrent()) {
        await client.close().catch(() => undefined);
        return;
      }
      const tools = await client.listTools();
      const names = tools.tools.map((tool) => tool.name);
      const missing = REQUIRED_TOOLS.filter((name) => !names.includes(name));
      if (missing.length) throw new Error("The MCP server is missing required tools: " + missing.join(", ") + ".");
      const pantry = await readToolResult(client, "get_pantry", {});
      if (!isCurrent()) return;
      setState(pantry);
      const firstSearch = await readToolResult(client, "find_recipes", DEFAULT_QUERY);
      if (!isCurrent()) return;
      setRecipes(firstSearch.recipes);
      setSelectedIndex(0);
      setStatus("connected");
    } catch (error) {
      if (!isCurrent()) return;
      await clientRef.current?.close().catch(() => undefined);
      clientRef.current = null;
      setConnectionError(error instanceof Error ? error.message : "Could not connect to the local MCP server.");
      setStatus("error");
    }
  }, [addTrace]);

  useEffect(() => {
    void connect();
    return () => {
      connectGeneration.current += 1;
      void clientRef.current?.close().catch(() => undefined);
    };
  }, [connect]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const currentRecipe = recipes[selectedIndex] ?? null;
  const upcomingReminder = useMemo(() => (state?.reminders ?? [])
    .filter((reminder) => new Date(reminder.scheduledAt).getTime() > clock)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0] ?? null, [clock, state]);
  const dueReminders = useMemo(() => (state?.reminders ?? [])
    .filter((reminder) => new Date(reminder.scheduledAt).getTime() <= clock && !dismissedDueReminderIds.includes(reminder.id))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)), [clock, state, dismissedDueReminderIds]);
  const pantryItems = state?.items ?? [];
  const availableCount = pantryItems.filter((item) => item.amount > 0).length;
  const connected = status === "connected";
  const localNow = new Date(clock);
  const todayLabel = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(localNow);

  const addMessage = (role: ConversationMessage["role"], text: string, card?: string) => {
    messageCounter.current += 1;
    setMessages((previous) => [...previous, { id: messageCounter.current, role, text, card }].slice(-16));
  };

  const performSearch = async (nextForm: SearchForm) => {
    const validated = validateQuery(nextForm);
    setFormErrors(validated.errors);
    if (!validated.query) return null;
    if (!clientRef.current) {
      setActionError("Connect to the local MCP server before searching.");
      return null;
    }
    setSearching(true);
    setActionError(null);
    setNotice(null);
    try {
      const result = await readToolResult(clientRef.current, "find_recipes", validated.query);
      setForm(nextForm);
      setQuery(validated.query);
      setRecipes(result.recipes);
      setSelectedIndex(0);
      setFormErrors({});
      return result.recipes;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The dinner search failed. Try again.");
      return null;
    } finally {
      setSearching(false);
    }
  };

  const searchFromForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const results = await performSearch(form);
    if (results) {
      addMessage("assistant", results.length ? "I found " + results.length + " dinner " + (results.length === 1 ? "idea" : "ideas") + ". The best pantry match is shown below." : "I couldn't find a " + form.diet + " dinner within " + form.maxPrepMinutes + " minutes. Try a little more time.", results.slice(0, 3).map((item) => item.name + " · " + item.prepMinutes + " min").join("  |  "));
    }
  };

  const refreshAfterMutation = async (nextState: PantryResult) => {
    setState(nextState);
    setPantryAmounts({});
    if (!clientRef.current) return;
    const results = await readToolResult(clientRef.current, "find_recipes", query);
    setRecipes(results.recipes);
    const previousId = currentRecipe?.id;
    const nextIndex = results.recipes.findIndex((recipe) => recipe.id === previousId);
    setSelectedIndex(nextIndex >= 0 ? nextIndex : 0);
  };

  const beginConfirmation = async (
    request: ChangePreviewInput,
    tool: WriteToolName,
    args: Record<string, unknown>,
    label: string,
    trigger?: HTMLElement | null,
  ) => {
    const client = clientRef.current;
    if (!client) {
      setActionError("Connect to the local MCP server before changing saved data.");
      return;
    }
    previousFocus.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : conversationInput.current);
    setActionError(null);
    setNotice(null);
    try {
      const checkedRequest = ChangePreviewInputSchema.parse(request);
      const preview = await readToolResult(client, "preview_change", checkedRequest);
      const finalArgs = tool === "add_to_shopping_list" ? { ...args, items: preview.items } : args;
      setDialog({ preview, tool, args: finalArgs, label });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not prepare that change.";
      setActionError(message);
      addMessage("assistant", message);
    }
  };

  useEffect(() => {
    if (dialog) firstDialogButton.current?.focus();
    else {
      const trigger = previousFocus.current;
      previousFocus.current = null;
      const enabled = trigger?.isConnected
        && !trigger.matches(":disabled")
        && trigger.getAttribute("aria-disabled") !== "true";
      if (trigger && enabled) trigger.focus();
      else if (recipeHeading.current?.isConnected) recipeHeading.current.focus();
      else conversationInput.current?.focus();
    }
  }, [dialog]);

  useEffect(() => {
    if (!householdMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!householdMenu.current?.contains(event.target as Node)) setHouseholdMenuOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setHouseholdMenuOpen(false);
        householdTrigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [householdMenuOpen]);

  const closeDialog = () => { if (!busy) setDialog(null); };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      closeDialog();
      return;
    }
    if (event.key === "Tab") {
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled)"));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (first && last && event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (first && last && !event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const confirmChange = async () => {
    const pending = dialog;
    const client = clientRef.current;
    if (!pending || !client) return;
    setBusy(true);
    setActionError(null);
    try {
      const args = { ...pending.args, confirmationToken: pending.preview.confirmationToken };
      const checkedArgs = WRITE_INPUT_SCHEMAS[pending.tool].parse(args) as Record<string, unknown>;
      let nextState: PantryResult;
      let message: string;
      if (pending.tool === "add_to_shopping_list") {
        const output = await readToolResult(client, pending.tool, checkedArgs);
        nextState = output.state;
        message = output.added.length + (output.added.length === 1 ? " item was added to your list." : " items were added to your list.");
      } else if (pending.tool === "set_prep_reminder") {
        const output = await readToolResult(client, pending.tool, checkedArgs);
        nextState = output.state;
        message = "I'll remind you at " + formatTime(output.reminder.scheduledAt) + ". It will appear here in the local demo.";
      } else {
        const output = await readToolResult(client, pending.tool, checkedArgs);
        nextState = output.state;
        message = output.message;
      }

      setDialog(null);
      setNotice(message);
      addMessage("assistant", "Done. " + message);
      try {
        await refreshAfterMutation(nextState);
      } catch (error) {
        const reason = error instanceof Error ? " " + error.message : "";
        const refreshMessage = "Saved, but couldn't refresh recipes." + reason;
        setNotice(refreshMessage);
        addMessage("assistant", refreshMessage);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The change could not be saved. Review it and try again.";
      setDialog(null);
      setActionError(message);
      addMessage("assistant", message);
    } finally {
      setBusy(false);
    }
  };

  const startShoppingConfirmation = (recipe: RecipeMatch | null, trigger?: HTMLElement | null) => {
    if (!recipe) return;
    const needs = recipe.ingredients.filter((item) => item.toBuyAmount > 0);
    if (!needs.length) {
      setNotice(recipe.ingredients.some((item) => item.missingAmount > 0) ? "Everything missing is already on your shopping list." : "Everything for this recipe is already in your pantry.");
      return;
    }
    void beginConfirmation(
      { action: "add_to_shopping_list", recipeId: recipe.id, servings: recipe.servings },
      "add_to_shopping_list",
      { recipeId: recipe.id, servings: recipe.servings },
      "Add remaining ingredients",
      trigger,
    );
  };

  const startReminderConfirmation = (recipe: RecipeMatch | null, delay: number, trigger?: HTMLElement | null) => {
    if (!recipe) return;
    void beginConfirmation(
      { action: "set_prep_reminder", recipeId: recipe.id, delayMinutes: delay },
      "set_prep_reminder",
      { recipeId: recipe.id, delayMinutes: delay },
      "Set local reminder",
      trigger,
    );
  };

  const previewItemAction = (action: "mark_item_bought" | "remove_shopping_item", itemId: string, trigger?: HTMLElement | null) => {
    const item = state?.shoppingList.find((candidate) => candidate.id === itemId);
    if (!item) return;
    void beginConfirmation(
      { action, itemId },
      action,
      { itemId },
      action === "mark_item_bought" ? "Mark as bought" : "Remove from list",
      trigger,
    );
  };

  const submitPantryAmount = (itemId: string, amount: number, trigger?: HTMLElement | null) => {
    void beginConfirmation(
      { action: "set_pantry_item", itemId, amount },
      "set_pantry_item",
      { itemId, amount },
      "Update pantry",
      trigger,
    );
  };

  const submitCooked = (recipe: RecipeMatch | null, trigger?: HTMLElement | null) => {
    if (!recipe) return;
    void beginConfirmation(
      { action: "mark_cooked", recipeId: recipe.id, servings: recipe.servings },
      "mark_cooked",
      { recipeId: recipe.id, servings: recipe.servings },
      "Mark as cooked",
      trigger,
    );
  };

  const previewCancelReminder = (reminderId: string, trigger?: HTMLElement | null) => {
    void beginConfirmation(
      { action: "cancel_prep_reminder", reminderId },
      "cancel_prep_reminder",
      { reminderId },
      "Cancel reminder",
      trigger,
    );
  };

  const runUtterance = async (utterance: string) => {
    const text = utterance.trim();
    if (!text) return;
    addMessage("user", text);
    setConversationText("");
    const normalized = text.toLocaleLowerCase();
    const minutesMatch = normalized.match(/(\d+)\s*(?:min|minute)/);
    const servingsMatch = normalized.match(/(?:for|serves?)\s*(\d+)/);
    const nextForm = { ...form };
    if (minutesMatch?.[1]) nextForm.maxPrepMinutes = minutesMatch[1];
    if (servingsMatch?.[1]) nextForm.servings = servingsMatch[1];
    if (/\bvegan\b|plant[- ]based/.test(normalized)) nextForm.diet = "vegan";
    else if (/\bvegetarian\b/.test(normalized)) nextForm.diet = "vegetarian";

    try {
      if (/\bremind(?:er)?\b/.test(normalized)) {
        const delay = Number(minutesMatch?.[1] ?? reminderDelay);
        if (delay < 5 || delay > 180) {
          addMessage("assistant", "I can set a local reminder from 5 to 180 minutes from now.");
          return;
        }
        if (!currentRecipe) {
          addMessage("assistant", "Search for a dinner idea first, and I can set its reminder.");
          return;
        }
        addMessage("assistant", "I can save a local preparation reminder. Please review the time before I save it.");
        startReminderConfirmation(currentRecipe, delay, conversationInput.current);
        return;
      }
      if (/\b(bought|picked up|got the groceries)\b/.test(normalized)) {
        const waiting = (state?.shoppingList ?? []).filter((item) => !item.checked);
        const namedItem = waiting.find((item) => normalized.includes(item.name.toLocaleLowerCase()));
        const item = namedItem ?? waiting[0];
        if (!item) {
          addMessage("assistant", "There are no unchecked items on your shopping list.");
          return;
        }
        addMessage("assistant", "I can mark " + item.name + " bought and add it to the pantry. Please confirm.");
        previewItemAction("mark_item_bought", item.id, conversationInput.current);
        return;
      }
      if (/\b(cook|cooked|made it|finished dinner)\b/.test(normalized)) {
        if (!currentRecipe) {
          addMessage("assistant", "Choose a recipe first so I know which ingredients to deduct.");
          return;
        }
        submitCooked(currentRecipe, conversationInput.current);
        return;
      }
      if (/\b(remove|delete)\b/.test(normalized)) {
        const item = (state?.shoppingList ?? []).find((candidate) => normalized.includes(candidate.name.toLocaleLowerCase()));
        if (!item) {
          addMessage("assistant", "Tell me the name of a shopping-list item to remove.");
          return;
        }
        previewItemAction("remove_shopping_item", item.id, conversationInput.current);
        return;
      }

      const pantryRead = /\b(what do i have|what(?:['’]s| is) in|show|list)\b/.test(normalized)
        && /\b(pantry|ingredients|food)\b/.test(normalized);
      if (pantryRead) {
        if (!clientRef.current) throw new Error("Connect to the local MCP server before reading the pantry.");
        const result = await readToolResult(clientRef.current, "get_pantry", {});
        setState(result);
        addMessage("assistant", "You have " + result.items.filter((item) => item.amount > 0).length + " stocked pantry items and " + result.shoppingList.filter((item) => !item.checked).length + " things to pick up.", result.items.filter((item) => item.amount > 0).map((item) => item.name + " · " + quantity(item.amount, item.unit)).join("  |  "));
        document.getElementById("pantry")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const amountMatch = normalized.match(/\b(?:to|=)\s*(\d+(?:\.\d+)?)/);
      const namedPantryItem = pantryItems.find((candidate) => normalized.includes(candidate.name.toLocaleLowerCase()));
      const pantryEditIntent = (/\bpantry\b/.test(normalized) && /\b(set|update|change)\b/.test(normalized))
        || (Boolean(namedPantryItem && amountMatch) && /\b(set|update|change)\b/.test(normalized));
      if (pantryEditIntent) {
        if (!namedPantryItem || !amountMatch?.[1]) {
          addMessage("assistant", "Say something like 'set Chickpeas to 2' and I will prepare the pantry update for confirmation.");
          return;
        }
        submitPantryAmount(namedPantryItem.id, Number(amountMatch[1]), conversationInput.current);
        return;
      }

      if (/\b(add|missing|buy)\b|\bshopping list\b/.test(normalized)) {
        if (!currentRecipe) {
          addMessage("assistant", "Run a dinner search first and I can add its missing ingredients.");
          return;
        }
        const needs = currentRecipe.ingredients.filter((item) => item.toBuyAmount > 0);
        if (!needs.length) {
          addMessage("assistant", "Everything missing is already on your list, or the pantry has it.");
          return;
        }
        addMessage("assistant", "I have checked what is still needed. Please review the amounts before I save them.", needs.map((item) => item.name + " · " + quantity(item.toBuyAmount, item.unit)).join("  |  "));
        startShoppingConfirmation(currentRecipe, conversationInput.current);
        return;
      }
      if (/\b(find|dinner|recipe|eat|vegan|vegetarian|minutes?)\b|what.*make/.test(normalized)) {
        const results = await performSearch(nextForm);
        if (results) {
          const top = results[0];
          addMessage("assistant", top ? "Here are " + results.length + " ideas. " + top.name + " is the closest pantry match." : "I could not find a matching dinner in that time. Try more minutes or switch the diet filter.", top ? top.name + " · " + top.prepMinutes + " min · " + top.pantryMatchCount + " pantry matches" : "You can change the time and search again.");
        } else {
          const validationMessage = Object.values(validateQuery(nextForm).errors).join(" ");
          addMessage("assistant", validationMessage || actionError || "The dinner search failed. Try again.");
        }
        return;
      }
      addMessage("assistant", "I can find vegan or vegetarian dinner, add missing ingredients, set a reminder, mark shopping as bought, update the pantry, or mark a meal cooked.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "I could not complete that request. Try again.";
      setActionError(message);
      addMessage("assistant", message);
    }
  };

  const handleConversationSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runUtterance(conversationText);
  };

  const selectRecipe = (index: number) => {
    if (!recipes.length) return;
    setSelectedIndex((index + recipes.length) % recipes.length);
  };

  const missing = currentRecipe?.ingredients.filter((item) => item.missingAmount > 0) ?? [];
  const toBuy = currentRecipe?.ingredients.filter((item) => item.toBuyAmount > 0) ?? [];
  const searchAnnouncement = searching
    ? "Searching recipes."
    : recipes.length
      ? recipes.length + " " + form.diet + " " + (recipes.length === 1 ? "recipe" : "recipes") + " found. " + (currentRecipe?.name ?? "") + " selected."
      : "No recipes matched this search.";

  return (
    <div className="app-shell">
      <div className="app-background" inert={Boolean(dialog)}>
        <header className="topbar">
          <a className="brand" href="#top" aria-label="TableReady home"><span className="brand-mark" aria-hidden="true">T</span><span className="brand-word">Table<span>Ready</span></span></a>
          <nav className="top-nav" aria-label="Main navigation">
            <a href="#dinner">Tonight</a>
            <a href="#pantry">My pantry</a>
            <a href="#conversation">Ask TableReady</a>
          </nav>
          <div className="topbar-right" ref={householdMenu}>
            <span className="local-label"><span className="local-dot" /> Local simulation</span>
            <button ref={householdTrigger} className="avatar" type="button" aria-label="Demo household information" aria-controls="household-menu" aria-expanded={householdMenuOpen} onClick={() => setHouseholdMenuOpen((open) => !open)}>H</button>
            {householdMenuOpen && <div id="household-menu" className="household-menu"><strong>Demo household</strong><span>Saved locally on this computer.</span></div>}
          </div>
        </header>

        <main id="top" className="page-wrap">
          <section className="welcome-row" aria-labelledby="page-title">
            <div>
              <p className="eyebrow">{todayLabel}</p>
              <h1 id="page-title">A lovely dinner, <em>already in reach.</em></h1>
              <p className="welcome-copy">A little less planning. A little more time around the table.</p>
            </div>
            <div className={"connection-pill " + (connected ? "is-connected" : status === "error" ? "has-error" : "is-loading")} role="status">
              <span className="connection-indicator" />
              <span>{connected ? "MCP connected · " + MCP_PROTOCOL_VERSION : status === "error" ? "MCP connection issue" : "Connecting to local MCP…"}</span>
            </div>
          </section>

          {status === "error" && <div className="alert-banner" role="alert"><div><strong>Couldn’t reach your local dinner planner.</strong><span>{connectionError}</span></div><button className="button button-outline" type="button" onClick={() => void connect()}>Try again</button></div>}
          {actionError && <div className="alert-banner action-alert" role="alert"><span>{actionError}</span><button type="button" className="plain-close" onClick={() => setActionError(null)} aria-label="Dismiss error">×</button></div>}
          {notice && <div className="success-banner" role="status"><span aria-hidden="true">✓</span><span>{notice}</span><button type="button" className="plain-close" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
          {dueReminders.length > 0 && <div className="due-banner" role="status"><span aria-hidden="true">&#9200;</span><div><strong>Reminders due</strong><div className="due-reminder-list">{dueReminders.map((reminder) => <div className="due-reminder-item" key={reminder.id}><span>{reminder.recipeName} reminder is due.</span><button type="button" className="text-button" onClick={() => setDismissedDueReminderIds((items) => [...items, reminder.id])}>Dismiss</button><button type="button" className="text-button" onClick={(event) => previewCancelReminder(reminder.id, event.currentTarget)}>Cancel</button></div>)}</div></div></div>}

          <div className="main-grid">
            <div className="primary-column">
              <section id="dinner" className="planner-card" aria-labelledby="planner-title">
                <div className="planner-content">
                  <p className="section-kicker">TONIGHT’S PLAN</p>
                  <h2 id="planner-title">Let’s make dinner <em>easy.</em></h2>
                  <p className="planner-copy">Tell me how many you’re feeding, how much time you have, and whether you want a vegan or vegetarian meal.</p>
                  <form className="planner-form" onSubmit={(event) => void searchFromForm(event)} noValidate>
                    <div className="form-row">
                      <label className="field-label" htmlFor="servings">Dinner for</label>
                      <div className="number-field"><input id="servings" type="number" inputMode="numeric" min="1" max="6" step="1" value={form.servings} onChange={(event) => setForm((value) => ({ ...value, servings: event.target.value }))} aria-invalid={Boolean(formErrors.servings)} aria-describedby={formErrors.servings ? "servings-error" : "servings-hint"} disabled={!connected || searching} /><span>people</span></div>
                      <label className="field-label" htmlFor="time-limit">in</label>
                      <div className="number-field"><input id="time-limit" type="number" inputMode="numeric" min="5" max="120" step="1" value={form.maxPrepMinutes} onChange={(event) => setForm((value) => ({ ...value, maxPrepMinutes: event.target.value }))} aria-invalid={Boolean(formErrors.maxPrepMinutes)} aria-describedby={formErrors.maxPrepMinutes ? "time-error" : "time-hint"} disabled={!connected || searching} /><span>min</span></div>
                      <label className="field-label" htmlFor="diet">diet</label>
                      <select id="diet" className="diet-select" value={form.diet} onChange={(event) => setForm((value) => ({ ...value, diet: event.target.value as Diet }))} disabled={!connected || searching}><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option></select>
                    </div>
                    {formErrors.servings && <p className="field-error" id="servings-error">{formErrors.servings}</p>}
                    {!formErrors.servings && <span className="sr-only" id="servings-hint">Choose a whole number of servings from 1 to 6.</span>}
                    {formErrors.maxPrepMinutes && <p className="field-error" id="time-error">{formErrors.maxPrepMinutes}</p>}
                    {!formErrors.maxPrepMinutes && <span className="sr-only" id="time-hint">Choose a maximum preparation time from 5 to 120 minutes.</span>}
                    <button className="button button-primary find-button" type="submit" disabled={!connected || searching}>{searching ? "Searching…" : "Find tonight’s dinner →"}</button>
                  </form>
                  <p className="planner-footnote">Made from what you have, with room to improvise.</p>
                </div>
                <div className="planner-art-wrap">
                  {currentRecipe ? <div className="planner-art" role="img" aria-label={"Illustration of " + currentRecipe.name}><span aria-hidden="true">{RECIPE_EMOJIS[currentRecipe.id] ?? "🍽️"}</span></div> : <div className="planner-art" aria-hidden="true"><span>🥣</span></div>}
                  <div className="art-tag"><strong>{currentRecipe ? currentRecipe.prepMinutes + " minutes" : "A fresh idea"}</strong><span>{currentRecipe?.diet === "vegan" ? "Plant-based dinner" : "Simple dinner, ready soon"}</span></div>
                </div>
              </section>

              <section className="recipe-section" aria-labelledby="recipe-heading" aria-busy={searching}>
                <div className="section-heading-row">
                  <div><p className="eyebrow">MADE FOR YOUR EVENING</p><h2 ref={recipeHeading} id="recipe-heading" tabIndex={-1}>Your dinner ideas</h2></div>
                  {recipes.length > 0 && <div className="carousel-controls"><button type="button" className="button button-small button-outline" onClick={() => selectRecipe(selectedIndex - 1)} aria-label="Previous recipe">←</button><span>{selectedIndex + 1} of {recipes.length}</span><button type="button" className="button button-small button-outline" onClick={() => selectRecipe(selectedIndex + 1)} aria-label="Next recipe">→</button></div>}
                </div>
                <p className="sr-only" role="status">{searchAnnouncement}</p>
                {currentRecipe ? (
                  <article className="recipe-card" aria-label={currentRecipe.name + " recipe"}>
                    <div className="recipe-card-main">
                      <div className="recipe-title-row"><div><span className="recipe-type">{currentRecipe.diet.toUpperCase()} · QUICK DINNER</span><h3>{currentRecipe.name}</h3></div><span className="heart-seal" aria-hidden="true">✦</span></div>
                      <p className="recipe-description">{currentRecipe.description}</p>
                      <div className="recipe-meta"><span>◷ {currentRecipe.prepMinutes} min</span><span>♧ Serves {currentRecipe.servings}</span><span>{currentRecipe.pantryMatchCount} pantry matches</span></div>
                      <div className="recipe-divider" />
                      <div className="ingredient-heading"><h4>What you’ll need</h4><span>{currentRecipe.ingredients.length} ingredients</span></div>
                      <ul className="ingredient-list">
                        {currentRecipe.ingredients.map((ingredient) => {
                          const unavailable = ingredient.missingAmount > 0 && ingredient.toBuyAmount > 0;
                          const listed = ingredient.missingAmount > 0 && ingredient.toBuyAmount === 0;
                          const unitMismatch = pantryItems.find((item) => item.name.trim().toLocaleLowerCase() === ingredient.name.trim().toLocaleLowerCase() && item.unit !== ingredient.unit);
                          return <li className={unavailable ? "is-missing" : "is-available"} key={ingredient.name}>
                            <span className="ingredient-status" aria-hidden="true">{unavailable ? "+" : "✓"}</span>
                            <span className="ingredient-name">{ingredient.name}</span>
                            <span className="ingredient-amount">{unavailable ? <><strong>{quantity(ingredient.toBuyAmount, ingredient.unit)}</strong> to get</> : listed ? <><strong>{quantity(ingredient.shoppingAmount, ingredient.unit)}</strong> on your list</> : quantity(ingredient.amount, ingredient.unit)}{unitMismatch && <small className="ingredient-unit-note">Pantry has {quantity(unitMismatch.amount, unitMismatch.unit)}; this demo matches exact units.</small>}</span>
                          </li>;
                        })}
                      </ul>
                      {toBuy.length > 0 ? <div className="missing-note"><strong>Still needed:</strong> {toBuy.map((item) => item.name).join(", ")}.</div> : missing.length > 0 ? <div className="all-here-note">✓ Everything missing is already on your list.</div> : <div className="all-here-note">✓ You have everything for this recipe.</div>}
                      <div className="recipe-actions">
                        <button className="button button-primary" type="button" onClick={(event) => startShoppingConfirmation(currentRecipe, event.currentTarget)} disabled={!connected || toBuy.length === 0}>{toBuy.length ? "Add remaining items" : missing.length ? "On your list ✓" : "In your pantry ✓"}</button>
                        <label className="reminder-inline" htmlFor="reminder-delay">Reminder in <select id="reminder-delay" value={reminderDelay} onChange={(event) => setReminderDelay(Number(event.target.value))}>{[5, 10, 15, 20, 30, 45, 60, 90, 120, 180].map((minutes) => <option value={minutes} key={minutes}>{minutes} min</option>)}</select></label>
                        <button className="button button-outline" type="button" onClick={(event) => startReminderConfirmation(currentRecipe, reminderDelay, event.currentTarget)} disabled={!connected}>Set reminder</button>
                        <button className="button button-outline" type="button" onClick={(event) => submitCooked(currentRecipe, event.currentTarget)} disabled={!connected || missing.length > 0}>Mark cooked</button>
                      </div>
                      <p className="reminder-disclaimer">Reminders appear in this local demo; no notification is sent.</p>
                    </div>
                    <aside className="recipe-aside">
                      <div className="step-card"><div className="step-card-top"><span className="step-number">COOKING GUIDE</span><span className="step-label">{currentRecipe.steps.length} steps</span></div><ol className="cooking-steps">{currentRecipe.steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol></div>
                      {upcomingReminder && <div className="saved-reminder-card"><span className="saved-reminder-icon" aria-hidden="true">◷</span><span><small>UP NEXT</small><strong>{formatTime(upcomingReminder.scheduledAt)}</strong><span>{upcomingReminder.recipeName}</span></span><button type="button" className="text-button" onClick={(event) => previewCancelReminder(upcomingReminder.id, event.currentTarget)}>Cancel</button></div>}
                    </aside>
                  </article>
                ) : (
                  <div className="empty-recipe-card"><span className="empty-illustration" aria-hidden="true">⌕</span><div><h3>No recipe fits that search yet</h3><p>Give dinner a little more time, or try the 25-minute suggestion.</p></div><button className="button button-outline" type="button" onClick={() => { const quick = { ...form, maxPrepMinutes: "25" }; setForm(quick); void performSearch(quick); }} disabled={!connected || searching}>Try 25 minutes</button></div>
                )}
              </section>

              <section id="conversation" className="conversation-card" aria-labelledby="conversation-title">
                <div className="section-heading-row"><div><p className="eyebrow">ALEXA-STYLE LOCAL DEMO</p><h2 id="conversation-title">Ask TableReady</h2></div><span className="conversation-mode">Deterministic intents · no model</span></div>
                <div className="conversation-log" role="log" aria-live="polite" aria-relevant="additions">
                  {messages.map((message) => <div key={message.id} className={"message message-" + message.role}><span className="message-speaker">{message.role === "assistant" ? "TableReady" : "You"}</span><p>{message.text}</p>{message.card && <div className="response-card">{message.card}</div>}</div>)}
                </div>
                <form className="conversation-form" onSubmit={handleConversationSubmit}>
                  <label className="sr-only" htmlFor="conversation-input">Ask TableReady</label>
                  <input ref={conversationInput} id="conversation-input" type="text" value={conversationText} onChange={(event) => setConversationText(event.target.value)} placeholder="Try “What can I make in 25 minutes?”" disabled={!connected || busy} />
                  <button className="button button-primary" type="submit" disabled={!connected || busy || !conversationText.trim()}>Ask →</button>
                </form>
                <div className="utterance-chips">
                  <button type="button" onClick={() => void runUtterance("What’s for dinner in 25 minutes?")}>What’s for dinner in 25 minutes?</button>
                  <button type="button" onClick={() => void runUtterance("Find a vegan dinner in 25 minutes")}>Find a vegan dinner</button>
                  <button type="button" onClick={() => void runUtterance("Add what I’m missing")}>Add what I’m missing</button>
                  <button type="button" onClick={() => void runUtterance("Remind me in " + reminderDelay + " minutes")}>Remind me in {reminderDelay} min</button>
                </div>

              </section>

              <section id="mcp-trace" className="trace-card" aria-labelledby="trace-title">
                <div className="trace-header"><span className="trace-icon" aria-hidden="true">⌘</span><div><p className="eyebrow">UNDER THE HOOD</p><h2 id="trace-title">MCP request trace</h2></div><span className={"trace-status " + (status === "error" ? "trace-status-error" : status === "connecting" ? "trace-status-waiting" : "")}><span />{status === "connected" ? "CONNECTED" : status === "error" ? "ERROR" : "CONNECTING"}</span></div>
                <p className="trace-intro">These are the real Streamable HTTP requests from this browser to the local MCP server.</p>
                <ol className="trace-list">
                  {trace.map((entry) => <li key={entry.id} className="trace-row">
                    <span className="trace-index">{String(entry.id).padStart(2, "0")}</span>
                    <div className="trace-main"><div className="trace-line"><code>{entry.method}</code><span>{entry.elapsed} ms</span></div><details className="trace-details"><summary><span className="trace-http-dot" />{entry.status === null ? "network error" : "HTTP " + entry.status} · inspect payload</summary><div className="trace-payloads"><div><small>REQUEST</small><pre>{entry.request}</pre></div><div><small>RESPONSE</small><pre>{entry.error ?? entry.response}</pre></div></div></details></div>
                    <span className={entry.failed ? "trace-result trace-result-error" : "trace-result"} aria-label={entry.failed ? "Error" : "Success"}>{entry.failed ? "!" : "✓"}</span>
                  </li>)}
                  {!trace.length && <li className="trace-empty">Waiting for the MCP initialization handshake…</li>}
                </ol>
                <div className="trace-footer"><span><span className="tiny-dot" /> Streamable HTTP · protocol {MCP_PROTOCOL_VERSION}</span><span>local server: <code>127.0.0.1:3001/mcp</code></span></div>
              </section>
            </div>

            <aside className="side-column">
              <section className="side-card pantry-card" id="pantry" aria-labelledby="pantry-title">
                <div className="side-card-heading"><div><p className="eyebrow">A QUICK LOOK</p><h2 id="pantry-title">Your pantry</h2></div><span className="count-badge">{availableCount}</span></div>
                <p className="side-card-copy">Adjust quantities here. Each change is previewed and confirmed.</p>
                <div className="pantry-list">
                  {pantryItems.map((item) => {
                    const amountText = pantryAmounts[item.id] ?? String(item.amount);
                    const amount = Number(amountText);
                    const valid = amountText.trim() !== "" && Number.isFinite(amount) && amount >= 0;
                    return <div className={"pantry-row " + (item.amount === 0 ? "pantry-row-empty" : "")} key={item.id}>
                      <span className="ingredient-avatar" aria-hidden="true">{item.name.slice(0, 1).toUpperCase()}</span>
                      <span className="pantry-name">{item.name}</span>
                      <label className="sr-only" htmlFor={"pantry-" + item.id}>{item.name + " quantity in " + item.unit}</label>
                      <input className="pantry-amount-input" id={"pantry-" + item.id} type="number" min="0" step={["can", "each", "cloves"].includes(item.unit) ? "1" : "0.1"} value={amountText} onChange={(event) => setPantryAmounts((previous) => ({ ...previous, [item.id]: event.target.value }))} />
                      <span className="pantry-unit">{item.unit}</span>
                      <button type="button" className="text-button" disabled={!connected || !valid || amount === item.amount} onClick={(event) => submitPantryAmount(item.id, amount, event.currentTarget)}>Save</button>
                    </div>;
                  })}
                  {!pantryItems.length && <div className="side-loading">Loading pantry…</div>}
                </div>
                <div className="pantry-foot">Your selected dinner uses {currentRecipe?.pantryMatchCount ?? 0} things you already have.</div>
              </section>

              <section className="side-card shopping-card" aria-labelledby="shopping-title">
                <div className="side-card-heading"><div><p className="eyebrow">THE LITTLE EXTRAS</p><h2 id="shopping-title">Shopping list</h2></div><span className="count-badge count-badge-light">{state?.shoppingList.filter((item) => !item.checked).length ?? 0}</span></div>
                {state?.shoppingList.length ? <ul className="shopping-items">{state.shoppingList.map((item) => <li key={item.id} className={item.checked ? "shopping-item-checked" : ""}>
                  <span className="shopping-item-name">{item.checked ? "✓ " : ""}{item.name}<small>{quantity(item.amount, item.unit)}{item.checked ? " · bought" : ""}</small></span>
                  <div className="shopping-item-actions">{!item.checked && <button type="button" className="text-button" disabled={!connected} onClick={(event) => previewItemAction("mark_item_bought", item.id, event.currentTarget)}>Bought</button>}<button type="button" className="text-button text-button-danger" disabled={!connected} onClick={(event) => previewItemAction("remove_shopping_item", item.id, event.currentTarget)}>Remove</button></div>
                </li>)}</ul> : <div className="shopping-empty"><strong>Nothing to pick up yet.</strong><span>Missing recipe ingredients can go here when you’re ready.</span></div>}
              </section>

              <section className="side-card reminders-card" aria-labelledby="reminders-title">
                <div className="side-card-heading"><div><p className="eyebrow">LOCAL ONLY</p><h2 id="reminders-title">Prep reminders</h2></div><span className="count-badge">{state?.reminders.length ?? 0}</span></div>
                {upcomingReminder ? <div className="reminder-row"><span><strong>{formatTime(upcomingReminder.scheduledAt)}</strong><small>{upcomingReminder.recipeName}</small></span><button className="text-button" type="button" disabled={!connected} onClick={(event) => previewCancelReminder(upcomingReminder.id, event.currentTarget)}>Cancel</button></div> : <p className="side-card-copy">No upcoming reminders. Saved times stay in this page and do not send notifications.</p>}
                {(state?.reminders ?? []).filter((reminder) => new Date(reminder.scheduledAt).getTime() <= clock).length > 0 && <p className="side-card-copy">A reminder is due above. Clear it after you’ve seen it.</p>}
              </section>

              <div className="simulation-note"><strong>Private by design</strong><span>Your demo data stays in a local JSON file on this computer.</span></div>
            </aside>
          </div>

          <footer className="page-footer"><span>TableReady</span><span>Thoughtful dinner planning, one local demo at a time.</span><a href="#mcp-trace">See the MCP calls ↑</a></footer>
        </main>
      </div>

      {dialog && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
        <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description" onKeyDown={handleDialogKeyDown}>
          <button type="button" className="dialog-close" aria-label="Close confirmation" onClick={closeDialog} disabled={busy}>×</button>
          <div className="dialog-mark" aria-hidden="true">{dialog.tool === "remove_shopping_item" || dialog.tool === "cancel_prep_reminder" ? "!" : dialog.tool === "set_prep_reminder" ? "◷" : dialog.tool === "mark_cooked" ? "✓" : "+"}</div>
          <p className="eyebrow">REVIEW THIS CHANGE</p>
          <h2 id="dialog-title">{dialog.label}?</h2>
          <p id="dialog-description" className="dialog-copy">{dialog.preview.summary}</p>
          {dialog.preview.items.length > 0 && <ul className="dialog-items">{dialog.preview.items.map((item) => <li key={item.name}><span>{item.name}</span><strong>{quantity(item.amount, item.unit)}</strong></li>)}</ul>}
          <p className="dialog-copy">Review the details above. Confirm to save this change in the local demo.</p>
          {actionError && <p className="dialog-error" role="alert">{actionError}</p>}
          <div className="dialog-actions"><button ref={firstDialogButton} className="button button-text" type="button" onClick={closeDialog} disabled={busy}>Not now</button><button className={dialog.tool === "remove_shopping_item" || dialog.tool === "cancel_prep_reminder" ? "button button-danger" : "button button-primary"} type="button" onClick={() => void confirmChange()} disabled={busy}>{busy ? "Saving..." : dialog.tool === "remove_shopping_item" ? "Remove item" : dialog.tool === "cancel_prep_reminder" ? "Cancel reminder" : "Confirm and save"}</button></div>
        </div>
      </div>}
    </div>
  );
}

export default App;
