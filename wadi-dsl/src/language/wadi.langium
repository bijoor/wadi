grammar Wadi

// ============================================================================
// The Wadi DSL — a formal grammar for the parametric house model.
//
// It is written in TWO tiers, separated by the banner below. This split is the
// whole point of the demonstration (see documentation/06-the-method.md):
//
//   • PARAMETRIC CORE — domain-NEUTRAL. Variables, points, grids, the formula
//     expression sublanguage, the configurator (control knobs), and a `raw`
//     JSON escape. Nothing here mentions a house. To formalize another domain
//     (solar farm, data-centre, PCB…), you keep this tier verbatim.
//   • WADI VOCABULARY — the DOMAIN primitives (floor, room, wall, roof, …).
//     This is the ONLY tier you rewrite to retarget the method.
//
// Langium's CLI rejects an entry-less imported library grammar, so the two tiers
// live in one file behind a divider rather than two files — the boundary is
// still exact and the core section lifts out unchanged.
//
// COVERAGE: every object type in the model's discriminated union now has
// ergonomic first-class syntax (room, wall, pillar, beam, slab, plinth, ground,
// staircase, kitchen, item, component, roof). `raw` remains as a deliberate
// escape hatch to the host JSON (good DSL hygiene), but nothing in the shipped
// model needs it.
// ============================================================================

// A .wdl file is a list of top-level, exportable declarations (a *module*) with an
// OPTIONAL `house { … }` body. A pure asset/component library has no `house`; a
// design (or a module's own demo) adds one. The same declaration kinds are accepted
// at the top level and inside the house block and merge into the same arrays, so
// every existing `house H { … }` file keeps parsing unchanged.
entry Model:
    ( imports+=Import
    | assets+=AssetDecl
    | vars+=Var
    | points+=Point
    | grids+=Grid
    | configurators+=Configurator
    | layers+=LayerDecl
    | components+=ComponentDef
    )*
    ( 'house' name=ID '{'
        ('convention' convention=('center' | 'outer'))?
        (units=Units)?
        (site=Site)?
        (defaults=Defaults)?
        (template=TemplateMeta)?
        ( imports+=Import
        | assets+=AssetDecl
        | vars+=Var
        | points+=Point
        | grids+=Grid
        | configurators+=Configurator
        | layers+=LayerDecl
        | components+=ComponentDef
        | floors+=Floor
        )*
    '}' )?;

// ---- Modules & imports: any .wdl can `import` another and use its exports
//      (its top-level `asset`/`component` decls) under a namespace alias. ----
Import:
    'import' ref=STRING ('as' ns=ID)?;
// A named GLB asset export (a furniture-catalog entry authored in the DSL).
AssetDecl:
    'asset' id=STRING 'src' src=STRING 'dims' '(' dx=NUMBER ',' dy=NUMBER ',' dz=NUMBER ')'
        ('name' assetName=STRING)? ('category' category=STRING)?;

// ============================================================================
// ===============  PARAMETRIC CORE  (domain-neutral — reusable)  ==============
// ============================================================================

// ---- Named scalar variables (a degree of freedom; may reference each other) ----
Var:
    'var' name=ID '=' value=Expr;

// ---- Named 2-D anchor points (double as sizes via .w/.l in formulas) ----
Point:
    'point' name=ID '{' 'x' '=' x=Expr ','? 'y' '=' y=Expr '}';

// ---- First-class parametric grid: named X/Y wall centrelines ----
Grid:
    'grid' name=ID '{'
        'x' ':' xlines+=GridLine (',' xlines+=GridLine)*
        'y' ':' ylines+=GridLine (',' ylines+=GridLine)*
    '}';
GridLine:
    name=(ID | NUMBER) '@' at=Expr ('thick' thickness=Expr)? ('role' role=('structural' | 'planning'))?;

