import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { Request, Response } from "express";
import { builtClientExists } from "./store.js";
import { createTableReadyServer } from "./tools.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";
const app = createMcpExpressApp({ host });
const mcpHandler = toNodeHandler(createMcpHandler(() => createTableReadyServer()));

app.get("/healthz", (_request: Request, response: Response) => {
  response.json({ ok: true, service: "tableready-local-mcp" });
});

app.all("/mcp", (request: Request, response: Response) => {
  void mcpHandler(request, response, request.body).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown MCP server error";
    if (!response.headersSent) {
      response.status(500).json({ error: "MCP request failed", message });
    }
  });
});

const clientDirectory = resolve(process.cwd(), "dist", "client");
if (await builtClientExists()) {
  app.use((await import("express")).default.static(clientDirectory));
  app.get(/.*/, (request: Request, response: Response, next) => {
    if (request.method !== "GET" || request.path.startsWith("/mcp") || request.path.startsWith("/healthz")) {
      next();
      return;
    }
    response.sendFile(join(clientDirectory, "index.html"));
  });
}

app.listen(port, host, () => {
  process.stdout.write(`TableReady MCP server listening at http://${host}:${port}/mcp\n`);
  if (existsSync(join(clientDirectory, "index.html"))) {
    process.stdout.write(`Built app available at http://${host}:${port}/\n`);
  }
});
