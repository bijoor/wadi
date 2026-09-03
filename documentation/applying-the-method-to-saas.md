# Applying the Wadi method: making SaaS platform capabilities agent-usable over MCP

A playbook for architects. Wadi turned a hard, expert domain (parametric house
design) into something an AI agent can operate reliably through an MCP server. The
same method applies to a B2B SaaS platform: take the customer's existing capabilities
and expose them so an agent can use them safely and correctly. This document explains
the mental model, when it applies, and the step-by-step.

Audience: our architects working with SaaS product customers. The customer already has
a platform with capabilities (APIs, workflows, configuration). The goal is to let AI
agents drive those capabilities on behalf of the customer's users.

## The core idea (the mental model to sell)

The obvious approach is to wrap each API endpoint as an MCP tool and hope the agent
orchestrates them. This mostly fails on real workflows. Agents flail when they have to
call many imperative endpoints in the right order, hold partial state in their head,
and discover errors only after side effects have happened.

Wadi does something different, and this is the transferable insight:

> Give the agent a **domain model**, a **declarative artifact to author** in that
> model, a **compiler** that turns the artifact into validated actions, and tight
> **check / preview / reference** feedback loops. The agent authors desired-state,
> checks it cheaply, previews the result without committing, iterates, and only then
> applies. That loop is what makes an agent reliable in a complex domain.

In Wadi terms: the agent writes a `.wdl` file (desired state), runs `wadi_check`
(validate), reads `wadi_preview` (see it), fixes what is wrong, and repeats. It is not
calling "add wall", "add window", "recompute roof" as 40 imperative tools.

The transferable pattern, end to end:

```
Domain model  →  Authoring surface  →  Compiler/planner  →  Feedback loop  →  MCP server  →  Agent skill
 (schema)         (spec or DSL)         (plan, not apply)    (check/preview/ref)  (self-contained)  (the loop)
                                                                                        ↕
                                                                                 Human co-edit + approval
```

## When to apply it (qualify first)

This is a spectrum, not one size. Place each use case on it deliberately.

- **A single simple action** (create a ticket, look up a record): just expose an MCP
  tool. No model, no DSL. Do not over-engineer.
- **A composable, multi-step, review-worthy workflow** (design a customer journey,
  build a pricing plan, configure a data pipeline, author an access policy): this is
  where the Wadi method pays off.

Good-fit signals:

- The domain has **composable objects** that combine (steps, rules, segments, nodes).
- **Desired-state is meaningful**: the customer can describe "what they want" and the
  platform can realize it.
- **Mistakes are costly or hard to reverse**, so cheap validation and preview matter.
- Today the work is **manual and expert-driven**, and the customer wants to scale it.
- Humans will want to **review and co-edit** what the agent produced.

Poor-fit signals: one-shot CRUD, read-only lookups, or anything where a plain tool call
is already reliable.

## The steps

### Step 0 — Qualify the use case

Pick one high-value workflow that scores well on the signals above. Resist starting
with the whole platform. Wadi started as one thing (a house model) and grew coverage
later; a SaaS engagement should start as one artifact and one loop.

### Step 1 — Find the artifact (the domain model)

Identify the central thing the agent will author or edit: the customer's equivalent of
Wadi's `HouseConfig`. It is almost always a **desired-state description** of a
workflow, configuration, or plan. Examples by SaaS category:

| SaaS category | The "artifact" the agent authors |
|---|---|
| Marketing automation | a campaign / journey spec (triggers, steps, audiences, content) |
| CRM / sales | a workflow / automation / segment definition |
| Analytics / BI | a dashboard / metric / pipeline spec |
| Billing / fintech | a pricing plan / rule set / entitlement config |
| Support / ITSM | a routing / SLA / macro policy |
| Data platform | a transformation / pipeline / model spec |
| Access / IAM | a role / policy / entitlement set |

If you cannot name a single artifact, the use case is probably several; split it.

### Step 2 — Make the schema the single source of truth

Define the artifact as a **typed, validated schema** (Zod, JSON Schema, protobuf, your
choice). Use a **discriminated union** for the different capability types the artifact
can contain, exactly as Wadi's object union is discriminated on `type`. This schema is
the contract every surface agrees on: the agent, the compiler, the UI, the docs.

Everything downstream derives from this. Do not let the API shape, the UI, and the
agent tools each carry their own private idea of the model.

### Step 3 — Componentize capabilities (one declaration, many projections)

