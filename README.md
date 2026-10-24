# TableReady

TableReady is a local Alexa+ simulation for planning a quick vegetarian or vegan dinner from pantry ingredients. Its browser client makes real MCP Streamable HTTP requests to a self-hosted server. It does not connect to Alexa+, a model API, AWS, or a grocery service.

## Run locally

Use Node.js 22 and npm.

    npm install
    npm run dev

Open the local URL printed by Vite. The browser connects to the local MCP endpoint through Vite's same-origin proxy. The browser presents each change in a confirmation dialog before saving. A server-issued, one-use token binds the preview to the requested write; the token alone does not establish human approval for other MCP clients.

    npm run build
    npm test
    npm start
    npm run data:reset

npm start serves the built app and MCP endpoint on 127.0.0.1:3001. Runtime state is created under the repository's data/ directory and ignored by git; data/seed.json is the reset source. Set TABLEREADY_DATA_DIR to use another data directory. To bind beyond loopback, set both HOST and ALLOW_REMOTE=1; remote access is unauthenticated and intended only for a controlled environment.

## Inspect with MCP Inspector

While the server is running, open a second terminal to list its tools through the MCP Inspector CLI:

The current CLI requires Node.js 22.19.0 or newer. See the [official CLI guide](https://github.com/modelcontextprotocol/inspector/blob/main/clients/cli/README.md).

    npx -y @modelcontextprotocol/inspector --cli http://127.0.0.1:3001/mcp --transport http --method tools/list

The same command can list the pantry resource and planning prompt:

    npx -y @modelcontextprotocol/inspector --cli http://127.0.0.1:3001/mcp --transport http --method resources/list
    npx -y @modelcontextprotocol/inspector --cli http://127.0.0.1:3001/mcp --transport http --method prompts/list

The local server also exposes pantry://current and the plan-tonight prompt. A read-only demo tour can show Inspector's initialize handshake, tools, resource, and prompt tabs. The browser app already displays its actual MCP request trace.

## Workspace guide

- [docs/BUILD_SPEC.md](docs/BUILD_SPEC.md) — product flow, MCP contracts, technical decisions, and acceptance checks.
- [docs/SUBMISSION_CHECKLIST.md](docs/SUBMISSION_CHECKLIST.md) — repository, demo, feedback, and observed friction notes.
- [docs/EVENT_INSIGHTS.md](docs/EVENT_INSIGHTS.md) — event requirements and dated source links.
- [docs/PLAN.md](docs/PLAN.md) — original workspace plan.
- [references/devpost/](references/devpost/) — copied event source material.
- src/client/, src/server/, src/shared/ — browser UI, Express/MCP server, and shared types and schemas.
- data/ — committed seed and ignored local runtime state.
- tests/ — Vitest recipe, storage, and MCP integration coverage.
- public/ — original static assets.

The app is not an Alexa+ connection and does not send notifications. See the build specification for the full scope.

## Built with

Node.js 22, npm, TypeScript, React, Vite, Express, Zod 4, Vitest, MCP Inspector for local integration checks, and the official MCP TypeScript SDK packages: @modelcontextprotocol/client, @modelcontextprotocol/server, @modelcontextprotocol/express, and @modelcontextprotocol/node. The browser client is restricted to MCP protocol version 2025-11-25 for a visible initialization and tool-call trace.
