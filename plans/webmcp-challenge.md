# WebMCP Challenge entry plan (OpenAI, Aug–Sept 2026)

Status: PLAN. Enter the OpenAI **WebMCP Challenge** with Wadi as an agent-native
home designer where a person and their agent **co-author a house together**.

- Challenge: <https://openai.com/webmcp-challenge/> · Devpost (rules + submit):
  <https://webmcp.devpost.com>
- Deadline (registration + submission): **2026-09-03, 1:00 pm PT**. Judging
  2026-09-04 → 2026-09-21. Winners ~2026-09-23.
- Prizes: top 10 each get $3,000 cash + 1yr ChatGPT Pro + Codex Micro keyboard +
  swag + partner prizes (Shopify, Chrome, Netlify, Cloudflare, Vercel, Render).

## 1. The rule that shapes the whole entry

> Pre-existing projects are evaluated **ONLY on work added during the Submission
> Period** (2026-08-25 → 2026-09-03), and must be "meaningfully extended using
> WebMCP" with **clear documentation distinguishing prior vs new work** (dated
> commit history).

Wadi already ships WebMCP (`wireWebMcpTools()` in `editor/src/viewer/main.ts`
registers tools via `document.modelContext.registerTool`, funnelling through
`window.wadi`). That prior work does **not** count. So the plan is: build a
**new WebMCP co-design capability** during the window, land every commit dated
2026-08-26 → 2026-09-03, and pitch on the human+agent angle. An 8-day window is
plenty. The challenge's first inspiration example ("3D Modeling — build and refine
3D models with your agent") is Wadi's exact pitch.

## 2. Decisions (owner)

- **Repo:** use the existing **public** repo `github.com/bijoor/wadi` as the
  submission's code repository (no carve-out).
- **License:** add an **MIT** `LICENSE` at the repo root, visible in the GitHub
  About section (satisfies the "open source, detectable license" requirement).
- **Judged new work:** a set of **co-design WebMCP tools** (below).

## 3. The pitch (description + video narrative)

Wadi lets you and your agent **co-author a house**. The agent proposes and makes
real design moves through WebMCP tools — add rooms, connect them, set the roof,
place furniture, change a variable — while you steer with the form-based studio
and watch the 3D + floor plans update live. **What was hard/impossible before:**
you can *converse a house into existence* and hand-tune the same live, parametric
model, with the agent respecting constraints a naive UI-clicking agent can't
(shared walls, doors-on-connections via C11, the grid, formulas). It maps onto the
challenge's "3D Modeling" example and the "humans + agents create together" theme.

## 4. Build — the new co-design WebMCP tools (the judged work)

New tools registered via `document.modelContext.registerTool` during the window,
each funnelling through the config store (`updateObject` / `insertObject` /
`updateVariables` / temporal undo) so **the human sees every agent change live and
can undo it**. Today only read/capture/load/layers/knob tools exist, so these are
genuinely new surface.

- **Read / orient:** `describe_house` (structured state: floors, rooms + sizes,
  connections, roof, variables), `list_rooms`, `list_variables`.
- **Mutate:** `add_room` (by name/floor + position or "next to X"), `edit_room`
  (rename / move / resize), `connect_rooms` (returns the C11 verdict: adjacent +
  door / open passage), `set_variable`, `set_roof`, `add_furniture`.
- **Shared control:** `undo` / `redo`, `capture_view` (reuse the existing 3D/plan
  capture so the agent can "look" at the result).

Design notes:
- Every tool routes through the SAME store mutations the studio UI uses, so a
  human edit and an agent edit are indistinguishable to the model and share one
  undo history. This is the crux of the "together" story.
- Tool descriptions + `inputSchema` written for an agent (clear names, enums for
  roof style / sides, units explained). Return concise structured results the
  agent can chain (e.g. `connect_rooms` returns why a connection isn't yet valid
  so the agent knows to add a door).
- Keep the new tools in a dedicated module (e.g. `editor/src/viewer/webmcpTools.ts`
  or an added section) so the diff is a clean, self-contained "new work" unit.

## 5. Repo + license actions