This is Wadi's `fields` pattern, and it is what lets coverage grow as data instead of
code. In Wadi a primitive declares its shape once as `FieldSpec[]`, and a neutral
engine projects that one declaration onto the schema, the docs, the form, and the DSL.
Adding a capability is one file, not edits across five surfaces.

For a SaaS platform: model each **capability** (each thing the platform can do) as one
declarative descriptor, and project it to the schema, the reference docs, and the
agent-facing surface from that single source. When the customer ships a new platform
feature, exposing it to agents should be adding a descriptor, not a bespoke integration.

Field types map to your domain's value kinds. Wadi's presets (coord, extent, nonneg,
int, text, flag, enum) are house-flavoured; yours might be `money`, `duration`,
`percentage`, `entity-ref`, `enum`, `expression`. The point is a **small closed set of
value kinds** plus **named presets** composed from them, so a new kind is data.

### Step 4 — Choose the authoring surface (spec vs DSL)

The agent needs a concrete thing to write. Two options:

- **A structured spec (JSON/YAML)** the agent edits directly. Enough for most SaaS use
  cases. Lower effort, and agents are good at structured editing when the schema and
  errors are clear.
- **A text DSL** (like Wadi's `.wdl`) that compiles to the spec. Worth it when
  composition is rich, when humans will co-author, or when a terse ergonomic surface
  materially helps. A DSL is more work (grammar, parser, compiler, decompiler).

Either way, borrow Wadi's **two-tier split**:

- A **domain-neutral core**: variables, references, parameterization, conditionals,
  reusable components. This is reusable across every use case you build.
- A **domain vocabulary**: the customer's specific capability nouns. This is the only
  part you rewrite per customer.

Keep an **escape hatch** to the raw underlying model (Wadi's `raw` rule), so the agent
is never blocked when a capability has no ergonomic form yet.

### Step 5 — Build the compiler/planner, and separate plan from apply

Turn the authored artifact into **a validated plan of platform actions**, then apply
that plan as a separate step. Wadi separates compile (produce the model), resolve
(fold formulas to numbers), and render (produce output). The equivalent for a SaaS:

- **Compile / plan**: artifact → a concrete, validated set of API calls / state
  changes, with no side effects. This is what enables dry-run.
- **Apply / commit**: execute the plan against the tenant, idempotently, with a diff.

Keeping these separate is what gives you a trustworthy preview and a safe apply. Make
compile **deterministic**: the same artifact always plans the same way.

### Step 6 — Build the feedback-loop tools (the heart of it)

These MCP tools are what make the agent competent. Wadi's set maps almost one to one:

| Wadi tool | Purpose | SaaS equivalent |
|---|---|---|
| `wadi_check` | validate: schema + structural rules → typed errors | `validate`: schema + business rules → typed errors |
| `wadi_preview` | render to an image the agent reads | `preview` / `plan`: dry-run diff or simulation |
| `wadi_reference` | embedded reference docs | `reference`: schema, capability catalog, policies |
| `wadi_examples` | known-good samples to copy | `examples`: validated example artifacts |
| `wadi_scope` | resolve variables/values | `resolve` / `query`: inspect current tenant state |
| (n/a) | | `apply` / `commit`: the side-effectful action, gated |

The two that agents cannot work without are **check** and **preview**. Check must
return **typed, located, actionable errors** (not a stack trace, not a boolean). Fail
fast: an unresolved reference or a broken rule must be an **error the check fails on**,
not a silent partial success. (Wadi learned this the hard way: a mistyped reference
used to collapse silently to zero and produce a wrong-but-valid model; now it is a hard
error the checkers report.)

### Step 7 — Encode constraints and guardrails declaratively

Wadi has a structural-conventions layer (C1 through C25 plus per-primitive rules) checked by
a linter over a spatial query model. For a B2B SaaS this is where **business rules,
policy, and compliance** live: budget caps, approval thresholds, data-residency rules,
segmentation limits, entitlement boundaries. Express them as a **declarative,
checkable layer over a query model of the artifact + tenant state**, run inside
`validate`. This is how you encode expert and policy knowledge so the agent cannot
propose something the customer would never allow. For B2B trust, this layer is not
optional.

### Step 8 — Package a self-contained, authenticated MCP server

Wadi's MCP server bundles the compiler, the reference docs, and a rasteriser into one
self-contained artifact that runs repo-free. For a SaaS the same server wraps
`validate` / `preview` / `reference` / `examples` / `resolve` / `apply`, plus two
things Wadi did not need:

- **Multi-tenant authentication**: every call is scoped to the customer's tenant and
  the acting user's permissions. The agent never gets more authority than the user.
- **Audit**: every `apply` is logged with the plan it executed and who approved it.

Run it where the agent runs (the customer's stack, or your managed layer in front of
their APIs).

### Step 9 — Write the agent skill (teach the loop)

Wadi ships an agent-neutral skill (SKILL.md) that teaches the workflow: read the
reference, author the artifact, check after every edit, preview, iterate, then apply.
Write the equivalent for the customer's domain, and keep it **agent-neutral** so it
works across Claude, Cursor, and any MCP client. The skill is where you encode the
discipline: "always `validate` after an edit", "never `apply` without a preview and an
approval".

### Step 10 — Keep humans in the loop

The artifact is human-readable and human-editable on purpose. The customer's own staff
review and adjust what the agent produced, in a UI or the raw spec. Put **approval
gates on side effects**: irreversible or high-impact `apply` operations require a human
yes. The agent proposes and validates; the human commits.

## Design principles that make agents reliable

These are the reasons the method works. Lead with them when convincing a skeptical
customer.

1. **Desired-state over imperative verbs.** Let the agent describe the end state and
   have the platform realize it. This is the single biggest lever.
2. **One source of truth, many projections.** The schema drives the agent tools, the
   docs, and the UI. Nothing drifts.
3. **Fail fast with typed errors.** A broken artifact must fail `validate` loudly.
   Silent partial success is how agents produce confidently wrong results.
4. **Deterministic compile; plan is not apply.** Dry-run/preview is the trust
   mechanism. Never let apply be the only way to find out what happens.
5. **Idempotency and diffs on apply.** Re-applying the same artifact does nothing new;
   changes show as a diff the human can read.
6. **Constraints encode expertise and policy.** The guardrail layer is where the
   customer's rules live, checked before anything happens.
7. **Start narrow, prove the loop, then grow as data.** One artifact, one loop, real
   value. Componentize to expand coverage without re-architecting.

## A concrete first engagement

A shape that de-risks the sale and proves the loop in weeks, not quarters:

1. Pick **one** high-value, composable, review-worthy workflow (Step 0/1).
2. Define the schema for **that one artifact** (Step 2), with two or three capability
   types, componentized (Step 3).
3. Ship `validate` + `preview` + `reference` + a handful of `examples` (Step 6), and a
   single `apply` behind human approval (Step 5/10).
4. Add the three or four most important **business-rule checks** (Step 7).
5. Package the authenticated MCP server (Step 8) and the skill (Step 9).
6. Demo the agent authoring the artifact, catching its own errors on `validate`,
   showing the `preview`, and applying once approved.

Then expand: more capability types (as descriptors), more constraints, and a text DSL
only if composition and human co-authoring justify it.

## Wadi to SaaS mapping (hand this to an engineer)

| Wadi | Your SaaS platform |
|---|---|
| `HouseConfig` Zod schema | the desired-state artifact schema |
| `.wdl` DSL | the authoring format (structured spec, or a DSL) |
| `fields` + kernel engine | capability descriptors, projected to every surface |
| discriminated union on `type` | discriminated union of capability types |
| `resolveParametric` | the compiler/planner (artifact → plan) |
| `render` / `wadi_preview` | dry-run / simulation / diff |
| lint constraints (C1 through C25) | business-rule and policy engine |
| spatial query model | query model over artifact + tenant state |
| `wadi-mcp` server | the authenticated, self-contained MCP server |
| architect skill (SKILL.md) | the agent skill teaching the loop |
| architect / owner personas | the builder vs the reviewer/approver |

## Pitfalls to avoid

- **Do not expose raw CRUD as dozens of tools.** That is the failure mode this method
  replaces. Give the agent an artifact and a compiler.
- **Do not make apply the only feedback.** Without cheap `validate` and `preview`, the
  agent learns nothing until it has already caused a side effect.
- **Do not skip tenancy, permissions, and audit.** For B2B this is the whole ballgame.
- **Do not hardcode each capability across five surfaces.** Componentize, or coverage
  becomes a maintenance sink.
- **Do not make validation errors advisory.** If a rule can be broken silently, the
  agent will break it.
- **Do not boil the ocean.** One artifact, one loop, real value, then grow.

## Further reading in this repo

- `documentation/06-the-method.md` — the general recipe for building a parametric DSL
  in another domain (the method Wadi demonstrates).
- `documentation/grammar-and-data-model.md` — how the `.wdl` grammar relates to the
  `.wadi` schema, field types, and composition rules.
- `documentation/05-extending-the-dsl.md` — adding a capability as one declarative unit.
- `wadi-mcp/` — a real, self-contained MCP server bundling compiler, reference, and
  renderer.
