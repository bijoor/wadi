# What Wadi is, and why it is designed for AI

> Part of the [Wadi documentation](README.md). This is the first chapter. It covers
> what Wadi is, why it is built to be used with an AI assistant, and why that shapes
> the architecture. No prior knowledge is assumed.

## What Wadi is

Wadi is a parametric home designer. It is also an example of an AI-native product: it
is designed to be operated with an AI coding assistant, not only through a user
interface.

You describe a house to an AI assistant in plain language. The assistant writes the
design in Wadi's design language, a text format saved as a `.wdl` file. Wadi compiles
that file and renders it live: a 3D model together with dimensioned floor plans,
elevations, roof details, and a wall-area estimate. You review the result and refine
it by continuing the conversation. Every output is generated from the same `.wdl`
file, so one change to the design updates all of them.

A domain expert (an architect) can read and edit the `.wdl` directly once familiar
with the syntax, and co-edit it alongside the assistant. A home-owner can take a
finished design and personalize it through a set of controls, without reading the
language at all.

It runs in the browser and on the desktop.

## Why Wadi uses a design language

The reason Wadi has its own language is to let an AI author designs.

An AI coding assistant is good at writing text that follows a grammar. Wadi's design
language is text with a formal grammar and a compiler that reports errors by line and
column. So an assistant can write a design, run the checker, read the errors, and
correct them, the same way it writes and fixes code. Describing a house becomes a
conversation: you state what you want, the assistant writes the `.wdl`, Wadi renders
it, and you both refine it.

The same file is readable by a person. An architect who learns the syntax can edit it
directly, review what the assistant wrote, and change it. The language is the shared
artifact: the assistant and the expert edit the same file.

This is what "AI-native" means here. The primary way to create and change a design is
through an assistant working in the language. An owner configurator (a set of declared
knobs) lets a home-owner adjust the parameters an author exposed, but the product is
built around the language, all authoring happens in it, and the language is built for
an AI to write.

The language also gives a design three properties a picture or a raw data file cannot:

- Version control. A `.wdl` file goes in git, so you can see what changed between two
  revisions. Floor-plan images cannot be diffed this way.
- Parametric templates. Variables, a structural grid, and formulas let the house
  re-flow when one number changes, so a design can be a resizable template rather than
  a one-off.
- Bounded personalization. An architect can expose a configurator over the parametric
  model, so a home-owner adjusts a design within set limits and never edits geometry.

## Writing and checking designs

An assistant that writes a design also needs to know whether the design is correct.
Wadi gives it a way to check, so the loop is write, check, fix, not just write. This is
the QA side of the product, and it is as important as the language itself.

There are two kinds of check today:

- Automated checks. One command parses the `.wdl`, resolves its formulas, validates it
  against the schema, checks the wall and roof geometry, and applies a set of
  structural conventions (for example: a floor with no slab must declare it, a room
  must wall its exterior sides, openings must not overlap). The assistant reads the
  result and fixes what failed. Because the check reuses the app's own code, it reports
  exactly what the app would.
- Visual inspection. The assistant renders the design to images (floor plans,
  elevations, 3D) and reads them back, so it can judge whether the result matches the
  brief.

Most of the functional testing today is visual: the assistant looks at the rendered
design. Planned work adds explicit functional tests for common design rules, checked
automatically, for example: furniture is not placed too close to a door, every room
has a path to the main entrance, and a staircase does not overlap a door or window. As
these are added, more of the checking becomes automatic rather than visual.

So the assistant can write designs that are syntactically correct, and verify that they
function. The set of things it can verify grows over time.

## What each persona does

Wadi serves four kinds of user. This is what each one does; the
[personas chapter](02-personas.md) covers how in detail.

| Persona | What they do |
|---|---|
| AI coding assistant | Write and revise the `.wdl` design from a written brief or a sketch, then check and preview it. The primary author. |
| Architect | Describe a building to the assistant and co-edit the `.wdl` it writes, or edit by hand. Make the design parametric (a grid with formulas) and expose a configurator so an owner can adjust it. |
| Home-owner | Pick a finished design and adjust a few controls (plot size, roof style, room options). No language and no AI needed. |
| Developer | Add new kinds of building elements, and apply the same engine to other domains. |

## Why Wadi is built to extend

For an AI-native product, the reference material the assistant writes against matters
as much as the language. If the schema, the documentation, and the grammar are
maintained separately, they drift apart, and an assistant writing against out-of-date
material produces invalid designs.