// ---- Configurator: the curated control knobs exposed to a downstream user ----
// This is the ARCHITECT's authoring surface for the owner-facing template: the
// architect writes it in .wdl, and it compiles to the configurator the home
// owner (Gharkul) drives. So it carries the full presentation — a title, a note
// (description), named groups that section the panel, per-input notes, and
// human-readable select labels. Knobs bind to a `var` (target=ID); to expose a
// plot dimension, model it as a var and reference it from the point.
// ---- Template catalog metadata: makes the compiled .wadi self-describing so a
//      folder of templates can be auto-indexed (see io/templateSource.ts). The
//      editorial fields a gallery card needs that geometry can't derive. ----
TemplateMeta:
    'template' '{'
        ('title' title=STRING)?
        ('description' description=STRING)?
        ('style' style=STRING)?
        ('roof' roof=STRING)?
        ('tags' tags+=STRING (',' tags+=STRING)*)?
        ('thumbnails' thumbs+=STRING (',' thumbs+=STRING)*)?
        ('min_plot' '(' minW=NUMBER ',' minL=NUMBER ')')?
    '}';

Configurator:
    'configurator' '{'
        ('title' title=STRING)?
        ('note' description=STRING)?
        items+=ConfigItem+
    '}';
ConfigItem:
    ConfigGroup | ConfigInput;
// A titled section of the panel. Just a label — the compiler derives the stable
// group id (a slug of the label) that inputs are tagged with. (A bare ID here
// would collide with grammar keywords like `size`.)
ConfigGroup:
    'group' label=STRING ('note' description=STRING)? '{' inputs+=ConfigInput+ '}';
ConfigInput:
    SliderInput | NumberInput | ToggleInput | SelectInput;
SliderInput:
    'slider' target=ID label=STRING (unit=ID)? '[' min=NUMBER '..' max=NUMBER ('step' step=NUMBER)? ']' ('note' description=STRING)?;
NumberInput:
    'number' target=ID label=STRING (unit=ID)? ('note' description=STRING)?;
ToggleInput:
    'toggle' target=ID label=STRING ('note' description=STRING)?;
SelectInput:
    'select' target=ID label=STRING '{' options+=SelectOption (',' options+=SelectOption)* '}' ('note' description=STRING)?;
// Option label is a bare identifier (Thin) or a quoted display string
// ("10 ft (standard)"); the value is what the bound var is set to.
SelectOption:
    label=(ID | STRING) '=' value=NUMBER;

// ---- Formula expression sublanguage — a faithful port of the grammar written
//      in editor/src/param/formula.ts: + - * /, unary minus, the pure functions
//      min/max/clamp/round/floor/ceil/abs, and dotted references (bay, main.x1,
//      House.W). Serialized back to a "= …" formula string for the runtime. ----
Expr infers Expr:
    Addition;
Addition infers Expr:
    Multiplication ({infer Binary.left=current} op=('+' | '-') right=Multiplication)*;
Multiplication infers Expr:
    Primary ({infer Binary.left=current} op=('*' | '/') right=Primary)*;
Primary infers Expr:
      {infer Neg} '-' operand=Primary
    | '(' Expr ')'
    | {infer Num} value=NUMBER
    | RefOrCall;
// Parse a dotted reference, then OPTIONALLY a call applied to it — so `min(...)`
// becomes a Call whose callee is the ref `min`, and `main.x1` stays a Ref.
RefOrCall infers Expr:
    {infer Ref} parts+=ID ('.' parts+=RefPart)*
    ({infer Call.callee=current} '(' (args+=Expr (',' args+=Expr)*)? ')')?;
// A member accessor. `x`/`y` are grammar keywords (grid `x :`/`y :`), yet the
// resolver treats `.x/.X/.y/.Y/.w/.W/.l/.L` as coordinate synonyms — so a dotted
// accessor must also accept the `x`/`y` keywords (e.g. `A3.y`, `E4.x`).
RefPart returns string:
    ID | 'x' | 'y';

// ---- Raw escape: any object, as literal JSON. Guarantees the DSL can express
//      anything the model can hold, even before a primitive has an ergonomic
//      rule. (A good DSL always keeps an escape to the host model.) ----
Raw:
    'raw' type=STRING body=JsonObject;
JsonObject infers JsonObject:
    '{' (members+=JsonMember (',' members+=JsonMember)*)? '}';
JsonMember:
    key=(STRING | ID) ':' value=JsonValue;
JsonValue infers JsonValue:
      JsonObject
    | {infer JsonArray} '[' (items+=JsonValue (',' items+=JsonValue)*)? ']'
    | {infer JsonNum} (neg?='-')? num=NUMBER
    | {infer JsonStr} str=STRING
    | {infer JsonBool} bool=('true' | 'false')
    | {infer JsonNull} 'null';

