# Who uses the Wadi DSL

> Part of the [Wadi documentation](README.md). Read the [concept](01-concept.md)
> first. This chapter describes who works with Wadi and how, so you can go to the
> chapter that fits you.

Wadi is designed to be used with an AI assistant. The primary way to create a design
is an architect working with an AI coding assistant in the design language: the
assistant writes the `.wdl` file, and the architect steers the work and co-edits the
file. Around that, a home-owner personalizes finished designs, and a developer extends
the system. The `.wdl` and `.wadi` model is the format they all share.

| Persona | Role | Works in | Touches the DSL? |
|---|---|---|---|
| AI coding assistant | writes the design from a brief | any coding agent | yes; authors the `.wdl` |
| Architect | describes the building and co-edits | a chat or the DSL editor | yes; co-authors `.wdl` |
| Home-owner | personalizes a finished design | the app (browser or phone) | no; adjusts controls |
| Developer | extends Wadi or reuses the engine | the codebase | builds the language |

## Architect

The architect designs and details the building. The primary method is to work with an
AI assistant: describe the house, let the assistant write the `.wdl`, review the
rendered result, and refine it in conversation. The architect also edits the file
directly once familiar with the syntax. The next section covers the AI setup.

The architect can also work by hand, in two places. Both drive the same model.

1. In the DSL editor, writing `.wdl` directly (browser: <https://wadi.house/dsl>;
   desktop: press ⌘⇧D). It is an editor for the language, with completion, hover,
   go-to-definition, rename, and a live preview pane. This is where you define the
   house on a structural grid with formulas so it stays valid when the plot is
   resized, then expose a configurator. The result is a reusable template for the
   owner gallery.

2. On the desktop, editing a file. The Wadi desktop app watches a `.wadi` file on
   disk, so you can edit it in any tool and see the 3D model update within about a
   second.

The step-by-step guide to writing `.wdl` is the [authoring guide](03-authoring.md).
Reuse across a project (components and libraries) is
[components & libraries](04-components-and-libraries.md).

The architect-to-owner handoff: the architect ships a parametric template with a
configurator; the owner opens it and adjusts the controls. Same file, two audiences.

## AI coding assistant

A `.wdl` file is text with a grammar and a compiler, so an AI coding assistant can
author the design. You describe a house in plain language and the assistant writes and
revises the `.wdl` while Wadi renders it. This is the method Wadi is built around.

The `.wdl` is one file that you and the assistant both edit. The assistant writes the
language, not raw `.wadi` JSON, because the editor does that conversion, and the
language expresses formulas, grids, and the configurator directly while its grammar
catches structural mistakes.

The work starts one of two ways:

