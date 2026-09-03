# Wadi documentation

Wadi is a parametric home designer, and an example of an AI-native product: it is
designed to be operated with an AI coding assistant. You describe a house to the
assistant; the assistant writes the design in the Wadi Design Language (a `.wdl`
file); Wadi compiles it and renders a 3D model plus every 2D drawing, all kept in
sync. An architect can co-edit the same file, and a home-owner can personalize a
finished design through a set of controls. This folder covers what Wadi is, who it is
for, how to design with it, and how to extend it.

New here? Read [01, what Wadi is and why it is designed for AI](01-concept.md) first.
It covers the product, why it is built to be used with an AI assistant, the personas,
and the reason for the architecture, then points you to the next chapter.

## The chapters

Read in order for a full tour, or jump using the [reading paths](#reading-paths).

| # | Chapter | What it covers |
|---|---|---|
| 01 | [What Wadi is, and why it is designed for AI](01-concept.md) | The product, why the DSL exists so an AI assistant can author designs, what each persona does, and why the system is built to add object types at low cost. Start here. |
| 02 | [Personas](02-personas.md) | Who uses Wadi and how: AI coding assistant, architect, home-owner, developer. |
| 03 | [Authoring guide](03-authoring.md) | The step-by-step guide to writing a house in `.wdl`, from the first room to a parametric, configurable template. |
| 07 | [Using an AI coding assistant](07-ai-assistants.md) | Step-by-step setup: connect an assistant over MCP, install the desktop app, and run the co-edit loop. |
| 04 | [Components & libraries](04-components-and-libraries.md) | Reuse: define a part once and place it many times; share parts across files. |
| 05 | [Extending the DSL](05-extending-the-dsl.md) | Advanced. Add a new object type in about two files: the componentization framework and its kernel. |
| 06 | [The method](06-the-method.md) | Advanced. The general recipe for building a parametric DSL like this in another domain. |

## Reading paths

- Home-owner (personalize a ready-made home): you mostly use the app, not the docs.
  Skim [the concept](01-concept.md), then the Home-owner section of
  [personas](02-personas.md#home-owner).
- Architect (design and detail a building): [concept](01-concept.md), then
  [personas, Architect](02-personas.md#architect), then the full
  [authoring guide](03-authoring.md), then [components & libraries](04-components-and-libraries.md).
- Using an AI coding tool (have an agent write the design): [concept](01-concept.md),
  then the step-by-step [using an AI coding assistant](07-ai-assistants.md) (connect over
  MCP, install the desktop app, the co-edit loop), then let the agent read the
  [reference](#reference) below.
- Developer (add object types, or reuse the engine): [concept](01-concept.md), then
  [extending the DSL](05-extending-the-dsl.md), then [the method](06-the-method.md).

## Reference

These are the reference docs. They live under `wadi-skill/architect/reference/`
because the AI skill and MCP server load them too. They are the source of truth for
syntax and semantics.

- [`dsl.md`](../wadi-skill/architect/reference/dsl.md): the complete `.wdl` syntax
  reference (denser than the authoring guide).
- [`data-model.md`](../wadi-skill/architect/reference/data-model.md): the resolved
  model's schema (the compiled HouseConfig), field by field. It is generated from the
  code, so it does not drift.
- [`coordinate-system.md`](../wadi-skill/architect/reference/coordinate-system.md):
  axes, units, and the centreline convention.
- [`parametric-conventions.md`](../wadi-skill/architect/reference/parametric-conventions.md):
  the grid-first recipe for a reusable, resizable template.
- [`conventions.md`](../wadi-skill/architect/reference/conventions.md): the C1 through C25
  structural conventions the `check.sh` linter enforces.
- [`roof-v2-guide.md`](../wadi-skill/architect/reference/roof-v2-guide.md): roof
  semantics.

Examples: validated sample houses are in [`wadi-dsl/examples/`](../wadi-dsl/examples/).
Start with `minimal.wdl`, then `coastal.wdl` (grid-driven) and `complete.wdl` (every
construct at once).

Related READMEs: the root [`README.md`](../README.md) (running, building, and
deploying Wadi), [`wadi-dsl/README.md`](../wadi-dsl/README.md) (the grammar and
compiler internals), and [`wadi-mcp/README.md`](../wadi-mcp/README.md) (the MCP
server).
