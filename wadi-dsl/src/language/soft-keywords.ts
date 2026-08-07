// Soft (contextual) keywords — the answer to keyword/field-name collisions.
//
// The two-track grammar (bespoke sugar over the generic ObjectDecl) turns every
// bespoke clause marker — `radius`, `turns`, `total_height`, `direction` … — into a
// reserved keyword, which would otherwise stop those (common!) words being used as
// bare field keys on the generic path. The fix: make those keywords SOFT — the token
// builder categorises them as `ID` too, so they read as a keyword where a rule
// expects one and as a plain identifier everywhere else. No per-promotion `FieldKey`
// edits.
//
// The soft set is DERIVED from the grammar (every keyword that heads a field, minus
// the leaders below), so a newly-promoted primitive's clause keywords are soft
// automatically. The only thing you ever add here is a new OBJECT-TYPE / statement
// keyword — which you are reserving on purpose anyway.

/** Keywords that MUST stay hard: they lead an object / top-level statement (so the
 *  generic `type=ID` rule and rule dispatch stay unambiguous), or are paren-structural
 *  clause markers. Grows only when a new object TYPE is added. */
export const HARD_KEYWORDS = new Set<string>([
  // object types (FloorObject leaders)
  "room", "wall", "pillar", "beam", "slab", "plinth", "ground", "staircase",
  "spiral_staircase", "kitchen", "item", "use", "roof", "raw", "door", "window",
  // top-level / house-body leaders
  "house", "import", "asset", "units", "site", "defaults", "layer", "component",
  "floor", "var", "point", "grid", "configurator", "group",
  // configurator / grid internals (rule leaders)
  "slider", "number", "toggle", "select", "note", "role", "structural", "planning",
  "thick", "dims", "src", "as",
  // roof internals (rule leaders)
  "seg", "truss", "slope",
  // paren / group structural clause markers — kept hard (implausible as field names)
  "at", "size", "from", "to", "path", "with", "step",
]);

/** Keywords never made soft (grammar literals / coordinate keywords handled
 *  explicitly by FieldKey). */
export const NEVER_SOFT = new Set<string>(["x", "y", "true", "false", "null"]);