- [ ] Add MIT `LICENSE` (root) + set `license` in the relevant `package.json`s.
- [ ] Add `WEBMCP.md` at root: what WebMCP is here, the tool list, a
  `registerTool` snippet, and **how to test** (ChatGPT in-app browser / Chrome
  149+ flag).
- [ ] Add `WEBMCP-CHALLENGE.md` (or a section in WEBMCP.md): **prior vs new work**,
  linking the dated commits that add the co-design tools (all 2026-08-26+).
- [ ] **Scrub before relying on public + MIT:** confirm nothing sensitive is
  MIT-licensed by accident — the private Konkan reference sheets
  ([[project_house_designer_references]]), any third-party GLBs/assets, fonts, and
  that `scripts/.signing.env` stays gitignored. If the Konkan sheets are in-repo,
  exclude them from the license grant or remove them.

## 6. Submission deliverables (Devpost)

- [ ] **Register** on Devpost ("Join Hackathon"). Optional: request 3,000 free
  Netlify credits via their form **by 2026-09-01, 12pm PT**.
- [ ] **Live URL** testable in ChatGPT's in-app browser (WebMCP by default) or
  Chrome 149+ with `chrome://flags/#enable-webmcp-testing`. `wadi.house/app`
  already exposes tools — verify the NEW tools register + work there after deploy.
- [ ] **Public repo** with MIT license (About-visible) + the `registerTool` code +
  build/run instructions + prior/new-work doc.
- [ ] **Text description** covering the four required points: why WebMCP fits, how
  it improves UX, what people+agents can now do that was hard/impossible, how
  WebMCP was implemented.
- [ ] **Demo video < 3 min**, public on **YouTube**, audio explaining what was
  built + how WebMCP is used. Show the co-design loop: agent drafts a house →
  human drags a room / changes plot width → agent adds doors where C11 flags them
  → both watch the live 3D.
- [ ] **Submit** before **2026-09-03, 1pm PT** (submit a day early as buffer).

## 7. Timeline (8 days)

- **2026-08-26 → 27:** register; add MIT LICENSE + WEBMCP.md skeleton; verify
  WebMCP registration works in ChatGPT's in-app browser; build the first tools
  (`describe_house`, `add_room`, `connect_rooms`).
- **2026-08-28 → 29:** remaining tools (`edit_room`, `set_variable`, `set_roof`,
  `add_furniture`, `undo/redo`); polish schemas + descriptions.
- **2026-08-30 → 31:** human-agent UX (live "agent changed X" affordance, easy
  undo); deploy to wadi.house; test the full co-design loop in ChatGPT.
- **2026-09-01:** request Netlify credits (if wanted, deadline today); freeze
  features; write the description + prior/new-work doc.
- **2026-09-02:** record + edit the demo video; dry-run the judge experience end
  to end on the live URL.
- **2026-09-03 (buffer, submit early before 1pm PT).**

## 8. Eligibility note

India (owner's locale) is on OpenAI's supported-countries list and is **not** in
the rules' excluded set (Brazil, China, HK, Quebec, Russia, Crimea, Cuba, Iran,
NK, Syria, Venezuela, Donetsk/Luhansk), so it appears eligible. Confirm residency
in a supported country at registration (the entrant's representation).

## 9. Open questions / risks

- **WebMCP in the deployed Chrome context: CONFIRMED OK.** `wireWebMcpTools()`
  (`editor/src/viewer/main.ts:2599`, called in the bootstrap) is NOT gated to
  desktop/dev — it registers whenever `document.modelContext` / `navigator
  .modelContext` exists, so the live `wadi.house/app` surfaces the tools to a
  judge in ChatGPT's in-app browser or Chrome+flag automatically. New tools added
  to `buildWadiMcpTools()` register the same way. No origin-trial token strictly
  required for judging (a prod token in `viewer.html` would only help plain-Chrome
  users). NOTE: some mutate tools already exist as PRIOR work (`wadi_set_plot`,
  `wadi_choose_home`, …) — the judged NEW tools must be clearly additional
  (add_room / edit_room / connect_rooms / add_furniture / describe_house / undo).
- **Team vs individual:** entering as an individual is simplest; decide before
  registering.
- **Scope creep:** the 7 mutate tools are the MVP; anything beyond (multi-step
  agent macros, a "design review" tool) is a stretch goal only if time allows.