// ============================================================================
// ===================  WADI VOCABULARY  (the domain layer)  ==================
// ============================================================================

Units:
    'units' system=('feet_inches' | 'feet' | 'meters' | 'centimeters' | 'millimeters')
    ('per_unit' per_unit=NUMBER)?;

Site:
    'site' '{' 'plot' '(' plot_width=Expr ',' plot_length=Expr ')'
    ('ref' '(' ref_x=NUMBER ',' ref_y=NUMBER ')')? '}';

Defaults:
    'defaults' '{'
        ('floor_height' floor_height=NUMBER)?
        ('wall_height' wall_height=NUMBER)?
        ('slab_thickness' slab_thickness=NUMBER)?
        ('wall_thickness' wall_thickness=NUMBER)?
    '}';

// ---- Per-house layer registry (display grouping) ----
LayerDecl:
    'layer' id=STRING label=STRING ('color' color=STRING)? ('group' group=STRING)?;

// ---- In-file component library: a reusable mini-house authored in LOCAL
//      coordinates (origin 0,0), stamped into a floor with `use … at (…)`. ----
ComponentDef:
    'component' name=ID ('goal' goal=STRING)?
        // Promote this component to a typed primitive at load time (P0): it can
        // then be used like any core object type, named `exposeType` (namespaced,
        // e.g. `pack.water_tank`).
        ('expose' 'as' exposeType=QualifiedName
            ('layer' exposeLayer=STRING)? ('label' exposeLabel=STRING)?)? '{'
        (params+=ComponentParam)*
        ( vars+=Var | points+=Point )*
        (objects+=FloorObject)*
    '}';
ComponentParam:
    'param' name=ID ('=' default=NUMBER)? ('label' label=STRING)?
        // Field-projection annotations for a promoted primitive (optional; the kind
        // is otherwise inferred). `kind` is a FieldKind preset (extent/int/…).
        ('kind' kind=ID)? ('unit' unit=STRING)?;

Floor:
    'floor' number=NUMBER name=STRING
    ('height' height=NUMBER)?
    ('wall_height' wall_height=NUMBER)?
    ('slab_thickness' slab_thickness=NUMBER)?
    ('enabled' enabled=Expr)?
    '{' objects+=FloorObject* '}';

// The full discriminated union — every model object type has a first-class rule.
// `ObjectDecl` is LAST: the generic, descriptor-driven fallback that parses ANY
// primitive by name (keyword-led rules above win; a non-keyword type name falls
// through to it). Bespoke rules above are ergonomic *sugar* over this generic core.
FloorObject:
      Room | Wall | Pillar | Beam | FloorSlab | Plinth | Ground
    | Staircase | SpiralStaircase | KitchenPlatform | Item | GlbModel | Component | Roof | Raw
    | ObjectDecl;

// ---- Model — a GLB placed at scale and manipulated by a node RIG (P1). Like `item`
//      but structural: each `node "name"` op moves/hides/recolours/arrays a named part
//      of the GLB. Rig values are constant expressions for now (negatives + arithmetic
//      fold to numbers; a var reference is a parametric-rig feature, not yet). ----
GlbModel:
    'model' ('name' name=STRING)?
        (assetRef=[AssetDecl:AssetName] | 'asset' asset=Asset)
        'at' '(' x=Expr ',' y=Expr ')'
        ('rotation' rotation=Expr)?
        ('scale' scale=Expr)?
        Common
        ('{' rig+=RigOp* '}')?;
// Each op leads with a distinct keyword then names the node: `rotate "lid" (0, 45, 0)`,
// `array "rung" count 6 step {…}`. translate/rotate/scale share a shape, so they are one
// rule discriminated by `op` (three identical rules would be merged by type inference).
RigOp:
    RigVec3 | RigVisible | RigMaterial | RigArray;
RigVec3:
    op=('translate' | 'rotate' | 'scale') node=STRING '(' x=Expr ',' y=Expr ',' z=Expr ')';
RigVisible:
    'visible' node=STRING value=Expr;
RigMaterial:
    'material' node=STRING 'color' color=STRING;
