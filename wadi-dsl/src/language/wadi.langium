grammar Wadi

// ============================================================================
// The Wadi DSL — a formal grammar for the parametric house model.
//
// It is written in TWO tiers, separated by the banner below. This split is the
// whole point of the demonstration (see PARAMETRIC-DSL-METHOD.md):
//
//   • PARAMETRIC CORE — domain-NEUTRAL. Variables, points, grids, the formula
//     expression sublanguage, the configurator (control knobs), and a `raw`
//     JSON escape. Nothing here mentions a house. To formalize another domain
//     (solar farm, data-centre, PCB…), you keep this tier verbatim.
//   • WADI VOCABULARY — the DOMAIN primitives (floor, room, wall, pillar, …).
//     This is the ONLY tier you rewrite to retarget the method.
//
// Langium's CLI rejects an entry-less imported library grammar, so the two tiers
// live in one file behind a divider rather than two files — the boundary is
// still exact and the core section lifts out unchanged.
// ============================================================================

entry Model:
    'house' name=ID '{'
        ('convention' convention=('center' | 'outer'))?
        (units=Units)?
        (site=Site)?
        (defaults=Defaults)?
        ( vars+=Var
        | points+=Point
        | grids+=Grid
        | configurators+=Configurator
        | floors+=Floor
        )*
    '}';

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
Configurator:
    'configurator' '{' inputs+=ConfigInput+ '}';
ConfigInput:
    SliderInput | NumberInput | ToggleInput | SelectInput;
SliderInput:
    'slider' target=ID label=STRING (unit=ID)? '[' min=NUMBER '..' max=NUMBER ('step' step=NUMBER)? ']';
NumberInput:
    'number' target=ID label=STRING (unit=ID)?;
ToggleInput:
    'toggle' target=ID label=STRING;
SelectInput:
    'select' target=ID label=STRING '{' options+=SelectOption (',' options+=SelectOption)* '}';
SelectOption:
    label=ID '=' value=NUMBER;

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
    {infer Ref} parts+=ID ('.' parts+=ID)*
    ({infer Call.callee=current} '(' (args+=Expr (',' args+=Expr)*)? ')')?;

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

Floor:
    'floor' number=NUMBER name=STRING '{' objects+=FloorObject* '}';

// Common house primitives get ergonomic, first-class syntax; everything else is
// expressible via the core `raw` escape (roof, plinth, ground, slab, …).
FloorObject:
    Room | Pillar | Raw;

Room:
    'room' name=ID
        'at' '(' x=Expr ',' y=Expr ')'
        'size' '(' w=Expr ',' l=Expr ')'
        ('{' walls+=RoomWall* '}')?;
RoomWall:
    'wall' side=Side ('{' openings+=Opening* '}')?;
Opening:
    kind=('door' | 'window') name=ID
    'at' offset=Expr 'size' '(' width=Expr ',' height=Expr ')'
    ('sill' sill=Expr)?;
Side returns string:
    'north' | 'south' | 'east' | 'west';

Pillar:
    'pillar' name=ID
        'at' '(' x=Expr ',' y=Expr ')'
        'size' '(' w=Expr ',' l=Expr ')'
        ('height' height=Expr)?;

// ---- Shared lexer ----
hidden terminal WS: /\s+/;
hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
terminal ID: /[_a-zA-Z][\w]*/;
terminal NUMBER returns number: /[0-9]+(\.[0-9]+)?/;
terminal STRING: /"(\\.|[^"\\])*"/;
