# Organize the Workspace and Prepare Claude to Build TableReady

## Summary

The workspace currently has six copied Devpost documents and no app code, package files, or Claude instructions. Move the originals into a reference folder unchanged, then add a concise workspace index, event research notes, a decision-complete build specification, a submission checklist, and a short `CLAUDE.md` that sends Claude straight to implementation.

Keep the previous direction: **Alexa+ track, household productivity category, TableReady dinner planner**. The Alexa+ path fits the time available and can be demonstrated locally with a real Streamable HTTP MCP client. Devpost says the Alexa+ partner tools are unavailable to participants, while a web page making actual `initialize`, `tools/list`, and `tools/call` requests is accepted. ([Devpost FAQ](https://amazonappdev2026.devpost.com/details/faqs), [Hackathon overview](https://amazonappdev2026.devpost.com/))

## Workspace Layout

Move the six source files without editing their contents:

```text
references/devpost/
  faqs.md
  judging_criteria.md
  overview.md
  resources.md
  rules.md
  tips.md

docs/
  EVENT_INSIGHTS.md
  BUILD_SPEC.md
  SUBMISSION_CHECKLIST.md

README.md
CLAUDE.md
```

`README.md` should explain the folder layout and link to the build spec. `CLAUDE.md` should be a brief execution guide: read the build spec and checklist, follow their decisions, implement immediately, avoid asking about choices already settled, and do not publish or deploy externally.

## Build Specification

`docs/BUILD_SPEC.md` should settle product and engineering decisions for Claude:

- **Product and demo:** TableReady helps a busy household plan a vegetarian dinner for two in 25 minutes from pantry items, see missing ingredients, and optionally add them to a shopping list and set a reminder. Use one guided scenario, with seeded demo data and a visible MCP call trace.
- **Interaction rules:** Confirm before persistent changes. Show empty results, invalid inputs, and connection errors clearly. Label the experience as a local Alexa+ simulation; do not imply it connects to Alexa+ or uses a generative model.
- **Stack:** Node.js 22, npm, TypeScript, React, Vite, Express, and the official MCP TypeScript SDK. Serve the local app and `/mcp` through the same origin, using a Vite development proxy. Persist demo state in local JSON files with a reset command.
- **MCP protocol:** Implement Streamable HTTP at `/mcp`; expose `get_pantry`, `find_recipes`, `add_to_shopping_list`, and `set_prep_reminder`. Use typed input schemas. Pin the browser client to the 2025-11-25 protocol so reviewers can observe the expected initialization and tool calls. The official SDK documents browser-capable clients and Express server adapters. ([MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk), [Express adapter](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/packages/middleware/express/README.md))
- **Scope limits:** No AWS services, model API keys, voice input, external grocery integrations, or cloud deployment. Do not claim eligibility for either mini challenge: the AWS credit codes are reported exhausted, and Open Source requires a separate project or contribution. ([Devpost resources](https://amazonappdev2026.devpost.com/resources))
- **Build sequence:** Scaffold the app and seeded data; implement and verify MCP tools; build the guided UI and confirmation flow; add persistence and reset; finish setup documentation and submission assets.

## Event Insights and Submission

`docs/EVENT_INSIGHTS.md` should summarize the tracks, mini challenges, judging criteria, eligibility and team rules, prize structure, submission requirements, and material caveats. Preserve source links and mark the date checked. Call out that the official rules take precedence over conflicting event copy; the credit-request window in older text conflicts with the later notice that codes ran out October 7. Keep the complete original references available under `references/devpost/`.

`docs/SUBMISSION_CHECKLIST.md` should cover the required GitHub repository and license or private-repo reviewer access, setup/run instructions, project description, selected track, and product feedback for every tool, API, or SDK used. Include a factual friction-log template: task, steps, expected versus actual result, severity, workaround, and suggested improvement. Friction logs are optional and can earn a judging bonus of up to 10%. The demo must be public, in English, on YouTube or Vimeo, and under three minutes; target 2:30. ([Hackathon requirements](https://amazonappdev2026.devpost.com/))

## Acceptance Criteria and Defaults

- All six raw reference files are present under `references/devpost/` with their contents preserved.
- The new documents agree on the chosen product, track, MCP version, stack, demo path, and scope limits.
- Claude’s build spec includes the tool contracts, user flow, failure cases, implementation sequence, and runnable acceptance checks so the implementation does not depend on routine follow-up decisions.
- Reserve October 22 for code and video freeze. The official close is **October 23, 2026 at 12:00 p.m. PDT** (**October 24 at 12:30 a.m. IST**). ([Hackathon deadline](https://amazonappdev2026.devpost.com/))
- Default to a public GitHub repo with an MIT license, but do not create a remote, publish, or submit without a separate instruction.