RigArray:
    'array' node=STRING 'count' count=Expr ('step' '{' steps+=RigStep* '}')?;
RigStep:
    op=('translate' | 'rotate' | 'scale' | 'about') '(' x=Expr ',' y=Expr ',' z=Expr ')';

// ---- Generic primitive (the framework's real grammar; §2.6). Parses any object
//      type by name, semantics driven by the primitive's descriptor `fields`. A
//      contributed primitive (e.g. spiral_staircase) needs ZERO grammar edits and
//      no `langium generate`. Named-assignment form; positional-arg sugar +
//      field-name validation/completion come from the descriptor (a later step).
//      Field keys accept a bare id, the `x`/`y` keywords, or a quoted string (so
//      a field whose name collides with a grammar keyword — `height`, `direction`,
//      … — is still expressible, `"height" 8`). ----
ObjectDecl:
    type=QualifiedName name=NameRef?
    ('(' args+=Value (',' args+=Value)* ')')?
    ('{' fields+=FieldAssign* '}')?
    Common;
FieldAssign:
    key=FieldKey value=Value;
// A generic field key: a bare id, the `x`/`y` coordinate keywords, or a quoted
// string. Field-marker keywords (`total_height`, `radius`, `direction`, …) are made
// SOFT by the token builder (wadi-token-builder.ts) — lexed as `ID` too — so they
// match `ID` here without being listed. Only a key that collides with a HARD leader
// keyword (`at`, `size`, an object type) needs quoting.
FieldKey returns string:
    ID | 'x' | 'y' | STRING;
Value infers Value:
    {infer StrVal} str=STRING | Expr;

// ---- Shared optional attribute tail: z-offset + the enabled/layer switches
//      that EVERY object carries (fragment → inlined, no wrapper AST node). ----
fragment Common:
    ('z_offset' z_offset=Expr)?
    ('enabled' enabled=Expr)?
    ('layer' layer=STRING)?;

// ---- Rooms + their walls / openings / anchored furniture ----
// An object name: a bare identifier, or a quoted string when it has hyphens/
// spaces (e.g. "Entrance-Varandah"). The compiler unquotes either form.
NameRef returns string:
    ID | STRING;

Room:
    'room' name=NameRef
        'at' '(' x=Expr ',' y=Expr ')'
        'size' '(' w=Expr ',' l=Expr ')'
        ('height' height=Expr)?
        Common ('material' material=STRING)?
        ('{' (walls+=RoomWall | items+=RoomItem)* '}')?;
// One or more sides in a single statement: plain walls read `wall east west
// north`; a wall that carries openings is declared on its own side with a block.
RoomWall:
    'wall' sides+=Side (sides+=Side)*
        ('height' height=Expr)? ('height_end' height_end=Expr)?
        ('{' openings+=Opening* '}')?;
Opening:
    kind=('door' | 'window') name=NameRef
    'at' offset=Expr 'size' '(' width=Expr ',' height=Expr ')'
    ('sill' sill=Expr)? (open?='open')? ('direction' direction=Side)?;
Side returns string:
    'north' | 'south' | 'east' | 'west';

// A free-standing wall (its own object, not a room side).
Wall:
    'wall' name=NameRef
        'from' '(' start_x=Expr ',' start_y=Expr ')'
        'to' '(' end_x=Expr ',' end_y=Expr ')'
        ('height' height=Expr)? ('height_end' height_end=Expr)?
        ('facing' facing=Side)?
        Common ('material' material=STRING)?
        ('{' openings+=Opening* '}')?;

Pillar:
    'pillar' name=NameRef
        'at' '(' x=Expr ',' y=Expr ')'
        // A pillar may set only one footprint dimension; the omitted one is
        // written `auto` and falls back to the wall thickness at render time
        // (a column embedded in a wall is only as deep as the wall).
        'size' '(' (w_auto?='auto' | w=Expr) ',' (l_auto?='auto' | l=Expr) ')'
        ('height' height=Expr)?
        Common;

Beam:
    'beam' ('name' name=STRING)?
        'at' '(' x=Expr ',' y=Expr ')'
        'size' '(' w=Expr ',' l=Expr ')'
        ('height' height=Expr)?
        Common;

