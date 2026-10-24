import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { Request, Response } from "express";
import { builtClientExists } from "./store.js";
import { createTableReadyServer } from "./tools.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
if (!loopbackHosts.has(host) && process.env.ALLOW_REMOTE !== "1") {
  throw new Error("Remote binding is disabled. Set ALLOW_REMOTE=1 only when remote access is intentional.");
}

const app = createMcpExpressApp({ host });
const mcpHandler = toNodeHandler(createMcpHandler(() => createTableReadyServer()));
const allowedOrigins = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:3001",
]);
const projectRootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

app.use((_request: Request, response: Response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:");
  next();
});

app.use("/mcp", (request: Request, response: Response, next) => {
  const origin = request.get("Origin");
  if (origin && !allowedOrigins.has(origin)) {
    response.status(403).json({ error: "Origin is not allowed." });
    return;
  }
  next();
});

app.get("/healthz", (_request: Request, response: Response) => {
  response.json({ ok: true, service: "tableready-local-mcp" });
});

app.all("/mcp", (request: Request, response: Response) => {
  void mcpHandler(request, response, request.body).catch((error: unknown) => {
    if (!response.headersSent) {
      response.status(500).json({ error: "MCP request failed." });
    }
  });
});

const clientDirectory = resolve(projectRootDirectory, "dist", "client");
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