Wadi avoids this. Each object type is declared once, by listing its fields. From that
one declaration, Wadi generates the schema, the documentation, and the syntax in the
design language (plus an internal form spec). These stay consistent because they come
from one source (a test checks this on every change). So the material an assistant reads is
always current, and adding a new object type is about two files rather than edits
spread across five subsystems. As the set of object types grows, the range of designs
an assistant can author grows with it.

The generation machinery does not refer to houses. It can be applied to a different
domain: a solar-farm layout, an interiors tool, a factory floor, a PCB. The AI-native
pattern, a domain expressed as a language an assistant can write, is reusable. The
home designer is the first application of it, not the only possible one.

Two later chapters cover these two activities: [extending the DSL](05-extending-the-dsl.md)
(adding a type) and [the method](06-the-method.md) (applying the engine to another
domain).

## How it works: `.wdl` and `.wadi`

A `.wdl` file is the design. Here is a complete one:

```wdl
house MyFirstHouse {
  convention center
  units feet_inches per_unit 10
  site { plot (300, 300) }
  defaults { floor_height 116 wall_height 108 slab_thickness 8 wall_thickness 8 }

  floor 1 "Ground" {
    room Living at (0, 0) size (240, 200) {
      wall north east south west
    }
  }
}
```

That is a valid house: one 24 ft by 20 ft room, walled on all four sides, on one
floor. It reads like a description a person would write, and an assistant can produce
it from a sentence.

There are two file types:

| | `.wdl`, the language | `.wadi`, the bundle |
|---|---|---|
| What it is | the source an assistant or a person writes | a shareable file that packages the `.wdl` source with its preview images and a small manifest (a zip under the hood) |
| Who writes it | the AI assistant, or an architect | the app, when you save or publish |
| Used for | authoring, diffing, formulas, reuse | sharing a finished design, or publishing it as a template |

The relationship is compile-and-render:

```
   authored             compiler              renderer
   ----------      -------------------      -----------------------------
   house.wdl   -->   parse -> resolve   -->   3D model
   (the DSL)         formulas -> a model      floor plans (per floor)
                     (held in memory)         elevations (front/back/left/right)
                                              roof drawings
                                              quantities (wall areas)
                                              a read-only graph view
```

The Wadi editor compiles the `.wdl` to a model and renders every output from that
model, live. Saving or publishing packages the design as a `.wadi` bundle (the `.wdl`
source plus its preview images), and opening a `.wadi` unpacks it back to editable
`.wdl`, so the two directions round-trip. Older `.wadi` files were a single JSON
document and still open.

The compile step and the extension model are the same mechanism seen from two sides. A
type is declared once by its fields. From that declaration, Wadi generates the schema,
the documentation, and the language syntax (plus an internal form spec). That is what
lets a `.wdl` file render as a full house, and it is what makes adding a new type about
two files.

## The app

The Wadi app runs in the browser (<https://wadi.house/app>) and as a desktop app. It is
one surface, built around the design language: a WDL code editor, the owner configurator
(the declared knobs an author exposes), layer toggles, and live 3D and 2D views that
update as the design changes. There are no separate editing modes and no form-based
editor; a read-only graph view shows the model's structure. Who works where is covered
in [personas](02-personas.md).

## Where to go from here

Everything in this folder supports one of two activities:

1. Author houses with the language. See who does what in
   [personas](02-personas.md), then the hands-on [authoring guide](03-authoring.md)
   and [components & libraries](04-components-and-libraries.md).

2. Extend the language. Add new object types in
   [extending the DSL](05-extending-the-dsl.md), or apply the engine to another
   domain in [the method](06-the-method.md).

Most readers want the first. Continue to [personas](02-personas.md).

## Where things live

| Path | What it is |
|---|---|
| `wadi-dsl/` | the DSL: grammar, compiler, decompiler, and the language services (LSP) the app's WDL editor uses |
| `wadi-dsl/examples/*.wdl` | validated sample houses (start with `minimal.wdl`) |
| `editor/` | the app: the 3D and 2D renderer, the app UI (WDL editor, configurator, 3D/2D views), and the model schema |
| `wadi-skill/architect/` | the agent-neutral AI skill (instructions, references, scripts) |
| `wadi-mcp/` | the MCP server: the skill's tooling, runnable without the repo |
| `documentation/` | this folder |