FloorSlab:
    'slab' ('name' name=STRING)?
        'at' '(' x=Expr ',' y=Expr ')'
        'size' '(' w=Expr ',' l=Expr ')'
        ('thickness' thickness=Expr)?
        Common;

Plinth:
    'plinth' ('name' name=STRING)?
        'at' '(' x=Expr ',' y=Expr ')'
        'size' '(' w=Expr ',' l=Expr ')'
        'height' height=Expr
        Common ('material' material=STRING)?;

Ground:
    'ground' ('name' name=STRING)?
        'at' '(' x=Expr ',' y=Expr ')'
        'size' '(' w=Expr ',' l=Expr ')'
        ('height' height=Expr)?
        Common ('material' material=STRING)?;

Staircase:
    'staircase' ('name' name=STRING)?
        'at' '(' start_x=Expr ',' start_y=Expr ')'
        'step' '(' step_rise=Expr ',' step_tread=Expr ',' step_width=Expr ')'
        'direction' direction=Side
        ('climb' climb=('up' | 'down'))?
        ('total_height' rise_height=Expr)?
        ('max_run' max_run=Expr)?
        ('landing_depth' landing_depth=Expr)?
        ('landing_thickness' landing_thickness=Expr)?
        ('turn' turn=('clockwise' | 'anticlockwise'))?
        ('flight_gap' flight_gap=Expr)?
        Common ('material' material=STRING)?;

// A PROMOTED primitive (plans/primitive-componentization.md §2.6): spiral_staircase
// started life on the generic `ObjectDecl` path, then graduated to this bespoke sugar
// so it reads like every other primitive — `at (x, y)` placement + named clauses, no
// braces. Its `fields` still drive schema/form/docs; only the DSL surface is sugared.
SpiralStaircase:
    'spiral_staircase' name=NameRef?
        'at' '(' x=Expr ',' y=Expr ')'
        'radius' radius=Expr
        'total_height' total_height=Expr
        ('turns' turns=Expr)?
        ('steps' steps=Expr)?
        ('tread_thickness' tread_thickness=Expr)?
        ('pole_radius' pole_radius=Expr)?
        Common;

KitchenPlatform:
    'kitchen' ('name' name=STRING)?
        'path' '(' pts+=Pt (',' pts+=Pt)* ')'
        'side' side=('left' | 'right')
        'depth' depth=Expr 'height' height=Expr
        ('base_z' base_z=Expr)?
        Common ('material' material=STRING)?;
Pt:
    '(' x=NUMBER ',' y=NUMBER ')';

// ---- Free-standing furniture (a GLB asset placed in plan) ----
Item:
    'item' ('name' name=STRING)?
        (assetRef=[AssetDecl:AssetName] | 'asset' asset=Asset)
        'at' '(' x=Expr ',' y=Expr ')'
        ('rotation' rotation=Expr)?
        ('scale' scale=Expr)?
        ('anchor_to' anchor_to=STRING)?
        ('anchor' anchor=Anchor)?
        ('gap' '(' gap_x=Expr ',' gap_y=Expr ')')?
        Common;
// Furniture anchored inside a room (no x/y — placed relative to the room box).
RoomItem:
    'item' ('name' name=STRING)?
        (assetRef=[AssetDecl:AssetName] | 'asset' asset=Asset)
        ('anchor' anchor=Anchor)?
        ('gap' '(' gap_x=Expr ',' gap_y=Expr ')')?
        ('rotation' rotation=Expr)?
        ('scale' scale=Expr)?
        Common;
// An asset reference name: bare (`"bed_double"`, same-file or a std module) or
// namespaced (`f."bed_double"`, from `import "…" as f`). Used as the cross-
// reference name for `item assetRef=[AssetDecl:AssetName]`; the ScopeProvider
// names asset entries in this exact quoted form so $refText matches. The inline
// `asset { … }` block stays for one-off GLBs.
AssetName returns string:
    (ID '.')? STRING;
Asset:
    '{' 'id' id=STRING 'src' src=STRING 'dims' '(' dx=NUMBER ',' dy=NUMBER ',' dz=NUMBER ')'
        ('name' name=STRING)? ('category' category=STRING)? '}';
Anchor returns string:
      'top-left' | 'top-center' | 'top-right'
    | 'center-left' | 'center' | 'center-right'
    | 'bottom-left' | 'bottom-center' | 'bottom-right';

