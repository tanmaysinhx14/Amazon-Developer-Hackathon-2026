# TableReady submission checklist

## Project package

- [ ] GitHub repository contains all source code, original assets, and accurate setup/run instructions.
- [ ] Public repository has an open-source license visible on GitHub, or private repository access is granted to the reviewers listed in the current rules.
- [ ] Re-run npm test, npm run dev, and npm run data:reset after the review fixes; npm run build passed on October 23, 2026.
- [ ] Runtime state, environment files, credentials, and local configuration are not committed.
- [ ] Project description explains the household dinner-planning need, pantry matching, and all ten MCP tools.
- [ ] Selected primary track: Alexa+. Do not claim the AWS Builder or Open Source mini-challenge without separately meeting their requirements.
- [x] The project is described as a local Alexa+ simulation and self-hosted MCP demo. It does not claim Alexa+ connectivity, model use, or push notifications.
- [ ] README includes an MCP Inspector CLI command for tools/list against the local Streamable HTTP endpoint; verify the command with the current Inspector CLI.

## Demo video

- [ ] Public, English YouTube or Vimeo video; under 3 minutes (target 2:30).
- [ ] Show the app and a multi-step story: pantry match, recipe carousel, missing amounts, confirmation, shopping-list save, mark bought, cook and pantry deduction, reminder save/cancel, and the MCP trace.
- [ ] Say “Streamable HTTP”; show the browser's initialize, tools/list, and tools/call trace.
- [ ] Describe the confirmation accurately: the browser asks the person to approve; the one-use server token only binds the preview to the write.
- [ ] Show the MCP Inspector briefly with the local tools, pantry resource, or plan-tonight prompt. Keep the tour read-only.
- [ ] Explain the customer problem and why the flow helps a busy household.
- [ ] Avoid third-party footage, images, and music unless usage rights are clear.
- [ ] The October 22 freeze target has passed; review the updated code and video, then confirm the final Devpost deadline and timezone against the live rules.

## Product feedback

These notes are from implementation and local use. Setup time was not separately measured; no unobserved production or cloud behavior is claimed.

| Tool / API / SDK | What we used it for | What worked well | What needs work | Onboarding from zero to first success | Would we build with it again? Why? |
| --- | --- | --- | --- | --- | --- |
| MCP TypeScript client and server | Browser Streamable HTTP client, server tools, structured results | Initialize, discovery, typed outputs, resources, prompts, and the integration round trip work locally | Keep client/server examples aligned with protocol negotiation and outputSchema details; no blocker was isolated in this demo | Install the SDK, register one tool, connect a client, then add shared schemas and calls; exact elapsed time was not recorded | Yes; the typed protocol boundary and shared tooling support a real, inspectable integration |
| MCP Express integration | Express route for the Streamable HTTP MCP handler | Local endpoint works with the browser client and Inspector | The adapter composition spans the server and Node packages; a focused current example would make setup easier | The local Express server and /mcp route are documented and exercised; setup duration was not measured | Yes; it keeps the MCP route in the existing local web server |
| MCP Node integration | Adapt the MCP handler to Node's request and response objects | The adapted handler serves the same local route as Express | A concise example for Express 5 and current SDK versions would reduce wiring questions; no package defect was confirmed | Add the Node adapter after the handler works independently; setup duration was not measured | Yes; it provides a small bridge between SDK and Node HTTP |
| Express | Health route, static production app, and MCP endpoint | The local server cleanly hosts health, MCP, and built UI routes | No implementation issue was isolated during this run | The route setup is conventional and the health endpoint makes the server easy to check | Yes; it fits this self-hosted local demo |
| Node.js | TypeScript runtime, filesystem-backed local state, atomic rename | Built-in filesystem APIs were enough for isolated JSON persistence | The checkout targets Node 22 while this workspace ran Node 25.2.1; verify the pinned version in a clean submission environment | npm scripts take a clean install to build and run; elapsed time not measured | Yes; the local server and filesystem operations need no extra runtime service |
| npm | Dependency installation and project scripts | Install completed with zero reported vulnerabilities; scripts cover dev, build, test, start, and reset | Pinning the Node version matters because this workspace can run a newer major | npm install followed by npm run dev is the documented first local success | Yes; the workspace stays easy to reproduce |
| TypeScript | Strict browser, server, and shared schema typing | Strict build caught mismatched result shapes during implementation | Shared unions need explicit typed helpers at client/tool boundaries; no compiler issue remains | npm run build checks the source before the Vite bundle; elapsed time not measured | Yes; it surfaced shape mismatches before the browser flow ran |
| React | Browser UI, recipe carousel, conversation panel, and accessible confirmation | State changes and dialog flows remain in one browser app without adding a backend UI framework | Keep the number of local action states manageable as more intents are added | Vite serves the local UI; initial route connects to MCP and displays live data | Yes; it suits the small interaction-heavy demo |
| Vite | Development server, MCP proxy, and client production bundle | Fast local iteration and a same-origin MCP route worked in the demo | The production server must serve the built client separately; both run paths are documented | npm run dev starts the UI and MCP server; elapsed time not measured | Yes; local iteration and static client output are straightforward |
| Zod 4 | Shared tool input/output contracts and browser structuredContent validation | The same schemas check server output and browser responses | Keep exported inferred types beside the schema definitions to avoid duplicate contracts | Build one shared schema and use it at both tool and client boundaries | Yes; runtime validation complements TypeScript at the MCP boundary |
| Vitest | Recipe math, serialized storage writes, malformed JSON, token checks, and MCP integration | The existing suite has prior results in isolated temporary data directories; rerun after the review fixes | A browser-level smoke test for add, confirm, bought, and cooked is still missing | npm test runs the suite without changing the saved runtime state | Yes; it covers the server behavior that must stay deterministic |
| MCP Inspector | Independent CLI listing of local tools, resources, and prompts | A prior run connected to the local Streamable HTTP endpoint | Rerun the updated command against the current origin checks | Start the local server and run the README tools/list command; npx may download the CLI on first use | Yes; it gives reviewers a separate view of the MCP surface |

## Optional friction log

The development launch friction below was observed while bringing up this local prototype. Do not add hypothetical SDK or API issues.

| Task attempted | Steps taken | Expected result | Actual result | Severity | Workaround | Suggested improvement |
| --- | --- | --- | --- | --- | --- | --- |
| Start the MCP and Vite development processes together | Initially used tsx watch for the MCP process under concurrently; Vite and the browser opened | Both the MCP listener and Vite should start and stay available | Vite became ready, but the MCP listener did not start in that launch configuration in this environment | Medium | Changed the MCP script to run tsx src/server/index.ts directly; npm run dev then exposed both services | Document a tested cross-platform concurrently pattern for long-running TypeScript processes |

## Final review

- [ ] Confirm current event rules, deadline, and submission fields on Devpost immediately before submission.
- [ ] Confirm repository visibility and reviewer access before the deadline.
- [ ] Verify that any demo link is public and plays without login.
- [ ] Check the repository and video for credentials, local state, personal information, unlicensed assets, and unsupported claims.
- [ ] Do not claim the Open Source mini-challenge unless a separate eligible contribution is made and the current rules are met.