- Brief to house. You describe the house ("a 3-bed L-shaped bungalow, hip roof, about
  1500 sq ft"). The assistant drafts a `.wdl`, checks it, and you steer with
  follow-ups.
- Drawings to house. You give the assistant a sketch or photo of a plan; it recreates
  it as a `.wdl` and asks about anything ambiguous.

The loop: keep the `.wdl` open in the DSL editor (browser or desktop). The assistant
edits and saves; the model rebuilds in the pane beside you; you respond in chat; the
assistant patches. Small, checkable steps.

The assistant does not only write the design, it verifies it. Verification has two
parts today. Automated checks (`check.sh`, or `wadi_check` over MCP) parse the `.wdl`,
resolve its formulas, validate the schema, check the wall and roof geometry, and apply
the structural conventions, then report what failed. Visual inspection: the assistant
renders the design to images (`preview.sh` or `wadi_preview`) and reads them to judge
whether it matches the brief. Most functional testing today is visual. Planned work
adds explicit functional tests for common patterns, for example furniture placed too
close to a door, a room with no path to the main entrance, or a staircase overlapping a
door or window. As those are added, more of the checking becomes automatic.

### Two ways to give an assistant the skill

The instructions, the data model, the reference docs, and the check/preview tooling
are packaged as an agent-neutral skill (`wadi-skill/architect/`): plain instructions,
docs, and scripts, usable by any coding agent. There are two delivery paths.

With the repo checked out, thin per-agent adapters point at the skill:

- Claude Code discovers it from `.claude/skills/` when run inside the repo. Ask
  naturally, or invoke `/wadi-architect`. It creates the `.wdl`, tells you the path,
  and runs `check.sh` after every edit.
- Google Antigravity, Cursor, and other `AGENTS.md`-aware agents read the repo-root
  `AGENTS.md`, which routes to the same skill.

Both the assistant and you can verify with two scripts that reuse the app's own
generators, so they match it byte for byte:

```bash
# parse + resolve + schema/geometry + structural conventions (writes no .wadi)
wadi-skill/architect/scripts/check.sh   <ABS_PATH_TO.wdl>
# render floor plans, elevations, and roof to PNGs the assistant can read
wadi-skill/architect/scripts/preview.sh <ABS_PATH_TO.wdl>
```

Without a repo, over MCP. `wadi-mcp` is an MCP server that bundles the whole pipeline
(DSL compiler, schema, geometry, conventions, 2D renderers) and the examples and
reference docs into one self-contained file. It is published to npm, so there is
nothing to build or clone; `npx` fetches it on first run.

Install it in Claude Code:

```bash
claude mcp add wadi -- npx -y wadi-mcp
```

For any other MCP client (Cursor, Windsurf, Claude Desktop), add the same command and
args to the client's MCP config:

```json
{ "mcpServers": { "wadi": { "command": "npx", "args": ["-y", "wadi-mcp"] } } }
```

To run a local build instead of the npm package, build it once (`cd wadi-mcp && npm
install && npm run build`) and point the client at the bundle by path:

```json
{ "mcpServers": { "wadi": { "command": "node", "args": ["/abs/path/to/wadi-mcp/dist/server.mjs"] } } }
```

Once registered, the server exposes these tools:

| Tool | Does |
|---|---|
| `wadi_check` | parse + resolve + schema/geometry + structural conventions |
| `wadi_preview` | render plans, elevations, and roof to PNG images the assistant reads |
| `wadi_examples` | the embedded `examples/*.wdl` |
| `wadi_reference` | the embedded reference docs (syntax, data model, conventions) |
| `wadi_modules` / `wadi_module` | discover importable component and furniture libraries |
| `wadi_view_3d` / `wadi_capture_3d` | with the desktop app open, load a design into the live 3D view, or return a 3D image |

No clone and no local build are needed. The live 3D preview still comes from the DSL
editor if you want it.

In both paths the assistant authors `.wdl` using the references and examples, and
verifies with check and preview. See `README.md` (the section on the AI architect
skill) and `wadi-mcp/README.md` for setup detail.

## Home-owner

The home-owner does not see the language. They see a home and a set of controls.

Everything runs in the browser. There is nothing to install, and it works on a phone.

1. Open the app at <https://wadi.house/app> (Home-owner view).
2. Choose a home. Browse a gallery of ready-made designs, such as Konkan cottages and
   family homes, each with 3D previews and a floor plan. Pick the closest one.
3. Adjust it. A set of controls (plot size, roof style, room options) reshapes the
   house, and the 3D model updates as you change them. Orbit, zoom, and look around.
4. See the plans. Switch to the floor-plan view for room sizes and layout.
5. Share it. The Share button copies a link that contains the whole design. Send it to
   family or an architect and they see what you see. No account, nothing uploaded.

Those controls are the configurator that an architect built into the template: a set
of labelled sliders, toggles, and selects, each bounded so the house stays valid.
Adjusting a control changes a number, and the parametric model re-flows around it. The
underlying template is a parametric `.wdl` / `.wadi` design; the owner is driving the
[configurator](03-authoring.md#13-the-configurator) that an architect exposed.

## Developer

The developer extends Wadi itself: adds a new kind of object, improves a renderer, or
reuses the engine for a different domain.

- Run and build locally. All app code is under `editor/`. Use `npm --prefix editor run
  dev` for a hot-reload dev server, `npm --prefix editor test` for the tests, and `npm
  --prefix editor run build` to produce the deployed bundles. The desktop app is Tauri
  (`src-tauri/`). See the root `README.md`, section "Run & develop locally".
- Add a new object type. A wall, a beam, and a spiral staircase are each declared once
  and projected onto the schema, forms, docs, and DSL. Adding one is about two files.
  This is [extending the DSL](05-extending-the-dsl.md).
- Reuse the engine for another domain. The projection machinery and parametric layer
  do not refer to houses. The recipe for retargeting is [the method](06-the-method.md).

Next: the [authoring guide](03-authoring.md), which covers writing a house in `.wdl`
from the first room to a parametric, configurable template.