// ---- Component INSTANCE — stamp a library component onto this floor. `target`
//      is a Langium CROSS-REFERENCE to a `component` definition: an in-file one
//      (bare `Comp`) or an imported one (`ns.Comp`), resolved by the linker +
//      the Wadi ScopeProvider across the imported-module documents. ----
Component:
    'use' target=[ComponentDef:QualifiedName] ('as' name=STRING)?
        'at' '(' x=Expr ',' y=Expr ')'
        // Standard placement: yaw° (0=south, 90=east). Right angles are exact for
        // any component; a free angle is allowed only for furniture-only ones.
        ('rotation' rotation=Expr)?
        ('with' '{' args+=ComponentArg (',' args+=ComponentArg)* '}')?
        Common;
ComponentArg:
    name=ID '=' value=Expr;

// A component reference name: a bare name (same-file / bare-imported) or a
// namespaced one (`ns.Comp`). The ScopeProvider maps both to the right node.
QualifiedName returns string:
    ID ('.' ID)*;

// ---- Roof — one object covering flat / shed / gable / hip via roof_type +
//      per-segment endpoints. Segments carry their own formula map (start_x,
//      hip_setback_start, …); truss positions serialize to pos0/pos1/… ----
Roof:
    'roof' ('name' name=STRING)? roof_type=('flat' | 'shed' | 'pitched')
        ('endpoint' default_endpoint=('open' | 'closed'))?
        (slope=Slope)?
        ('overhang' min_overhang=Expr)?
        ('slab_thickness' slab_thickness=Expr)?
        ('parapet' parapet_height=Expr 'x' parapet_thickness=Expr)?
        ('gable_wall_thickness' gable_wall_thickness=Expr)?
        // Detailed structural framing (rafter/purlin/ridge/truss member sizes)
        // as a raw JSON block — an advanced, rarely-hand-authored spec.
        ('framing' framing=JsonObject)?
        Common ('material' material=STRING)?
        '{' (segments+=Segment | trusses+=Truss)* '}';
// Roof pitch. A single value is a symmetric gable/hip; an ANGLE PAIR (left, right)
// is an asymmetric (saltbox) gable — the two eaves stay put and the ridge shifts
// across the width so each side takes its angle. left/right are by the segment's
// left normal (the same sides as overhang_left/right). `height` is single-value
// only (both faces share ONE ridge line, so one rise).
Slope:
    'slope' (
        'angle' ('(' angle_left=Expr ',' angle_right=Expr ')' | angle_deg=Expr)
      | 'height' ridge_h=Expr
    );
Segment:
    'segment' id=STRING
        'from' '(' sx=Expr ',' sy=Expr ')' 'to' '(' ex=Expr ',' ey=Expr ')'
        'width' width=Expr
        ('high_side' shed_high_side=('left' | 'right'))?
        ('start_endpoint' start_endpoint=('open' | 'closed'))?
        ('end_endpoint' end_endpoint=('open' | 'closed'))?
        ('hip_setback' '(' hip_setback_start=Expr ',' hip_setback_end=Expr ')')?
        ('gable_overhang' '(' gable_overhang_start=Expr ',' gable_overhang_end=Expr ')')?
        ('hip_ridge_extension' '(' hip_ridge_extension_start=Expr ',' hip_ridge_extension_end=Expr ')')?
        ('overhang' min_overhang=Expr)?
        ('overhang_start' overhang_start=Expr)?
        ('overhang_end' overhang_end=Expr)?
        ('overhang_low' overhang_low=Expr)?
        ('overhang_high' overhang_high=Expr)?
        ('overhang_left' overhang_left=Expr)?
        ('overhang_right' overhang_right=Expr)?
        ('tie_beams' tie_beam_count=NUMBER)?;
Truss:
    'truss' segment_id=STRING type=('fink' | 'mono_pitch')
        'at' '(' positions+=Expr (',' positions+=Expr)* ')';

// ---- Shared lexer ----
hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
terminal ID: /[_a-zA-Z][\w]*/;
terminal NUMBER returns number: /[0-9]+(\.[0-9]+)?/;
terminal STRING: /"(\\.|[^"\\])*"/;
