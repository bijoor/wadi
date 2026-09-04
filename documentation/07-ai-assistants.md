# Using an AI coding assistant

Wadi is built to be operated with an AI coding assistant. A house is a `.wdl` file (the
Wadi Design Language): plain text with a grammar and a compiler, so an assistant can
author and revise it while you steer and watch the model rebuild. You describe the house
in words; the assistant writes and checks the `.wdl`; the Wadi editor renders it live
beside you.

This page is the step-by-step setup. For the "who and why" see
[personas](02-personas.md#ai-coding-assistant); for the language itself, the
[authoring guide](03-authoring.md).

## What you need

1. **An AI coding assistant that supports MCP** — Claude Code, Claude Desktop, Cursor,
   Windsurf, or any MCP client.
2. **Node.js 20 or newer** — so `npx` can run the Wadi MCP server on demand.
3. **The Wadi editor, to see your house.** Two choices:
   - **The desktop app (recommended for this workflow).** It watches your `.wdl` file on
     disk, so when the assistant edits the file the 3-D model updates automatically, and
     it lets the assistant show you the live 3-D view. **You must download and install it
     first** — this is the step people miss.
   - The **browser editor**, the WDL tab in the app at <https://wadi.house/app> (no
     install). Good for editing and a live preview, but it cannot watch a file the
     assistant edits on disk, and the assistant's live-3-D tools do not reach it.

> **Download the desktop app** from the **"Prefer a desktop app?"** section on
> <https://wadi.house>, or directly from the releases page:
> <https://github.com/bijoor/wadi/releases> (macOS `.dmg`, Linux `.deb`; Windows
> coming soon). Install it
> and open it once before you start. Without it, the assistant can still check and draw
> 2-D previews, but you will not get the live 3-D model that updates as it works.

## Step by step

1. **Install and open the desktop app** (see the box above). This is the window where
   your house appears and updates.

2. **Connect the assistant to Wadi (the MCP server).** In **Claude Code**:

   ```bash
   claude mcp add wadi -- npx -y wadi-mcp
   ```

   In **any other MCP client** (Cursor, Windsurf, Claude Desktop, ...), add this to the
   client's MCP config, then restart it:

   ```json
   { "mcpServers": { "wadi": { "command": "npx", "args": ["-y", "wadi-mcp"] } } }
   ```

   Nothing to build or clone: `npx` fetches the server on first run.

3. **Check the connection.** Ask the assistant something like *"list the Wadi examples"*
   or *"check this Wadi house"* with a tiny snippet. If it can call `wadi_examples` or
   `wadi_check`, you are connected.

4. **Start a house and open it in the app.** Ask the assistant to create the design (for
   example *"make a 2-bed single-storey cottage, hip roof, about 900 sq ft"*). It writes
   a `.wdl` file and tells you the path. **Open that file in the desktop app** (File menu,
   or drag it in) so the app watches it. From now on, every time the assistant saves, the
   model rebuilds in the app.

5. **Let it check and preview its own work.** After each edit the assistant runs
   `wadi_check` (errors must be fixed; warnings are advisory) and reads a preview image
   (`wadi_preview`, or `wadi_capture_3d` for a real 3-D shot from the app).

6. **Steer with plain language.** *"Widen the kitchen", "add a verandah on the south",
   "move the stairs to the north wall."* Keep the changes small and checkable; the app
   updates as the file is saved.

## The tools the assistant uses

You do not call these; the assistant does, once connected.

| Tool | What it does |
|---|---|
| `wadi_check` | Compile + validate the `.wdl`: parse, resolve formulas/grids, schema + wall/roof geometry, and the structural conventions (C1 through C25 + per-primitive rules). Run after every edit. |
| `wadi_preview` | Render floor plans, elevations, and the roof to PNG images the assistant reads. |
| `wadi_scope` | Resolve the design's variables, points, and grid lines to their actual values. |
| `wadi_examples` | List or fetch a validated example `.wdl` to copy from. |
| `wadi_reference` | The embedded reference docs (syntax, data model, conventions, coordinates, roof). |
| `wadi_modules` / `wadi_module` | Discover and load importable component and furniture libraries. |
| `wadi_view_3d` / `wadi_capture_3d` | With the desktop app open, load the design into the live 3-D view, or return a real 3-D image (a chosen camera angle, or a first-person interior). |

The last two need the desktop app running; the rest work on their own.

**Reusing your own components.** To reuse a `component` across designs, author it as a
sibling module file: put `component Name { … }` in a `.wdl` next to the main file (or in
a `modules/` subfolder) and `import "name"` it. The desktop app auto-loads those sibling
files on open and saves them inside the `.wadi`, so the design stays self-contained. (An
in-browser agent instead registers modules with the WebMCP `wadi_add_module` tool.) See
[components & libraries](04-components-and-libraries.md).

## Alternative: an agent working inside the repo (no MCP)

If your assistant is a coding agent with the Wadi repository checked out, it can use the
built-in skill instead of the MCP server:

- **Claude Code** discovers it from `.claude/skills/` in the repo. Ask naturally, or run
  `/wadi-architect`. It creates the `.wdl`, tells you the path, and runs `check.sh` after
  every edit.
- **AGENTS.md-aware agents** (Cursor, Google Antigravity, and others) read the repo-root
  `AGENTS.md`, which routes to the same skill.

Both you and the agent can verify with the same two scripts the app uses:

```bash
wadi-skill/architect/scripts/check.sh   <ABS_PATH_TO.wdl>   # parse + resolve + schema/geometry + conventions
wadi-skill/architect/scripts/preview.sh <ABS_PATH_TO.wdl>   # render plans/elevations/roof to PNGs
```

## Tips

- Ask the assistant to read `wadi_reference('guide')` once at the start so it follows the
  intended workflow.
- Insist on `wadi_check` after every edit.
- Prefer small, verifiable changes over one big redesign.
- If the model is not updating as the assistant works, confirm the **desktop app** is open
  **on that same `.wdl` file** — that live link is the piece most people miss.
