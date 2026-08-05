grammar Mini

// A deliberately tiny DSL that isolates the one risky mechanism: a `use` that is
// a real Langium CROSS-REFERENCE (`[Component:QualifiedName]`) resolved by the
// linker + a custom ScopeProvider across MULTIPLE in-memory documents (modules).
// If a LIBRARY component can `use` a SIBLING library component here — the exact
// case Wadi's hand-rolled inliner drops today — the approach is proven.

entry Model:
    (imports+=Import | components+=Component | uses+=Use)*;

Import:
    'import' path=STRING 'as' ns=ID;

Component:
    'component' name=ID '{'
        (uses+=Use)*
    '}';

Use:
    'use' target=[Component:QualifiedName];

// A bare name (a same-file component) or a namespaced one (`ns.Name`, an imported
// component). The ScopeProvider maps both forms to the right Component node.
QualifiedName returns string:
    ID ('.' ID)*;

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w]*/;
terminal STRING: /"[^"]*"/;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
