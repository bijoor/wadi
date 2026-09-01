import{i as e,n as t,r as n,t as r}from"./viewer-CNC7AqOf.js";import{ct as i,dt as a,ft as o,lt as s,ut as c}from"./viewer-XMUEohfE.js";function l(e){return typeof e==`object`&&!!e&&typeof e.$type==`string`}function u(e){return typeof e==`object`&&!!e&&typeof e.$refText==`string`&&`ref`in e}function d(e){return typeof e==`object`&&!!e&&typeof e.$refText==`string`&&`items`in e}function f(e){return typeof e==`object`&&!!e&&typeof e.name==`string`&&typeof e.type==`string`&&typeof e.path==`string`}function p(e){return typeof e==`object`&&!!e&&typeof e.info==`object`&&typeof e.message==`string`}var m=class{constructor(){this.subtypes={},this.allSubtypes={}}getAllTypes(){return Object.keys(this.types)}getReferenceType(e){let t=this.types[e.container.$type];if(!t)throw Error(`Type ${e.container.$type||`undefined`} not found.`);let n=t.properties[e.property]?.referenceType;if(!n)throw Error(`Property ${e.property||`undefined`} of type ${e.container.$type} is not a reference.`);return n}getTypeMetaData(e){return this.types[e]||{name:e,properties:{},superTypes:[]}}isInstance(e,t){return l(e)&&this.isSubtype(e.$type,t)}isSubtype(e,t){if(e===t)return!0;let n=this.subtypes[e];n||=this.subtypes[e]={};let r=n[t];if(r!==void 0)return r;{let r=this.types[e],i=r?r.superTypes.some(e=>this.isSubtype(e,t)):!1;return n[t]=i,i}}getAllSubTypes(e){let t=this.allSubtypes[e];if(t)return t;{let t=this.getAllTypes(),n=[];for(let r of t)this.isSubtype(r,e)&&n.push(r);return this.allSubtypes[e]=n,n}}isComplete(e){let t=this.getTypeMetaData(e.$type);for(let n of Object.keys(t.properties)){let r=t.properties[n];if(!r.optional&&e[r.name]==null)return!1}return!0}};function h(e){return typeof e==`object`&&!!e&&Array.isArray(e.content)}function g(e){return typeof e==`object`&&!!e&&typeof e.tokenType==`object`}function _(e){return h(e)&&typeof e.fullText==`string`}var v=class e{constructor(e,t){this.startFn=e,this.nextFn=t}iterator(){let e={state:this.startFn(),next:()=>this.nextFn(e.state),[Symbol.iterator]:()=>e};return e}[Symbol.iterator](){return this.iterator()}isEmpty(){return!!this.iterator().next().done}count(){let e=this.iterator(),t=0,n=e.next();for(;!n.done;)t++,n=e.next();return t}toArray(){let e=[],t=this.iterator(),n;do n=t.next(),n.value!==void 0&&e.push(n.value);while(!n.done);return e}toSet(){return new Set(this)}toMap(e,t){let n=this.map(n=>[e?e(n):n,t?t(n):n]);return new Map(n)}toString(){return this.join()}concat(t){return new e(()=>({first:this.startFn(),firstDone:!1,iterator:t[Symbol.iterator]()}),e=>{let t;if(!e.firstDone){do if(t=this.nextFn(e.first),!t.done)return t;while(!t.done);e.firstDone=!0}do if(t=e.iterator.next(),!t.done)return t;while(!t.done);return x})}join(e=`,`){let t=this.iterator(),n=``,r,i=!1;do r=t.next(),r.done||(i&&(n+=e),n+=y(r.value)),i=!0;while(!r.done);return n}indexOf(e,t=0){let n=this.iterator(),r=0,i=n.next();for(;!i.done;){if(r>=t&&i.value===e)return r;i=n.next(),r++}return-1}every(e){let t=this.iterator(),n=t.next();for(;!n.done;){if(!e(n.value))return!1;n=t.next()}return!0}some(e){let t=this.iterator(),n=t.next();for(;!n.done;){if(e(n.value))return!0;n=t.next()}return!1}forEach(e){let t=this.iterator(),n=0,r=t.next();for(;!r.done;)e(r.value,n),r=t.next(),n++}map(t){return new e(this.startFn,e=>{let{done:n,value:r}=this.nextFn(e);return n?x:{done:!1,value:t(r)}})}filter(t){return new e(this.startFn,e=>{let n;do if(n=this.nextFn(e),!n.done&&t(n.value))return n;while(!n.done);return x})}nonNullable(){return this.filter(e=>e!=null)}reduce(e,t){let n=this.iterator(),r=t,i=n.next();for(;!i.done;)r=r===void 0?i.value:e(r,i.value),i=n.next();return r}reduceRight(e,t){return this.recursiveReduce(this.iterator(),e,t)}recursiveReduce(e,t,n){let r=e.next();if(r.done)return n;let i=this.recursiveReduce(e,t,n);return i===void 0?r.value:t(i,r.value)}find(e){let t=this.iterator(),n=t.next();for(;!n.done;){if(e(n.value))return n.value;n=t.next()}}findIndex(e){let t=this.iterator(),n=0,r=t.next();for(;!r.done;){if(e(r.value))return n;r=t.next(),n++}return-1}includes(e){let t=this.iterator(),n=t.next();for(;!n.done;){if(n.value===e)return!0;n=t.next()}return!1}flatMap(t){return new e(()=>({this:this.startFn()}),e=>{do{if(e.iterator){let t=e.iterator.next();if(t.done)e.iterator=void 0;else return t}let{done:n,value:r}=this.nextFn(e.this);if(!n){let n=t(r);if(ee(n))e.iterator=n[Symbol.iterator]();else return{done:!1,value:n}}}while(e.iterator);return x})}flat(t){if(t===void 0&&(t=1),t<=0)return this;let n=t>1?this.flat(t-1):this;return new e(()=>({this:n.startFn()}),e=>{do{if(e.iterator){let t=e.iterator.next();if(t.done)e.iterator=void 0;else return t}let{done:t,value:r}=n.nextFn(e.this);if(!t)if(ee(r))e.iterator=r[Symbol.iterator]();else return{done:!1,value:r}}while(e.iterator);return x})}head(){let e=this.iterator().next();if(!e.done)return e.value}tail(t=1){return new e(()=>{let e=this.startFn();for(let n=0;n<t;n++)if(this.nextFn(e).done)return e;return e},this.nextFn)}limit(t){return new e(()=>({size:0,state:this.startFn()}),e=>(e.size++,e.size>t?x:this.nextFn(e.state)))}distinct(t){return new e(()=>({set:new Set,internalState:this.startFn()}),e=>{let n;do if(n=this.nextFn(e.internalState),!n.done){let r=t?t(n.value):n.value;if(!e.set.has(r))return e.set.add(r),n}while(!n.done);return x})}exclude(e,t){let n=new Set;for(let r of e){let e=t?t(r):r;n.add(e)}return this.filter(e=>{let r=t?t(e):e;return!n.has(r)})}};function y(e){return typeof e==`string`?e:e===void 0?`undefined`:typeof e.toString==`function`?e.toString():Object.prototype.toString.call(e)}function ee(e){return!!e&&typeof e[Symbol.iterator]==`function`}var b=new v(()=>void 0,()=>x),x=Object.freeze({done:!0,value:void 0});function S(...e){if(e.length===1){let t=e[0];if(t instanceof v)return t;if(ee(t))return new v(()=>t[Symbol.iterator](),e=>e.next());if(typeof t.length==`number`)return new v(()=>({index:0}),e=>e.index<t.length?{done:!1,value:t[e.index++]}:x)}return e.length>1?new v(()=>({collIndex:0,arrIndex:0}),t=>{do{if(t.iterator){let e=t.iterator.next();if(!e.done)return e;t.iterator=void 0}if(t.array){if(t.arrIndex<t.array.length)return{done:!1,value:t.array[t.arrIndex++]};t.array=void 0,t.arrIndex=0}if(t.collIndex<e.length){let n=e[t.collIndex++];ee(n)?t.iterator=n[Symbol.iterator]():n&&typeof n.length==`number`&&(t.array=n)}}while(t.iterator||t.array||t.collIndex<e.length);return x}):b}var te=class extends v{constructor(e,t,n){super(()=>({iterators:n?.includeRoot?[[e][Symbol.iterator]()]:[t(e)[Symbol.iterator]()],pruned:!1}),e=>{for(e.pruned&&=(e.iterators.pop(),!1);e.iterators.length>0;){let n=e.iterators[e.iterators.length-1].next();if(n.done)e.iterators.pop();else return e.iterators.push(t(n.value)[Symbol.iterator]()),n}return x})}iterator(){let e={state:this.startFn(),next:()=>this.nextFn(e.state),prune:()=>{e.state.pruned=!0},[Symbol.iterator]:()=>e};return e}},C;(function(e){function t(e){return e.reduce((e,t)=>e+t,0)}e.sum=t;function n(e){return e.reduce((e,t)=>e*t,0)}e.product=n;function r(e){return e.reduce((e,t)=>Math.min(e,t))}e.min=r;function i(e){return e.reduce((e,t)=>Math.max(e,t))}e.max=i})(C||={});function w(e,t={}){for(let[n,r]of Object.entries(e))n.startsWith(`$`)||(Array.isArray(r)?r.forEach((r,i)=>{l(r)&&(r.$container=e,r.$containerProperty=n,r.$containerIndex=i,t.deep&&w(r,t))}):l(r)&&(r.$container=e,r.$containerProperty=n,t.deep&&w(r,t)))}function T(e,t){let n=e;for(;n;){if(t(n))return n;n=n.$container}}function E(e){let t=ne(e).$document;if(!t)throw Error(`AST node has no document.`);return t}function ne(e){for(;e.$container;)e=e.$container;return e}function D(e){return u(e)?e.ref?[e.ref]:[]:d(e)?e.items.map(e=>e.ref):[]}function O(e,t){if(!e)throw Error(`Node must be an AstNode.`);let n=t?.range;return new v(()=>({keys:Object.keys(e),keyIndex:0,arrayIndex:0}),t=>{for(;t.keyIndex<t.keys.length;){let r=t.keys[t.keyIndex];if(!r.startsWith(`$`)){let i=e[r];if(l(i)){if(t.keyIndex++,re(i,n))return{done:!1,value:i}}else if(Array.isArray(i)){for(;t.arrayIndex<i.length;){let e=i[t.arrayIndex++];if(l(e)&&re(e,n))return{done:!1,value:e}}t.arrayIndex=0}}t.keyIndex++}return x})}function k(e,t){if(!e)throw Error(`Root node must be an AstNode.`);return new te(e,e=>O(e,t))}function A(e,t){if(!e)throw Error(`Root node must be an AstNode.`);return t?.range&&!re(e,t.range)?new te(e,()=>[]):new te(e,e=>O(e,t),{includeRoot:!0})}function re(e,t){if(!t)return!0;let n=e.$cstNode?.range;return n?Bt(n,t):!1}function ie(e){return new v(()=>({keys:Object.keys(e),keyIndex:0,arrayIndex:0}),t=>{for(;t.keyIndex<t.keys.length;){let n=t.keys[t.keyIndex];if(!n.startsWith(`$`)){let r=e[n];if(u(r)||d(r))return t.keyIndex++,{done:!1,value:{reference:r,container:e,property:n}};if(Array.isArray(r)){for(;t.arrayIndex<r.length;){let i=t.arrayIndex++,a=r[i];if(u(a)||d(r))return{done:!1,value:{reference:a,container:e,property:n,index:i}}}t.arrayIndex=0}}t.keyIndex++}return x})}function ae(e,t){let n=e.getTypeMetaData(t.$type),r=t;for(let e of Object.values(n.properties))e.defaultValue!==void 0&&r[e.name]===void 0&&(r[e.name]=j(e.defaultValue))}function j(e){return Array.isArray(e)?[...e.map(j)]:e}var M={$type:`AbstractElement`,cardinality:`cardinality`};function oe(e){return I.isInstance(e,M.$type)}var se={$type:`AbstractParserRule`};function N(e){return I.isInstance(e,se.$type)}var ce={$type:`AbstractRule`},P={$type:`AbstractType`},F={$type:`Action`,cardinality:`cardinality`,feature:`feature`,inferredType:`inferredType`,operator:`operator`,type:`type`};function le(e){return I.isInstance(e,F.$type)}var ue={$type:`Alternatives`,cardinality:`cardinality`,elements:`elements`};function de(e){return I.isInstance(e,ue.$type)}var fe={$type:`ArrayLiteral`,elements:`elements`},pe={$type:`ArrayType`,elementType:`elementType`},me={$type:`Assignment`,cardinality:`cardinality`,feature:`feature`,operator:`operator`,predicate:`predicate`,terminal:`terminal`};function he(e){return I.isInstance(e,me.$type)}var ge={$type:`BooleanLiteral`,true:`true`};function _e(e){return I.isInstance(e,ge.$type)}var ve={$type:`CharacterRange`,cardinality:`cardinality`,left:`left`,lookahead:`lookahead`,parenthesized:`parenthesized`,right:`right`};function ye(e){return I.isInstance(e,ve.$type)}var be={$type:`Condition`},xe={$type:`Conjunction`,left:`left`,right:`right`};function Se(e){return I.isInstance(e,xe.$type)}var Ce={$type:`CrossReference`,cardinality:`cardinality`,deprecatedSyntax:`deprecatedSyntax`,isMulti:`isMulti`,terminal:`terminal`,type:`type`};function we(e){return I.isInstance(e,Ce.$type)}var Te={$type:`Disjunction`,left:`left`,right:`right`};function Ee(e){return I.isInstance(e,Te.$type)}var De={$type:`EndOfFile`,cardinality:`cardinality`};function Oe(e){return I.isInstance(e,De.$type)}var ke={$type:`Grammar`,imports:`imports`,interfaces:`interfaces`,isDeclared:`isDeclared`,name:`name`,rules:`rules`,types:`types`},Ae={$type:`GrammarImport`,path:`path`},je={$type:`Group`,cardinality:`cardinality`,elements:`elements`,guardCondition:`guardCondition`,predicate:`predicate`};function Me(e){return I.isInstance(e,je.$type)}var Ne={$type:`InferredType`,name:`name`};function Pe(e){return I.isInstance(e,Ne.$type)}var Fe={$type:`InfixRule`,call:`call`,dataType:`dataType`,inferredType:`inferredType`,name:`name`,operators:`operators`,parameters:`parameters`,returnType:`returnType`};function Ie(e){return I.isInstance(e,Fe.$type)}var Le={$type:`InfixRuleOperatorList`,associativity:`associativity`,operators:`operators`},Re={$type:`InfixRuleOperators`,precedences:`precedences`},ze={$type:`Interface`,attributes:`attributes`,name:`name`,superTypes:`superTypes`};function Be(e){return I.isInstance(e,ze.$type)}var Ve={$type:`Keyword`,cardinality:`cardinality`,predicate:`predicate`,value:`value`};function He(e){return I.isInstance(e,Ve.$type)}var Ue={$type:`NamedArgument`,calledByName:`calledByName`,parameter:`parameter`,value:`value`},We={$type:`NegatedToken`,cardinality:`cardinality`,lookahead:`lookahead`,parenthesized:`parenthesized`,terminal:`terminal`};function Ge(e){return I.isInstance(e,We.$type)}var Ke={$type:`Negation`,value:`value`};function qe(e){return I.isInstance(e,Ke.$type)}var Je={$type:`NumberLiteral`,value:`value`},Ye={$type:`Parameter`,name:`name`},Xe={$type:`ParameterReference`,parameter:`parameter`};function Ze(e){return I.isInstance(e,Xe.$type)}var Qe={$type:`ParserRule`,dataType:`dataType`,definition:`definition`,entry:`entry`,fragment:`fragment`,inferredType:`inferredType`,name:`name`,parameters:`parameters`,returnType:`returnType`};function $e(e){return I.isInstance(e,Qe.$type)}var et={$type:`ReferenceType`,isMulti:`isMulti`,referenceType:`referenceType`},tt={$type:`RegexToken`,cardinality:`cardinality`,lookahead:`lookahead`,parenthesized:`parenthesized`,regex:`regex`};function nt(e){return I.isInstance(e,tt.$type)}var rt={$type:`ReturnType`,name:`name`};function it(e){return I.isInstance(e,rt.$type)}var at={$type:`RuleCall`,arguments:`arguments`,cardinality:`cardinality`,predicate:`predicate`,rule:`rule`};function ot(e){return I.isInstance(e,at.$type)}var st={$type:`SimpleType`,primitiveType:`primitiveType`,stringType:`stringType`,typeRef:`typeRef`};function ct(e){return I.isInstance(e,st.$type)}var lt={$type:`StringLiteral`,value:`value`},ut={$type:`TerminalAlternatives`,cardinality:`cardinality`,elements:`elements`,lookahead:`lookahead`,parenthesized:`parenthesized`};function dt(e){return I.isInstance(e,ut.$type)}var ft={$type:`TerminalElement`,cardinality:`cardinality`,lookahead:`lookahead`,parenthesized:`parenthesized`},pt={$type:`TerminalGroup`,cardinality:`cardinality`,elements:`elements`,lookahead:`lookahead`,parenthesized:`parenthesized`};function mt(e){return I.isInstance(e,pt.$type)}var ht={$type:`TerminalRule`,definition:`definition`,fragment:`fragment`,hidden:`hidden`,name:`name`,type:`type`};function gt(e){return I.isInstance(e,ht.$type)}var _t={$type:`TerminalRuleCall`,cardinality:`cardinality`,lookahead:`lookahead`,parenthesized:`parenthesized`,rule:`rule`};function vt(e){return I.isInstance(e,_t.$type)}var yt={$type:`Type`,name:`name`,type:`type`};function bt(e){return I.isInstance(e,yt.$type)}var xt={$type:`TypeAttribute`,defaultValue:`defaultValue`,isOptional:`isOptional`,name:`name`,type:`type`},St={$type:`TypeDefinition`},Ct={$type:`UnionType`,types:`types`},wt={$type:`UnorderedGroup`,cardinality:`cardinality`,elements:`elements`};function Tt(e){return I.isInstance(e,wt.$type)}var Et={$type:`UntilToken`,cardinality:`cardinality`,lookahead:`lookahead`,parenthesized:`parenthesized`,terminal:`terminal`};function Dt(e){return I.isInstance(e,Et.$type)}var Ot={$type:`ValueLiteral`},kt={$type:`Wildcard`,cardinality:`cardinality`,lookahead:`lookahead`,parenthesized:`parenthesized`};function At(e){return I.isInstance(e,kt.$type)}var jt=class extends m{constructor(){super(...arguments),this.types={AbstractElement:{name:M.$type,properties:{cardinality:{name:M.cardinality,optional:!0}},superTypes:[]},AbstractParserRule:{name:se.$type,properties:{},superTypes:[ce.$type,P.$type]},AbstractRule:{name:ce.$type,properties:{},superTypes:[]},AbstractType:{name:P.$type,properties:{},superTypes:[]},Action:{name:F.$type,properties:{cardinality:{name:F.cardinality,optional:!0},feature:{name:F.feature,optional:!0},inferredType:{name:F.inferredType,optional:!0},operator:{name:F.operator,optional:!0},type:{name:F.type,referenceType:P.$type,optional:!0}},superTypes:[M.$type]},Alternatives:{name:ue.$type,properties:{cardinality:{name:ue.cardinality,optional:!0},elements:{name:ue.elements,defaultValue:[]}},superTypes:[M.$type]},ArrayLiteral:{name:fe.$type,properties:{elements:{name:fe.elements,defaultValue:[]}},superTypes:[Ot.$type]},ArrayType:{name:pe.$type,properties:{elementType:{name:pe.elementType}},superTypes:[St.$type]},Assignment:{name:me.$type,properties:{cardinality:{name:me.cardinality,optional:!0},feature:{name:me.feature},operator:{name:me.operator},predicate:{name:me.predicate,optional:!0},terminal:{name:me.terminal}},superTypes:[M.$type]},BooleanLiteral:{name:ge.$type,properties:{true:{name:ge.true,defaultValue:!1}},superTypes:[be.$type,Ot.$type]},CharacterRange:{name:ve.$type,properties:{cardinality:{name:ve.cardinality,optional:!0},left:{name:ve.left},lookahead:{name:ve.lookahead,optional:!0},parenthesized:{name:ve.parenthesized,defaultValue:!1,optional:!0},right:{name:ve.right,optional:!0}},superTypes:[ft.$type]},Condition:{name:be.$type,properties:{},superTypes:[]},Conjunction:{name:xe.$type,properties:{left:{name:xe.left},right:{name:xe.right}},superTypes:[be.$type]},CrossReference:{name:Ce.$type,properties:{cardinality:{name:Ce.cardinality,optional:!0},deprecatedSyntax:{name:Ce.deprecatedSyntax,defaultValue:!1},isMulti:{name:Ce.isMulti,defaultValue:!1},terminal:{name:Ce.terminal,optional:!0},type:{name:Ce.type,referenceType:P.$type}},superTypes:[M.$type]},Disjunction:{name:Te.$type,properties:{left:{name:Te.left},right:{name:Te.right}},superTypes:[be.$type]},EndOfFile:{name:De.$type,properties:{cardinality:{name:De.cardinality,optional:!0}},superTypes:[M.$type]},Grammar:{name:ke.$type,properties:{imports:{name:ke.imports,defaultValue:[]},interfaces:{name:ke.interfaces,defaultValue:[]},isDeclared:{name:ke.isDeclared,defaultValue:!1},name:{name:ke.name,optional:!0},rules:{name:ke.rules,defaultValue:[]},types:{name:ke.types,defaultValue:[]}},superTypes:[]},GrammarImport:{name:Ae.$type,properties:{path:{name:Ae.path}},superTypes:[]},Group:{name:je.$type,properties:{cardinality:{name:je.cardinality,optional:!0},elements:{name:je.elements,defaultValue:[]},guardCondition:{name:je.guardCondition,optional:!0},predicate:{name:je.predicate,optional:!0}},superTypes:[M.$type]},InferredType:{name:Ne.$type,properties:{name:{name:Ne.name}},superTypes:[P.$type]},InfixRule:{name:Fe.$type,properties:{call:{name:Fe.call},dataType:{name:Fe.dataType,optional:!0},inferredType:{name:Fe.inferredType,optional:!0},name:{name:Fe.name},operators:{name:Fe.operators},parameters:{name:Fe.parameters,defaultValue:[]},returnType:{name:Fe.returnType,referenceType:P.$type,optional:!0}},superTypes:[se.$type]},InfixRuleOperatorList:{name:Le.$type,properties:{associativity:{name:Le.associativity,optional:!0},operators:{name:Le.operators,defaultValue:[]}},superTypes:[]},InfixRuleOperators:{name:Re.$type,properties:{precedences:{name:Re.precedences,defaultValue:[]}},superTypes:[]},Interface:{name:ze.$type,properties:{attributes:{name:ze.attributes,defaultValue:[]},name:{name:ze.name},superTypes:{name:ze.superTypes,defaultValue:[],referenceType:P.$type}},superTypes:[P.$type]},Keyword:{name:Ve.$type,properties:{cardinality:{name:Ve.cardinality,optional:!0},predicate:{name:Ve.predicate,optional:!0},value:{name:Ve.value}},superTypes:[M.$type]},NamedArgument:{name:Ue.$type,properties:{calledByName:{name:Ue.calledByName,defaultValue:!1},parameter:{name:Ue.parameter,referenceType:Ye.$type,optional:!0},value:{name:Ue.value}},superTypes:[]},NegatedToken:{name:We.$type,properties:{cardinality:{name:We.cardinality,optional:!0},lookahead:{name:We.lookahead,optional:!0},parenthesized:{name:We.parenthesized,defaultValue:!1,optional:!0},terminal:{name:We.terminal}},superTypes:[ft.$type]},Negation:{name:Ke.$type,properties:{value:{name:Ke.value}},superTypes:[be.$type]},NumberLiteral:{name:Je.$type,properties:{value:{name:Je.value}},superTypes:[Ot.$type]},Parameter:{name:Ye.$type,properties:{name:{name:Ye.name}},superTypes:[]},ParameterReference:{name:Xe.$type,properties:{parameter:{name:Xe.parameter,referenceType:Ye.$type}},superTypes:[be.$type]},ParserRule:{name:Qe.$type,properties:{dataType:{name:Qe.dataType,optional:!0},definition:{name:Qe.definition},entry:{name:Qe.entry,defaultValue:!1},fragment:{name:Qe.fragment,defaultValue:!1},inferredType:{name:Qe.inferredType,optional:!0},name:{name:Qe.name},parameters:{name:Qe.parameters,defaultValue:[]},returnType:{name:Qe.returnType,referenceType:P.$type,optional:!0}},superTypes:[se.$type]},ReferenceType:{name:et.$type,properties:{isMulti:{name:et.isMulti,defaultValue:!1},referenceType:{name:et.referenceType}},superTypes:[St.$type]},RegexToken:{name:tt.$type,properties:{cardinality:{name:tt.cardinality,optional:!0},lookahead:{name:tt.lookahead,optional:!0},parenthesized:{name:tt.parenthesized,defaultValue:!1,optional:!0},regex:{name:tt.regex}},superTypes:[ft.$type]},ReturnType:{name:rt.$type,properties:{name:{name:rt.name}},superTypes:[]},RuleCall:{name:at.$type,properties:{arguments:{name:at.arguments,defaultValue:[]},cardinality:{name:at.cardinality,optional:!0},predicate:{name:at.predicate,optional:!0},rule:{name:at.rule,referenceType:ce.$type}},superTypes:[M.$type]},SimpleType:{name:st.$type,properties:{primitiveType:{name:st.primitiveType,optional:!0},stringType:{name:st.stringType,optional:!0},typeRef:{name:st.typeRef,referenceType:P.$type,optional:!0}},superTypes:[St.$type]},StringLiteral:{name:lt.$type,properties:{value:{name:lt.value}},superTypes:[Ot.$type]},TerminalAlternatives:{name:ut.$type,properties:{cardinality:{name:ut.cardinality,optional:!0},elements:{name:ut.elements,defaultValue:[]},lookahead:{name:ut.lookahead,optional:!0},parenthesized:{name:ut.parenthesized,defaultValue:!1,optional:!0}},superTypes:[ft.$type]},TerminalElement:{name:ft.$type,properties:{cardinality:{name:ft.cardinality,optional:!0},lookahead:{name:ft.lookahead,optional:!0},parenthesized:{name:ft.parenthesized,defaultValue:!1,optional:!0}},superTypes:[M.$type]},TerminalGroup:{name:pt.$type,properties:{cardinality:{name:pt.cardinality,optional:!0},elements:{name:pt.elements,defaultValue:[]},lookahead:{name:pt.lookahead,optional:!0},parenthesized:{name:pt.parenthesized,defaultValue:!1,optional:!0}},superTypes:[ft.$type]},TerminalRule:{name:ht.$type,properties:{definition:{name:ht.definition},fragment:{name:ht.fragment,defaultValue:!1},hidden:{name:ht.hidden,defaultValue:!1},name:{name:ht.name},type:{name:ht.type,optional:!0}},superTypes:[ce.$type]},TerminalRuleCall:{name:_t.$type,properties:{cardinality:{name:_t.cardinality,optional:!0},lookahead:{name:_t.lookahead,optional:!0},parenthesized:{name:_t.parenthesized,defaultValue:!1,optional:!0},rule:{name:_t.rule,referenceType:ht.$type}},superTypes:[ft.$type]},Type:{name:yt.$type,properties:{name:{name:yt.name},type:{name:yt.type}},superTypes:[P.$type]},TypeAttribute:{name:xt.$type,properties:{defaultValue:{name:xt.defaultValue,optional:!0},isOptional:{name:xt.isOptional,defaultValue:!1},name:{name:xt.name},type:{name:xt.type}},superTypes:[]},TypeDefinition:{name:St.$type,properties:{},superTypes:[]},UnionType:{name:Ct.$type,properties:{types:{name:Ct.types,defaultValue:[]}},superTypes:[St.$type]},UnorderedGroup:{name:wt.$type,properties:{cardinality:{name:wt.cardinality,optional:!0},elements:{name:wt.elements,defaultValue:[]}},superTypes:[M.$type]},UntilToken:{name:Et.$type,properties:{cardinality:{name:Et.cardinality,optional:!0},lookahead:{name:Et.lookahead,optional:!0},parenthesized:{name:Et.parenthesized,defaultValue:!1,optional:!0},terminal:{name:Et.terminal}},superTypes:[ft.$type]},ValueLiteral:{name:Ot.$type,properties:{},superTypes:[]},Wildcard:{name:kt.$type,properties:{cardinality:{name:kt.cardinality,optional:!0},lookahead:{name:kt.lookahead,optional:!0},parenthesized:{name:kt.parenthesized,defaultValue:!1,optional:!0}},superTypes:[ft.$type]}}}},I=new jt;function Mt(e){let t=e,n=!1;for(;t;){let e=T(t.grammarSource,$e);if(e&&e.dataType)t=t.container,n=!0;else if(n)return t;else return}}function Nt(e){return new te(e,e=>h(e)?e.content:[],{includeRoot:!0})}function Pt(e){return Nt(e).filter(g)}function Ft(e,t){for(;e.container;)if(e=e.container,e===t)return!0;return!1}function It(e){return{start:{character:e.startColumn-1,line:e.startLine-1},end:{character:e.endColumn,line:e.endLine-1}}}function Lt(e){if(!e)return;let{offset:t,end:n,range:r}=e;return{range:r,offset:t,end:n,length:n-t}}var Rt;(function(e){e[e.Before=0]=`Before`,e[e.After=1]=`After`,e[e.OverlapFront=2]=`OverlapFront`,e[e.OverlapBack=3]=`OverlapBack`,e[e.Inside=4]=`Inside`,e[e.Outside=5]=`Outside`})(Rt||={});function zt(e,t){if(e.end.line<t.start.line||e.end.line===t.start.line&&e.end.character<=t.start.character)return Rt.Before;if(e.start.line>t.end.line||e.start.line===t.end.line&&e.start.character>=t.end.character)return Rt.After;let n=e.start.line>t.start.line||e.start.line===t.start.line&&e.start.character>=t.start.character,r=e.end.line<t.end.line||e.end.line===t.end.line&&e.end.character<=t.end.character;return n&&r?Rt.Inside:n?Rt.OverlapBack:r?Rt.OverlapFront:Rt.Outside}function Bt(e,t){return zt(e,t)>Rt.After}var Vt=/^[\w\p{L}]$/u;function Ht(e,t,n=Vt){if(e){if(t>0){let r=t-e.offset,i=e.text.charAt(r);n.test(i)||t--}return Gt(e,t)}}function Ut(e,t){if(e){let n=Jt(e,!0);if(n&&Wt(n,t))return n;if(_(e)){let n=e.content.findIndex(e=>!e.hidden);for(let r=n-1;r>=0;r--){let n=e.content[r];if(Wt(n,t))return n}}}}function Wt(e,t){return g(e)&&t.includes(e.tokenType.name)}function Gt(e,t){if(g(e))return e;if(h(e)){let n=qt(e,t,!1);if(n)return Gt(n,t)}}function Kt(e,t){if(g(e))return e;if(h(e)){let n=qt(e,t,!0);if(n)return Kt(n,t)}}function qt(e,t,n){let r=0,i=e.content.length-1,a;for(;r<=i;){let o=Math.floor((r+i)/2),s=e.content[o];if(s.offset<=t&&s.end>t)return s;s.end<=t?(a=n?s:void 0,r=o+1):i=o-1}return a}function Jt(e,t=!0){for(;e.container;){let n=e.container,r=n.content.indexOf(e);for(;r>0;){r--;let e=n.content[r];if(t||!e.hidden)return e}e=n}}var Yt=class extends Error{constructor(e,t){super(e?`${t} at ${e.range.start.line}:${e.range.start.character}`:t)}};function Xt(e,t=`Error: Got unexpected value.`){throw Error(t)}function L(e){return e.charCodeAt(0)}function Zt(e,t){Array.isArray(e)?e.forEach(function(e){t.push(e)}):t.push(e)}function Qt(e,t){if(e[t]===!0)throw`duplicate flag `+t;e[t],e[t]=!0}function $t(e){if(e===void 0)throw Error(`Internal Error - Should never get here!`);return!0}function en(){throw Error(`Internal Error - Should never get here!`)}function tn(e){return e.type===`Character`}var nn=[];for(let e=L(`0`);e<=L(`9`);e++)nn.push(e);var rn=[L(`_`)].concat(nn);for(let e=L(`a`);e<=L(`z`);e++)rn.push(e);for(let e=L(`A`);e<=L(`Z`);e++)rn.push(e);var an=[L(` `),L(`\f`),L(`
`),L(`\r`),L(`	`),L(`\v`),L(`	`),L(`\xA0`),L(` `),L(` `),L(` `),L(` `),L(` `),L(` `),L(` `),L(` `),L(` `),L(` `),L(` `),L(` `),L(`\u2028`),L(`\u2029`),L(` `),L(` `),L(`　`),L(`﻿`)],on=/[0-9a-fA-F]/,sn=/[0-9]/,cn=/[1-9]/,ln=class{constructor(){this.idx=0,this.input=``,this.groupIdx=0}saveState(){return{idx:this.idx,input:this.input,groupIdx:this.groupIdx}}restoreState(e){this.idx=e.idx,this.input=e.input,this.groupIdx=e.groupIdx}pattern(e){this.idx=0,this.input=e,this.groupIdx=0,this.consumeChar(`/`);let t=this.disjunction();this.consumeChar(`/`);let n={type:`Flags`,loc:{begin:this.idx,end:e.length},global:!1,ignoreCase:!1,multiLine:!1,unicode:!1,sticky:!1};for(;this.isRegExpFlag();)switch(this.popChar()){case`g`:Qt(n,`global`);break;case`i`:Qt(n,`ignoreCase`);break;case`m`:Qt(n,`multiLine`);break;case`u`:Qt(n,`unicode`);break;case`y`:Qt(n,`sticky`);break}if(this.idx!==this.input.length)throw Error(`Redundant input: `+this.input.substring(this.idx));return{type:`Pattern`,flags:n,value:t,loc:this.loc(0)}}disjunction(){let e=[],t=this.idx;for(e.push(this.alternative());this.peekChar()===`|`;)this.consumeChar(`|`),e.push(this.alternative());return{type:`Disjunction`,value:e,loc:this.loc(t)}}alternative(){let e=[],t=this.idx;for(;this.isTerm();)e.push(this.term());return{type:`Alternative`,value:e,loc:this.loc(t)}}term(){return this.isAssertion()?this.assertion():this.atom()}assertion(){let e=this.idx;switch(this.popChar()){case`^`:return{type:`StartAnchor`,loc:this.loc(e)};case`$`:return{type:`EndAnchor`,loc:this.loc(e)};case`\\`:switch(this.popChar()){case`b`:return{type:`WordBoundary`,loc:this.loc(e)};case`B`:return{type:`NonWordBoundary`,loc:this.loc(e)}}throw Error(`Invalid Assertion Escape`);case`(`:this.consumeChar(`?`);let t;switch(this.popChar()){case`=`:t=`Lookahead`;break;case`!`:t=`NegativeLookahead`;break;case`<`:switch(this.popChar()){case`=`:t=`Lookbehind`;break;case`!`:t=`NegativeLookbehind`}break}$t(t);let n=this.disjunction();return this.consumeChar(`)`),{type:t,value:n,loc:this.loc(e)}}return en()}quantifier(e=!1){let t,n=this.idx;switch(this.popChar()){case`*`:t={atLeast:0,atMost:1/0};break;case`+`:t={atLeast:1,atMost:1/0};break;case`?`:t={atLeast:0,atMost:1};break;case`{`:let n=this.integerIncludingZero();switch(this.popChar()){case`}`:t={atLeast:n,atMost:n};break;case`,`:let e;this.isDigit()?(e=this.integerIncludingZero(),t={atLeast:n,atMost:e}):t={atLeast:n,atMost:1/0},this.consumeChar(`}`);break}if(e===!0&&t===void 0)return;$t(t);break}if(!(e===!0&&t===void 0)&&$t(t))return this.peekChar(0)===`?`?(this.consumeChar(`?`),t.greedy=!1):t.greedy=!0,t.type=`Quantifier`,t.loc=this.loc(n),t}atom(){let e,t=this.idx;switch(this.peekChar()){case`.`:e=this.dotAll();break;case`\\`:e=this.atomEscape();break;case`[`:e=this.characterClass();break;case`(`:e=this.group();break}return e===void 0&&this.isPatternCharacter()&&(e=this.patternCharacter()),$t(e)?(e.loc=this.loc(t),this.isQuantifier()&&(e.quantifier=this.quantifier()),e):en()}dotAll(){return this.consumeChar(`.`),{type:`Set`,complement:!0,value:[L(`
`),L(`\r`),L(`\u2028`),L(`\u2029`)]}}atomEscape(){switch(this.consumeChar(`\\`),this.peekChar()){case`1`:case`2`:case`3`:case`4`:case`5`:case`6`:case`7`:case`8`:case`9`:return this.decimalEscapeAtom();case`d`:case`D`:case`s`:case`S`:case`w`:case`W`:return this.characterClassEscape();case`f`:case`n`:case`r`:case`t`:case`v`:return this.controlEscapeAtom();case`c`:return this.controlLetterEscapeAtom();case`0`:return this.nulCharacterAtom();case`x`:return this.hexEscapeSequenceAtom();case`u`:return this.regExpUnicodeEscapeSequenceAtom();default:return this.identityEscapeAtom()}}decimalEscapeAtom(){return{type:`GroupBackReference`,value:this.positiveInteger()}}characterClassEscape(){let e,t=!1;switch(this.popChar()){case`d`:e=nn;break;case`D`:e=nn,t=!0;break;case`s`:e=an;break;case`S`:e=an,t=!0;break;case`w`:e=rn;break;case`W`:e=rn,t=!0;break}return $t(e)?{type:`Set`,value:e,complement:t}:en()}controlEscapeAtom(){let e;switch(this.popChar()){case`f`:e=L(`\f`);break;case`n`:e=L(`
`);break;case`r`:e=L(`\r`);break;case`t`:e=L(`	`);break;case`v`:e=L(`\v`);break}return $t(e)?{type:`Character`,value:e}:en()}controlLetterEscapeAtom(){this.consumeChar(`c`);let e=this.popChar();if(/[a-zA-Z]/.test(e)===!1)throw Error(`Invalid `);return{type:`Character`,value:e.toUpperCase().charCodeAt(0)-64}}nulCharacterAtom(){return this.consumeChar(`0`),{type:`Character`,value:L(`\0`)}}hexEscapeSequenceAtom(){return this.consumeChar(`x`),this.parseHexDigits(2)}regExpUnicodeEscapeSequenceAtom(){return this.consumeChar(`u`),this.parseHexDigits(4)}identityEscapeAtom(){return{type:`Character`,value:L(this.popChar())}}classPatternCharacterAtom(){switch(this.peekChar()){case`
`:case`\r`:case`\u2028`:case`\u2029`:case`\\`:case`]`:throw Error(`TBD`);default:return{type:`Character`,value:L(this.popChar())}}}characterClass(){let e=[],t=!1;for(this.consumeChar(`[`),this.peekChar(0)===`^`&&(this.consumeChar(`^`),t=!0);this.isClassAtom();){let t=this.classAtom();if(t.type,tn(t)&&this.isRangeDash()){this.consumeChar(`-`);let n=this.classAtom();if(n.type,tn(n)){if(n.value<t.value)throw Error(`Range out of order in character class`);e.push({from:t.value,to:n.value})}else Zt(t.value,e),e.push(L(`-`)),Zt(n.value,e)}else Zt(t.value,e)}return this.consumeChar(`]`),{type:`Set`,complement:t,value:e}}classAtom(){switch(this.peekChar()){case`]`:case`
`:case`\r`:case`\u2028`:case`\u2029`:throw Error(`TBD`);case`\\`:return this.classEscape();default:return this.classPatternCharacterAtom()}}classEscape(){switch(this.consumeChar(`\\`),this.peekChar()){case`b`:return this.consumeChar(`b`),{type:`Character`,value:L(`\b`)};case`d`:case`D`:case`s`:case`S`:case`w`:case`W`:return this.characterClassEscape();case`f`:case`n`:case`r`:case`t`:case`v`:return this.controlEscapeAtom();case`c`:return this.controlLetterEscapeAtom();case`0`:return this.nulCharacterAtom();case`x`:return this.hexEscapeSequenceAtom();case`u`:return this.regExpUnicodeEscapeSequenceAtom();default:return this.identityEscapeAtom()}}group(){let e=!0;switch(this.consumeChar(`(`),this.peekChar(0)){case`?`:this.consumeChar(`?`),this.consumeChar(`:`),e=!1;break;default:this.groupIdx++;break}let t=this.disjunction();this.consumeChar(`)`);let n={type:`Group`,capturing:e,value:t};return e&&(n.idx=this.groupIdx),n}positiveInteger(){let e=this.popChar();if(cn.test(e)===!1)throw Error(`Expecting a positive integer`);for(;sn.test(this.peekChar(0));)e+=this.popChar();return parseInt(e,10)}integerIncludingZero(){let e=this.popChar();if(sn.test(e)===!1)throw Error(`Expecting an integer`);for(;sn.test(this.peekChar(0));)e+=this.popChar();return parseInt(e,10)}patternCharacter(){let e=this.popChar();switch(e){case`
`:case`\r`:case`\u2028`:case`\u2029`:case`^`:case`$`:case`\\`:case`.`:case`*`:case`+`:case`?`:case`(`:case`)`:case`[`:case`|`:throw Error(`TBD`);default:return{type:`Character`,value:L(e)}}}isRegExpFlag(){switch(this.peekChar(0)){case`g`:case`i`:case`m`:case`u`:case`y`:return!0;default:return!1}}isRangeDash(){return this.peekChar()===`-`&&this.isClassAtom(1)}isDigit(){return sn.test(this.peekChar(0))}isClassAtom(e=0){switch(this.peekChar(e)){case`]`:case`
`:case`\r`:case`\u2028`:case`\u2029`:return!1;default:return!0}}isTerm(){return this.isAtom()||this.isAssertion()}isAtom(){if(this.isPatternCharacter())return!0;switch(this.peekChar(0)){case`.`:case`\\`:case`[`:case`(`:return!0;default:return!1}}isAssertion(){switch(this.peekChar(0)){case`^`:case`$`:return!0;case`\\`:switch(this.peekChar(1)){case`b`:case`B`:return!0;default:return!1}case`(`:return this.peekChar(1)===`?`&&(this.peekChar(2)===`=`||this.peekChar(2)===`!`||this.peekChar(2)===`<`&&(this.peekChar(3)===`=`||this.peekChar(3)===`!`));default:return!1}}isQuantifier(){let e=this.saveState();try{return this.quantifier(!0)!==void 0}catch{return!1}finally{this.restoreState(e)}}isPatternCharacter(){switch(this.peekChar()){case`^`:case`$`:case`\\`:case`.`:case`*`:case`+`:case`?`:case`(`:case`)`:case`[`:case`|`:case`/`:case`
`:case`\r`:case`\u2028`:case`\u2029`:return!1;default:return!0}}parseHexDigits(e){let t=``;for(let n=0;n<e;n++){let e=this.popChar();if(on.test(e)===!1)throw Error(`Expecting a HexDecimal digits`);t+=e}return{type:`Character`,value:parseInt(t,16)}}peekChar(e=0){return this.input[this.idx+e]}popChar(){let e=this.peekChar(0);return this.consumeChar(void 0),e}consumeChar(e){if(e!==void 0&&this.input[this.idx]!==e)throw Error(`Expected: '`+e+`' but found: '`+this.input[this.idx]+`' at offset: `+this.idx);if(this.idx>=this.input.length)throw Error(`Unexpected end of input`);this.idx++}loc(e){return{begin:e,end:this.idx}}},un=class{visitChildren(e){for(let t in e){let n=e[t];e.hasOwnProperty(t)&&(n.type===void 0?Array.isArray(n)&&n.forEach(e=>{this.visit(e)},this):this.visit(n))}}visit(e){switch(e.type){case`Pattern`:this.visitPattern(e);break;case`Flags`:this.visitFlags(e);break;case`Disjunction`:this.visitDisjunction(e);break;case`Alternative`:this.visitAlternative(e);break;case`StartAnchor`:this.visitStartAnchor(e);break;case`EndAnchor`:this.visitEndAnchor(e);break;case`WordBoundary`:this.visitWordBoundary(e);break;case`NonWordBoundary`:this.visitNonWordBoundary(e);break;case`Lookahead`:this.visitLookahead(e);break;case`NegativeLookahead`:this.visitNegativeLookahead(e);break;case`Lookbehind`:this.visitLookbehind(e);break;case`NegativeLookbehind`:this.visitNegativeLookbehind(e);break;case`Character`:this.visitCharacter(e);break;case`Set`:this.visitSet(e);break;case`Group`:this.visitGroup(e);break;case`GroupBackReference`:this.visitGroupBackReference(e);break;case`Quantifier`:this.visitQuantifier(e);break}this.visitChildren(e)}visitPattern(e){}visitFlags(e){}visitDisjunction(e){}visitAlternative(e){}visitStartAnchor(e){}visitEndAnchor(e){}visitWordBoundary(e){}visitNonWordBoundary(e){}visitLookahead(e){}visitNegativeLookahead(e){}visitLookbehind(e){}visitNegativeLookbehind(e){}visitCharacter(e){}visitSet(e){}visitGroup(e){}visitGroupBackReference(e){}visitQuantifier(e){}},dn=/\r?\n/gm,fn=new ln,pn=new class extends un{constructor(){super(...arguments),this.isStarting=!0,this.endRegexpStack=[],this.multiline=!1}get endRegex(){return this.endRegexpStack.join(``)}reset(e){this.multiline=!1,this.regex=e,this.startRegexp=``,this.isStarting=!0,this.endRegexpStack=[]}visitGroup(e){e.quantifier&&(this.isStarting=!1,this.endRegexpStack=[])}visitCharacter(e){let t=String.fromCharCode(e.value);if(!this.multiline&&t===`
`&&(this.multiline=!0),e.quantifier)this.isStarting=!1,this.endRegexpStack=[];else{let e=_n(t);this.endRegexpStack.push(e),this.isStarting&&(this.startRegexp+=e)}}visitSet(e){if(!this.multiline){let t=this.regex.substring(e.loc.begin,e.loc.end),n=new RegExp(t);this.multiline=!!`
`.match(n)}if(e.quantifier)this.isStarting=!1,this.endRegexpStack=[];else{let t=this.regex.substring(e.loc.begin,e.loc.end);this.endRegexpStack.push(t),this.isStarting&&(this.startRegexp+=t)}}visitChildren(e){e.type===`Group`&&e.quantifier||super.visitChildren(e)}};function mn(e){try{return typeof e==`string`&&(e=new RegExp(e)),e=e.toString(),pn.reset(e),pn.visit(fn.pattern(e)),pn.multiline}catch{return!1}}var hn=`\f
\r	\v \xA0            \u2028\u2029  　﻿`.split(``);function gn(e){let t=typeof e==`string`?new RegExp(e):e;return hn.some(e=>t.test(e))}function _n(e){return e.replace(/[.*+?^${}()|[\]\\]/g,`\\$&`)}function vn(e,t){let n=yn(e),r=t.match(n);return!!r&&r[0].length>0}function yn(e){typeof e==`string`&&(e=new RegExp(e));let t=e,n=e.source,r=0;function i(){let e=``,a;function o(t){e+=n.substr(r,t),r+=t}function s(t){e+=`(?:`+n.substr(r,t)+`|$)`,r+=t}for(;r<n.length;)switch(n[r]){case`\\`:switch(n[r+1]){case`c`:s(3);break;case`x`:s(4);break;case`u`:t.unicode?n[r+2]===`{`?s(n.indexOf(`}`,r)-r+1):s(6):s(2);break;case`p`:case`P`:t.unicode?s(n.indexOf(`}`,r)-r+1):s(2);break;case`k`:s(n.indexOf(`>`,r)-r+1);break;default:s(2);break}break;case`[`:a=/\[(?:\\.|.)*?\]/g,a.lastIndex=r,a=a.exec(n)||[],s(a[0].length);break;case`|`:case`^`:case`$`:case`*`:case`+`:case`?`:o(1);break;case`{`:a=/\{\d+,?\d*\}/g,a.lastIndex=r,a=a.exec(n),a?o(a[0].length):s(1);break;case`(`:if(n[r+1]===`?`)switch(n[r+2]){case`:`:e+=`(?:`,r+=3,e+=i()+`|$)`;break;case`=`:e+=`(?=`,r+=3,e+=i()+`)`;break;case`!`:a=r,r+=3,i(),e+=n.substr(a,r-a);break;case`<`:switch(n[r+3]){case`=`:case`!`:a=r,r+=4,i(),e+=n.substr(a,r-a);break;default:o(n.indexOf(`>`,r)-r+1),e+=i()+`|$)`;break}break}else o(1),e+=i()+`|$)`;break;case`)`:return++r,e;default:s(1);break}return e}return new RegExp(i(),e.flags)}function bn(e){return e.rules.find(e=>$e(e)&&e.entry)}function xn(e){return e.rules.filter(e=>gt(e)&&e.hidden)}function Sn(e,t){let n=new Set,r=bn(e);if(!r)return new Set(e.rules);let i=[r].concat(xn(e));for(let e of i)Cn(e,n,t);let a=new Set;for(let t of e.rules)(n.has(t.name)||gt(t)&&t.hidden)&&a.add(t);return a}function Cn(e,t,n){t.add(e.name),k(e).forEach(e=>{if(ot(e)||n&&vt(e)){let r=e.rule.ref;r&&!t.has(r.name)&&Cn(r,t,n)}})}function wn(e){if(e.terminal)return e.terminal;if(e.type.ref)return Mn(e.type.ref)?.terminal}function Tn(e){return e.hidden&&!gn(Hn(e))}function En(e,t){return!e||!t?[]:On(e,t,e.astNode,!0)}function Dn(e,t,n){if(!e||!t)return;let r=On(e,t,e.astNode,!0);if(r.length!==0)return n=n===void 0?0:Math.max(0,Math.min(n,r.length-1)),r[n]}function On(e,t,n,r){if(!r){let n=T(e.grammarSource,he);if(n&&n.feature===t)return[e]}return h(e)&&e.astNode===n?e.content.flatMap(e=>On(e,t,n,!1)):[]}function kn(e,t,n){if(!e)return;let r=An(e,t,e?.astNode);if(r.length!==0)return n=n===void 0?0:Math.max(0,Math.min(n,r.length-1)),r[n]}function An(e,t,n){if(e.astNode!==n)return[];if(He(e.grammarSource)&&e.grammarSource.value===t)return[e];let r=Nt(e).iterator(),i,a=[];do if(i=r.next(),!i.done){let e=i.value;e.astNode===n?He(e.grammarSource)&&e.grammarSource.value===t&&a.push(e):r.prune()}while(!i.done);return a}function jn(e){let t=e.astNode;for(;t===e.container?.astNode;){let t=T(e.grammarSource,he);if(t)return t;e=e.container}}function Mn(e){let t=e;return Pe(t)&&(le(t.$container)?t=t.$container.$container:N(t.$container)?t=t.$container:Xt(t.$container)),Nn(e,t,new Map)}function Nn(e,t,n){function r(t,r){let i;return T(t,he)||(i=Nn(r,r,n)),n.set(e,i),i}if(n.has(e))return n.get(e);n.set(e,void 0);for(let i of k(t))if(he(i)&&i.feature.toLowerCase()===`name`)return n.set(e,i),i;else if(ot(i)&&$e(i.rule.ref))return r(i,i.rule.ref);else if(ct(i)&&i.typeRef?.ref)return r(i,i.typeRef.ref)}function Pn(e,t){return e===`?`||e===`*`||Me(t)&&!!t.guardCondition}function Fn(e){return e===`*`||e===`+`}function In(e){return Ln(e,new Set)}function Ln(e,t){if(t.has(e))return!0;t.add(e);for(let n of k(e))if(ot(n)){if(!n.rule.ref||$e(n.rule.ref)&&!Ln(n.rule.ref,t)||Ie(n.rule.ref))return!1}else if(he(n))return!1;else if(le(n))return!1;return!!e.definition}function Rn(e){if(!gt(e)){if(e.inferredType)return e.inferredType.name;if(e.dataType)return e.dataType;if(e.returnType){let t=e.returnType.ref;if(t)return t.name}}}function zn(e){if(N(e))return $e(e)&&In(e)?e.name:Rn(e)??e.name;if(Be(e)||bt(e)||it(e))return e.name;if(le(e)){let t=Bn(e);if(t)return t}else if(Pe(e))return e.name;throw Error(`Cannot get name of Unknown Type`)}function Bn(e){if(e.inferredType)return e.inferredType.name;if(e.type?.ref)return zn(e.type.ref)}function Vn(e){return gt(e)?e.type?.name??`string`:Rn(e)??e.name}function Hn(e){let t={s:!1,i:!1,u:!1},n=Wn(e.definition,t),r=Object.entries(t).filter(([,e])=>e).map(([e])=>e).join(``);return new RegExp(n,r)}var Un=`[\\s\\S]`;function Wn(e,t){if(dt(e))return Gn(e);if(mt(e))return Kn(e);if(ye(e))return Yn(e);if(vt(e)){let t=e.rule.ref;if(!t)throw Error(`Missing rule reference.`);return Zn(Wn(t.definition),{cardinality:e.cardinality,lookahead:e.lookahead,parenthesized:e.parenthesized})}else if(Ge(e))return Jn(e);else if(Dt(e))return qn(e);else if(nt(e)){let n=e.regex.lastIndexOf(`/`),r=e.regex.substring(1,n),i=e.regex.substring(n+1);return t&&(t.i=i.includes(`i`),t.s=i.includes(`s`),t.u=i.includes(`u`)),Zn(r,{cardinality:e.cardinality,lookahead:e.lookahead,parenthesized:e.parenthesized,wrap:!1})}else if(At(e))return Zn(Un,{cardinality:e.cardinality,lookahead:e.lookahead,parenthesized:e.parenthesized});else throw Error(`Invalid terminal element: ${e?.$type}, ${e?.$cstNode?.text}`)}function Gn(e){return Zn(e.elements.map(e=>Wn(e)).join(`|`),{cardinality:e.cardinality,lookahead:e.lookahead,parenthesized:e.parenthesized,wrap:!1})}function Kn(e){return Zn(e.elements.map(e=>Wn(e)).join(``),{cardinality:e.cardinality,lookahead:e.lookahead,parenthesized:e.parenthesized,wrap:!1})}function qn(e){return Zn(`${Un}*?${Wn(e.terminal)}`,{cardinality:e.cardinality,lookahead:e.lookahead,parenthesized:e.parenthesized})}function Jn(e){return Zn(`(?!${Wn(e.terminal)})${Un}*?`,{cardinality:e.cardinality,lookahead:e.lookahead,parenthesized:e.parenthesized})}function Yn(e){return e.right?Zn(`[${Xn(e.left)}-${Xn(e.right)}]`,{cardinality:e.cardinality,lookahead:e.lookahead,parenthesized:e.parenthesized,wrap:!1}):Zn(Xn(e.left),{cardinality:e.cardinality,lookahead:e.lookahead,parenthesized:e.parenthesized,wrap:!1})}function Xn(e){return _n(e.value)}function Zn(e,t){return(t.parenthesized||t.lookahead||t.wrap!==!1)&&(e=`(${t.lookahead??(t.parenthesized?``:`?:`)}${e})`),t.cardinality?`${e}${t.cardinality}`:e}function Qn(e){let t=[],n=e.Grammar;for(let e of n.rules)gt(e)&&Tn(e)&&mn(Hn(e))&&t.push(e.name);return{multilineCommentRules:t,nameRegexp:Vt}}function $n(e){console&&console.error&&console.error(`Error: ${e}`)}function er(e){console&&console.warn&&console.warn(`Warning: ${e}`)}function tr(e){let t=new Date().getTime(),n=e();return{time:new Date().getTime()-t,value:n}}function nr(e){function t(){}t.prototype=e;let n=new t;function r(){return typeof n.bar}return r(),r(),e}function rr(e){return ir(e)?e.LABEL:e.name}function ir(e){return typeof e.LABEL==`string`&&e.LABEL!==``}var ar=class{get definition(){return this._definition}set definition(e){this._definition=e}constructor(e){this._definition=e}accept(e){e.visit(this),this.definition.forEach(t=>{t.accept(e)})}},or=class extends ar{constructor(e){super([]),this.idx=1,Object.assign(this,gr(e))}set definition(e){}get definition(){return this.referencedRule===void 0?[]:this.referencedRule.definition}accept(e){e.visit(this)}},sr=class extends ar{constructor(e){super(e.definition),this.orgText=``,Object.assign(this,gr(e))}},cr=class extends ar{constructor(e){super(e.definition),this.ignoreAmbiguities=!1,Object.assign(this,gr(e))}},lr=class extends ar{constructor(e){super(e.definition),this.idx=1,Object.assign(this,gr(e))}},ur=class extends ar{constructor(e){super(e.definition),this.idx=1,Object.assign(this,gr(e))}},dr=class extends ar{constructor(e){super(e.definition),this.idx=1,Object.assign(this,gr(e))}},R=class extends ar{constructor(e){super(e.definition),this.idx=1,Object.assign(this,gr(e))}},fr=class extends ar{constructor(e){super(e.definition),this.idx=1,Object.assign(this,gr(e))}},pr=class extends ar{get definition(){return this._definition}set definition(e){this._definition=e}constructor(e){super(e.definition),this.idx=1,this.ignoreAmbiguities=!1,this.hasPredicates=!1,Object.assign(this,gr(e))}},z=class{constructor(e){this.idx=1,Object.assign(this,gr(e))}accept(e){e.visit(this)}};function mr(e){return e.map(hr)}function hr(e){function t(e){return e.map(hr)}if(e instanceof or){let t={type:`NonTerminal`,name:e.nonTerminalName,idx:e.idx};return typeof e.label==`string`&&(t.label=e.label),t}else if(e instanceof cr)return{type:`Alternative`,definition:t(e.definition)};else if(e instanceof lr)return{type:`Option`,idx:e.idx,definition:t(e.definition)};else if(e instanceof ur)return{type:`RepetitionMandatory`,idx:e.idx,definition:t(e.definition)};else if(e instanceof dr)return{type:`RepetitionMandatoryWithSeparator`,idx:e.idx,separator:hr(new z({terminalType:e.separator})),definition:t(e.definition)};else if(e instanceof fr)return{type:`RepetitionWithSeparator`,idx:e.idx,separator:hr(new z({terminalType:e.separator})),definition:t(e.definition)};else if(e instanceof R)return{type:`Repetition`,idx:e.idx,definition:t(e.definition)};else if(e instanceof pr)return{type:`Alternation`,idx:e.idx,definition:t(e.definition)};else if(e instanceof z){let t={type:`Terminal`,name:e.terminalType.name,label:rr(e.terminalType),idx:e.idx};typeof e.label==`string`&&(t.terminalLabel=e.label);let n=e.terminalType.PATTERN;return e.terminalType.PATTERN&&(t.pattern=n instanceof RegExp?n.source:n),t}else if(e instanceof sr)return{type:`Rule`,name:e.name,orgText:e.orgText,definition:t(e.definition)};else throw Error(`non exhaustive match`)}function gr(e){return Object.fromEntries(Object.entries(e).filter(([,e])=>e!==void 0))}var _r=class{visit(e){let t=e;switch(t.constructor){case or:return this.visitNonTerminal(t);case cr:return this.visitAlternative(t);case lr:return this.visitOption(t);case ur:return this.visitRepetitionMandatory(t);case dr:return this.visitRepetitionMandatoryWithSeparator(t);case fr:return this.visitRepetitionWithSeparator(t);case R:return this.visitRepetition(t);case pr:return this.visitAlternation(t);case z:return this.visitTerminal(t);case sr:return this.visitRule(t);default:throw Error(`non exhaustive match`)}}visitNonTerminal(e){}visitAlternative(e){}visitOption(e){}visitRepetition(e){}visitRepetitionMandatory(e){}visitRepetitionMandatoryWithSeparator(e){}visitRepetitionWithSeparator(e){}visitAlternation(e){}visitTerminal(e){}visitRule(e){}};function vr(e){return e instanceof cr||e instanceof lr||e instanceof R||e instanceof ur||e instanceof dr||e instanceof fr||e instanceof z||e instanceof sr}function yr(e,t=[]){return e instanceof lr||e instanceof R||e instanceof fr?!0:e instanceof pr?e.definition.some(e=>yr(e,t)):e instanceof or&&t.includes(e)?!1:e instanceof ar?(e instanceof or&&t.push(e),e.definition.every(e=>yr(e,t))):!1}function br(e){return e instanceof pr}function xr(e){if(e instanceof or)return`SUBRULE`;if(e instanceof lr)return`OPTION`;if(e instanceof pr)return`OR`;if(e instanceof ur)return`AT_LEAST_ONE`;if(e instanceof dr)return`AT_LEAST_ONE_SEP`;if(e instanceof fr)return`MANY_SEP`;if(e instanceof R)return`MANY`;if(e instanceof z)return`CONSUME`;throw Error(`non exhaustive match`)}var Sr=class{walk(e,t=[]){e.definition.forEach((n,r)=>{let i=e.definition.slice(r+1);if(n instanceof or)this.walkProdRef(n,i,t);else if(n instanceof z)this.walkTerminal(n,i,t);else if(n instanceof cr)this.walkFlat(n,i,t);else if(n instanceof lr)this.walkOption(n,i,t);else if(n instanceof ur)this.walkAtLeastOne(n,i,t);else if(n instanceof dr)this.walkAtLeastOneSep(n,i,t);else if(n instanceof fr)this.walkManySep(n,i,t);else if(n instanceof R)this.walkMany(n,i,t);else if(n instanceof pr)this.walkOr(n,i,t);else throw Error(`non exhaustive match`)})}walkTerminal(e,t,n){}walkProdRef(e,t,n){}walkFlat(e,t,n){let r=t.concat(n);this.walk(e,r)}walkOption(e,t,n){let r=t.concat(n);this.walk(e,r)}walkAtLeastOne(e,t,n){let r=[new lr({definition:e.definition})].concat(t,n);this.walk(e,r)}walkAtLeastOneSep(e,t,n){let r=Cr(e,t,n);this.walk(e,r)}walkMany(e,t,n){let r=[new lr({definition:e.definition})].concat(t,n);this.walk(e,r)}walkManySep(e,t,n){let r=Cr(e,t,n);this.walk(e,r)}walkOr(e,t,n){let r=t.concat(n);e.definition.forEach(e=>{let t=new cr({definition:[e]});this.walk(t,r)})}};function Cr(e,t,n){return[new lr({definition:[new z({terminalType:e.separator})].concat(e.definition)})].concat(t,n)}function wr(e){if(e instanceof or)return wr(e.referencedRule);if(e instanceof z)return Dr(e);if(vr(e))return Tr(e);if(br(e))return Er(e);throw Error(`non exhaustive match`)}function Tr(e){let t=[],n=e.definition,r=0,i=n.length>r,a,o=!0;for(;i&&o;)a=n[r],o=yr(a),t=t.concat(wr(a)),r+=1,i=n.length>r;return[...new Set(t)]}function Er(e){let t=e.definition.map(e=>wr(e));return[...new Set(t.flat())]}function Dr(e){return[e.terminalType]}var Or=`_~IN~_`,kr=class extends Sr{constructor(e){super(),this.topProd=e,this.follows={}}startWalking(){return this.walk(this.topProd),this.follows}walkTerminal(e,t,n){}walkProdRef(e,t,n){let r=jr(e.referencedRule,e.idx)+this.topProd.name,i=wr(new cr({definition:t.concat(n)}));this.follows[r]=i}};function Ar(e){let t={};return e.forEach(e=>{let n=new kr(e).startWalking();Object.assign(t,n)}),t}function jr(e,t){return e.name+t+Or}var Mr={},Nr=new ln;function Pr(e){let t=e.toString();if(Mr.hasOwnProperty(t))return Mr[t];{let e=Nr.pattern(t);return Mr[t]=e,e}}function Fr(){Mr={}}var Ir=`Complement Sets are not supported for first char optimization`,Lr=`Unable to use "first char" lexer optimizations:
`;function Rr(e,t=!1){try{let t=Pr(e);return zr(t.value,{},t.flags.ignoreCase)}catch(n){if(n.message===Ir)t&&er(`${Lr}\tUnable to optimize: < ${e.toString()} >\n	Complement Sets cannot be automatically optimized.
	This will disable the lexer's first char optimizations.
	See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#COMPLEMENT for details.`);else{let n=``;t&&(n=`
	This will disable the lexer's first char optimizations.
	See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#REGEXP_PARSING for details.`),$n(`${Lr}\n\tFailed parsing: < ${e.toString()} >\n\tUsing the @chevrotain/regexp-to-ast library\n	Please open an issue at: https://github.com/chevrotain/chevrotain/issues`+n)}}return[]}function zr(e,t,n){switch(e.type){case`Disjunction`:for(let r=0;r<e.value.length;r++)zr(e.value[r],t,n);break;case`Alternative`:let r=e.value;for(let e=0;e<r.length;e++){let i=r[e];switch(i.type){case`EndAnchor`:case`GroupBackReference`:case`Lookahead`:case`NegativeLookahead`:case`Lookbehind`:case`NegativeLookbehind`:case`StartAnchor`:case`WordBoundary`:case`NonWordBoundary`:continue}let a=i;switch(a.type){case`Character`:Br(a.value,t,n);break;case`Set`:if(a.complement===!0)throw Error(Ir);a.value.forEach(e=>{if(typeof e==`number`)Br(e,t,n);else{let r=e;if(n===!0)for(let e=r.from;e<=r.to;e++)Br(e,t,n);else{for(let e=r.from;e<=r.to&&e<256;e++)Br(e,t,n);if(r.to>=256){let e=r.from>=256?r.from:256,n=r.to,i=wi(e),a=wi(n);for(let e=i;e<=a;e++)t[e]=e}}}});break;case`Group`:zr(a.value,t,n);break;default:throw Error(`Non Exhaustive Match`)}let o=a.quantifier!==void 0&&a.quantifier.atLeast===0;if(a.type===`Group`&&Ur(a)===!1||a.type!==`Group`&&o===!1)break}break;default:throw Error(`non exhaustive match!`)}return Object.values(t)}function Br(e,t,n){let r=wi(e);t[r]=r,n===!0&&Vr(e,t)}function Vr(e,t){let n=String.fromCharCode(e),r=n.toUpperCase();if(r!==n){let e=wi(r.charCodeAt(0));t[e]=e}else{let e=n.toLowerCase();if(e!==n){let n=wi(e.charCodeAt(0));t[n]=n}}}function Hr(e,t){return e.value.find(e=>{if(typeof e==`number`)return t.includes(e);{let n=e;return t.find(e=>n.from<=e&&e<=n.to)!==void 0}})}function Ur(e){let t=e.quantifier;return t&&t.atLeast===0?!0:e.value?Array.isArray(e.value)?e.value.every(Ur):Ur(e.value):!1}var Wr=class extends un{constructor(e){super(),this.targetCharCodes=e,this.found=!1}visitChildren(e){if(this.found!==!0){switch(e.type){case`Lookahead`:this.visitLookahead(e);return;case`NegativeLookahead`:this.visitNegativeLookahead(e);return;case`Lookbehind`:this.visitLookbehind(e);return;case`NegativeLookbehind`:this.visitNegativeLookbehind(e);return}super.visitChildren(e)}}visitCharacter(e){this.targetCharCodes.includes(e.value)&&(this.found=!0)}visitSet(e){e.complement?Hr(e,this.targetCharCodes)===void 0&&(this.found=!0):Hr(e,this.targetCharCodes)!==void 0&&(this.found=!0)}};function Gr(e,t){if(t instanceof RegExp){let n=Pr(t),r=new Wr(e);return r.visit(n),r.found}else{for(let n of t){let t=n.charCodeAt(0);if(e.includes(t))return!0}return!1}}var Kr=`PATTERN`,qr=`defaultMode`;function Jr(e,t){t=Object.assign({safeMode:!1,positionTracking:`full`,lineTerminatorCharacters:[`\r`,`
`],tracer:(e,t)=>t()},t);let n=t.tracer;n(`initCharCodeToOptimizedIndexMap`,()=>{Ti()});let r;n(`Reject Lexer.NA`,()=>{r=e.filter(e=>e[Kr]!==Ui.NA)});let i=!1,a;n(`Transform Patterns`,()=>{i=!1,a=r.map(e=>{let t=e[Kr];if(t instanceof RegExp){let e=t.source;return e.length===1&&e!==`^`&&e!==`$`&&e!==`.`&&!t.ignoreCase?e:e.length===2&&e[0]===`\\`&&![`d`,`D`,`s`,`S`,`t`,`r`,`n`,`t`,`0`,`c`,`b`,`B`,`f`,`v`,`w`,`W`].includes(e[1])?e[1]:fi(t)}else if(typeof t==`function`)return i=!0,{exec:t};else if(typeof t==`object`)return i=!0,t;else if(typeof t==`string`){if(t.length===1)return t;{let e=t.replace(/[\\^$.*+?()[\]{}|]/g,`\\$&`);return fi(new RegExp(e))}}else throw Error(`non exhaustive match`)})});let o,s,c,l,u;n(`misc mapping`,()=>{o=r.map(e=>e.tokenTypeIdx),s=r.map(e=>{let t=e.GROUP;if(t!==Ui.SKIPPED){if(typeof t==`string`)return t;if(t===void 0)return!1;throw Error(`non exhaustive match`)}}),c=r.map(e=>{let t=e.LONGER_ALT;if(t)return Array.isArray(t)?t.map(e=>r.indexOf(e)):[r.indexOf(t)]}),l=r.map(e=>e.PUSH_MODE),u=r.map(e=>Object.hasOwn(e,`POP_MODE`))});let d;n(`Line Terminator Handling`,()=>{let e=xi(t.lineTerminatorCharacters);d=r.map(e=>!1),t.positionTracking!==`onlyOffset`&&(d=r.map(t=>Object.hasOwn(t,`LINE_BREAKS`)?!!t.LINE_BREAKS:yi(t,e)===!1&&Gr(e,t.PATTERN)))});let f,p,m,h;n(`Misc Mapping #2`,()=>{f=r.map(gi),p=a.map(_i),m=r.reduce((e,t)=>{let n=t.GROUP;return typeof n==`string`&&n!==Ui.SKIPPED&&(e[n]=[]),e},{}),h=a.map((e,t)=>({pattern:a[t],longerAlt:c[t],canLineTerminator:d[t],isCustom:f[t],short:p[t],group:s[t],push:l[t],pop:u[t],tokenTypeIdx:o[t],tokenType:r[t]}))});let g=!0,_=[];return t.safeMode||n(`First Char Optimization`,()=>{_=r.reduce((e,n,r)=>{if(typeof n.PATTERN==`string`)Si(e,wi(n.PATTERN.charCodeAt(0)),h[r]);else if(Array.isArray(n.START_CHARS_HINT)){let t;n.START_CHARS_HINT.forEach(n=>{let i=wi(typeof n==`string`?n.charCodeAt(0):n);t!==i&&(t=i,Si(e,i,h[r]))})}else if(n.PATTERN instanceof RegExp)if(n.PATTERN.unicode)g=!1,t.ensureOptimizations&&$n(`${Lr}\tUnable to analyze < ${n.PATTERN.toString()} > pattern.\n	The regexp unicode flag is not currently supported by the regexp-to-ast library.
	This will disable the lexer's first char optimizations.
	For details See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#UNICODE_OPTIMIZE`);else{let i=Rr(n.PATTERN,t.ensureOptimizations);i.length===0&&(g=!1),i.forEach(t=>{Si(e,t,h[r])})}else t.ensureOptimizations&&$n(`${Lr}\tTokenType: <${n.name}> is using a custom token pattern without providing <start_chars_hint> parameter.\n	This will disable the lexer's first char optimizations.
	For details See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#CUSTOM_OPTIMIZE`),g=!1;return e},[])}),{emptyGroups:m,patternIdxToConfig:h,charCodeToPatternIdxToConfig:_,hasCustom:i,canBeOptimized:g}}function Yr(e,t){let n=[],r=Zr(e);n=n.concat(r.errors);let i=Qr(r.valid),a=i.valid;return n=n.concat(i.errors),n=n.concat(Xr(a)),n=n.concat(oi(a)),n=n.concat(si(a,t)),n=n.concat(ci(a)),n}function Xr(e){let t=[],n=e.filter(e=>e[Kr]instanceof RegExp);return t=t.concat(ei(n)),t=t.concat(ri(n)),t=t.concat(ii(n)),t=t.concat(ai(n)),t=t.concat(ti(n)),t}function Zr(e){let t=e.filter(e=>!Object.hasOwn(e,Kr));return{errors:t.map(e=>({message:`Token Type: ->`+e.name+`<- missing static 'PATTERN' property`,type:B.MISSING_PATTERN,tokenTypes:[e]})),valid:e.filter(e=>!t.includes(e))}}function Qr(e){let t=e.filter(e=>{let t=e[Kr];return!(t instanceof RegExp)&&typeof t!=`function`&&!Object.hasOwn(t,`exec`)&&typeof t!=`string`});return{errors:t.map(e=>({message:`Token Type: ->`+e.name+`<- static 'PATTERN' can only be a RegExp, a Function matching the {CustomPatternMatcherFunc} type or an Object matching the {ICustomPattern} interface.`,type:B.INVALID_PATTERN,tokenTypes:[e]})),valid:e.filter(e=>!t.includes(e))}}var $r=/[^\\][$]/;function ei(e){class t extends un{constructor(){super(...arguments),this.found=!1}visitEndAnchor(e){this.found=!0}}return e.filter(e=>{let n=e.PATTERN;try{let e=Pr(n),r=new t;return r.visit(e),r.found}catch{return $r.test(n.source)}}).map(e=>({message:`Unexpected RegExp Anchor Error:
	Token Type: ->`+e.name+`<- static 'PATTERN' cannot contain end of input anchor '$'
	See chevrotain.io/docs/guide/resolving_lexer_errors.html#ANCHORS	for details.`,type:B.EOI_ANCHOR_FOUND,tokenTypes:[e]}))}function ti(e){return e.filter(e=>e.PATTERN.test(``)).map(e=>({message:`Token Type: ->`+e.name+`<- static 'PATTERN' must not match an empty string`,type:B.EMPTY_MATCH_PATTERN,tokenTypes:[e]}))}var ni=/[^\\[][\^]|^\^/;function ri(e){class t extends un{constructor(){super(...arguments),this.found=!1}visitStartAnchor(e){this.found=!0}}return e.filter(e=>{let n=e.PATTERN;try{let e=Pr(n),r=new t;return r.visit(e),r.found}catch{return ni.test(n.source)}}).map(e=>({message:`Unexpected RegExp Anchor Error:
	Token Type: ->`+e.name+`<- static 'PATTERN' cannot contain start of input anchor '^'
	See https://chevrotain.io/docs/guide/resolving_lexer_errors.html#ANCHORS	for details.`,type:B.SOI_ANCHOR_FOUND,tokenTypes:[e]}))}function ii(e){return e.filter(e=>{let t=e[Kr];return t instanceof RegExp&&(t.multiline||t.global)}).map(e=>({message:`Token Type: ->`+e.name+`<- static 'PATTERN' may NOT contain global('g') or multiline('m')`,type:B.UNSUPPORTED_FLAGS_FOUND,tokenTypes:[e]}))}function ai(e){let t=[],n=e.map(n=>e.reduce((e,r)=>n.PATTERN.source===r.PATTERN.source&&!t.includes(r)&&r.PATTERN!==Ui.NA?(t.push(r),e.push(r),e):e,[]));return n=n.filter(Boolean),n.filter(e=>e.length>1).map(e=>{let t=e.map(e=>e.name);return{message:`The same RegExp pattern ->${e[0].PATTERN}<-has been used in all of the following Token Types: ${t.join(`, `)} <-`,type:B.DUPLICATE_PATTERNS_FOUND,tokenTypes:e}})}function oi(e){return e.filter(e=>{if(!Object.hasOwn(e,`GROUP`))return!1;let t=e.GROUP;return t!==Ui.SKIPPED&&t!==Ui.NA&&typeof t!=`string`}).map(e=>({message:`Token Type: ->`+e.name+`<- static 'GROUP' can only be Lexer.SKIPPED/Lexer.NA/A String`,type:B.INVALID_GROUP_TYPE_FOUND,tokenTypes:[e]}))}function si(e,t){return e.filter(e=>e.PUSH_MODE!==void 0&&!t.includes(e.PUSH_MODE)).map(e=>({message:`Token Type: ->${e.name}<- static 'PUSH_MODE' value cannot refer to a Lexer Mode ->${e.PUSH_MODE}<-which does not exist`,type:B.PUSH_MODE_DOES_NOT_EXIST,tokenTypes:[e]}))}function ci(e){let t=[],n=e.reduce((e,t,n)=>{let r=t.PATTERN;return r===Ui.NA||(typeof r==`string`?e.push({str:r,idx:n,tokenType:t}):r instanceof RegExp&&ui(r)&&e.push({str:r.source,idx:n,tokenType:t})),e},[]);return e.forEach((e,r)=>{n.forEach(({str:n,idx:i,tokenType:a})=>{if(r<i&&li(n,e.PATTERN)){let n=`Token: ->${a.name}<- can never be matched.\nBecause it appears AFTER the Token Type ->${e.name}<-in the lexer's definition.\nSee https://chevrotain.io/docs/guide/resolving_lexer_errors.html#UNREACHABLE`;t.push({message:n,type:B.UNREACHABLE_PATTERN,tokenTypes:[e,a]})}})}),t}function li(e,t){if(t instanceof RegExp){if(di(t))return!1;let n=t.exec(e);return n!==null&&n.index===0}else if(typeof t==`function`)return t(e,0,[],{});else if(Object.hasOwn(t,`exec`))return t.exec(e,0,[],{});else if(typeof t==`string`)return t===e;else throw Error(`non exhaustive match`)}function ui(e){return[`.`,`\\`,`[`,`]`,`|`,`^`,`$`,`(`,`)`,`?`,`*`,`+`,`{`].find(t=>e.source.indexOf(t)!==-1)===void 0}function di(e){return/(\(\?=)|(\(\?!)|(\(\?<=)|(\(\?<!)/.test(e.source)}function fi(e){let t=e.ignoreCase?`iy`:`y`;return RegExp(`${e.source}`,t)}function pi(e,t,n){let r=[];return Object.hasOwn(e,`defaultMode`)||r.push({message:`A MultiMode Lexer cannot be initialized without a <defaultMode> property in its definition
`,type:B.MULTI_MODE_LEXER_WITHOUT_DEFAULT_MODE}),Object.hasOwn(e,`modes`)||r.push({message:`A MultiMode Lexer cannot be initialized without a <modes> property in its definition
`,type:B.MULTI_MODE_LEXER_WITHOUT_MODES_PROPERTY}),Object.hasOwn(e,`modes`)&&Object.hasOwn(e,`defaultMode`)&&!Object.hasOwn(e.modes,e.defaultMode)&&r.push({message:`A MultiMode Lexer cannot be initialized with a ${qr}: <${e.defaultMode}>which does not exist\n`,type:B.MULTI_MODE_LEXER_DEFAULT_MODE_VALUE_DOES_NOT_EXIST}),Object.hasOwn(e,`modes`)&&Object.keys(e.modes).forEach(t=>{let n=e.modes[t];n.forEach((e,i)=>{e===void 0?r.push({message:`A Lexer cannot be initialized using an undefined Token Type. Mode:<${t}> at index: <${i}>\n`,type:B.LEXER_DEFINITION_CANNOT_CONTAIN_UNDEFINED}):Object.hasOwn(e,`LONGER_ALT`)&&(Array.isArray(e.LONGER_ALT)?e.LONGER_ALT:[e.LONGER_ALT]).forEach(i=>{i!==void 0&&!n.includes(i)&&r.push({message:`A MultiMode Lexer cannot be initialized with a longer_alt <${i.name}> on token <${e.name}> outside of mode <${t}>\n`,type:B.MULTI_MODE_LEXER_LONGER_ALT_NOT_IN_CURRENT_MODE})})})}),r}function mi(e,t,n){let r=[],i=!1,a=Object.values(e.modes||{}).flat().filter(Boolean).filter(e=>e[Kr]!==Ui.NA),o=xi(n);return t&&a.forEach(e=>{let t=yi(e,o);if(t!==!1){let n={message:bi(e,t),type:t.issue,tokenType:e};r.push(n)}else Object.hasOwn(e,`LINE_BREAKS`)?e.LINE_BREAKS===!0&&(i=!0):Gr(o,e.PATTERN)&&(i=!0)}),t&&!i&&r.push({message:`Warning: No LINE_BREAKS Found.
	This Lexer has been defined to track line and column information,
	But none of the Token Types can be identified as matching a line terminator.
	See https://chevrotain.io/docs/guide/resolving_lexer_errors.html#LINE_BREAKS 
	for details.`,type:B.NO_LINE_BREAKS_FLAGS}),r}function hi(e){let t={};return Object.keys(e).forEach(n=>{let r=e[n];if(Array.isArray(r))t[n]=[];else throw Error(`non exhaustive match`)}),t}function gi(e){let t=e.PATTERN;if(t instanceof RegExp)return!1;if(typeof t==`function`||Object.hasOwn(t,`exec`))return!0;if(typeof t==`string`)return!1;throw Error(`non exhaustive match`)}function _i(e){return typeof e==`string`&&e.length===1&&e.charCodeAt(0)}var vi={test:function(e){let t=e.length;for(let n=this.lastIndex;n<t;n++){let t=e.charCodeAt(n);if(t===10)return this.lastIndex=n+1,!0;if(t===13)return e.charCodeAt(n+1)===10?this.lastIndex=n+2:this.lastIndex=n+1,!0}return!1},lastIndex:0};function yi(e,t){if(Object.hasOwn(e,`LINE_BREAKS`))return!1;if(e.PATTERN instanceof RegExp){try{Gr(t,e.PATTERN)}catch(e){return{issue:B.IDENTIFY_TERMINATOR,errMsg:e.message}}return!1}else if(typeof e.PATTERN==`string`)return!1;else if(gi(e))return{issue:B.CUSTOM_LINE_BREAK};else throw Error(`non exhaustive match`)}function bi(e,t){if(t.issue===B.IDENTIFY_TERMINATOR)return`Warning: unable to identify line terminator usage in pattern.
\tThe problem is in the <${e.name}> Token Type\n\t Root cause: ${t.errMsg}.\n	For details See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#IDENTIFY_TERMINATOR`;if(t.issue===B.CUSTOM_LINE_BREAK)return`Warning: A Custom Token Pattern should specify the <line_breaks> option.
\tThe problem is in the <${e.name}> Token Type\n	For details See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#CUSTOM_LINE_BREAK`;throw Error(`non exhaustive match`)}function xi(e){return e.map(e=>typeof e==`string`?e.charCodeAt(0):e)}function Si(e,t,n){e[t]===void 0?e[t]=[n]:e[t].push(n)}var Ci=[];function wi(e){return e<256?e:Ci[e]}function Ti(){if(Ci.length===0){Ci=Array(65536);for(let e=0;e<65536;e++)Ci[e]=e>255?255+~~(e/255):e}}function Ei(e,t){let n=e.tokenTypeIdx;return n===t.tokenTypeIdx||t.isParent===!0&&t.categoryMatchesMap[n]===!0}function Di(e,t){return e.tokenTypeIdx===t.tokenTypeIdx}var Oi=1,ki={};function Ai(e){let t=ji(e);Mi(t),Pi(t),Ni(t),t.forEach(e=>{e.isParent=e.categoryMatches.length>0})}function ji(e){let t=[...e],n=e,r=!0;for(;r;){n=n.map(e=>e.CATEGORIES).flat().filter(Boolean);let e=n.filter(e=>!t.includes(e));t=t.concat(e),e.length===0?r=!1:n=e}return t}function Mi(e){e.forEach(e=>{Ii(e)||(ki[Oi]=e,e.tokenTypeIdx=Oi++),Li(e)&&!Array.isArray(e.CATEGORIES)&&(e.CATEGORIES=[e.CATEGORIES]),Li(e)||(e.CATEGORIES=[]),Ri(e)||(e.categoryMatches=[]),zi(e)||(e.categoryMatchesMap={})})}function Ni(e){e.forEach(e=>{e.categoryMatches=[],Object.keys(e.categoryMatchesMap).forEach(t=>{e.categoryMatches.push(ki[t].tokenTypeIdx)})})}function Pi(e){e.forEach(e=>{Fi([],e)})}function Fi(e,t){e.forEach(e=>{t.categoryMatchesMap[e.tokenTypeIdx]=!0}),t.CATEGORIES.forEach(n=>{let r=e.concat(t);r.includes(n)||Fi(r,n)})}function Ii(e){return Object.hasOwn(e??{},`tokenTypeIdx`)}function Li(e){return Object.hasOwn(e??{},`CATEGORIES`)}function Ri(e){return Object.hasOwn(e??{},`categoryMatches`)}function zi(e){return Object.hasOwn(e??{},`categoryMatchesMap`)}function Bi(e){return Object.hasOwn(e??{},`tokenTypeIdx`)}var Vi={buildUnableToPopLexerModeMessage(e){return`Unable to pop Lexer Mode after encountering Token ->${e.image}<- The Mode Stack is empty`},buildUnexpectedCharactersMessage(e,t,n,r,i,a){return`unexpected character: ->${e.charAt(t)}<- at offset: ${t}, skipped ${n} characters.`}},B;(function(e){e[e.MISSING_PATTERN=0]=`MISSING_PATTERN`,e[e.INVALID_PATTERN=1]=`INVALID_PATTERN`,e[e.EOI_ANCHOR_FOUND=2]=`EOI_ANCHOR_FOUND`,e[e.UNSUPPORTED_FLAGS_FOUND=3]=`UNSUPPORTED_FLAGS_FOUND`,e[e.DUPLICATE_PATTERNS_FOUND=4]=`DUPLICATE_PATTERNS_FOUND`,e[e.INVALID_GROUP_TYPE_FOUND=5]=`INVALID_GROUP_TYPE_FOUND`,e[e.PUSH_MODE_DOES_NOT_EXIST=6]=`PUSH_MODE_DOES_NOT_EXIST`,e[e.MULTI_MODE_LEXER_WITHOUT_DEFAULT_MODE=7]=`MULTI_MODE_LEXER_WITHOUT_DEFAULT_MODE`,e[e.MULTI_MODE_LEXER_WITHOUT_MODES_PROPERTY=8]=`MULTI_MODE_LEXER_WITHOUT_MODES_PROPERTY`,e[e.MULTI_MODE_LEXER_DEFAULT_MODE_VALUE_DOES_NOT_EXIST=9]=`MULTI_MODE_LEXER_DEFAULT_MODE_VALUE_DOES_NOT_EXIST`,e[e.LEXER_DEFINITION_CANNOT_CONTAIN_UNDEFINED=10]=`LEXER_DEFINITION_CANNOT_CONTAIN_UNDEFINED`,e[e.SOI_ANCHOR_FOUND=11]=`SOI_ANCHOR_FOUND`,e[e.EMPTY_MATCH_PATTERN=12]=`EMPTY_MATCH_PATTERN`,e[e.NO_LINE_BREAKS_FLAGS=13]=`NO_LINE_BREAKS_FLAGS`,e[e.UNREACHABLE_PATTERN=14]=`UNREACHABLE_PATTERN`,e[e.IDENTIFY_TERMINATOR=15]=`IDENTIFY_TERMINATOR`,e[e.CUSTOM_LINE_BREAK=16]=`CUSTOM_LINE_BREAK`,e[e.MULTI_MODE_LEXER_LONGER_ALT_NOT_IN_CURRENT_MODE=17]=`MULTI_MODE_LEXER_LONGER_ALT_NOT_IN_CURRENT_MODE`})(B||={});var Hi={deferDefinitionErrorsHandling:!1,positionTracking:`full`,lineTerminatorsPattern:/\n|\r\n?/g,lineTerminatorCharacters:[`
`,`\r`],ensureOptimizations:!1,safeMode:!1,errorMessageProvider:Vi,traceInitPerf:!1,skipValidations:!1,recoveryEnabled:!0};Object.freeze(Hi);var Ui=class{constructor(e,t=Hi){if(this.lexerDefinition=e,this.lexerDefinitionErrors=[],this.lexerDefinitionWarning=[],this.patternIdxToConfig={},this.charCodeToPatternIdxToConfig={},this.modes=[],this.emptyGroups={},this.trackStartLines=!0,this.trackEndLines=!0,this.hasCustom=!1,this.canModeBeOptimized={},this.TRACE_INIT=(e,t)=>{if(this.traceInitPerf===!0){this.traceInitIndent++;let n=Array(this.traceInitIndent+1).join(`	`);this.traceInitIndent<this.traceInitMaxIdent&&console.log(`${n}--> <${e}>`);let{time:r,value:i}=tr(t),a=r>10?console.warn:console.log;return this.traceInitIndent<this.traceInitMaxIdent&&a(`${n}<-- <${e}> time: ${r}ms`),this.traceInitIndent--,i}else return t()},typeof t==`boolean`)throw Error(`The second argument to the Lexer constructor is now an ILexerConfig Object.
a boolean 2nd argument is no longer supported`);this.config=Object.assign({},Hi,t);let n=this.config.traceInitPerf;n===!0?(this.traceInitMaxIdent=1/0,this.traceInitPerf=!0):typeof n==`number`&&(this.traceInitMaxIdent=n,this.traceInitPerf=!0),this.traceInitIndent=-1,this.TRACE_INIT(`Lexer Constructor`,()=>{let n,r=!0;this.TRACE_INIT(`Lexer Config handling`,()=>{if(this.config.lineTerminatorsPattern===Hi.lineTerminatorsPattern)this.config.lineTerminatorsPattern=vi;else if(this.config.lineTerminatorCharacters===Hi.lineTerminatorCharacters)throw Error(`Error: Missing <lineTerminatorCharacters> property on the Lexer config.
	For details See: https://chevrotain.io/docs/guide/resolving_lexer_errors.html#MISSING_LINE_TERM_CHARS`);if(t.safeMode&&t.ensureOptimizations)throw Error(`"safeMode" and "ensureOptimizations" flags are mutually exclusive.`);this.trackStartLines=/full|onlyStart/i.test(this.config.positionTracking),this.trackEndLines=/full/i.test(this.config.positionTracking),Array.isArray(e)?n={modes:{defaultMode:[...e]},defaultMode:qr}:(r=!1,n=Object.assign({},e))}),this.config.skipValidations===!1&&(this.TRACE_INIT(`performRuntimeChecks`,()=>{this.lexerDefinitionErrors=this.lexerDefinitionErrors.concat(pi(n,this.trackStartLines,this.config.lineTerminatorCharacters))}),this.TRACE_INIT(`performWarningRuntimeChecks`,()=>{this.lexerDefinitionWarning=this.lexerDefinitionWarning.concat(mi(n,this.trackStartLines,this.config.lineTerminatorCharacters))})),n.modes=n.modes?n.modes:{},Object.entries(n.modes).forEach(([e,t])=>{n.modes[e]=t.filter(e=>e!==void 0)});let i=Object.keys(n.modes);if(Object.entries(n.modes).forEach(([e,n])=>{this.TRACE_INIT(`Mode: <${e}> processing`,()=>{if(this.modes.push(e),this.config.skipValidations===!1&&this.TRACE_INIT(`validatePatterns`,()=>{this.lexerDefinitionErrors=this.lexerDefinitionErrors.concat(Yr(n,i))}),this.lexerDefinitionErrors.length===0){Ai(n);let r;this.TRACE_INIT(`analyzeTokenTypes`,()=>{r=Jr(n,{lineTerminatorCharacters:this.config.lineTerminatorCharacters,positionTracking:t.positionTracking,ensureOptimizations:t.ensureOptimizations,safeMode:t.safeMode,tracer:this.TRACE_INIT})}),this.patternIdxToConfig[e]=r.patternIdxToConfig,this.charCodeToPatternIdxToConfig[e]=r.charCodeToPatternIdxToConfig,this.emptyGroups=Object.assign({},this.emptyGroups,r.emptyGroups),this.hasCustom=r.hasCustom||this.hasCustom,this.canModeBeOptimized[e]=r.canBeOptimized}})}),this.defaultMode=n.defaultMode,this.lexerDefinitionErrors.length>0&&!this.config.deferDefinitionErrorsHandling){let e=this.lexerDefinitionErrors.map(e=>e.message).join(`-----------------------
`);throw Error(`Errors detected in definition of Lexer:
`+e)}this.lexerDefinitionWarning.forEach(e=>{er(e.message)}),this.TRACE_INIT(`Choosing sub-methods implementations`,()=>{if(r&&(this.handleModes=()=>{}),this.trackStartLines===!1&&(this.computeNewColumn=e=>e),this.trackEndLines===!1&&(this.updateTokenEndLineColumnLocation=()=>{}),/full/i.test(this.config.positionTracking))this.createTokenInstance=this.createFullToken;else if(/onlyStart/i.test(this.config.positionTracking))this.createTokenInstance=this.createStartOnlyToken;else if(/onlyOffset/i.test(this.config.positionTracking))this.createTokenInstance=this.createOffsetOnlyToken;else throw Error(`Invalid <positionTracking> config option: "${this.config.positionTracking}"`);this.hasCustom?(this.addToken=this.addTokenUsingPush,this.handlePayload=this.handlePayloadWithCustom):(this.addToken=this.addTokenUsingMemberAccess,this.handlePayload=this.handlePayloadNoCustom)}),this.TRACE_INIT(`Failed Optimization Warnings`,()=>{let e=Object.entries(this.canModeBeOptimized).reduce((e,[t,n])=>(n===!1&&e.push(t),e),[]);if(t.ensureOptimizations&&e.length>0)throw Error(`Lexer Modes: < ${e.join(`, `)} > cannot be optimized.\n	 Disable the "ensureOptimizations" lexer config flag to silently ignore this and run the lexer in an un-optimized mode.
	 Or inspect the console log for details on how to resolve these issues.`)}),this.TRACE_INIT(`clearRegExpParserCache`,()=>{Fr()}),this.TRACE_INIT(`toFastProperties`,()=>{nr(this)})})}tokenize(e,t=this.defaultMode){if(this.lexerDefinitionErrors.length>0){let e=this.lexerDefinitionErrors.map(e=>e.message).join(`-----------------------
`);throw Error(`Unable to Tokenize because Errors detected in definition of Lexer:
`+e)}return this.tokenizeInternal(e,t)}tokenizeInternal(e,t){let n,r,i,a,o,s,c,l,u,d,f,p,m,h,g,_=e,v=_.length,y=0,ee=0,b=this.hasCustom?0:Math.floor(e.length/10),x=Array(b),S=[],te=this.trackStartLines?1:void 0,C=this.trackStartLines?1:void 0,w=hi(this.emptyGroups),T=this.trackStartLines,E=this.config.lineTerminatorsPattern,ne=0,D=[],O=[],k=[],A=[];Object.freeze(A);let re=!1,ie=e=>{if(k.length===1&&e.tokenType.PUSH_MODE===void 0){let t=this.config.errorMessageProvider.buildUnableToPopLexerModeMessage(e);S.push({offset:e.startOffset,line:e.startLine,column:e.startColumn,length:e.image.length,message:t})}else{k.pop();let e=k.at(-1);D=this.patternIdxToConfig[e],O=this.charCodeToPatternIdxToConfig[e],ne=D.length;let t=this.canModeBeOptimized[e]&&this.config.safeMode===!1;re=!!(O&&t)}};function ae(e){k.push(e),O=this.charCodeToPatternIdxToConfig[e],D=this.patternIdxToConfig[e],ne=D.length,ne=D.length;let t=this.canModeBeOptimized[e]&&this.config.safeMode===!1;re=!!(O&&t)}ae.call(this,t);let j,M=this.config.recoveryEnabled;for(;y<v;){s=null,u=-1;let t=_.charCodeAt(y),b;if(re){let e=wi(t),n=O[e];b=n===void 0?A:n}else b=D;let oe=b.length;for(n=0;n<oe;n++){j=b[n];let r=j.pattern;c=null;let d=j.short;if(d===!1?j.isCustom===!0?(g=r.exec(_,y,x,w),g===null?s=null:(s=g[0],u=s.length,g.payload!==void 0&&(c=g.payload))):(r.lastIndex=y,u=this.matchLength(r,e,y)):t===d&&(u=1,s=r),u!==-1){if(o=j.longerAlt,o!==void 0){s=e.substring(y,y+u);let t=o.length;for(i=0;i<t;i++){let t=D[o[i]],n=t.pattern;if(l=null,t.isCustom===!0?(g=n.exec(_,y,x,w),g===null?a=null:(a=g[0],g.payload!==void 0&&(l=g.payload))):(n.lastIndex=y,a=this.match(n,e,y)),a&&a.length>s.length){s=a,u=a.length,c=l,j=t;break}}}break}}if(u!==-1){if(d=j.group,d!==void 0&&(s=s===null?e.substring(y,y+u):s,f=j.tokenTypeIdx,p=this.createTokenInstance(s,y,f,j.tokenType,te,C,u),this.handlePayload(p,c),d===!1?ee=this.addToken(x,ee,p):w[d].push(p)),T===!0&&j.canLineTerminator===!0){let t=0,n,r;E.lastIndex=0;do s=s===null?e.substring(y,y+u):s,n=E.test(s),n===!0&&(r=E.lastIndex-1,t++);while(n===!0);t===0?C=this.computeNewColumn(C,u):(te+=t,C=u-r,this.updateTokenEndLineColumnLocation(p,d,r,t,te,C,u))}else C=this.computeNewColumn(C,u);y+=u,this.handleModes(j,ie,ae,p)}else{let t=y,n=te,i=C,a=M===!1;for(;a===!1&&y<v;)for(y++,r=0;r<ne;r++){let t=D[r],n=t.pattern,i=t.short;if(i===!1?t.isCustom===!0?a=n.exec(_,y,x,w)!==null:(n.lastIndex=y,a=n.exec(e)!==null):_.charCodeAt(y)===i&&(a=!0),a===!0)break}if(m=y-t,C=this.computeNewColumn(C,m),h=this.config.errorMessageProvider.buildUnexpectedCharactersMessage(_,t,m,n,i,k.at(-1)),S.push({offset:t,line:n,column:i,length:m,message:h}),M===!1)break}}return this.hasCustom||(x.length=ee),{tokens:x,groups:w,errors:S}}handleModes(e,t,n,r){if(e.pop===!0){let i=e.push;t(r),i!==void 0&&n.call(this,i)}else e.push!==void 0&&n.call(this,e.push)}updateTokenEndLineColumnLocation(e,t,n,r,i,a,o){let s,c;t!==void 0&&(s=n===o-1,c=s?-1:0,r===1&&s===!0||(e.endLine=i+c,e.endColumn=a-1+-c))}computeNewColumn(e,t){return e+t}createOffsetOnlyToken(e,t,n,r){return{image:e,startOffset:t,tokenTypeIdx:n,tokenType:r}}createStartOnlyToken(e,t,n,r,i,a){return{image:e,startOffset:t,startLine:i,startColumn:a,tokenTypeIdx:n,tokenType:r}}createFullToken(e,t,n,r,i,a,o){return{image:e,startOffset:t,endOffset:t+o-1,startLine:i,endLine:i,startColumn:a,endColumn:a+o-1,tokenTypeIdx:n,tokenType:r}}addTokenUsingPush(e,t,n){return e.push(n),t}addTokenUsingMemberAccess(e,t,n){return e[t]=n,t++,t}handlePayloadNoCustom(e,t){}handlePayloadWithCustom(e,t){t!==null&&(e.payload=t)}match(e,t,n){return e.test(t)===!0?t.substring(n,e.lastIndex):null}matchLength(e,t,n){return e.test(t)===!0?e.lastIndex-n:-1}};Ui.SKIPPED=`This marks a skipped Token pattern, this means each token identified by it will be consumed and then thrown into oblivion, this can be used to for example to completely ignore whitespace.`,Ui.NA=/NOT_APPLICABLE/;function Wi(e){return Gi(e)?e.LABEL:e.name}function Gi(e){return typeof e.LABEL==`string`&&e.LABEL!==``}var Ki=`parent`,qi=`categories`,Ji=`label`,Yi=`group`,Xi=`push_mode`,Zi=`pop_mode`,Qi=`longer_alt`,$i=`line_breaks`,ea=`start_chars_hint`;function ta(e){return na(e)}function na(e){let t=e.pattern,n={};if(n.name=e.name,t!==void 0&&(n.PATTERN=t),Object.hasOwn(e,Ki))throw`The parent property is no longer supported.
See: https://github.com/chevrotain/chevrotain/issues/564#issuecomment-349062346 for details.`;return Object.hasOwn(e,qi)&&(n.CATEGORIES=e[qi]),Ai([n]),Object.hasOwn(e,Ji)&&(n.LABEL=e[Ji]),Object.hasOwn(e,Yi)&&(n.GROUP=e[Yi]),Object.hasOwn(e,Zi)&&(n.POP_MODE=e[Zi]),Object.hasOwn(e,Xi)&&(n.PUSH_MODE=e[Xi]),Object.hasOwn(e,Qi)&&(n.LONGER_ALT=e[Qi]),Object.hasOwn(e,$i)&&(n.LINE_BREAKS=e[$i]),Object.hasOwn(e,ea)&&(n.START_CHARS_HINT=e[ea]),n}var ra=ta({name:`EOF`,pattern:Ui.NA});Ai([ra]);function ia(e,t,n,r,i,a,o,s){return{image:t,startOffset:n,endOffset:r,startLine:i,endLine:a,startColumn:o,endColumn:s,tokenTypeIdx:e.tokenTypeIdx,tokenType:e}}function aa(e,t){return Ei(e,t)}var oa={buildMismatchTokenMessage({expected:e,actual:t,previous:n,ruleName:r}){return`Expecting ${Gi(e)?`--> ${Wi(e)} <--`:`token of type --> ${e.name} <--`} but found --> '${t.image}' <--`},buildNotAllInputParsedMessage({firstRedundant:e,ruleName:t}){return`Redundant input, expecting EOF but found: `+e.image},buildNoViableAltMessage({expectedPathsPerAlt:e,actual:t,previous:n,customUserDescription:r,ruleName:i}){let a=`
but found: '`+t[0].image+`'`;return r?`Expecting: `+r+a:`Expecting: one of these possible Token sequences:\n${e.reduce((e,t)=>e.concat(t),[]).map(e=>`[${e.map(e=>Wi(e)).join(`, `)}]`).map((e,t)=>`  ${t+1}. ${e}`).join(`
`)}`+a},buildEarlyExitMessage({expectedIterationPaths:e,actual:t,customUserDescription:n,ruleName:r}){let i=`
but found: '`+t[0].image+`'`;return n?`Expecting: `+n+i:`Expecting: expecting at least one iteration which starts with one of these possible Token sequences::\n  <${e.map(e=>`[${e.map(e=>Wi(e)).join(`,`)}]`).join(` ,`)}>`+i}};Object.freeze(oa);var sa={buildRuleNotFoundError(e,t){return`Invalid grammar, reference to a rule which is not defined: ->`+t.nonTerminalName+`<-
inside top level rule: ->`+e.name+`<-`}},ca={buildDuplicateFoundError(e,t){function n(e){return e instanceof z?e.terminalType.name:e instanceof or?e.nonTerminalName:``}let r=e.name,i=t[0],a=i.idx,o=xr(i),s=n(i),c=`->${o}${a>0?a:``}<- ${s?`with argument: ->${s}<-`:``}
                  appears more than once (${t.length} times) in the top level rule: ->${r}<-.                  
                  For further details see: https://chevrotain.io/docs/FAQ.html#NUMERICAL_SUFFIXES 
                  `;return c=c.replace(/[ \t]+/g,` `),c=c.replace(/\s\s+/g,`
`),c},buildNamespaceConflictError(e){return`Namespace conflict found in grammar.\nThe grammar has both a Terminal(Token) and a Non-Terminal(Rule) named: <${e.name}>.\nTo resolve this make sure each Terminal and Non-Terminal names are unique\nThis is easy to accomplish by using the convention that Terminal names start with an uppercase letter\nand Non-Terminal names start with a lower case letter.`},buildAlternationPrefixAmbiguityError(e){let t=e.prefixPath.map(e=>Wi(e)).join(`, `),n=e.alternation.idx===0?``:e.alternation.idx;return`Ambiguous alternatives: <${e.ambiguityIndices.join(` ,`)}> due to common lookahead prefix\nin <OR${n}> inside <${e.topLevelRule.name}> Rule,\n<${t}> may appears as a prefix path in all these alternatives.\nSee: https://chevrotain.io/docs/guide/resolving_grammar_errors.html#COMMON_PREFIX\nFor Further details.`},buildAlternationAmbiguityError(e){let t=e.alternation.idx===0?``:e.alternation.idx,n=e.prefixPath.length===0,r=`Ambiguous Alternatives Detected: <${e.ambiguityIndices.join(` ,`)}> in <OR${t}> inside <${e.topLevelRule.name}> Rule,\n`;if(n)r+=`These alternatives are all empty (match no tokens), making them indistinguishable.
Only the last alternative may be empty.
`;else{let t=e.prefixPath.map(e=>Wi(e)).join(`, `);r+=`<${t}> may appears as a prefix path in all these alternatives.\n`}return r+=`See: https://chevrotain.io/docs/guide/resolving_grammar_errors.html#AMBIGUOUS_ALTERNATIVES
For Further details.`,r},buildEmptyRepetitionError(e){let t=xr(e.repetition);return e.repetition.idx!==0&&(t+=e.repetition.idx),`The repetition <${t}> within Rule <${e.topLevelRule.name}> can never consume any tokens.\nThis could lead to an infinite loop.`},buildTokenNameError(e){return`deprecated`},buildEmptyAlternationError(e){return`Ambiguous empty alternative: <${e.emptyChoiceIdx+1}> in <OR${e.alternation.idx}> inside <${e.topLevelRule.name}> Rule.\nOnly the last alternative may be an empty alternative.`},buildTooManyAlternativesError(e){return`An Alternation cannot have more than 256 alternatives:\n<OR${e.alternation.idx}> inside <${e.topLevelRule.name}> Rule.\n has ${e.alternation.definition.length+1} alternatives.`},buildLeftRecursionError(e){let t=e.topLevelRule.name;return`Left Recursion found in grammar.\nrule: <${t}> can be invoked from itself (directly or indirectly)\nwithout consuming any Tokens. The grammar path that causes this is: \n ${`${t} --> ${e.leftRecursionPath.map(e=>e.name).concat([t]).join(` --> `)}`}\n To fix this refactor your grammar to remove the left recursion.\nsee: https://en.wikipedia.org/wiki/LL_parser#Left_factoring.`},buildInvalidRuleNameError(e){return`deprecated`},buildDuplicateRuleNameError(e){let t;return t=e.topLevelRule instanceof sr?e.topLevelRule.name:e.topLevelRule,`Duplicate definition, rule: ->${t}<- is already defined in the grammar: ->${e.grammarName}<-`}};function la(e,t){let n=new ua(e,t);return n.resolveRefs(),n.errors}var ua=class extends _r{constructor(e,t){super(),this.nameToTopRule=e,this.errMsgProvider=t,this.errors=[]}resolveRefs(){Object.values(this.nameToTopRule).forEach(e=>{this.currTopLevel=e,e.accept(this)})}visitNonTerminal(e){let t=this.nameToTopRule[e.nonTerminalName];if(t)e.referencedRule=t;else{let t=this.errMsgProvider.buildRuleNotFoundError(this.currTopLevel,e);this.errors.push({message:t,type:ls.UNRESOLVED_SUBRULE_REF,ruleName:this.currTopLevel.name,unresolvedRefName:e.nonTerminalName})}}},da=class extends Sr{constructor(e,t){super(),this.topProd=e,this.path=t,this.possibleTokTypes=[],this.nextProductionName=``,this.nextProductionOccurrence=0,this.found=!1,this.isAtEndOfPath=!1}startWalking(){if(this.found=!1,this.path.ruleStack[0]!==this.topProd.name)throw Error(`The path does not start with the walker's top Rule!`);return this.ruleStack=[...this.path.ruleStack].reverse(),this.occurrenceStack=[...this.path.occurrenceStack].reverse(),this.ruleStack.pop(),this.occurrenceStack.pop(),this.updateExpectedNext(),this.walk(this.topProd),this.possibleTokTypes}walk(e,t=[]){this.found||super.walk(e,t)}walkProdRef(e,t,n){if(e.referencedRule.name===this.nextProductionName&&e.idx===this.nextProductionOccurrence){let r=t.concat(n);this.updateExpectedNext(),this.walk(e.referencedRule,r)}}updateExpectedNext(){this.ruleStack.length===0?(this.nextProductionName=``,this.nextProductionOccurrence=0,this.isAtEndOfPath=!0):(this.nextProductionName=this.ruleStack.pop(),this.nextProductionOccurrence=this.occurrenceStack.pop())}},fa=class extends da{constructor(e,t){super(e,t),this.path=t,this.nextTerminalName=``,this.nextTerminalOccurrence=0,this.nextTerminalName=this.path.lastTok.name,this.nextTerminalOccurrence=this.path.lastTokOccurrence}walkTerminal(e,t,n){if(this.isAtEndOfPath&&e.terminalType.name===this.nextTerminalName&&e.idx===this.nextTerminalOccurrence&&!this.found){let e=new cr({definition:t.concat(n)});this.possibleTokTypes=wr(e),this.found=!0}}},pa=class extends Sr{constructor(e,t){super(),this.topRule=e,this.occurrence=t,this.result={token:void 0,occurrence:void 0,isEndOfRule:void 0}}startWalking(){return this.walk(this.topRule),this.result}},ma=class extends pa{walkMany(e,t,n){if(e.idx===this.occurrence){let e=t.concat(n)[0];this.result.isEndOfRule=e===void 0,e instanceof z&&(this.result.token=e.terminalType,this.result.occurrence=e.idx)}else super.walkMany(e,t,n)}},ha=class extends pa{walkManySep(e,t,n){if(e.idx===this.occurrence){let e=t.concat(n)[0];this.result.isEndOfRule=e===void 0,e instanceof z&&(this.result.token=e.terminalType,this.result.occurrence=e.idx)}else super.walkManySep(e,t,n)}},ga=class extends pa{walkAtLeastOne(e,t,n){if(e.idx===this.occurrence){let e=t.concat(n)[0];this.result.isEndOfRule=e===void 0,e instanceof z&&(this.result.token=e.terminalType,this.result.occurrence=e.idx)}else super.walkAtLeastOne(e,t,n)}},_a=class extends pa{walkAtLeastOneSep(e,t,n){if(e.idx===this.occurrence){let e=t.concat(n)[0];this.result.isEndOfRule=e===void 0,e instanceof z&&(this.result.token=e.terminalType,this.result.occurrence=e.idx)}else super.walkAtLeastOneSep(e,t,n)}};function va(e,t,n=[]){n=[...n];let r=[],i=0;function a(t){return t.concat(e.slice(i+1))}function o(e){let i=va(a(e),t,n);return r.concat(i)}for(;n.length<t&&i<e.length;){let t=e[i];if(t instanceof cr||t instanceof or)return o(t.definition);if(t instanceof lr)r=o(t.definition);else if(t instanceof ur)return o(t.definition.concat([new R({definition:t.definition})]));else if(t instanceof dr)return o([new cr({definition:t.definition}),new R({definition:[new z({terminalType:t.separator})].concat(t.definition)})]);else if(t instanceof fr)r=o(t.definition.concat([new R({definition:[new z({terminalType:t.separator})].concat(t.definition)})]));else if(t instanceof R)r=o(t.definition.concat([new R({definition:t.definition})]));else if(t instanceof pr)return t.definition.forEach(e=>{e.definition.length!==0&&(r=o(e.definition))}),r;else if(t instanceof z)n.push(t.terminalType);else throw Error(`non exhaustive match`);i++}return r.push({partialPath:n,suffixDef:e.slice(i)}),r}function ya(e,t,n,r){let i=`EXIT_NONE_TERMINAL`,a=[i],o=`EXIT_ALTERNATIVE`,s=!1,c=t.length,l=c-r-1,u=[],d=[];for(d.push({idx:-1,def:e,ruleStack:[],occurrenceStack:[]});d.length!==0;){let e=d.pop();if(e===o){s&&d.at(-1).idx<=l&&d.pop();continue}let r=e.def,f=e.idx,p=e.ruleStack,m=e.occurrenceStack;if(r.length===0)continue;let h=r[0];if(h===i){let e={idx:f,def:r.slice(1),ruleStack:p.slice(0,-1),occurrenceStack:m.slice(0,-1)};d.push(e)}else if(h instanceof z)if(f<c-1){let e=f+1,i=t[e];if(n(i,h.terminalType)){let t={idx:e,def:r.slice(1),ruleStack:p,occurrenceStack:m};d.push(t)}}else if(f===c-1)u.push({nextTokenType:h.terminalType,nextTokenOccurrence:h.idx,ruleStack:p,occurrenceStack:m}),s=!0;else throw Error(`non exhaustive match`);else if(h instanceof or){let e=[...p];e.push(h.nonTerminalName);let t=[...m];t.push(h.idx);let n={idx:f,def:h.definition.concat(a,r.slice(1)),ruleStack:e,occurrenceStack:t};d.push(n)}else if(h instanceof lr){let e={idx:f,def:r.slice(1),ruleStack:p,occurrenceStack:m};d.push(e),d.push(o);let t={idx:f,def:h.definition.concat(r.slice(1)),ruleStack:p,occurrenceStack:m};d.push(t)}else if(h instanceof ur){let e=new R({definition:h.definition,idx:h.idx}),t={idx:f,def:h.definition.concat([e],r.slice(1)),ruleStack:p,occurrenceStack:m};d.push(t)}else if(h instanceof dr){let e=new R({definition:[new z({terminalType:h.separator})].concat(h.definition),idx:h.idx}),t={idx:f,def:h.definition.concat([e],r.slice(1)),ruleStack:p,occurrenceStack:m};d.push(t)}else if(h instanceof fr){let e={idx:f,def:r.slice(1),ruleStack:p,occurrenceStack:m};d.push(e),d.push(o);let t=new R({definition:[new z({terminalType:h.separator})].concat(h.definition),idx:h.idx}),n={idx:f,def:h.definition.concat([t],r.slice(1)),ruleStack:p,occurrenceStack:m};d.push(n)}else if(h instanceof R){let e={idx:f,def:r.slice(1),ruleStack:p,occurrenceStack:m};d.push(e),d.push(o);let t=new R({definition:h.definition,idx:h.idx}),n={idx:f,def:h.definition.concat([t],r.slice(1)),ruleStack:p,occurrenceStack:m};d.push(n)}else if(h instanceof pr)for(let e=h.definition.length-1;e>=0;e--){let t={idx:f,def:h.definition[e].definition.concat(r.slice(1)),ruleStack:p,occurrenceStack:m};d.push(t),d.push(o)}else if(h instanceof cr)d.push({idx:f,def:h.definition.concat(r.slice(1)),ruleStack:p,occurrenceStack:m});else if(h instanceof sr)d.push(ba(h,f,p,m));else throw Error(`non exhaustive match`)}return u}function ba(e,t,n,r){let i=[...n];i.push(e.name);let a=[...r];return a.push(1),{idx:t,def:e.definition,ruleStack:i,occurrenceStack:a}}var V;(function(e){e[e.OPTION=0]=`OPTION`,e[e.REPETITION=1]=`REPETITION`,e[e.REPETITION_MANDATORY=2]=`REPETITION_MANDATORY`,e[e.REPETITION_MANDATORY_WITH_SEPARATOR=3]=`REPETITION_MANDATORY_WITH_SEPARATOR`,e[e.REPETITION_WITH_SEPARATOR=4]=`REPETITION_WITH_SEPARATOR`,e[e.ALTERNATION=5]=`ALTERNATION`})(V||={});function xa(e){if(e instanceof lr||e===`Option`)return V.OPTION;if(e instanceof R||e===`Repetition`)return V.REPETITION;if(e instanceof ur||e===`RepetitionMandatory`)return V.REPETITION_MANDATORY;if(e instanceof dr||e===`RepetitionMandatoryWithSeparator`)return V.REPETITION_MANDATORY_WITH_SEPARATOR;if(e instanceof fr||e===`RepetitionWithSeparator`)return V.REPETITION_WITH_SEPARATOR;if(e instanceof pr||e===`Alternation`)return V.ALTERNATION;throw Error(`non exhaustive match`)}function Sa(e){let{occurrence:t,rule:n,prodType:r,maxLookahead:i}=e,a=xa(r);return a===V.ALTERNATION?Na(t,n,i):Pa(t,n,a,i)}function Ca(e,t,n,r,i,a){let o=Na(e,t,n);return a(o,r,La(o)?Di:Ei,i)}function wa(e,t,n,r,i,a){let o=Pa(e,t,i,n),s=La(o)?Di:Ei;return a(o[0],s,r)}function Ta(e,t,n,r){let i=e.length,a=e.every(e=>e.every(e=>e.length===1));if(t)return function(t){let r=t.map(e=>e.GATE);for(let t=0;t<i;t++){let i=e[t],a=i.length,o=r[t];if(!(o!==void 0&&o.call(this)===!1))nextPath:for(let e=0;e<a;e++){let r=i[e],a=r.length;for(let e=0;e<a;e++)if(n(this.LA_FAST(e+1),r[e])===!1)continue nextPath;return t}}};if(a&&!r){let t=e.map(e=>e.flat()).reduce((e,t,n)=>(t.forEach(t=>{t.tokenTypeIdx in e||(e[t.tokenTypeIdx]=n),t.categoryMatches.forEach(t=>{Object.hasOwn(e,t)||(e[t]=n)})}),e),{});return function(){let e=this.LA_FAST(1);return t[e.tokenTypeIdx]}}else return function(){for(let t=0;t<i;t++){let r=e[t],i=r.length;nextPath:for(let e=0;e<i;e++){let i=r[e],a=i.length;for(let e=0;e<a;e++)if(n(this.LA_FAST(e+1),i[e])===!1)continue nextPath;return t}}}}function Ea(e,t,n){let r=e.every(e=>e.length===1),i=e.length;if(r&&!n){let t=e.flat();if(t.length===1&&t[0].categoryMatches.length===0){let e=t[0].tokenTypeIdx;return function(){return this.LA_FAST(1).tokenTypeIdx===e}}else{let e=t.reduce((e,t,n)=>(e[t.tokenTypeIdx]=!0,t.categoryMatches.forEach(t=>{e[t]=!0}),e),[]);return function(){let t=this.LA_FAST(1);return e[t.tokenTypeIdx]===!0}}}else return function(){nextPath:for(let n=0;n<i;n++){let r=e[n],i=r.length;for(let e=0;e<i;e++)if(t(this.LA_FAST(e+1),r[e])===!1)continue nextPath;return!0}return!1}}var Da=class extends Sr{constructor(e,t,n){super(),this.topProd=e,this.targetOccurrence=t,this.targetProdType=n}startWalking(){return this.walk(this.topProd),this.restDef}checkIsTarget(e,t,n,r){return e.idx===this.targetOccurrence&&this.targetProdType===t?(this.restDef=n.concat(r),!0):!1}walkOption(e,t,n){this.checkIsTarget(e,V.OPTION,t,n)||super.walkOption(e,t,n)}walkAtLeastOne(e,t,n){this.checkIsTarget(e,V.REPETITION_MANDATORY,t,n)||super.walkOption(e,t,n)}walkAtLeastOneSep(e,t,n){this.checkIsTarget(e,V.REPETITION_MANDATORY_WITH_SEPARATOR,t,n)||super.walkOption(e,t,n)}walkMany(e,t,n){this.checkIsTarget(e,V.REPETITION,t,n)||super.walkOption(e,t,n)}walkManySep(e,t,n){this.checkIsTarget(e,V.REPETITION_WITH_SEPARATOR,t,n)||super.walkOption(e,t,n)}},Oa=class extends _r{constructor(e,t,n){super(),this.targetOccurrence=e,this.targetProdType=t,this.targetRef=n,this.result=[]}checkIsTarget(e,t){e.idx===this.targetOccurrence&&this.targetProdType===t&&(this.targetRef===void 0||e===this.targetRef)&&(this.result=e.definition)}visitOption(e){this.checkIsTarget(e,V.OPTION)}visitRepetition(e){this.checkIsTarget(e,V.REPETITION)}visitRepetitionMandatory(e){this.checkIsTarget(e,V.REPETITION_MANDATORY)}visitRepetitionMandatoryWithSeparator(e){this.checkIsTarget(e,V.REPETITION_MANDATORY_WITH_SEPARATOR)}visitRepetitionWithSeparator(e){this.checkIsTarget(e,V.REPETITION_WITH_SEPARATOR)}visitAlternation(e){this.checkIsTarget(e,V.ALTERNATION)}};function ka(e){let t=Array(e);for(let n=0;n<e;n++)t[n]=[];return t}function Aa(e){let t=[``];for(let n=0;n<e.length;n++){let r=e[n],i=[];for(let e=0;e<t.length;e++){let n=t[e];i.push(n+`_`+r.tokenTypeIdx);for(let e=0;e<r.categoryMatches.length;e++){let t=`_`+r.categoryMatches[e];i.push(n+t)}}t=i}return t}function ja(e,t,n){for(let r=0;r<e.length;r++){if(r===n)continue;let i=e[r];for(let e=0;e<t.length;e++)if(i[t[e]]===!0)return!1}return!0}function Ma(e,t){let n=e.map(e=>va([e],1)),r=ka(n.length),i=n.map(e=>{let t={};return e.forEach(e=>{Aa(e.partialPath).forEach(e=>{t[e]=!0})}),t}),a=n;for(let e=1;e<=t;e++){let n=a;a=ka(n.length);for(let o=0;o<n.length;o++){let s=n[o];for(let n=0;n<s.length;n++){let c=s[n].partialPath,l=s[n].suffixDef,u=Aa(c);if(ja(i,u,o)||l.length===0||c.length===t){let e=r[o];if(Fa(e,c)===!1){e.push(c);for(let e=0;e<u.length;e++){let t=u[e];i[o][t]=!0}}}else{let t=va(l,e+1,c);a[o]=a[o].concat(t),t.forEach(e=>{Aa(e.partialPath).forEach(e=>{i[o][e]=!0})})}}}}return r}function Na(e,t,n,r){let i=new Oa(e,V.ALTERNATION,r);return t.accept(i),Ma(i.result,n)}function Pa(e,t,n,r){let i=new Oa(e,n);t.accept(i);let a=i.result,o=new Da(t,e,n).startWalking();return Ma([new cr({definition:a}),new cr({definition:o})],r)}function Fa(e,t){compareOtherPath:for(let n=0;n<e.length;n++){let r=e[n];if(r.length===t.length){for(let e=0;e<r.length;e++){let n=t[e],i=r[e];if(!(n===i||i.categoryMatchesMap[n.tokenTypeIdx]!==void 0))continue compareOtherPath}return!0}}return!1}function Ia(e,t){return e.length<t.length&&e.every((e,n)=>{let r=t[n];return e===r||r.categoryMatchesMap[e.tokenTypeIdx]})}function La(e){return e.every(e=>e.every(e=>e.every(e=>e.categoryMatches.length===0)))}function Ra(e){return e.lookaheadStrategy.validate({rules:e.rules,tokenTypes:e.tokenTypes,grammarName:e.grammarName}).map(e=>Object.assign({type:ls.CUSTOM_LOOKAHEAD_VALIDATION},e))}function za(e,t,n,r){let i=e.flatMap(e=>Ba(e,n)),a=no(e,t,n),o=e.flatMap(e=>Qa(e,n)),s=e.flatMap(t=>Wa(t,e,r,n));return i.concat(a,o,s)}function Ba(e,t){let n=new Ua;e.accept(n);let r=n.allProductions,i=Object.groupBy(r,Va),a=Object.fromEntries(Object.entries(i).filter(([e,t])=>t.length>1));return Object.values(a).map(n=>{let r=n[0],i=t.buildDuplicateFoundError(e,n),a=xr(r),o={message:i,type:ls.DUPLICATE_PRODUCTIONS,ruleName:e.name,dslName:a,occurrence:r.idx},s=Ha(r);return s&&(o.parameter=s),o})}function Va(e){return`${xr(e)}_#_${e.idx}_#_${Ha(e)}`}function Ha(e){return e instanceof z?e.terminalType.name:e instanceof or?e.nonTerminalName:``}var Ua=class extends _r{constructor(){super(...arguments),this.allProductions=[]}visitNonTerminal(e){this.allProductions.push(e)}visitOption(e){this.allProductions.push(e)}visitRepetitionWithSeparator(e){this.allProductions.push(e)}visitRepetitionMandatory(e){this.allProductions.push(e)}visitRepetitionMandatoryWithSeparator(e){this.allProductions.push(e)}visitRepetition(e){this.allProductions.push(e)}visitAlternation(e){this.allProductions.push(e)}visitTerminal(e){this.allProductions.push(e)}};function Wa(e,t,n,r){let i=[];if(t.reduce((t,n)=>n.name===e.name?t+1:t,0)>1){let t=r.buildDuplicateRuleNameError({topLevelRule:e,grammarName:n});i.push({message:t,type:ls.DUPLICATE_RULE_NAME,ruleName:e.name})}return i}function Ga(e,t,n){let r=[],i;return t.includes(e)||(i=`Invalid rule override, rule: ->${e}<- cannot be overridden in the grammar: ->${n}<-as it is not defined in any of the super grammars `,r.push({message:i,type:ls.INVALID_RULE_OVERRIDE,ruleName:e})),r}function Ka(e,t,n,r=[]){let i=[],a=qa(t.definition);if(a.length===0)return[];{let t=e.name;a.includes(e)&&i.push({message:n.buildLeftRecursionError({topLevelRule:e,leftRecursionPath:r}),type:ls.LEFT_RECURSION,ruleName:t});let o=r.concat([e]),s=a.filter(e=>!o.includes(e)).flatMap(t=>{let i=[...r];return i.push(t),Ka(e,t,n,i)});return i.concat(s)}}function qa(e){let t=[];if(e.length===0)return t;let n=e[0];if(n instanceof or)t.push(n.referencedRule);else if(n instanceof cr||n instanceof lr||n instanceof ur||n instanceof dr||n instanceof fr||n instanceof R)t=t.concat(qa(n.definition));else if(n instanceof pr)t=n.definition.map(e=>qa(e.definition)).flat();else if(!(n instanceof z))throw Error(`non exhaustive match`);let r=yr(n),i=e.length>1;if(r&&i){let n=e.slice(1);return t.concat(qa(n))}else return t}var Ja=class extends _r{constructor(){super(...arguments),this.alternations=[]}visitAlternation(e){this.alternations.push(e)}};function Ya(e,t){let n=new Ja;return e.accept(n),n.alternations.flatMap(n=>n.definition.slice(0,-1).flatMap((r,i)=>ya([r],[],Ei,1).length===0?[{message:t.buildEmptyAlternationError({topLevelRule:e,alternation:n,emptyChoiceIdx:i}),type:ls.NONE_LAST_EMPTY_ALT,ruleName:e.name,occurrence:n.idx,alternative:i+1}]:[]))}function Xa(e,t,n){let r=new Ja;e.accept(r);let i=r.alternations;return i=i.filter(e=>e.ignoreAmbiguities!==!0),i.flatMap(r=>{let i=r.idx,a=Na(i,e,r.maxLookahead||t,r),o=eo(a,r,e,n),s=to(a,r,e,n);return o.concat(s)})}var Za=class extends _r{constructor(){super(...arguments),this.allProductions=[]}visitRepetitionWithSeparator(e){this.allProductions.push(e)}visitRepetitionMandatory(e){this.allProductions.push(e)}visitRepetitionMandatoryWithSeparator(e){this.allProductions.push(e)}visitRepetition(e){this.allProductions.push(e)}};function Qa(e,t){let n=new Ja;return e.accept(n),n.alternations.flatMap(n=>n.definition.length>255?[{message:t.buildTooManyAlternativesError({topLevelRule:e,alternation:n}),type:ls.TOO_MANY_ALTS,ruleName:e.name,occurrence:n.idx}]:[])}function $a(e,t,n){let r=[];return e.forEach(e=>{let i=new Za;e.accept(i),i.allProductions.forEach(i=>{let a=xa(i),o=i.maxLookahead||t,s=i.idx;if(Pa(s,e,a,o)[0].flat().length===0){let t=n.buildEmptyRepetitionError({topLevelRule:e,repetition:i});r.push({message:t,type:ls.NO_NON_EMPTY_LOOKAHEAD,ruleName:e.name})}})}),r}function eo(e,t,n,r){let i=[];return e.reduce((n,r,a)=>(t.definition[a].ignoreAmbiguities===!0||r.forEach(r=>{let o=[a];e.forEach((e,n)=>{a!==n&&Fa(e,r)&&t.definition[n].ignoreAmbiguities!==!0&&o.push(n)}),o.length>1&&!Fa(i,r)&&(i.push(r),n.push({alts:o,path:r}))}),n),[]).map(e=>{let i=e.alts.map(e=>e+1);return{message:r.buildAlternationAmbiguityError({topLevelRule:n,alternation:t,ambiguityIndices:i,prefixPath:e.path}),type:ls.AMBIGUOUS_ALTS,ruleName:n.name,occurrence:t.idx,alternatives:e.alts}})}function to(e,t,n,r){let i=e.reduce((e,t,n)=>{let r=t.map(e=>({idx:n,path:e}));return e.concat(r)},[]);return i.flatMap(e=>{if(t.definition[e.idx].ignoreAmbiguities===!0)return[];let a=e.idx,o=e.path;return i.filter(e=>t.definition[e.idx].ignoreAmbiguities!==!0&&e.idx<a&&Ia(e.path,o)).map(e=>{let i=[e.idx+1,a+1],o=t.idx===0?``:t.idx;return{message:r.buildAlternationPrefixAmbiguityError({topLevelRule:n,alternation:t,ambiguityIndices:i,prefixPath:e.path}),type:ls.AMBIGUOUS_PREFIX_ALTS,ruleName:n.name,occurrence:o,alternatives:i}})})}function no(e,t,n){let r=[],i=t.map(e=>e.name);return e.forEach(e=>{let t=e.name;if(i.includes(t)){let i=n.buildNamespaceConflictError(e);r.push({message:i,type:ls.CONFLICT_TOKENS_RULES_NAMESPACE,ruleName:t})}}),r}function ro(e){let t=Object.assign({errMsgProvider:sa},e),n={};return e.rules.forEach(e=>{n[e.name]=e}),la(n,t.errMsgProvider)}function io(e){let t=e.errMsgProvider??ca;return za(e.rules,e.tokenTypes,t,e.grammarName)}var ao=`MismatchedTokenException`,oo=`NoViableAltException`,so=`EarlyExitException`,co=`NotAllInputParsedException`,lo=[ao,oo,so,co];Object.freeze(lo);function uo(e){return lo.includes(e.name)}var fo=class extends Error{constructor(e,t){super(e),this.token=t,this.resyncedTokens=[],Object.setPrototypeOf(this,new.target.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,this.constructor)}},po=class extends fo{constructor(e,t,n){super(e,t),this.previousToken=n,this.name=ao}},mo=class extends fo{constructor(e,t,n){super(e,t),this.previousToken=n,this.name=oo}},ho=class extends fo{constructor(e,t){super(e,t),this.name=co}},go=class extends fo{constructor(e,t,n){super(e,t),this.previousToken=n,this.name=so}},_o={},vo=`InRuleRecoveryException`,yo=class extends Error{constructor(e){super(e),this.name=vo}},bo=class{initRecoverable(e){this.firstAfterRepMap={},this.resyncFollows={},this.recoveryEnabled=Object.hasOwn(e,`recoveryEnabled`)?e.recoveryEnabled:ss.recoveryEnabled,this.recoveryEnabled&&(this.attemptInRepetitionRecovery=xo)}getTokenToInsert(e){let t=ia(e,``,NaN,NaN,NaN,NaN,NaN,NaN);return t.isInsertedInRecovery=!0,t}canTokenTypeBeInsertedInRecovery(e){return!0}canTokenTypeBeDeletedInRecovery(e){return!0}tryInRepetitionRecovery(e,t,n,r){let i=this.findReSyncTokenType(),a=this.exportLexerState(),o=[],s=!1,c=this.LA_FAST(1),l=this.LA_FAST(1),u=()=>{let e=this.LA(0),t=new po(this.errorMessageProvider.buildMismatchTokenMessage({expected:r,actual:c,previous:e,ruleName:this.getCurrRuleFullName()}),c,this.LA(0));t.resyncedTokens=o.slice(0,-1),this.SAVE_ERROR(t)};for(;!s;)if(this.tokenMatcher(l,r)){u();return}else if(n.call(this)){u(),e.apply(this,t);return}else this.tokenMatcher(l,i)?s=!0:(l=this.SKIP_TOKEN(),this.addToResyncTokens(l,o));this.importLexerState(a)}shouldInRepetitionRecoveryBeTried(e,t,n){return!(n===!1||this.tokenMatcher(this.LA_FAST(1),e)||this.isBackTracking()||this.canPerformInRuleRecovery(e,this.getFollowsForInRuleRecovery(e,t)))}getNextPossibleTokenTypes(e){let t=e.ruleStack[0],n=this.getGAstProductions()[t];return new fa(n,e).startWalking()}getFollowsForInRuleRecovery(e,t){let n=this.getCurrentGrammarPath(e,t);return this.getNextPossibleTokenTypes(n)}tryInRuleRecovery(e,t){if(this.canRecoverWithSingleTokenInsertion(e,t))return this.getTokenToInsert(e);if(this.canRecoverWithSingleTokenDeletion(e)){let e=this.SKIP_TOKEN();return this.consumeToken(),e}throw new yo(`sad sad panda`)}canPerformInRuleRecovery(e,t){return this.canRecoverWithSingleTokenInsertion(e,t)||this.canRecoverWithSingleTokenDeletion(e)}canRecoverWithSingleTokenInsertion(e,t){if(!this.canTokenTypeBeInsertedInRecovery(e)||t.length===0)return!1;let n=this.LA_FAST(1);return t.find(e=>this.tokenMatcher(n,e))!==void 0}canRecoverWithSingleTokenDeletion(e){return this.canTokenTypeBeDeletedInRecovery(e)?this.tokenMatcher(this.LA(2),e):!1}isInCurrentRuleReSyncSet(e){let t=this.getCurrFollowKey();return this.getFollowSetFromFollowKey(t).includes(e)}findReSyncTokenType(){let e=this.flattenFollowSet(),t=this.LA_FAST(1),n=2;for(;;){let r=e.find(e=>aa(t,e));if(r!==void 0)return r;t=this.LA(n),n++}}getCurrFollowKey(){if(this.RULE_STACK_IDX===0)return _o;let e=this.currRuleShortName,t=this.getLastExplicitRuleOccurrenceIndex(),n=this.getPreviousExplicitRuleShortName();return{ruleName:this.shortRuleNameToFullName(e),idxInCallingRule:t,inRule:this.shortRuleNameToFullName(n)}}buildFullFollowKeyStack(){let e=this.RULE_STACK,t=this.RULE_OCCURRENCE_STACK,n=this.RULE_STACK_IDX+1,r=Array(n);for(let i=0;i<n;i++)i===0?r[i]=_o:r[i]={ruleName:this.shortRuleNameToFullName(e[i]),idxInCallingRule:t[i],inRule:this.shortRuleNameToFullName(e[i-1])};return r}flattenFollowSet(){return this.buildFullFollowKeyStack().map(e=>this.getFollowSetFromFollowKey(e)).flat()}getFollowSetFromFollowKey(e){if(e===_o)return[ra];let t=e.ruleName+e.idxInCallingRule+Or+e.inRule;return this.resyncFollows[t]}addToResyncTokens(e,t){return this.tokenMatcher(e,ra)||t.push(e),t}reSyncTo(e){let t=[],n=this.LA_FAST(1);for(;this.tokenMatcher(n,e)===!1;)n=this.SKIP_TOKEN(),this.addToResyncTokens(n,t);return t.slice(0,-1)}attemptInRepetitionRecovery(e,t,n,r,i,a,o){}getCurrentGrammarPath(e,t){return{ruleStack:this.getHumanReadableRuleStack(),occurrenceStack:this.RULE_OCCURRENCE_STACK.slice(0,this.RULE_OCCURRENCE_STACK_IDX+1),lastTok:e,lastTokOccurrence:t}}getHumanReadableRuleStack(){let e=this.RULE_STACK_IDX+1,t=Array(e);for(let n=0;n<e;n++)t[n]=this.shortRuleNameToFullName(this.RULE_STACK[n]);return t}};function xo(e,t,n,r,i,a,o){let s=this.getKeyForAutomaticLookahead(r,i),c=this.firstAfterRepMap[s];if(c===void 0){let e=this.getCurrRuleFullName(),t=this.getGAstProductions()[e];c=new a(t,i).startWalking(),this.firstAfterRepMap[s]=c}let l=c.token,u=c.occurrence,d=c.isEndOfRule;this.RULE_STACK_IDX===0&&d&&l===void 0&&(l=ra,u=1),!(l===void 0||u===void 0)&&this.shouldInRepetitionRecoveryBeTried(l,u,o)&&this.tryInRepetitionRecovery(e,t,n,l)}var So=1024,Co=1280,wo=1536;function To(e,t,n){return n|t|e}var Eo=class{constructor(e){this.maxLookahead=e?.maxLookahead??ss.maxLookahead}validate(e){let t=this.validateNoLeftRecursion(e.rules);if(t.length===0){let n=this.validateEmptyOrAlternatives(e.rules),r=this.validateAmbiguousAlternationAlternatives(e.rules,this.maxLookahead),i=this.validateSomeNonEmptyLookaheadPath(e.rules,this.maxLookahead);return[...t,...n,...r,...i]}return t}validateNoLeftRecursion(e){return e.flatMap(e=>Ka(e,e,ca))}validateEmptyOrAlternatives(e){return e.flatMap(e=>Ya(e,ca))}validateAmbiguousAlternationAlternatives(e,t){return e.flatMap(e=>Xa(e,t,ca))}validateSomeNonEmptyLookaheadPath(e,t){return $a(e,t,ca)}buildLookaheadForAlternation(e){return Ca(e.prodOccurrence,e.rule,e.maxLookahead,e.hasPredicates,e.dynamicTokensEnabled,Ta)}buildLookaheadForOptional(e){return wa(e.prodOccurrence,e.rule,e.maxLookahead,e.dynamicTokensEnabled,xa(e.prodType),Ea)}},Do=class{initLooksAhead(e){this.dynamicTokensEnabled=Object.hasOwn(e,`dynamicTokensEnabled`)?e.dynamicTokensEnabled:ss.dynamicTokensEnabled,this.maxLookahead=Object.hasOwn(e,`maxLookahead`)?e.maxLookahead:ss.maxLookahead,this.lookaheadStrategy=Object.hasOwn(e,`lookaheadStrategy`)?e.lookaheadStrategy:new Eo({maxLookahead:this.maxLookahead}),this.lookAheadFuncsCache=new Map}preComputeLookaheadFunctions(e){e.forEach(e=>{this.TRACE_INIT(`${e.name} Rule Lookahead`,()=>{let{alternation:t,repetition:n,option:r,repetitionMandatory:i,repetitionMandatoryWithSeparator:a,repetitionWithSeparator:o}=ko(e);t.forEach(t=>{let n=t.idx===0?``:t.idx;this.TRACE_INIT(`${xr(t)}${n}`,()=>{let n=this.lookaheadStrategy.buildLookaheadForAlternation({prodOccurrence:t.idx,rule:e,maxLookahead:t.maxLookahead||this.maxLookahead,hasPredicates:t.hasPredicates,dynamicTokensEnabled:this.dynamicTokensEnabled}),r=To(this.fullRuleNameToShort[e.name],256,t.idx);this.setLaFuncCache(r,n)})}),n.forEach(t=>{this.computeLookaheadFunc(e,t.idx,768,`Repetition`,t.maxLookahead,xr(t))}),r.forEach(t=>{this.computeLookaheadFunc(e,t.idx,512,`Option`,t.maxLookahead,xr(t))}),i.forEach(t=>{this.computeLookaheadFunc(e,t.idx,So,`RepetitionMandatory`,t.maxLookahead,xr(t))}),a.forEach(t=>{this.computeLookaheadFunc(e,t.idx,wo,`RepetitionMandatoryWithSeparator`,t.maxLookahead,xr(t))}),o.forEach(t=>{this.computeLookaheadFunc(e,t.idx,Co,`RepetitionWithSeparator`,t.maxLookahead,xr(t))})})})}computeLookaheadFunc(e,t,n,r,i,a){this.TRACE_INIT(`${a}${t===0?``:t}`,()=>{let a=this.lookaheadStrategy.buildLookaheadForOptional({prodOccurrence:t,rule:e,maxLookahead:i||this.maxLookahead,dynamicTokensEnabled:this.dynamicTokensEnabled,prodType:r}),o=To(this.fullRuleNameToShort[e.name],n,t);this.setLaFuncCache(o,a)})}getKeyForAutomaticLookahead(e,t){return To(this.currRuleShortName,e,t)}getLaFuncFromCache(e){return this.lookAheadFuncsCache.get(e)}setLaFuncCache(e,t){this.lookAheadFuncsCache.set(e,t)}},Oo=new class extends _r{constructor(){super(...arguments),this.dslMethods={option:[],alternation:[],repetition:[],repetitionWithSeparator:[],repetitionMandatory:[],repetitionMandatoryWithSeparator:[]}}reset(){this.dslMethods={option:[],alternation:[],repetition:[],repetitionWithSeparator:[],repetitionMandatory:[],repetitionMandatoryWithSeparator:[]}}visitOption(e){this.dslMethods.option.push(e)}visitRepetitionWithSeparator(e){this.dslMethods.repetitionWithSeparator.push(e)}visitRepetitionMandatory(e){this.dslMethods.repetitionMandatory.push(e)}visitRepetitionMandatoryWithSeparator(e){this.dslMethods.repetitionMandatoryWithSeparator.push(e)}visitRepetition(e){this.dslMethods.repetition.push(e)}visitAlternation(e){this.dslMethods.alternation.push(e)}};function ko(e){Oo.reset(),e.accept(Oo);let t=Oo.dslMethods;return Oo.reset(),t}function Ao(e,t){isNaN(e.startOffset)===!0?(e.startOffset=t.startOffset,e.endOffset=t.endOffset):e.endOffset<t.endOffset&&(e.endOffset=t.endOffset)}function jo(e,t){isNaN(e.startOffset)===!0?(e.startOffset=t.startOffset,e.startColumn=t.startColumn,e.startLine=t.startLine,e.endOffset=t.endOffset,e.endColumn=t.endColumn,e.endLine=t.endLine):e.endOffset<t.endOffset&&(e.endOffset=t.endOffset,e.endColumn=t.endColumn,e.endLine=t.endLine)}function Mo(e,t,n){e.children[n]===void 0?e.children[n]=[t]:e.children[n].push(t)}function No(e,t,n){e.children[t]===void 0?e.children[t]=[n]:e.children[t].push(n)}var Po=`name`;function Fo(e,t){Object.defineProperty(e,Po,{enumerable:!1,configurable:!0,writable:!1,value:t})}function Io(e,t){let n=Object.keys(e),r=n.length;for(let i=0;i<r;i++){let r=e[n[i]],a=r.length;for(let e=0;e<a;e++){let n=r[e];n.tokenTypeIdx===void 0&&this[n.name](n.children,t)}}}function Lo(e,t){let n=function(){};return Fo(n,e+`BaseSemantics`),n.prototype={visit:function(e,t){if(Array.isArray(e)&&(e=e[0]),e!==void 0)return this[e.name](e.children,t)},validateVisitor:function(){let e=Bo(this,t);if(e.length!==0){let t=e.map(e=>e.msg);throw Error(`Errors Detected in CST Visitor <${this.constructor.name}>:\n\t${t.join(`

`).replace(/\n/g,`
	`)}`)}}},n.prototype.constructor=n,n._RULE_NAMES=t,n}function Ro(e,t,n){let r=function(){};Fo(r,e+`BaseSemanticsWithDefaults`);let i=Object.create(n.prototype);return t.forEach(e=>{i[e]=Io}),r.prototype=i,r.prototype.constructor=r,r}var zo;(function(e){e[e.REDUNDANT_METHOD=0]=`REDUNDANT_METHOD`,e[e.MISSING_METHOD=1]=`MISSING_METHOD`})(zo||={});function Bo(e,t){return Vo(e,t)}function Vo(e,t){return t.filter(t=>typeof e[t]!=`function`).map(t=>({msg:`Missing visitor method: <${t}> on ${e.constructor.name} CST Visitor.`,type:zo.MISSING_METHOD,methodName:t})).filter(Boolean)}var Ho=class{initTreeBuilder(e){if(this.CST_STACK=[],this.outputCst=e.outputCst,this.nodeLocationTracking=Object.hasOwn(e,`nodeLocationTracking`)?e.nodeLocationTracking:ss.nodeLocationTracking,!this.outputCst)this.cstInvocationStateUpdate=()=>{},this.cstFinallyStateUpdate=()=>{},this.cstPostTerminal=()=>{},this.cstPostNonTerminal=()=>{},this.cstPostRule=()=>{};else if(/full/i.test(this.nodeLocationTracking))this.recoveryEnabled?(this.setNodeLocationFromToken=jo,this.setNodeLocationFromNode=jo,this.cstPostRule=()=>{},this.setInitialNodeLocation=this.setInitialNodeLocationFullRecovery):(this.setNodeLocationFromToken=()=>{},this.setNodeLocationFromNode=()=>{},this.cstPostRule=this.cstPostRuleFull,this.setInitialNodeLocation=this.setInitialNodeLocationFullRegular);else if(/onlyOffset/i.test(this.nodeLocationTracking))this.recoveryEnabled?(this.setNodeLocationFromToken=Ao,this.setNodeLocationFromNode=Ao,this.cstPostRule=()=>{},this.setInitialNodeLocation=this.setInitialNodeLocationOnlyOffsetRecovery):(this.setNodeLocationFromToken=()=>{},this.setNodeLocationFromNode=()=>{},this.cstPostRule=this.cstPostRuleOnlyOffset,this.setInitialNodeLocation=this.setInitialNodeLocationOnlyOffsetRegular);else if(/none/i.test(this.nodeLocationTracking))this.setNodeLocationFromToken=()=>{},this.setNodeLocationFromNode=()=>{},this.cstPostRule=()=>{},this.setInitialNodeLocation=()=>{};else throw Error(`Invalid <nodeLocationTracking> config option: "${e.nodeLocationTracking}"`)}setInitialNodeLocationOnlyOffsetRecovery(e){e.location={startOffset:NaN,endOffset:NaN}}setInitialNodeLocationOnlyOffsetRegular(e){e.location={startOffset:this.LA_FAST(1).startOffset,endOffset:NaN}}setInitialNodeLocationFullRecovery(e){e.location={startOffset:NaN,startLine:NaN,startColumn:NaN,endOffset:NaN,endLine:NaN,endColumn:NaN}}setInitialNodeLocationFullRegular(e){let t=this.LA_FAST(1);e.location={startOffset:t.startOffset,startLine:t.startLine,startColumn:t.startColumn,endOffset:NaN,endLine:NaN,endColumn:NaN}}cstInvocationStateUpdate(e){let t={name:e,children:Object.create(null)};this.setInitialNodeLocation(t),this.CST_STACK.push(t)}cstFinallyStateUpdate(){this.CST_STACK.pop()}cstPostRuleFull(e){let t=this.LA(0),n=e.location;n.startOffset<=t.startOffset?(n.endOffset=t.endOffset,n.endLine=t.endLine,n.endColumn=t.endColumn):(n.startOffset=NaN,n.startLine=NaN,n.startColumn=NaN)}cstPostRuleOnlyOffset(e){let t=this.LA(0),n=e.location;n.startOffset<=t.startOffset?n.endOffset=t.endOffset:n.startOffset=NaN}cstPostTerminal(e,t){let n=this.CST_STACK[this.CST_STACK.length-1];Mo(n,t,e),this.setNodeLocationFromToken(n.location,t)}cstPostNonTerminal(e,t){let n=this.CST_STACK[this.CST_STACK.length-1];No(n,t,e),this.setNodeLocationFromNode(n.location,e.location)}getBaseCstVisitorConstructor(){if(this.baseCstVisitorConstructor===void 0){let e=Lo(this.className,Object.keys(this.gastProductionsCache));return this.baseCstVisitorConstructor=e,e}return this.baseCstVisitorConstructor}getBaseCstVisitorConstructorWithDefaults(){if(this.baseCstVisitorWithDefaultsConstructor===void 0){let e=Ro(this.className,Object.keys(this.gastProductionsCache),this.getBaseCstVisitorConstructor());return this.baseCstVisitorWithDefaultsConstructor=e,e}return this.baseCstVisitorWithDefaultsConstructor}getPreviousExplicitRuleShortName(){return this.RULE_STACK[this.RULE_STACK_IDX-1]}getLastExplicitRuleOccurrenceIndex(){return this.RULE_OCCURRENCE_STACK[this.RULE_OCCURRENCE_STACK_IDX]}},Uo=class{initLexerAdapter(){this.tokVector=[],this.tokVectorLength=0,this.currIdx=-1}set input(e){if(this.selfAnalysisDone!==!0)throw Error(`Missing <performSelfAnalysis> invocation at the end of the Parser's constructor.`);this.reset(),this.tokVector=e,this.tokVectorLength=e.length}get input(){return this.tokVector}SKIP_TOKEN(){return this.currIdx<=this.tokVectorLength-2?(this.consumeToken(),this.LA_FAST(1)):os}LA_FAST(e){let t=this.currIdx+e;return this.tokVector[t]}LA(e){let t=this.currIdx+e;return t<0||this.tokVectorLength<=t?os:this.tokVector[t]}consumeToken(){this.currIdx++}exportLexerState(){return this.currIdx}importLexerState(e){this.currIdx=e}resetLexerState(){this.currIdx=-1}moveToTerminatedState(){this.currIdx=this.tokVectorLength-1}getLexerPosition(){return this.exportLexerState()}},Wo=class{ACTION(e){return e.call(this)}consume(e,t,n){return this.consumeInternal(t,e,n)}subrule(e,t,n){return this.subruleInternal(t,e,n)}option(e,t){return this.optionInternal(t,e)}or(e,t){return this.orInternal(t,e)}many(e,t){return this.manyInternal(e,t)}atLeastOne(e,t){return this.atLeastOneInternal(e,t)}CONSUME(e,t){return this.consumeInternal(e,0,t)}CONSUME1(e,t){return this.consumeInternal(e,1,t)}CONSUME2(e,t){return this.consumeInternal(e,2,t)}CONSUME3(e,t){return this.consumeInternal(e,3,t)}CONSUME4(e,t){return this.consumeInternal(e,4,t)}CONSUME5(e,t){return this.consumeInternal(e,5,t)}CONSUME6(e,t){return this.consumeInternal(e,6,t)}CONSUME7(e,t){return this.consumeInternal(e,7,t)}CONSUME8(e,t){return this.consumeInternal(e,8,t)}CONSUME9(e,t){return this.consumeInternal(e,9,t)}SUBRULE(e,t){return this.subruleInternal(e,0,t)}SUBRULE1(e,t){return this.subruleInternal(e,1,t)}SUBRULE2(e,t){return this.subruleInternal(e,2,t)}SUBRULE3(e,t){return this.subruleInternal(e,3,t)}SUBRULE4(e,t){return this.subruleInternal(e,4,t)}SUBRULE5(e,t){return this.subruleInternal(e,5,t)}SUBRULE6(e,t){return this.subruleInternal(e,6,t)}SUBRULE7(e,t){return this.subruleInternal(e,7,t)}SUBRULE8(e,t){return this.subruleInternal(e,8,t)}SUBRULE9(e,t){return this.subruleInternal(e,9,t)}OPTION(e){return this.optionInternal(e,0)}OPTION1(e){return this.optionInternal(e,1)}OPTION2(e){return this.optionInternal(e,2)}OPTION3(e){return this.optionInternal(e,3)}OPTION4(e){return this.optionInternal(e,4)}OPTION5(e){return this.optionInternal(e,5)}OPTION6(e){return this.optionInternal(e,6)}OPTION7(e){return this.optionInternal(e,7)}OPTION8(e){return this.optionInternal(e,8)}OPTION9(e){return this.optionInternal(e,9)}OR(e){return this.orInternal(e,0)}OR1(e){return this.orInternal(e,1)}OR2(e){return this.orInternal(e,2)}OR3(e){return this.orInternal(e,3)}OR4(e){return this.orInternal(e,4)}OR5(e){return this.orInternal(e,5)}OR6(e){return this.orInternal(e,6)}OR7(e){return this.orInternal(e,7)}OR8(e){return this.orInternal(e,8)}OR9(e){return this.orInternal(e,9)}MANY(e){this.manyInternal(0,e)}MANY1(e){this.manyInternal(1,e)}MANY2(e){this.manyInternal(2,e)}MANY3(e){this.manyInternal(3,e)}MANY4(e){this.manyInternal(4,e)}MANY5(e){this.manyInternal(5,e)}MANY6(e){this.manyInternal(6,e)}MANY7(e){this.manyInternal(7,e)}MANY8(e){this.manyInternal(8,e)}MANY9(e){this.manyInternal(9,e)}MANY_SEP(e){this.manySepFirstInternal(0,e)}MANY_SEP1(e){this.manySepFirstInternal(1,e)}MANY_SEP2(e){this.manySepFirstInternal(2,e)}MANY_SEP3(e){this.manySepFirstInternal(3,e)}MANY_SEP4(e){this.manySepFirstInternal(4,e)}MANY_SEP5(e){this.manySepFirstInternal(5,e)}MANY_SEP6(e){this.manySepFirstInternal(6,e)}MANY_SEP7(e){this.manySepFirstInternal(7,e)}MANY_SEP8(e){this.manySepFirstInternal(8,e)}MANY_SEP9(e){this.manySepFirstInternal(9,e)}AT_LEAST_ONE(e){this.atLeastOneInternal(0,e)}AT_LEAST_ONE1(e){return this.atLeastOneInternal(1,e)}AT_LEAST_ONE2(e){this.atLeastOneInternal(2,e)}AT_LEAST_ONE3(e){this.atLeastOneInternal(3,e)}AT_LEAST_ONE4(e){this.atLeastOneInternal(4,e)}AT_LEAST_ONE5(e){this.atLeastOneInternal(5,e)}AT_LEAST_ONE6(e){this.atLeastOneInternal(6,e)}AT_LEAST_ONE7(e){this.atLeastOneInternal(7,e)}AT_LEAST_ONE8(e){this.atLeastOneInternal(8,e)}AT_LEAST_ONE9(e){this.atLeastOneInternal(9,e)}AT_LEAST_ONE_SEP(e){this.atLeastOneSepFirstInternal(0,e)}AT_LEAST_ONE_SEP1(e){this.atLeastOneSepFirstInternal(1,e)}AT_LEAST_ONE_SEP2(e){this.atLeastOneSepFirstInternal(2,e)}AT_LEAST_ONE_SEP3(e){this.atLeastOneSepFirstInternal(3,e)}AT_LEAST_ONE_SEP4(e){this.atLeastOneSepFirstInternal(4,e)}AT_LEAST_ONE_SEP5(e){this.atLeastOneSepFirstInternal(5,e)}AT_LEAST_ONE_SEP6(e){this.atLeastOneSepFirstInternal(6,e)}AT_LEAST_ONE_SEP7(e){this.atLeastOneSepFirstInternal(7,e)}AT_LEAST_ONE_SEP8(e){this.atLeastOneSepFirstInternal(8,e)}AT_LEAST_ONE_SEP9(e){this.atLeastOneSepFirstInternal(9,e)}RULE(e,t,n=cs){if(this.definedRulesNames.includes(e)){let t={message:ca.buildDuplicateRuleNameError({topLevelRule:e,grammarName:this.className}),type:ls.DUPLICATE_RULE_NAME,ruleName:e};this.definitionErrors.push(t)}this.definedRulesNames.push(e);let r=this.defineRule(e,t,n);return this[e]=r,r}OVERRIDE_RULE(e,t,n=cs){let r=Ga(e,this.definedRulesNames,this.className);this.definitionErrors=this.definitionErrors.concat(r);let i=this.defineRule(e,t,n);return this[e]=i,i}BACKTRACK(e,t){let n=e.coreRule??e;return function(){this.isBackTrackingStack.push(1);let e=this.saveRecogState();try{return n.apply(this,t),!0}catch(e){if(uo(e))return!1;throw e}finally{this.reloadRecogState(e),this.isBackTrackingStack.pop()}}}getGAstProductions(){return this.gastProductionsCache}getSerializedGastProductions(){return mr(Object.values(this.gastProductionsCache))}},Go=class{initRecognizerEngine(e,t){if(this.className=this.constructor.name,this.shortRuleNameToFull={},this.fullRuleNameToShort={},this.ruleShortNameIdx=256,this.tokenMatcher=Di,this.subruleIdx=0,this.currRuleShortName=0,this.definedRulesNames=[],this.tokensMap={},this.isBackTrackingStack=[],this.RULE_STACK=[],this.RULE_STACK_IDX=-1,this.RULE_OCCURRENCE_STACK=[],this.RULE_OCCURRENCE_STACK_IDX=-1,this.gastProductionsCache={},Object.hasOwn(t,`serializedGrammar`))throw Error(`The Parser's configuration can no longer contain a <serializedGrammar> property.
	See: https://chevrotain.io/docs/changes/BREAKING_CHANGES.html#_6-0-0
	For Further details.`);if(Array.isArray(e)){if(e.length===0)throw Error(`A Token Vocabulary cannot be empty.
	Note that the first argument for the parser constructor
	is no longer a Token vector (since v4.0).`);if(typeof e[0].startOffset==`number`)throw Error(`The Parser constructor no longer accepts a token vector as the first argument.
	See: https://chevrotain.io/docs/changes/BREAKING_CHANGES.html#_4-0-0
	For Further details.`)}if(Array.isArray(e))this.tokensMap=e.reduce((e,t)=>(e[t.name]=t,e),{});else if(Object.hasOwn(e,`modes`)&&Object.values(e.modes).flat().every(Bi)){let t=Object.values(e.modes).flat(),n=[...new Set(t)];this.tokensMap=n.reduce((e,t)=>(e[t.name]=t,e),{})}else if(typeof e==`object`&&e)this.tokensMap=Object.assign({},e);else throw Error(`<tokensDictionary> argument must be An Array of Token constructors, A dictionary of Token constructors or an IMultiModeLexerDefinition`);this.tokensMap.EOF=ra;let n=(Object.hasOwn(e,`modes`)?Object.values(e.modes).flat():Object.values(e)).every(e=>e.categoryMatches?.length==0);this.tokenMatcher=n?Di:Ei,Ai(Object.values(this.tokensMap))}defineRule(e,t,n){if(this.selfAnalysisDone)throw Error(`Grammar rule <${e}> may not be defined after the 'performSelfAnalysis' method has been called'\nMake sure that all grammar rule definitions are done before 'performSelfAnalysis' is called.`);let r=Object.hasOwn(n,`resyncEnabled`)?n.resyncEnabled:cs.resyncEnabled,i=Object.hasOwn(n,`recoveryValueFunc`)?n.recoveryValueFunc:cs.recoveryValueFunc,a=this.ruleShortNameIdx<<12;this.ruleShortNameIdx++,this.shortRuleNameToFull[a]=e,this.fullRuleNameToShort[e]=a;let o;return o=this.outputCst===!0?function(...n){try{this.ruleInvocationStateUpdate(a,e,this.subruleIdx),t.apply(this,n);let r=this.CST_STACK[this.CST_STACK.length-1];return this.cstPostRule(r),r}catch(e){return this.invokeRuleCatch(e,r,i)}finally{this.ruleFinallyStateUpdate()}}:function(...n){try{return this.ruleInvocationStateUpdate(a,e,this.subruleIdx),t.apply(this,n)}catch(e){return this.invokeRuleCatch(e,r,i)}finally{this.ruleFinallyStateUpdate()}},Object.assign(function(...t){this.onBeforeParse(e);try{return o.apply(this,t)}finally{this.onAfterParse(e)}},{ruleName:e,originalGrammarAction:t,coreRule:o})}invokeRuleCatch(e,t,n){let r=this.RULE_STACK_IDX===0,i=t&&!this.isBackTracking()&&this.recoveryEnabled;if(uo(e)){let t=e;if(i){let r=this.findReSyncTokenType();if(this.isInCurrentRuleReSyncSet(r))if(t.resyncedTokens=this.reSyncTo(r),this.outputCst){let e=this.CST_STACK[this.CST_STACK.length-1];return e.recoveredNode=!0,e}else return n(e);else{if(this.outputCst){let e=this.CST_STACK[this.CST_STACK.length-1];e.recoveredNode=!0,t.partialCstResult=e}throw t}}else if(r)return this.moveToTerminatedState(),n(e);else throw t}else throw e}optionInternal(e,t){let n=this.getKeyForAutomaticLookahead(512,t);return this.optionInternalLogic(e,t,n)}optionInternalLogic(e,t,n){let r=this.getLaFuncFromCache(n),i;if(typeof e!=`function`){i=e.DEF;let t=e.GATE;if(t!==void 0){let e=r;r=()=>t.call(this)&&e.call(this)}}else i=e;if(r.call(this)===!0)return i.call(this)}atLeastOneInternal(e,t){let n=this.getKeyForAutomaticLookahead(So,e);return this.atLeastOneInternalLogic(e,t,n)}atLeastOneInternalLogic(e,t,n){let r=this.getLaFuncFromCache(n),i;if(typeof t!=`function`){i=t.DEF;let e=t.GATE;if(e!==void 0){let t=r;r=()=>e.call(this)&&t.call(this)}}else i=t;if(r.call(this)===!0){let e=this.doSingleRepetition(i);for(;r.call(this)===!0&&e===!0;)e=this.doSingleRepetition(i)}else throw this.raiseEarlyExitException(e,V.REPETITION_MANDATORY,t.ERR_MSG);this.attemptInRepetitionRecovery(this.atLeastOneInternal,[e,t],r,So,e,ga)}atLeastOneSepFirstInternal(e,t){let n=this.getKeyForAutomaticLookahead(wo,e);this.atLeastOneSepFirstInternalLogic(e,t,n)}atLeastOneSepFirstInternalLogic(e,t,n){let r=t.DEF,i=t.SEP;if(this.getLaFuncFromCache(n).call(this)===!0){r.call(this);let t=()=>this.tokenMatcher(this.LA_FAST(1),i);for(;this.tokenMatcher(this.LA_FAST(1),i)===!0;)this.CONSUME(i),r.call(this);this.attemptInRepetitionRecovery(this.repetitionSepSecondInternal,[e,i,t,r,_a],t,wo,e,_a)}else throw this.raiseEarlyExitException(e,V.REPETITION_MANDATORY_WITH_SEPARATOR,t.ERR_MSG)}manyInternal(e,t){let n=this.getKeyForAutomaticLookahead(768,e);return this.manyInternalLogic(e,t,n)}manyInternalLogic(e,t,n){let r=this.getLaFuncFromCache(n),i;if(typeof t!=`function`){i=t.DEF;let e=t.GATE;if(e!==void 0){let t=r;r=()=>e.call(this)&&t.call(this)}}else i=t;let a=!0;for(;r.call(this)===!0&&a===!0;)a=this.doSingleRepetition(i);this.attemptInRepetitionRecovery(this.manyInternal,[e,t],r,768,e,ma,a)}manySepFirstInternal(e,t){let n=this.getKeyForAutomaticLookahead(Co,e);this.manySepFirstInternalLogic(e,t,n)}manySepFirstInternalLogic(e,t,n){let r=t.DEF,i=t.SEP;if(this.getLaFuncFromCache(n).call(this)===!0){r.call(this);let t=()=>this.tokenMatcher(this.LA_FAST(1),i);for(;this.tokenMatcher(this.LA_FAST(1),i)===!0;)this.CONSUME(i),r.call(this);this.attemptInRepetitionRecovery(this.repetitionSepSecondInternal,[e,i,t,r,ha],t,Co,e,ha)}}repetitionSepSecondInternal(e,t,n,r,i){for(;n();)this.CONSUME(t),r.call(this);this.attemptInRepetitionRecovery(this.repetitionSepSecondInternal,[e,t,n,r,i],n,wo,e,i)}doSingleRepetition(e){let t=this.getLexerPosition();return e.call(this),this.getLexerPosition()>t}orInternal(e,t){let n=this.getKeyForAutomaticLookahead(256,t),r=Array.isArray(e)?e:e.DEF,i=this.getLaFuncFromCache(n).call(this,r);if(i!==void 0)return r[i].ALT.call(this);this.raiseNoAltException(t,e.ERR_MSG)}ruleFinallyStateUpdate(){this.RULE_STACK_IDX--,this.RULE_OCCURRENCE_STACK_IDX--,this.RULE_STACK_IDX>=0&&(this.currRuleShortName=this.RULE_STACK[this.RULE_STACK_IDX]),this.cstFinallyStateUpdate()}subruleInternal(e,t,n){let r;try{let i=n===void 0?void 0:n.ARGS;return this.subruleIdx=t,r=e.coreRule.apply(this,i),this.cstPostNonTerminal(r,n!==void 0&&n.LABEL!==void 0?n.LABEL:e.ruleName),r}catch(t){throw this.subruleInternalError(t,n,e.ruleName)}}subruleInternalError(e,t,n){throw uo(e)&&e.partialCstResult!==void 0&&(this.cstPostNonTerminal(e.partialCstResult,t!==void 0&&t.LABEL!==void 0?t.LABEL:n),delete e.partialCstResult),e}consumeInternal(e,t,n){let r;try{let t=this.LA_FAST(1);this.tokenMatcher(t,e)===!0?(this.consumeToken(),r=t):this.consumeInternalError(e,t,n)}catch(n){r=this.consumeInternalRecovery(e,t,n)}return this.cstPostTerminal(n!==void 0&&n.LABEL!==void 0?n.LABEL:e.name,r),r}consumeInternalError(e,t,n){let r,i=this.LA(0);throw r=n!==void 0&&n.ERR_MSG?n.ERR_MSG:this.errorMessageProvider.buildMismatchTokenMessage({expected:e,actual:t,previous:i,ruleName:this.getCurrRuleFullName()}),this.SAVE_ERROR(new po(r,t,i))}consumeInternalRecovery(e,t,n){if(this.recoveryEnabled&&n.name===`MismatchedTokenException`&&!this.isBackTracking()){let r=this.getFollowsForInRuleRecovery(e,t);try{return this.tryInRuleRecovery(e,r)}catch(e){throw e.name===`InRuleRecoveryException`?n:e}}else throw n}saveRecogState(){let e=this.errors,t=this.RULE_STACK.slice(0,this.RULE_STACK_IDX+1);return{errors:e,lexerState:this.exportLexerState(),RULE_STACK:t,CST_STACK:this.CST_STACK}}reloadRecogState(e){this.errors=e.errors,this.importLexerState(e.lexerState);let t=e.RULE_STACK;for(let e=0;e<t.length;e++)this.RULE_STACK[e]=t[e];this.RULE_STACK_IDX=t.length-1,this.RULE_STACK_IDX>=0&&(this.currRuleShortName=this.RULE_STACK[this.RULE_STACK_IDX])}ruleInvocationStateUpdate(e,t,n){this.RULE_OCCURRENCE_STACK[++this.RULE_OCCURRENCE_STACK_IDX]=n,this.RULE_STACK[++this.RULE_STACK_IDX]=e,this.currRuleShortName=e,this.cstInvocationStateUpdate(t)}isBackTracking(){return this.isBackTrackingStack.length!==0}getCurrRuleFullName(){let e=this.currRuleShortName;return this.shortRuleNameToFull[e]}shortRuleNameToFullName(e){return this.shortRuleNameToFull[e]}isAtEndOfInput(){return this.tokenMatcher(this.LA(1),ra)}reset(){this.resetLexerState(),this.subruleIdx=0,this.currRuleShortName=0,this.isBackTrackingStack=[],this.errors=[],this.RULE_STACK_IDX=-1,this.RULE_OCCURRENCE_STACK_IDX=-1,this.CST_STACK=[]}onBeforeParse(e){for(let e=0;e<this.maxLookahead+1;e++)this.tokVector.push(os)}onAfterParse(e){if(this.isAtEndOfInput()===!1){let e=this.LA(1),t=this.errorMessageProvider.buildNotAllInputParsedMessage({firstRedundant:e,ruleName:this.getCurrRuleFullName()});this.SAVE_ERROR(new ho(t,e))}for(;this.tokVector.at(-1)===os;)this.tokVector.pop()}},Ko=class{initErrorHandler(e){this._errors=[],this.errorMessageProvider=Object.hasOwn(e,`errorMessageProvider`)?e.errorMessageProvider:ss.errorMessageProvider}SAVE_ERROR(e){if(uo(e))return e.context={ruleStack:this.getHumanReadableRuleStack(),ruleOccurrenceStack:this.RULE_OCCURRENCE_STACK.slice(0,this.RULE_OCCURRENCE_STACK_IDX+1)},this._errors.push(e),e;throw Error(`Trying to save an Error which is not a RecognitionException`)}get errors(){return[...this._errors]}set errors(e){this._errors=e}raiseEarlyExitException(e,t,n){let r=this.getCurrRuleFullName(),i=this.getGAstProductions()[r],a=Pa(e,i,t,this.maxLookahead)[0],o=[];for(let e=1;e<=this.maxLookahead;e++)o.push(this.LA(e));let s=this.errorMessageProvider.buildEarlyExitMessage({expectedIterationPaths:a,actual:o,previous:this.LA(0),customUserDescription:n,ruleName:r});throw this.SAVE_ERROR(new go(s,this.LA(1),this.LA(0)))}raiseNoAltException(e,t){let n=this.getCurrRuleFullName(),r=this.getGAstProductions()[n],i=Na(e,r,this.maxLookahead),a=[];for(let e=1;e<=this.maxLookahead;e++)a.push(this.LA(e));let o=this.LA(0),s=this.errorMessageProvider.buildNoViableAltMessage({expectedPathsPerAlt:i,actual:a,previous:o,customUserDescription:t,ruleName:this.getCurrRuleFullName()});throw this.SAVE_ERROR(new mo(s,this.LA(1),o))}},qo={description:`This Object indicates the Parser is during Recording Phase`};Object.freeze(qo);var Jo=!0,Yo=2**8-1,Xo=ta({name:`RECORDING_PHASE_TOKEN`,pattern:Ui.NA});Ai([Xo]);var Zo=ia(Xo,`This IToken indicates the Parser is in Recording Phase
	See: https://chevrotain.io/docs/guide/internals.html#grammar-recording for details`,-1,-1,-1,-1,-1,-1);Object.freeze(Zo);var Qo={name:`This CSTNode indicates the Parser is in Recording Phase
	See: https://chevrotain.io/docs/guide/internals.html#grammar-recording for details`,children:{}},$o=class{initGastRecorder(e){this.recordingProdStack=[],this.RECORDING_PHASE=!1}enableRecording(){this.RECORDING_PHASE=!0,this.TRACE_INIT(`Enable Recording`,()=>{for(let e=0;e<10;e++){let t=e>0?e:``;this[`CONSUME${t}`]=function(t,n){return this.consumeInternalRecord(t,e,n)},this[`SUBRULE${t}`]=function(t,n){return this.subruleInternalRecord(t,e,n)},this[`OPTION${t}`]=function(t){return this.optionInternalRecord(t,e)},this[`OR${t}`]=function(t){return this.orInternalRecord(t,e)},this[`MANY${t}`]=function(t){this.manyInternalRecord(e,t)},this[`MANY_SEP${t}`]=function(t){this.manySepFirstInternalRecord(e,t)},this[`AT_LEAST_ONE${t}`]=function(t){this.atLeastOneInternalRecord(e,t)},this[`AT_LEAST_ONE_SEP${t}`]=function(t){this.atLeastOneSepFirstInternalRecord(e,t)}}this.consume=function(e,t,n){return this.consumeInternalRecord(t,e,n)},this.subrule=function(e,t,n){return this.subruleInternalRecord(t,e,n)},this.option=function(e,t){return this.optionInternalRecord(t,e)},this.or=function(e,t){return this.orInternalRecord(t,e)},this.many=function(e,t){this.manyInternalRecord(e,t)},this.atLeastOne=function(e,t){this.atLeastOneInternalRecord(e,t)},this.ACTION=this.ACTION_RECORD,this.BACKTRACK=this.BACKTRACK_RECORD,this.LA=this.LA_RECORD})}disableRecording(){this.RECORDING_PHASE=!1,this.TRACE_INIT(`Deleting Recording methods`,()=>{let e=this;for(let t=0;t<10;t++){let n=t>0?t:``;delete e[`CONSUME${n}`],delete e[`SUBRULE${n}`],delete e[`OPTION${n}`],delete e[`OR${n}`],delete e[`MANY${n}`],delete e[`MANY_SEP${n}`],delete e[`AT_LEAST_ONE${n}`],delete e[`AT_LEAST_ONE_SEP${n}`]}delete e.consume,delete e.subrule,delete e.option,delete e.or,delete e.many,delete e.atLeastOne,delete e.ACTION,delete e.BACKTRACK,delete e.LA})}ACTION_RECORD(e){}BACKTRACK_RECORD(e,t){return()=>!0}LA_RECORD(e){return os}topLevelRuleRecord(e,t){try{let n=new sr({definition:[],name:e});return n.name=e,this.recordingProdStack.push(n),t.call(this),this.recordingProdStack.pop(),n}catch(e){if(e.KNOWN_RECORDER_ERROR!==!0)try{e.message+=`
	 This error was thrown during the "grammar recording phase" For more info see:
	https://chevrotain.io/docs/guide/internals.html#grammar-recording`}catch{throw e}throw e}}optionInternalRecord(e,t){return es.call(this,lr,e,t)}atLeastOneInternalRecord(e,t){es.call(this,ur,t,e)}atLeastOneSepFirstInternalRecord(e,t){es.call(this,dr,t,e,Jo)}manyInternalRecord(e,t){es.call(this,R,t,e)}manySepFirstInternalRecord(e,t){es.call(this,fr,t,e,Jo)}orInternalRecord(e,t){return ts.call(this,e,t)}subruleInternalRecord(e,t,n){if(rs(t),!e||!Object.hasOwn(e,`ruleName`)){let n=Error(`<SUBRULE${ns(t)}> argument is invalid expecting a Parser method reference but got: <${JSON.stringify(e)}>\n inside top level rule: <${this.recordingProdStack[0].name}>`);throw n.KNOWN_RECORDER_ERROR=!0,n}let r=this.recordingProdStack.at(-1),i=e.ruleName,a=new or({idx:t,nonTerminalName:i,label:n?.LABEL,referencedRule:void 0});return r.definition.push(a),this.outputCst?Qo:qo}consumeInternalRecord(e,t,n){if(rs(t),!Ii(e)){let n=Error(`<CONSUME${ns(t)}> argument is invalid expecting a TokenType reference but got: <${JSON.stringify(e)}>\n inside top level rule: <${this.recordingProdStack[0].name}>`);throw n.KNOWN_RECORDER_ERROR=!0,n}let r=this.recordingProdStack.at(-1),i=new z({idx:t,terminalType:e,label:n?.LABEL});return r.definition.push(i),Zo}};function es(e,t,n,r=!1){rs(n);let i=this.recordingProdStack.at(-1),a=typeof t==`function`?t:t.DEF,o=new e({definition:[],idx:n});return r&&(o.separator=t.SEP),Object.hasOwn(t,`MAX_LOOKAHEAD`)&&(o.maxLookahead=t.MAX_LOOKAHEAD),this.recordingProdStack.push(o),a.call(this),i.definition.push(o),this.recordingProdStack.pop(),qo}function ts(e,t){rs(t);let n=this.recordingProdStack.at(-1),r=Array.isArray(e)===!1,i=r===!1?e:e.DEF,a=new pr({definition:[],idx:t,ignoreAmbiguities:r&&e.IGNORE_AMBIGUITIES===!0});return Object.hasOwn(e,`MAX_LOOKAHEAD`)&&(a.maxLookahead=e.MAX_LOOKAHEAD),a.hasPredicates=i.some(e=>typeof e.GATE==`function`),n.definition.push(a),i.forEach(e=>{let t=new cr({definition:[]});a.definition.push(t),Object.hasOwn(e,`IGNORE_AMBIGUITIES`)?t.ignoreAmbiguities=e.IGNORE_AMBIGUITIES:Object.hasOwn(e,`GATE`)&&(t.ignoreAmbiguities=!0),this.recordingProdStack.push(t),e.ALT.call(this),this.recordingProdStack.pop()}),qo}function ns(e){return e===0?``:`${e}`}function rs(e){if(e<0||e>Yo){let t=Error(`Invalid DSL Method idx value: <${e}>\n\tIdx value must be a none negative value smaller than ${Yo+1}`);throw t.KNOWN_RECORDER_ERROR=!0,t}}var is=class{initPerformanceTracer(e){if(Object.hasOwn(e,`traceInitPerf`)){let t=e.traceInitPerf,n=typeof t==`number`;this.traceInitMaxIdent=n?t:1/0,this.traceInitPerf=n?t>0:t}else this.traceInitMaxIdent=0,this.traceInitPerf=ss.traceInitPerf;this.traceInitIndent=-1}TRACE_INIT(e,t){if(this.traceInitPerf===!0){this.traceInitIndent++;let n=Array(this.traceInitIndent+1).join(`	`);this.traceInitIndent<this.traceInitMaxIdent&&console.log(`${n}--> <${e}>`);let{time:r,value:i}=tr(t),a=r>10?console.warn:console.log;return this.traceInitIndent<this.traceInitMaxIdent&&a(`${n}<-- <${e}> time: ${r}ms`),this.traceInitIndent--,i}else return t()}};function as(e,t){t.forEach(t=>{let n=t.prototype;Object.getOwnPropertyNames(n).forEach(r=>{if(r===`constructor`)return;let i=Object.getOwnPropertyDescriptor(n,r);i&&(i.get||i.set)?Object.defineProperty(e.prototype,r,i):e.prototype[r]=t.prototype[r]})})}var os=ia(ra,``,NaN,NaN,NaN,NaN,NaN,NaN);Object.freeze(os);var ss=Object.freeze({recoveryEnabled:!1,maxLookahead:3,dynamicTokensEnabled:!1,outputCst:!0,errorMessageProvider:oa,nodeLocationTracking:`none`,traceInitPerf:!1,skipValidations:!1}),cs=Object.freeze({recoveryValueFunc:()=>void 0,resyncEnabled:!0}),ls;(function(e){e[e.INVALID_RULE_NAME=0]=`INVALID_RULE_NAME`,e[e.DUPLICATE_RULE_NAME=1]=`DUPLICATE_RULE_NAME`,e[e.INVALID_RULE_OVERRIDE=2]=`INVALID_RULE_OVERRIDE`,e[e.DUPLICATE_PRODUCTIONS=3]=`DUPLICATE_PRODUCTIONS`,e[e.UNRESOLVED_SUBRULE_REF=4]=`UNRESOLVED_SUBRULE_REF`,e[e.LEFT_RECURSION=5]=`LEFT_RECURSION`,e[e.NONE_LAST_EMPTY_ALT=6]=`NONE_LAST_EMPTY_ALT`,e[e.AMBIGUOUS_ALTS=7]=`AMBIGUOUS_ALTS`,e[e.CONFLICT_TOKENS_RULES_NAMESPACE=8]=`CONFLICT_TOKENS_RULES_NAMESPACE`,e[e.INVALID_TOKEN_NAME=9]=`INVALID_TOKEN_NAME`,e[e.NO_NON_EMPTY_LOOKAHEAD=10]=`NO_NON_EMPTY_LOOKAHEAD`,e[e.AMBIGUOUS_PREFIX_ALTS=11]=`AMBIGUOUS_PREFIX_ALTS`,e[e.TOO_MANY_ALTS=12]=`TOO_MANY_ALTS`,e[e.CUSTOM_LOOKAHEAD_VALIDATION=13]=`CUSTOM_LOOKAHEAD_VALIDATION`})(ls||={});function us(e=void 0){return function(){return e}}var ds=class e{static performSelfAnalysis(e){throw Error("The **static** `performSelfAnalysis` method has been deprecated.	\nUse the **instance** method with the same name instead.")}performSelfAnalysis(){this.TRACE_INIT(`performSelfAnalysis`,()=>{let t;this.selfAnalysisDone=!0;let n=this.className;this.TRACE_INIT(`toFastProps`,()=>{nr(this)}),this.TRACE_INIT(`Grammar Recording`,()=>{try{this.enableRecording(),this.definedRulesNames.forEach(e=>{let t=this[e].originalGrammarAction,n;this.TRACE_INIT(`${e} Rule`,()=>{n=this.topLevelRuleRecord(e,t)}),this.gastProductionsCache[e]=n})}finally{this.disableRecording()}});let r=[];if(this.TRACE_INIT(`Grammar Resolving`,()=>{r=ro({rules:Object.values(this.gastProductionsCache)}),this.definitionErrors=this.definitionErrors.concat(r)}),this.TRACE_INIT(`Grammar Validations`,()=>{if(r.length===0&&this.skipValidations===!1){let e=io({rules:Object.values(this.gastProductionsCache),tokenTypes:Object.values(this.tokensMap),errMsgProvider:ca,grammarName:n}),t=Ra({lookaheadStrategy:this.lookaheadStrategy,rules:Object.values(this.gastProductionsCache),tokenTypes:Object.values(this.tokensMap),grammarName:n});this.definitionErrors=this.definitionErrors.concat(e,t)}}),this.definitionErrors.length===0&&(this.recoveryEnabled&&this.TRACE_INIT(`computeAllProdsFollows`,()=>{let e=Ar(Object.values(this.gastProductionsCache));this.resyncFollows=e}),this.TRACE_INIT(`ComputeLookaheadFunctions`,()=>{var e,t;(t=(e=this.lookaheadStrategy).initialize)==null||t.call(e,{rules:Object.values(this.gastProductionsCache)}),this.preComputeLookaheadFunctions(Object.values(this.gastProductionsCache))})),!e.DEFER_DEFINITION_ERRORS_HANDLING&&this.definitionErrors.length!==0)throw t=this.definitionErrors.map(e=>e.message),Error(`Parser Definition Errors detected:\n ${t.join(`
-------------------------------
`)}`)})}constructor(e,t){this.definitionErrors=[],this.selfAnalysisDone=!1;let n=this;if(n.initErrorHandler(t),n.initLexerAdapter(),n.initLooksAhead(t),n.initRecognizerEngine(e,t),n.initRecoverable(t),n.initTreeBuilder(t),n.initGastRecorder(t),n.initPerformanceTracer(t),Object.hasOwn(t,`ignoredIssues`))throw Error(`The <ignoredIssues> IParserConfig property has been deprecated.
	Please use the <IGNORE_AMBIGUITIES> flag on the relevant DSL method instead.
	See: https://chevrotain.io/docs/guide/resolving_grammar_errors.html#IGNORING_AMBIGUITIES
	For further details.`);this.skipValidations=Object.hasOwn(t,`skipValidations`)?t.skipValidations:ss.skipValidations}};ds.DEFER_DEFINITION_ERRORS_HANDLING=!1,as(ds,[bo,Do,Ho,Uo,Go,Wo,Ko,$o,is]);var fs=class extends ds{constructor(e,t=ss){let n=Object.assign({},t);n.outputCst=!1,super(e,n)}};function ps(e,t){for(var n=-1,r=e==null?0:e.length,i=Array(r);++n<r;)i[n]=t(e[n],n,e);return i}function ms(){this.__data__=[],this.size=0}function hs(e,t){return e===t||e!==e&&t!==t}function gs(e,t){for(var n=e.length;n--;)if(hs(e[n][0],t))return n;return-1}var _s=Array.prototype.splice;function vs(e){var t=this.__data__,n=gs(t,e);return n<0?!1:(n==t.length-1?t.pop():_s.call(t,n,1),--this.size,!0)}function ys(e){var t=this.__data__,n=gs(t,e);return n<0?void 0:t[n][1]}function bs(e){return gs(this.__data__,e)>-1}function xs(e,t){var n=this.__data__,r=gs(n,e);return r<0?(++this.size,n.push([e,t])):n[r][1]=t,this}function Ss(e){var t=-1,n=e==null?0:e.length;for(this.clear();++t<n;){var r=e[t];this.set(r[0],r[1])}}Ss.prototype.clear=ms,Ss.prototype.delete=vs,Ss.prototype.get=ys,Ss.prototype.has=bs,Ss.prototype.set=xs;function Cs(){this.__data__=new Ss,this.size=0}function ws(e){var t=this.__data__,n=t.delete(e);return this.size=t.size,n}function Ts(e){return this.__data__.get(e)}function Es(e){return this.__data__.has(e)}var Ds=typeof global==`object`&&global&&global.Object===Object&&global,Os=typeof self==`object`&&self&&self.Object===Object&&self,ks=Ds||Os||Function(`return this`)(),As=ks.Symbol,js=Object.prototype,Ms=js.hasOwnProperty,Ns=js.toString,Ps=As?As.toStringTag:void 0;function Fs(e){var t=Ms.call(e,Ps),n=e[Ps];try{e[Ps]=void 0;var r=!0}catch{}var i=Ns.call(e);return r&&(t?e[Ps]=n:delete e[Ps]),i}var Is=Object.prototype.toString;function Ls(e){return Is.call(e)}var Rs=`[object Null]`,zs=`[object Undefined]`,Bs=As?As.toStringTag:void 0;function Vs(e){return e==null?e===void 0?zs:Rs:Bs&&Bs in Object(e)?Fs(e):Ls(e)}function Hs(e){var t=typeof e;return e!=null&&(t==`object`||t==`function`)}var Us=`[object AsyncFunction]`,Ws=`[object Function]`,Gs=`[object GeneratorFunction]`,Ks=`[object Proxy]`;function qs(e){if(!Hs(e))return!1;var t=Vs(e);return t==Ws||t==Gs||t==Us||t==Ks}var Js=ks[`__core-js_shared__`],Ys=function(){var e=/[^.]+$/.exec(Js&&Js.keys&&Js.keys.IE_PROTO||``);return e?`Symbol(src)_1.`+e:``}();function Xs(e){return!!Ys&&Ys in e}var Zs=Function.prototype.toString;function Qs(e){if(e!=null){try{return Zs.call(e)}catch{}try{return e+``}catch{}}return``}var $s=/[\\^$.*+?()[\]{}|]/g,ec=/^\[object .+?Constructor\]$/,tc=Function.prototype,nc=Object.prototype,rc=tc.toString,ic=nc.hasOwnProperty,ac=RegExp(`^`+rc.call(ic).replace($s,`\\$&`).replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,`$1.*?`)+`$`);function oc(e){return!Hs(e)||Xs(e)?!1:(qs(e)?ac:ec).test(Qs(e))}function sc(e,t){return e?.[t]}function cc(e,t){var n=sc(e,t);return oc(n)?n:void 0}var lc=cc(ks,`Map`),uc=cc(Object,`create`);function dc(){this.__data__=uc?uc(null):{},this.size=0}function fc(e){var t=this.has(e)&&delete this.__data__[e];return this.size-=+!!t,t}var pc=`__lodash_hash_undefined__`,mc=Object.prototype.hasOwnProperty;function hc(e){var t=this.__data__;if(uc){var n=t[e];return n===pc?void 0:n}return mc.call(t,e)?t[e]:void 0}var gc=Object.prototype.hasOwnProperty;function _c(e){var t=this.__data__;return uc?t[e]!==void 0:gc.call(t,e)}var vc=`__lodash_hash_undefined__`;function yc(e,t){var n=this.__data__;return this.size+=+!this.has(e),n[e]=uc&&t===void 0?vc:t,this}function bc(e){var t=-1,n=e==null?0:e.length;for(this.clear();++t<n;){var r=e[t];this.set(r[0],r[1])}}bc.prototype.clear=dc,bc.prototype.delete=fc,bc.prototype.get=hc,bc.prototype.has=_c,bc.prototype.set=yc;function xc(){this.size=0,this.__data__={hash:new bc,map:new(lc||Ss),string:new bc}}function Sc(e){var t=typeof e;return t==`string`||t==`number`||t==`symbol`||t==`boolean`?e!==`__proto__`:e===null}function Cc(e,t){var n=e.__data__;return Sc(t)?n[typeof t==`string`?`string`:`hash`]:n.map}function wc(e){var t=Cc(this,e).delete(e);return this.size-=+!!t,t}function Tc(e){return Cc(this,e).get(e)}function Ec(e){return Cc(this,e).has(e)}function Dc(e,t){var n=Cc(this,e),r=n.size;return n.set(e,t),this.size+=n.size==r?0:1,this}function Oc(e){var t=-1,n=e==null?0:e.length;for(this.clear();++t<n;){var r=e[t];this.set(r[0],r[1])}}Oc.prototype.clear=xc,Oc.prototype.delete=wc,Oc.prototype.get=Tc,Oc.prototype.has=Ec,Oc.prototype.set=Dc;var kc=200;function Ac(e,t){var n=this.__data__;if(n instanceof Ss){var r=n.__data__;if(!lc||r.length<kc-1)return r.push([e,t]),this.size=++n.size,this;n=this.__data__=new Oc(r)}return n.set(e,t),this.size=n.size,this}function jc(e){var t=this.__data__=new Ss(e);this.size=t.size}jc.prototype.clear=Cs,jc.prototype.delete=ws,jc.prototype.get=Ts,jc.prototype.has=Es,jc.prototype.set=Ac;var Mc=`__lodash_hash_undefined__`;function Nc(e){return this.__data__.set(e,Mc),this}function Pc(e){return this.__data__.has(e)}function Fc(e){var t=-1,n=e==null?0:e.length;for(this.__data__=new Oc;++t<n;)this.add(e[t])}Fc.prototype.add=Fc.prototype.push=Nc,Fc.prototype.has=Pc;function Ic(e,t){for(var n=-1,r=e==null?0:e.length;++n<r;)if(t(e[n],n,e))return!0;return!1}function Lc(e,t){return e.has(t)}var Rc=1,zc=2;function Bc(e,t,n,r,i,a){var o=n&Rc,s=e.length,c=t.length;if(s!=c&&!(o&&c>s))return!1;var l=a.get(e),u=a.get(t);if(l&&u)return l==t&&u==e;var d=-1,f=!0,p=n&zc?new Fc:void 0;for(a.set(e,t),a.set(t,e);++d<s;){var m=e[d],h=t[d];if(r)var g=o?r(h,m,d,t,e,a):r(m,h,d,e,t,a);if(g!==void 0){if(g)continue;f=!1;break}if(p){if(!Ic(t,function(e,t){if(!Lc(p,t)&&(m===e||i(m,e,n,r,a)))return p.push(t)})){f=!1;break}}else if(!(m===h||i(m,h,n,r,a))){f=!1;break}}return a.delete(e),a.delete(t),f}var Vc=ks.Uint8Array;function Hc(e){var t=-1,n=Array(e.size);return e.forEach(function(e,r){n[++t]=[r,e]}),n}function Uc(e){var t=-1,n=Array(e.size);return e.forEach(function(e){n[++t]=e}),n}var Wc=1,Gc=2,Kc=`[object Boolean]`,qc=`[object Date]`,Jc=`[object Error]`,Yc=`[object Map]`,Xc=`[object Number]`,Zc=`[object RegExp]`,Qc=`[object Set]`,$c=`[object String]`,el=`[object Symbol]`,tl=`[object ArrayBuffer]`,nl=`[object DataView]`,rl=As?As.prototype:void 0,il=rl?rl.valueOf:void 0;function al(e,t,n,r,i,a,o){switch(n){case nl:if(e.byteLength!=t.byteLength||e.byteOffset!=t.byteOffset)return!1;e=e.buffer,t=t.buffer;case tl:return!(e.byteLength!=t.byteLength||!a(new Vc(e),new Vc(t)));case Kc:case qc:case Xc:return hs(+e,+t);case Jc:return e.name==t.name&&e.message==t.message;case Zc:case $c:return e==t+``;case Yc:var s=Hc;case Qc:var c=r&Wc;if(s||=Uc,e.size!=t.size&&!c)return!1;var l=o.get(e);if(l)return l==t;r|=Gc,o.set(e,t);var u=Bc(s(e),s(t),r,i,a,o);return o.delete(e),u;case el:if(il)return il.call(e)==il.call(t)}return!1}function ol(e,t){for(var n=-1,r=t.length,i=e.length;++n<r;)e[i+n]=t[n];return e}var sl=Array.isArray;function cl(e,t,n){var r=t(e);return sl(e)?r:ol(r,n(e))}function ll(e,t){for(var n=-1,r=e==null?0:e.length,i=0,a=[];++n<r;){var o=e[n];t(o,n,e)&&(a[i++]=o)}return a}function ul(){return[]}var dl=Object.prototype.propertyIsEnumerable,fl=Object.getOwnPropertySymbols,pl=fl?function(e){return e==null?[]:(e=Object(e),ll(fl(e),function(t){return dl.call(e,t)}))}:ul;function ml(e,t){for(var n=-1,r=Array(e);++n<e;)r[n]=t(n);return r}function hl(e){return typeof e==`object`&&!!e}var gl=`[object Arguments]`;function _l(e){return hl(e)&&Vs(e)==gl}var vl=Object.prototype,yl=vl.hasOwnProperty,bl=vl.propertyIsEnumerable,xl=_l(function(){return arguments}())?_l:function(e){return hl(e)&&yl.call(e,`callee`)&&!bl.call(e,`callee`)};function Sl(){return!1}var Cl=typeof exports==`object`&&exports&&!exports.nodeType&&exports,wl=Cl&&typeof module==`object`&&module&&!module.nodeType&&module,Tl=wl&&wl.exports===Cl?ks.Buffer:void 0,El=(Tl?Tl.isBuffer:void 0)||Sl,Dl=9007199254740991,Ol=/^(?:0|[1-9]\d*)$/;function kl(e,t){var n=typeof e;return t??=Dl,!!t&&(n==`number`||n!=`symbol`&&Ol.test(e))&&e>-1&&e%1==0&&e<t}var Al=9007199254740991;function jl(e){return typeof e==`number`&&e>-1&&e%1==0&&e<=Al}var Ml=`[object Arguments]`,Nl=`[object Array]`,Pl=`[object Boolean]`,Fl=`[object Date]`,Il=`[object Error]`,Ll=`[object Function]`,Rl=`[object Map]`,zl=`[object Number]`,Bl=`[object Object]`,Vl=`[object RegExp]`,Hl=`[object Set]`,Ul=`[object String]`,Wl=`[object WeakMap]`,Gl=`[object ArrayBuffer]`,Kl=`[object DataView]`,ql=`[object Float32Array]`,Jl=`[object Float64Array]`,Yl=`[object Int8Array]`,Xl=`[object Int16Array]`,Zl=`[object Int32Array]`,Ql=`[object Uint8Array]`,$l=`[object Uint8ClampedArray]`,eu=`[object Uint16Array]`,tu=`[object Uint32Array]`,H={};H[ql]=H[Jl]=H[Yl]=H[Xl]=H[Zl]=H[Ql]=H[$l]=H[eu]=H[tu]=!0,H[Ml]=H[Nl]=H[Gl]=H[Pl]=H[Kl]=H[Fl]=H[Il]=H[Ll]=H[Rl]=H[zl]=H[Bl]=H[Vl]=H[Hl]=H[Ul]=H[Wl]=!1;function nu(e){return hl(e)&&jl(e.length)&&!!H[Vs(e)]}function ru(e){return function(t){return e(t)}}var iu=typeof exports==`object`&&exports&&!exports.nodeType&&exports,au=iu&&typeof module==`object`&&module&&!module.nodeType&&module,ou=au&&au.exports===iu&&Ds.process,su=function(){try{return au&&au.require&&au.require(`util`).types||ou&&ou.binding&&ou.binding(`util`)}catch{}}(),cu=su&&su.isTypedArray,lu=cu?ru(cu):nu,uu=Object.prototype.hasOwnProperty;function du(e,t){var n=sl(e),r=!n&&xl(e),i=!n&&!r&&El(e),a=!n&&!r&&!i&&lu(e),o=n||r||i||a,s=o?ml(e.length,String):[],c=s.length;for(var l in e)(t||uu.call(e,l))&&!(o&&(l==`length`||i&&(l==`offset`||l==`parent`)||a&&(l==`buffer`||l==`byteLength`||l==`byteOffset`)||kl(l,c)))&&s.push(l);return s}var fu=Object.prototype;function pu(e){var t=e&&e.constructor;return e===(typeof t==`function`&&t.prototype||fu)}function mu(e,t){return function(n){return e(t(n))}}var hu=mu(Object.keys,Object),gu=Object.prototype.hasOwnProperty;function _u(e){if(!pu(e))return hu(e);var t=[];for(var n in Object(e))gu.call(e,n)&&n!=`constructor`&&t.push(n);return t}function vu(e){return e!=null&&jl(e.length)&&!qs(e)}function yu(e){return vu(e)?du(e):_u(e)}function bu(e){return cl(e,yu,pl)}var xu=1,Su=Object.prototype.hasOwnProperty;function Cu(e,t,n,r,i,a){var o=n&xu,s=bu(e),c=s.length;if(c!=bu(t).length&&!o)return!1;for(var l=c;l--;){var u=s[l];if(!(o?u in t:Su.call(t,u)))return!1}var d=a.get(e),f=a.get(t);if(d&&f)return d==t&&f==e;var p=!0;a.set(e,t),a.set(t,e);for(var m=o;++l<c;){u=s[l];var h=e[u],g=t[u];if(r)var _=o?r(g,h,u,t,e,a):r(h,g,u,e,t,a);if(!(_===void 0?h===g||i(h,g,n,r,a):_)){p=!1;break}m||=u==`constructor`}if(p&&!m){var v=e.constructor,y=t.constructor;v!=y&&`constructor`in e&&`constructor`in t&&!(typeof v==`function`&&v instanceof v&&typeof y==`function`&&y instanceof y)&&(p=!1)}return a.delete(e),a.delete(t),p}var wu=cc(ks,`DataView`),Tu=cc(ks,`Promise`),Eu=cc(ks,`Set`),Du=cc(ks,`WeakMap`),Ou=`[object Map]`,ku=`[object Object]`,Au=`[object Promise]`,ju=`[object Set]`,Mu=`[object WeakMap]`,Nu=`[object DataView]`,Pu=Qs(wu),Fu=Qs(lc),Iu=Qs(Tu),Lu=Qs(Eu),Ru=Qs(Du),zu=Vs;(wu&&zu(new wu(new ArrayBuffer(1)))!=Nu||lc&&zu(new lc)!=Ou||Tu&&zu(Tu.resolve())!=Au||Eu&&zu(new Eu)!=ju||Du&&zu(new Du)!=Mu)&&(zu=function(e){var t=Vs(e),n=t==ku?e.constructor:void 0,r=n?Qs(n):``;if(r)switch(r){case Pu:return Nu;case Fu:return Ou;case Iu:return Au;case Lu:return ju;case Ru:return Mu}return t});var Bu=zu,Vu=1,Hu=`[object Arguments]`,Uu=`[object Array]`,Wu=`[object Object]`,Gu=Object.prototype.hasOwnProperty;function Ku(e,t,n,r,i,a){var o=sl(e),s=sl(t),c=o?Uu:Bu(e),l=s?Uu:Bu(t);c=c==Hu?Wu:c,l=l==Hu?Wu:l;var u=c==Wu,d=l==Wu,f=c==l;if(f&&El(e)){if(!El(t))return!1;o=!0,u=!1}if(f&&!u)return a||=new jc,o||lu(e)?Bc(e,t,n,r,i,a):al(e,t,c,n,r,i,a);if(!(n&Vu)){var p=u&&Gu.call(e,`__wrapped__`),m=d&&Gu.call(t,`__wrapped__`);if(p||m){var h=p?e.value():e,g=m?t.value():t;return a||=new jc,i(h,g,n,r,a)}}return f?(a||=new jc,Cu(e,t,n,r,i,a)):!1}function qu(e,t,n,r,i){return e===t?!0:e==null||t==null||!hl(e)&&!hl(t)?e!==e&&t!==t:Ku(e,t,n,r,qu,i)}var Ju=1,Yu=2;function Xu(e,t,n,r){var i=n.length,a=i,o=!r;if(e==null)return!a;for(e=Object(e);i--;){var s=n[i];if(o&&s[2]?s[1]!==e[s[0]]:!(s[0]in e))return!1}for(;++i<a;){s=n[i];var c=s[0],l=e[c],u=s[1];if(o&&s[2]){if(l===void 0&&!(c in e))return!1}else{var d=new jc;if(r)var f=r(l,u,c,e,t,d);if(!(f===void 0?qu(u,l,Ju|Yu,r,d):f))return!1}}return!0}function Zu(e){return e===e&&!Hs(e)}function Qu(e){for(var t=yu(e),n=t.length;n--;){var r=t[n],i=e[r];t[n]=[r,i,Zu(i)]}return t}function $u(e,t){return function(n){return n!=null&&n[e]===t&&(t!==void 0||e in Object(n))}}function ed(e){var t=Qu(e);return t.length==1&&t[0][2]?$u(t[0][0],t[0][1]):function(n){return n===e||Xu(n,e,t)}}var td=`[object Symbol]`;function nd(e){return typeof e==`symbol`||hl(e)&&Vs(e)==td}var rd=/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,id=/^\w*$/;function ad(e,t){if(sl(e))return!1;var n=typeof e;return n==`number`||n==`symbol`||n==`boolean`||e==null||nd(e)?!0:id.test(e)||!rd.test(e)||t!=null&&e in Object(t)}var od=`Expected a function`;function sd(e,t){if(typeof e!=`function`||t!=null&&typeof t!=`function`)throw TypeError(od);var n=function(){var r=arguments,i=t?t.apply(this,r):r[0],a=n.cache;if(a.has(i))return a.get(i);var o=e.apply(this,r);return n.cache=a.set(i,o)||a,o};return n.cache=new(sd.Cache||Oc),n}sd.Cache=Oc;var cd=500;function ld(e){var t=sd(e,function(e){return n.size===cd&&n.clear(),e}),n=t.cache;return t}var ud=/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,dd=/\\(\\)?/g,fd=ld(function(e){var t=[];return e.charCodeAt(0)===46&&t.push(``),e.replace(ud,function(e,n,r,i){t.push(r?i.replace(dd,`$1`):n||e)}),t}),pd=1/0,md=As?As.prototype:void 0,hd=md?md.toString:void 0;function gd(e){if(typeof e==`string`)return e;if(sl(e))return ps(e,gd)+``;if(nd(e))return hd?hd.call(e):``;var t=e+``;return t==`0`&&1/e==-pd?`-0`:t}function _d(e){return e==null?``:gd(e)}function vd(e,t){return sl(e)?e:ad(e,t)?[e]:fd(_d(e))}var yd=1/0;function bd(e){if(typeof e==`string`||nd(e))return e;var t=e+``;return t==`0`&&1/e==-yd?`-0`:t}function xd(e,t){t=vd(t,e);for(var n=0,r=t.length;e!=null&&n<r;)e=e[bd(t[n++])];return n&&n==r?e:void 0}function Sd(e,t,n){var r=e==null?void 0:xd(e,t);return r===void 0?n:r}function Cd(e,t){return e!=null&&t in Object(e)}function wd(e,t,n){t=vd(t,e);for(var r=-1,i=t.length,a=!1;++r<i;){var o=bd(t[r]);if(!(a=e!=null&&n(e,o)))break;e=e[o]}return a||++r!=i?a:(i=e==null?0:e.length,!!i&&jl(i)&&kl(o,i)&&(sl(e)||xl(e)))}function Td(e,t){return e!=null&&wd(e,t,Cd)}var Ed=1,Dd=2;function Od(e,t){return ad(e)&&Zu(t)?$u(bd(e),t):function(n){var r=Sd(n,e);return r===void 0&&r===t?Td(n,e):qu(t,r,Ed|Dd)}}function kd(e){return e}function Ad(e){return function(t){return t?.[e]}}function jd(e){return function(t){return xd(t,e)}}function Md(e){return ad(e)?Ad(bd(e)):jd(e)}function Nd(e){return typeof e==`function`?e:e==null?kd:typeof e==`object`?sl(e)?Od(e[0],e[1]):ed(e):Md(e)}function Pd(e){return function(t,n,r){for(var i=-1,a=Object(t),o=r(t),s=o.length;s--;){var c=o[e?s:++i];if(n(a[c],c,a)===!1)break}return t}}var Fd=Pd();function Id(e,t){return e&&Fd(e,t,yu)}function Ld(e,t){return function(n,r){if(n==null)return n;if(!vu(n))return e(n,r);for(var i=n.length,a=t?i:-1,o=Object(n);(t?a--:++a<i)&&r(o[a],a,o)!==!1;);return n}}var Rd=Ld(Id);function zd(e,t){var n=-1,r=vu(e)?Array(e.length):[];return Rd(e,function(e,i,a){r[++n]=t(e,i,a)}),r}function Bd(e,t){return(sl(e)?ps:zd)(e,Nd(t,3))}function Vd(e,t){var n=[];return Rd(e,function(e,r,i){t(e,r,i)&&n.push(e)}),n}function Hd(e,t){return(sl(e)?ll:Vd)(e,Nd(t,3))}function Ud(e,t,n){return`${e.name}_${t}_${n}`}var Wd=class{constructor(e){this.target=e}isEpsilon(){return!1}},Gd=class extends Wd{constructor(e,t){super(e),this.tokenType=t}},Kd=class extends Wd{constructor(e){super(e)}isEpsilon(){return!0}},qd=class extends Wd{constructor(e,t,n){super(e),this.rule=t,this.followState=n}isEpsilon(){return!0}};function Jd(e){let t={decisionMap:{},decisionStates:[],ruleToStartState:new Map,ruleToStopState:new Map,states:[]};Yd(t,e);let n=e.length;for(let r=0;r<n;r++){let n=e[r],i=rf(t,n,n);i!==void 0&&mf(t,n,i)}return t}function Yd(e,t){let n=t.length;for(let r=0;r<n;r++){let n=t[r],i=W(e,n,void 0,{type:2}),a=W(e,n,void 0,{type:7});i.stop=a,e.ruleToStartState.set(n,i),e.ruleToStopState.set(n,a)}}function Xd(e,t,n){return n instanceof z?ff(e,t,n.terminalType,n):n instanceof or?pf(e,t,n):n instanceof pr?tf(e,t,n):n instanceof lr?nf(e,t,n):n instanceof R?Zd(e,t,n):n instanceof fr?Qd(e,t,n):n instanceof ur?$d(e,t,n):n instanceof dr?ef(e,t,n):rf(e,t,n)}function Zd(e,t,n){let r=W(e,t,n,{type:5});return cf(e,r),of(e,t,n,lf(e,t,r,n,rf(e,t,n)))}function Qd(e,t,n){let r=W(e,t,n,{type:5});return cf(e,r),of(e,t,n,lf(e,t,r,n,rf(e,t,n)),ff(e,t,n.separator,n))}function $d(e,t,n){let r=W(e,t,n,{type:4});return cf(e,r),af(e,t,n,lf(e,t,r,n,rf(e,t,n)))}function ef(e,t,n){let r=W(e,t,n,{type:4});return cf(e,r),af(e,t,n,lf(e,t,r,n,rf(e,t,n)),ff(e,t,n.separator,n))}function tf(e,t,n){let r=W(e,t,n,{type:1});return cf(e,r),lf(e,t,r,n,...Bd(n.definition,n=>Xd(e,t,n)))}function nf(e,t,n){let r=W(e,t,n,{type:1});return cf(e,r),sf(e,t,n,lf(e,t,r,n,rf(e,t,n)))}function rf(e,t,n){let r=Hd(Bd(n.definition,n=>Xd(e,t,n)),e=>e!==void 0);return r.length===1?r[0]:r.length===0?void 0:df(e,r)}function af(e,t,n,r,i){let a=r.left,o=r.right,s=W(e,t,n,{type:11});cf(e,s);let c=W(e,t,n,{type:12});return a.loopback=s,c.loopback=s,e.decisionMap[Ud(t,i?`RepetitionMandatoryWithSeparator`:`RepetitionMandatory`,n.idx)]=s,U(o,s),i===void 0?(U(s,a),U(s,c)):(U(s,c),U(s,i.left),U(i.right,a)),{left:a,right:c}}function of(e,t,n,r,i){let a=r.left,o=r.right,s=W(e,t,n,{type:10});cf(e,s);let c=W(e,t,n,{type:12}),l=W(e,t,n,{type:9});return s.loopback=l,c.loopback=l,U(s,a),U(s,c),U(o,l),i===void 0?U(l,s):(U(l,c),U(l,i.left),U(i.right,a)),e.decisionMap[Ud(t,i?`RepetitionWithSeparator`:`Repetition`,n.idx)]=s,{left:s,right:c}}function sf(e,t,n,r){let i=r.left,a=r.right;return U(i,a),e.decisionMap[Ud(t,`Option`,n.idx)]=i,r}function cf(e,t){return e.decisionStates.push(t),t.decision=e.decisionStates.length-1,t.decision}function lf(e,t,n,r,...i){let a=W(e,t,r,{type:8,start:n});n.end=a;for(let e of i)e===void 0?U(n,a):(U(n,e.left),U(e.right,a));let o={left:n,right:a};return e.decisionMap[Ud(t,uf(r),r.idx)]=n,o}function uf(e){if(e instanceof pr)return`Alternation`;if(e instanceof lr)return`Option`;if(e instanceof R)return`Repetition`;if(e instanceof fr)return`RepetitionWithSeparator`;if(e instanceof ur)return`RepetitionMandatory`;if(e instanceof dr)return`RepetitionMandatoryWithSeparator`;throw Error(`Invalid production type encountered`)}function df(e,t){let n=t.length;for(let r=0;r<n-1;r++){let n=t[r],i;n.left.transitions.length===1&&(i=n.left.transitions[0]);let a=i instanceof qd,o=i,s=t[r+1].left;n.left.type===1&&n.right.type===1&&i!==void 0&&(a&&o.followState===n.right||i.target===n.right)?(a?o.followState=s:i.target=s,gf(e,n.right)):U(n.right,s)}let r=t[0],i=t[n-1];return{left:r.left,right:i.right}}function ff(e,t,n,r){let i=W(e,t,r,{type:1}),a=W(e,t,r,{type:1});return hf(i,new Gd(a,n)),{left:i,right:a}}function pf(e,t,n){let r=n.referencedRule,i=e.ruleToStartState.get(r),a=W(e,t,n,{type:1}),o=W(e,t,n,{type:1});return hf(a,new qd(i,r,o)),{left:a,right:o}}function mf(e,t,n){let r=e.ruleToStartState.get(t);U(r,n.left);let i=e.ruleToStopState.get(t);return U(n.right,i),{left:r,right:i}}function U(e,t){hf(e,new Kd(t))}function W(e,t,n,r){let i=Object.assign({atn:e,production:n,epsilonOnlyTransitions:!1,rule:t,transitions:[],nextTokenWithinRule:[],stateNumber:e.states.length},r);return e.states.push(i),i}function hf(e,t){e.transitions.length===0&&(e.epsilonOnlyTransitions=t.isEpsilon()),e.transitions.push(t)}function gf(e,t){e.states.splice(e.states.indexOf(t),1)}var _f={},vf=class{constructor(){this.map={},this.configs=[]}get size(){return this.configs.length}finalize(){this.map={}}add(e){let t=yf(e);t in this.map||(this.map[t]=this.configs.length,this.configs.push(e))}get elements(){return this.configs}get alts(){return Bd(this.configs,e=>e.alt)}get key(){let e=``;for(let t in this.map)e+=t+`:`;return e}};function yf(e,t=!0){return`${t?`a${e.alt}`:``}s${e.state.stateNumber}:${e.stack.map(e=>e.stateNumber.toString()).join(`_`)}`}function bf(e,t,n){for(var r=-1,i=e.length;++r<i;){var a=e[r],o=t(a);if(o!=null&&(s===void 0?o===o&&!nd(o):n(o,s)))var s=o,c=a}return c}function xf(e,t){return e<t}function Sf(e){return e&&e.length?bf(e,kd,xf):void 0}var Cf=As?As.isConcatSpreadable:void 0;function wf(e){return sl(e)||xl(e)||!!(Cf&&e&&e[Cf])}function Tf(e,t,n,r,i){var a=-1,o=e.length;for(n||=wf,i||=[];++a<o;){var s=e[a];t>0&&n(s)?t>1?Tf(s,t-1,n,r,i):ol(i,s):r||(i[i.length]=s)}return i}function Ef(e,t){return Tf(Bd(e,t),1)}function Df(e,t,n,r){for(var i=e.length,a=n+(r?1:-1);r?a--:++a<i;)if(t(e[a],a,e))return a;return-1}function Of(e){return e!==e}function kf(e,t,n){for(var r=n-1,i=e.length;++r<i;)if(e[r]===t)return r;return-1}function Af(e,t,n){return t===t?kf(e,t,n):Df(e,Of,n)}function jf(e,t){return!!(e!=null&&e.length)&&Af(e,t,0)>-1}function Mf(e,t,n){for(var r=-1,i=e==null?0:e.length;++r<i;)if(n(t,e[r]))return!0;return!1}function Nf(){}var Pf=Eu&&1/Uc(new Eu([,-0]))[1]==1/0?function(e){return new Eu(e)}:Nf,Ff=200;function If(e,t,n){var r=-1,i=jf,a=e.length,o=!0,s=[],c=s;if(n)o=!1,i=Mf;else if(a>=Ff){var l=t?null:Pf(e);if(l)return Uc(l);o=!1,i=Lc,c=new Fc}else c=t?[]:s;outer:for(;++r<a;){var u=e[r],d=t?t(u):u;if(u=n||u!==0?u:0,o&&d===d){for(var f=c.length;f--;)if(c[f]===d)continue outer;t&&c.push(d),s.push(u)}else i(c,d,n)||(c!==s&&c.push(d),s.push(u))}return s}function Lf(e,t){return e&&e.length?If(e,Nd(t,2)):[]}function Rf(e){return e!=null&&e.length?Tf(e,1):[]}function zf(e,t){for(var n=-1,r=e==null?0:e.length;++n<r&&t(e[n],n,e)!==!1;);return e}function Bf(e){return typeof e==`function`?e:kd}function Vf(e,t){return(sl(e)?zf:Rd)(e,Bf(t))}var Hf=`[object Map]`,Uf=`[object Set]`,Wf=Object.prototype.hasOwnProperty;function Gf(e){if(e==null)return!0;if(vu(e)&&(sl(e)||typeof e==`string`||typeof e.splice==`function`||El(e)||lu(e)||xl(e)))return!e.length;var t=Bu(e);if(t==Hf||t==Uf)return!e.size;if(pu(e))return!_u(e).length;for(var n in e)if(Wf.call(e,n))return!1;return!0}function Kf(e,t,n,r){var i=-1,a=e==null?0:e.length;for(r&&a&&(n=e[++i]);++i<a;)n=t(n,e[i],i,e);return n}function qf(e,t,n,r,i){return i(e,function(e,i,a){n=r?(r=!1,e):t(n,e,i,a)}),n}function Jf(e,t,n){var r=sl(e)?Kf:qf,i=arguments.length<3;return r(e,Nd(t,4),n,i,Rd)}function Yf(e,t){let n={};return r=>{let i=r.toString(),a=n[i];return a===void 0?(a={atnStartState:e,decision:t,states:{}},n[i]=a,a):a}}var Xf=class{constructor(){this.predicates=[]}is(e){return e>=this.predicates.length||this.predicates[e]}set(e,t){this.predicates[e]=t}toString(){let e=``,t=this.predicates.length;for(let n=0;n<t;n++)e+=this.predicates[n]===!0?`1`:`0`;return e}},Zf=new Xf,Qf=class extends Eo{constructor(e){super(),this.logging=e?.logging??(e=>console.log(e)),this.incomplete=e?.incomplete??!1}initialize(e){this.atn=Jd(e.rules),this.dfas=rp(this.atn),this.callers=ep(this.atn)}validateAmbiguousAlternationAlternatives(){return[]}validateEmptyOrAlternatives(){return[]}buildLookaheadForAlternation(e){let{prodOccurrence:t,rule:n,hasPredicates:r,dynamicTokensEnabled:i}=e,a=this.dfas,o=this.logging,s=this.incomplete,c=Ud(n,`Alternation`,t),l=this.atn.decisionMap[c].decision,u=Bd(Sa({maxLookahead:1,occurrence:t,prodType:`Alternation`,rule:n}),e=>Bd(e,e=>e[0]));if($f(u,!1)&&!i){let e=Jf(u,(e,t,n)=>(Vf(t,t=>{t&&(e[t.tokenTypeIdx]=n,Vf(t.categoryMatches,t=>{e[t]=n}))}),e),{});return r?function(t){let n=this.LA_FAST(1),r=e[n.tokenTypeIdx];if(t!==void 0&&r!==void 0){let e=t[r]?.GATE;if(e!==void 0&&e.call(this)===!1)return}return r}:function(){let t=this.LA_FAST(1);return e[t.tokenTypeIdx]}}else if(r)return function(e){let t=new Xf,n=e===void 0?0:e.length;for(let r=0;r<n;r++){let n=e?.[r].GATE;t.set(r,n===void 0||n.call(this))}let r=ip.call(this,a,l,t,o,s);return typeof r==`number`?r:void 0};else return function(){let e=ip.call(this,a,l,Zf,o,s);return typeof e==`number`?e:void 0}}buildLookaheadForOptional(e){let{prodOccurrence:t,rule:n,prodType:r,dynamicTokensEnabled:i}=e,a=this.dfas,o=this.logging,s=this.incomplete,c=this.callers,l=Ud(n,r,t),u=this.atn.decisionMap[l],d=u.decision,f=Bd(Sa({maxLookahead:1,occurrence:t,prodType:r,rule:n}),e=>Bd(e,e=>e[0]));if($f(f)&&f[0][0]&&!i&&!np(u,r,c)){let e=f[0],t=Rf(e);if(t.length===1&&Gf(t[0].categoryMatches)){let e=t[0].tokenTypeIdx;return function(){return this.LA_FAST(1).tokenTypeIdx===e}}else{let e=Jf(t,(e,t)=>(t!==void 0&&(e[t.tokenTypeIdx]=!0,Vf(t.categoryMatches,t=>{e[t]=!0})),e),{});return function(){let t=this.LA_FAST(1);return e[t.tokenTypeIdx]===!0}}}return function(){let e=ip.call(this,a,d,Zf,o,s);return typeof e!=`object`&&e===0}}};function $f(e,t=!0){let n=new Set;for(let r of e){let e=new Set;for(let i of r){if(i===void 0){if(t)break;return!1}let r=[i.tokenTypeIdx].concat(i.categoryMatches);for(let t of r)if(n.has(t)){if(!e.has(t))return!1}else n.add(t),e.add(t)}}return!0}function ep(e){let t=new Map;for(let n of e.states)for(let e of n.transitions)if(e instanceof qd){let n=t.get(e.rule);n===void 0&&(n=[],t.set(e.rule,n)),n.push(e.followState)}return t}function tp(e,t){let n=new Set,r=new Set,i=[e];for(;i.length>0;){let e=i.shift();if(!r.has(e)){if(r.add(e),e.type===7){if(t!==void 0){let n=t.get(e.rule);n!==void 0&&i.push(...n)}continue}for(let t of e.transitions)if(t instanceof Gd){n.add(t.tokenType.tokenTypeIdx);for(let e of t.tokenType.categoryMatches)n.add(e)}else i.push(t.target)}}return n}function np(e,t,n){let r=t===`RepetitionMandatoryWithSeparator`,i=e.transitions[+!!r],a=e.transitions[+!r];if(i===void 0||a===void 0)return!1;let o=tp(i.target),s=tp(a.target,n);for(let e of o)if(s.has(e))return!0;return!1}function rp(e){let t=e.decisionStates.length,n=Array(t);for(let r=0;r<t;r++)n[r]=Yf(e.decisionStates[r],r);return n}function ip(e,t,n,r,i){let a=e[t](n),o=a.start;return o===void 0&&(o=_p(a,hp(vp(a.atnStartState))),a.start=o),ap.apply(this,[a,o,n,r,i])}function ap(e,t,n,r,i){let a=t,o=1,s=[],c=this.LA_FAST(o++);for(;;){let t=dp(a,c);if(t===void 0&&(t=op.apply(this,[e,a,c,o,n,r])),t===_f)return up(s,a,c);if(t.isAcceptState===!0){if(i===!0&&aa(c,ra)){let e=Dp(a,n);if(e!==void 0)return e}return t.prediction}a=t,s.push(c),c=this.LA(o++)}}function op(e,t,n,r,i,a){let o=fp(t.configs,n,i);if(o.size===0)return gp(e,t,n,_f),_f;let s=hp(o),c=mp(o,i);if(c!==void 0)s.isAcceptState=!0,s.prediction=c,s.configs.uniqueAlt=c;else if(Cp(o)){let t=Sf(o.alts);s.isAcceptState=!0,s.prediction=t,s.configs.uniqueAlt=t,sp.apply(this,[e,r,o.alts,a])}return s=gp(e,t,n,s),s}function sp(e,t,n,r){let i=[];for(let e=1;e<=t;e++)i.push(this.LA(e).tokenType);let a=e.atnStartState,o=a.rule,s=a.production;r(cp({topLevelRule:o,ambiguityIndices:n,production:s,prefixPath:i}))}function cp(e){let t=Bd(e.prefixPath,e=>Wi(e)).join(`, `),n=e.production.idx===0?``:e.production.idx,r=`Ambiguous Alternatives Detected: <${e.ambiguityIndices.join(`, `)}> in <${lp(e.production)}${n}> inside <${e.topLevelRule.name}> Rule,\n<${t}> may appears as a prefix path in all these alternatives.\n`;return r+=`See: https://chevrotain.io/docs/guide/resolving_grammar_errors.html#AMBIGUOUS_ALTERNATIVES
For Further details.`,r}function lp(e){if(e instanceof or)return`SUBRULE`;if(e instanceof lr)return`OPTION`;if(e instanceof pr)return`OR`;if(e instanceof ur)return`AT_LEAST_ONE`;if(e instanceof dr)return`AT_LEAST_ONE_SEP`;if(e instanceof fr)return`MANY_SEP`;if(e instanceof R)return`MANY`;if(e instanceof z)return`CONSUME`;throw Error(`non exhaustive match`)}function up(e,t,n){return{actualToken:n,possibleTokenTypes:Lf(Ef(t.configs.elements,e=>e.state.transitions).filter(e=>e instanceof Gd).map(e=>e.tokenType),e=>e.tokenTypeIdx),tokenPath:e}}function dp(e,t){return e.edges[t.tokenTypeIdx]}function fp(e,t,n){let r=new vf,i=[];for(let a of e.elements){if(n.is(a.alt)===!1)continue;if(a.state.type===7){i.push(a);continue}let e=a.state.transitions.length;for(let n=0;n<e;n++){let e=a.state.transitions[n],i=pp(e,t);i!==void 0&&r.add({state:i,alt:a.alt,stack:a.stack})}}let a;if(i.length===0&&r.size===1&&(a=r),a===void 0){a=new vf;for(let e of r.elements)yp(e,a)}if(i.length>0&&!xp(a))for(let e of i)a.add(e);return a}function pp(e,t){if(e instanceof Gd&&aa(t,e.tokenType))return e.target}function mp(e,t){let n;for(let r of e.elements)if(t.is(r.alt)===!0){if(n===void 0)n=r.alt;else if(n!==r.alt)return}return n}function hp(e){return{configs:e,edges:{},isAcceptState:!1,prediction:-1}}function gp(e,t,n,r){return r=_p(e,r),t.edges[n.tokenTypeIdx]=r,r}function _p(e,t){if(t===_f)return t;let n=t.configs.key,r=e.states[n];return r===void 0?(t.configs.finalize(),e.states[n]=t,t):r}function vp(e){let t=new vf,n=e.transitions.length;for(let r=0;r<n;r++)yp({state:e.transitions[r].target,alt:r,stack:[]},t);return t}function yp(e,t){let n=e.state;if(n.type===7){if(e.stack.length>0){let n=[...e.stack];yp({state:n.pop(),alt:e.alt,stack:n},t)}else t.add(e);return}n.epsilonOnlyTransitions||t.add(e);let r=n.transitions.length;for(let i=0;i<r;i++){let r=n.transitions[i],a=bp(e,r);a!==void 0&&yp(a,t)}}function bp(e,t){if(t instanceof Kd)return{state:t.target,alt:e.alt,stack:e.stack};if(t instanceof qd){let n=[...e.stack,t.followState];return{state:t.target,alt:e.alt,stack:n}}}function xp(e){for(let t of e.elements)if(t.state.type===7)return!0;return!1}function Sp(e){for(let t of e.elements)if(t.state.type!==7)return!1;return!0}function Cp(e){if(Sp(e))return!0;let t=wp(e.elements);return Tp(t)&&!Ep(t)}function wp(e){let t=new Map;for(let n of e){let e=yf(n,!1),r=t.get(e);r===void 0&&(r={},t.set(e,r)),r[n.alt]=!0}return t}function Tp(e){for(let t of Array.from(e.values()))if(Object.keys(t).length>1)return!0;return!1}function Ep(e){for(let t of Array.from(e.values()))if(Object.keys(t).length===1)return!0;return!1}function Dp(e,t){let n;for(let r of e.configs.elements)if(!(t.is(r.alt)===!1||r.state.type===7)){if(n===void 0)n=r.alt;else if(n!==r.alt)return}return n}var Op=n({AnnotatedTextEdit:()=>Yp,ApplyKind:()=>_m,ChangeAnnotation:()=>qp,ChangeAnnotationIdentifier:()=>Jp,CodeAction:()=>Im,CodeActionContext:()=>Pm,CodeActionKind:()=>Mm,CodeActionTag:()=>Fm,CodeActionTriggerKind:()=>Nm,CodeDescription:()=>Up,CodeLens:()=>Lm,Color:()=>Fp,ColorInformation:()=>Ip,ColorPresentation:()=>Lp,Command:()=>Gp,CompletionItem:()=>ym,CompletionItemKind:()=>fm,CompletionItemLabelDetails:()=>vm,CompletionItemTag:()=>mm,CompletionList:()=>bm,CreateFile:()=>Zp,DeleteFile:()=>$p,Diagnostic:()=>Wp,DiagnosticRelatedInformation:()=>Bp,DiagnosticSeverity:()=>Vp,DiagnosticTag:()=>Hp,DocumentHighlight:()=>Em,DocumentHighlightKind:()=>Tm,DocumentLink:()=>zm,DocumentSymbol:()=>jm,DocumentUri:()=>kp,EOL:()=>ih,FoldingRange:()=>zp,FoldingRangeKind:()=>Rp,FormattingOptions:()=>Rm,Hover:()=>Sm,InlayHint:()=>Xm,InlayHintKind:()=>Jm,InlayHintLabelPart:()=>Ym,InlineCompletionContext:()=>nh,InlineCompletionItem:()=>Qm,InlineCompletionList:()=>$m,InlineCompletionTriggerKind:()=>eh,InlineValueContext:()=>qm,InlineValueEvaluatableExpression:()=>Km,InlineValueText:()=>Wm,InlineValueVariableLookup:()=>Gm,InsertReplaceEdit:()=>hm,InsertTextFormat:()=>pm,InsertTextMode:()=>gm,LanguageKind:()=>cm,Location:()=>Np,LocationLink:()=>Pp,MarkedString:()=>xm,MarkupContent:()=>dm,MarkupKind:()=>um,OptionalVersionedTextDocumentIdentifier:()=>sm,ParameterInformation:()=>Cm,Position:()=>G,Range:()=>K,RenameFile:()=>Qp,SelectedCompletionInfo:()=>th,SelectionRange:()=>Bm,SemanticTokenModifiers:()=>Hm,SemanticTokenTypes:()=>Vm,SemanticTokens:()=>Um,SignatureInformation:()=>wm,SnippetTextEdit:()=>nm,StringValue:()=>Zm,SymbolInformation:()=>km,SymbolKind:()=>Dm,SymbolTag:()=>Om,TextDocument:()=>ah,TextDocumentEdit:()=>Xp,TextDocumentIdentifier:()=>am,TextDocumentItem:()=>lm,TextEdit:()=>Kp,URI:()=>Ap,VersionedTextDocumentIdentifier:()=>om,WorkspaceChange:()=>im,WorkspaceEdit:()=>em,WorkspaceFolder:()=>rh,WorkspaceSymbol:()=>Am,integer:()=>jp,uinteger:()=>Mp}),kp,Ap,jp,Mp,G,K,Np,Pp,Fp,Ip,Lp,Rp,zp,Bp,Vp,Hp,Up,Wp,Gp,Kp,qp,Jp,Yp,Xp,Zp,Qp,$p,em,tm,nm,rm,im,am,om,sm,cm,lm,um,dm,fm,pm,mm,hm,gm,_m,vm,ym,bm,xm,Sm,Cm,wm,Tm,Em,Dm,Om,km,Am,jm,Mm,Nm,Pm,Fm,Im,Lm,Rm,zm,Bm,Vm,Hm,Um,Wm,Gm,Km,qm,Jm,Ym,Xm,Zm,Qm,$m,eh,th,nh,rh,ih,ah,oh,q,sh=t((()=>{(function(e){function t(e){return typeof e==`string`}e.is=t})(kp||={}),(function(e){function t(e){return typeof e==`string`}e.is=t})(Ap||={}),(function(e){e.MIN_VALUE=-2147483648,e.MAX_VALUE=2147483647;function t(t){return typeof t==`number`&&e.MIN_VALUE<=t&&t<=e.MAX_VALUE}e.is=t})(jp||={}),(function(e){e.MIN_VALUE=0,e.MAX_VALUE=2147483647;function t(t){return typeof t==`number`&&e.MIN_VALUE<=t&&t<=e.MAX_VALUE}e.is=t})(Mp||={}),(function(e){function t(e,t){return e===Number.MAX_VALUE&&(e=Mp.MAX_VALUE),t===Number.MAX_VALUE&&(t=Mp.MAX_VALUE),{line:e,character:t}}e.create=t;function n(e){let t=e;return q.objectLiteral(t)&&q.uinteger(t.line)&&q.uinteger(t.character)}e.is=n})(G||={}),(function(e){function t(e,t,n,r){if(q.uinteger(e)&&q.uinteger(t)&&q.uinteger(n)&&q.uinteger(r))return{start:G.create(e,t),end:G.create(n,r)};if(G.is(e)&&G.is(t))return{start:e,end:t};throw Error(`Range#create called with invalid arguments[${e}, ${t}, ${n}, ${r}]`)}e.create=t;function n(e){let t=e;return q.objectLiteral(t)&&G.is(t.start)&&G.is(t.end)}e.is=n})(K||={}),(function(e){function t(e,t){return{uri:e,range:t}}e.create=t;function n(e){let t=e;return q.objectLiteral(t)&&K.is(t.range)&&(q.string(t.uri)||q.undefined(t.uri))}e.is=n})(Np||={}),(function(e){function t(e,t,n,r){return{targetUri:e,targetRange:t,targetSelectionRange:n,originSelectionRange:r}}e.create=t;function n(e){let t=e;return q.objectLiteral(t)&&K.is(t.targetRange)&&q.string(t.targetUri)&&K.is(t.targetSelectionRange)&&(K.is(t.originSelectionRange)||q.undefined(t.originSelectionRange))}e.is=n})(Pp||={}),(function(e){function t(e,t,n,r){return{red:e,green:t,blue:n,alpha:r}}e.create=t;function n(e){let t=e;return q.objectLiteral(t)&&q.numberRange(t.red,0,1)&&q.numberRange(t.green,0,1)&&q.numberRange(t.blue,0,1)&&q.numberRange(t.alpha,0,1)}e.is=n})(Fp||={}),(function(e){function t(e,t){return{range:e,color:t}}e.create=t;function n(e){let t=e;return q.objectLiteral(t)&&K.is(t.range)&&Fp.is(t.color)}e.is=n})(Ip||={}),(function(e){function t(e,t,n){return{label:e,textEdit:t,additionalTextEdits:n}}e.create=t;function n(e){let t=e;return q.objectLiteral(t)&&q.string(t.label)&&(q.undefined(t.textEdit)||Kp.is(t))&&(q.undefined(t.additionalTextEdits)||q.typedArray(t.additionalTextEdits,Kp.is))}e.is=n})(Lp||={}),(function(e){e.Comment=`comment`,e.Imports=`imports`,e.Region=`region`})(Rp||={}),(function(e){function t(e,t,n,r,i,a){let o={startLine:e,endLine:t};return q.defined(n)&&(o.startCharacter=n),q.defined(r)&&(o.endCharacter=r),q.defined(i)&&(o.kind=i),q.defined(a)&&(o.collapsedText=a),o}e.create=t;function n(e){let t=e;return q.objectLiteral(t)&&q.uinteger(t.startLine)&&q.uinteger(t.startLine)&&(q.undefined(t.startCharacter)||q.uinteger(t.startCharacter))&&(q.undefined(t.endCharacter)||q.uinteger(t.endCharacter))&&(q.undefined(t.kind)||q.string(t.kind))}e.is=n})(zp||={}),(function(e){function t(e,t){return{location:e,message:t}}e.create=t;function n(e){let t=e;return q.defined(t)&&Np.is(t.location)&&q.string(t.message)}e.is=n})(Bp||={}),(function(e){e.Error=1,e.Warning=2,e.Information=3,e.Hint=4})(Vp||={}),(function(e){e.Unnecessary=1,e.Deprecated=2})(Hp||={}),(function(e){function t(e){let t=e;return q.objectLiteral(t)&&q.string(t.href)}e.is=t})(Up||={}),(function(e){function t(e,t,n,r,i,a){let o={range:e,message:t};return q.defined(n)&&(o.severity=n),q.defined(r)&&(o.code=r),q.defined(i)&&(o.source=i),q.defined(a)&&(o.relatedInformation=a),o}e.create=t;function n(e){let t=e;return q.defined(t)&&K.is(t.range)&&(q.string(t.message)||dm.is(t.message))&&(q.number(t.severity)||q.undefined(t.severity))&&(q.integer(t.code)||q.string(t.code)||q.undefined(t.code))&&(q.undefined(t.codeDescription)||q.string(t.codeDescription?.href))&&(q.string(t.source)||q.undefined(t.source))&&(q.undefined(t.relatedInformation)||q.typedArray(t.relatedInformation,Bp.is))}e.is=n;function r(e){return q.string(e.message)}e.is3_17=r;function i(e){if(q.string(e.message))return e.message;if(dm.is(e.message))return e.message.value;throw Error(`Unknown message type ${typeof e.message}`)}e.getMessageString=i})(Wp||={}),(function(e){function t(e,t,...n){let r={title:e,command:t};return q.defined(n)&&n.length>0&&(r.arguments=n),r}e.create=t;function n(e){let t=e;return q.defined(t)&&q.string(t.title)&&(t.tooltip===void 0||q.string(t.tooltip))&&q.string(t.command)}e.is=n})(Gp||={}),(function(e){function t(e,t){return{range:e,newText:t}}e.replace=t;function n(e,t){return{range:{start:e,end:e},newText:t}}e.insert=n;function r(e){return{range:e,newText:``}}e.del=r;function i(e){let t=e;return q.objectLiteral(t)&&q.string(t.newText)&&K.is(t.range)}e.is=i})(Kp||={}),(function(e){function t(e,t,n){let r={label:e};return t!==void 0&&(r.needsConfirmation=t),n!==void 0&&(r.description=n),r}e.create=t;function n(e){let t=e;return q.objectLiteral(t)&&q.string(t.label)&&(q.boolean(t.needsConfirmation)||t.needsConfirmation===void 0)&&(q.string(t.description)||t.description===void 0)}e.is=n})(qp||={}),(function(e){function t(e){let t=e;return q.string(t)}e.is=t})(Jp||={}),(function(e){function t(e,t,n){return{range:e,newText:t,annotationId:n}}e.replace=t;function n(e,t,n){return{range:{start:e,end:e},newText:t,annotationId:n}}e.insert=n;function r(e,t){return{range:e,newText:``,annotationId:t}}e.del=r;function i(e){let t=e;return Kp.is(t)&&(qp.is(t.annotationId)||Jp.is(t.annotationId))}e.is=i})(Yp||={}),(function(e){function t(e,t){return{textDocument:e,edits:t}}e.create=t;function n(e){let t=e;return q.defined(t)&&sm.is(t.textDocument)&&Array.isArray(t.edits)}e.is=n})(Xp||={}),(function(e){function t(e,t,n){let r={kind:`create`,uri:e};return t!==void 0&&(t.overwrite!==void 0||t.ignoreIfExists!==void 0)&&(r.options=t),n!==void 0&&(r.annotationId=n),r}e.create=t;function n(e){let t=e;return t&&t.kind===`create`&&q.string(t.uri)&&(t.options===void 0||(t.options.overwrite===void 0||q.boolean(t.options.overwrite))&&(t.options.ignoreIfExists===void 0||q.boolean(t.options.ignoreIfExists)))&&(t.annotationId===void 0||Jp.is(t.annotationId))}e.is=n})(Zp||={}),(function(e){function t(e,t,n,r){let i={kind:`rename`,oldUri:e,newUri:t};return n!==void 0&&(n.overwrite!==void 0||n.ignoreIfExists!==void 0)&&(i.options=n),r!==void 0&&(i.annotationId=r),i}e.create=t;function n(e){let t=e;return t&&t.kind===`rename`&&q.string(t.oldUri)&&q.string(t.newUri)&&(t.options===void 0||(t.options.overwrite===void 0||q.boolean(t.options.overwrite))&&(t.options.ignoreIfExists===void 0||q.boolean(t.options.ignoreIfExists)))&&(t.annotationId===void 0||Jp.is(t.annotationId))}e.is=n})(Qp||={}),(function(e){function t(e,t,n){let r={kind:`delete`,uri:e};return t!==void 0&&(t.recursive!==void 0||t.ignoreIfNotExists!==void 0)&&(r.options=t),n!==void 0&&(r.annotationId=n),r}e.create=t;function n(e){let t=e;return t&&t.kind===`delete`&&q.string(t.uri)&&(t.options===void 0||(t.options.recursive===void 0||q.boolean(t.options.recursive))&&(t.options.ignoreIfNotExists===void 0||q.boolean(t.options.ignoreIfNotExists)))&&(t.annotationId===void 0||Jp.is(t.annotationId))}e.is=n})($p||={}),(function(e){function t(e){let t=e;return t&&(t.changes!==void 0||t.documentChanges!==void 0)&&(t.documentChanges===void 0||t.documentChanges.every(e=>q.string(e.kind)?Zp.is(e)||Qp.is(e)||$p.is(e):Xp.is(e)))}e.is=t})(em||={}),tm=class{constructor(e,t){this.edits=e,this.changeAnnotations=t}insert(e,t,n){let r,i;if(n===void 0?r=Kp.insert(e,t):Jp.is(n)?(i=n,r=Yp.insert(e,t,n)):(this.assertChangeAnnotations(this.changeAnnotations),i=this.changeAnnotations.manage(n),r=Yp.insert(e,t,i)),this.edits.push(r),i!==void 0)return i}replace(e,t,n){let r,i;if(n===void 0?r=Kp.replace(e,t):Jp.is(n)?(i=n,r=Yp.replace(e,t,n)):(this.assertChangeAnnotations(this.changeAnnotations),i=this.changeAnnotations.manage(n),r=Yp.replace(e,t,i)),this.edits.push(r),i!==void 0)return i}delete(e,t){let n,r;if(t===void 0?n=Kp.del(e):Jp.is(t)?(r=t,n=Yp.del(e,t)):(this.assertChangeAnnotations(this.changeAnnotations),r=this.changeAnnotations.manage(t),n=Yp.del(e,r)),this.edits.push(n),r!==void 0)return r}add(e){this.edits.push(e)}all(){return this.edits}clear(){this.edits.splice(0,this.edits.length)}assertChangeAnnotations(e){if(e===void 0)throw Error(`Text edit change is not configured to manage change annotations.`)}},(function(e){function t(e){let t=e;return q.objectLiteral(t)&&K.is(t.range)&&Zm.isSnippet(t.snippet)&&(t.annotationId===void 0||qp.is(t.annotationId)||Jp.is(t.annotationId))}e.is=t})(nm||={}),rm=class{constructor(e){this._annotations=e===void 0?Object.create(null):e,this._counter=0,this._size=0}all(){return this._annotations}get size(){return this._size}manage(e,t){let n;if(Jp.is(e)?n=e:(n=this.nextId(),t=e),this._annotations[n]!==void 0)throw Error(`Id ${n} is already in use.`);if(t===void 0)throw Error(`No annotation provided for id ${n}`);return this._annotations[n]=t,this._size++,n}nextId(){return this._counter++,this._counter.toString()}},im=class{constructor(e){this._textEditChanges=Object.create(null),e===void 0?this._workspaceEdit={}:(this._workspaceEdit=e,e.documentChanges?(this._changeAnnotations=new rm(e.changeAnnotations),e.changeAnnotations=this._changeAnnotations.all(),e.documentChanges.forEach(e=>{if(Xp.is(e)){let t=new tm(e.edits,this._changeAnnotations);this._textEditChanges[e.textDocument.uri]=t}})):e.changes&&Object.keys(e.changes).forEach(t=>{let n=new tm(e.changes[t]);this._textEditChanges[t]=n}))}get edit(){return this.initDocumentChanges(),this._changeAnnotations!==void 0&&(this._changeAnnotations.size===0?this._workspaceEdit.changeAnnotations=void 0:this._workspaceEdit.changeAnnotations=this._changeAnnotations.all()),this._workspaceEdit}getTextEditChange(e){if(sm.is(e)){if(this.initDocumentChanges(),this._workspaceEdit.documentChanges===void 0)throw Error(`Workspace edit is not configured for document changes.`);let t={uri:e.uri,version:e.version},n=this._textEditChanges[t.uri];if(!n){let e=[],r={textDocument:t,edits:e};this._workspaceEdit.documentChanges.push(r),n=new tm(e,this._changeAnnotations),this._textEditChanges[t.uri]=n}return n}else{if(this.initChanges(),this._workspaceEdit.changes===void 0)throw Error(`Workspace edit is not configured for normal text edit changes.`);let t=this._textEditChanges[e];if(!t){let n=[];this._workspaceEdit.changes[e]=n,t=new tm(n),this._textEditChanges[e]=t}return t}}initDocumentChanges(){this._workspaceEdit.documentChanges===void 0&&this._workspaceEdit.changes===void 0&&(this._changeAnnotations=new rm,this._workspaceEdit.documentChanges=[],this._workspaceEdit.changeAnnotations=this._changeAnnotations.all())}initChanges(){this._workspaceEdit.documentChanges===void 0&&this._workspaceEdit.changes===void 0&&(this._workspaceEdit.changes=Object.create(null))}createFile(e,t,n){if(this.initDocumentChanges(),this._workspaceEdit.documentChanges===void 0)throw Error(`Workspace edit is not configured for document changes.`);let r;qp.is(t)||Jp.is(t)?r=t:n=t;let i,a;if(r===void 0?i=Zp.create(e,n):(a=Jp.is(r)?r:this._changeAnnotations.manage(r),i=Zp.create(e,n,a)),this._workspaceEdit.documentChanges.push(i),a!==void 0)return a}renameFile(e,t,n,r){if(this.initDocumentChanges(),this._workspaceEdit.documentChanges===void 0)throw Error(`Workspace edit is not configured for document changes.`);let i;qp.is(n)||Jp.is(n)?i=n:r=n;let a,o;if(i===void 0?a=Qp.create(e,t,r):(o=Jp.is(i)?i:this._changeAnnotations.manage(i),a=Qp.create(e,t,r,o)),this._workspaceEdit.documentChanges.push(a),o!==void 0)return o}deleteFile(e,t,n){if(this.initDocumentChanges(),this._workspaceEdit.documentChanges===void 0)throw Error(`Workspace edit is not configured for document changes.`);let r;qp.is(t)||Jp.is(t)?r=t:n=t;let i,a;if(r===void 0?i=$p.create(e,n):(a=Jp.is(r)?r:this._changeAnnotations.manage(r),i=$p.create(e,n,a)),this._workspaceEdit.documentChanges.push(i),a!==void 0)return a}},(function(e){function t(e){return{uri:e}}e.create=t;function n(e){let t=e;return q.defined(t)&&q.string(t.uri)}e.is=n})(am||={}),(function(e){function t(e,t){return{uri:e,version:t}}e.create=t;function n(e){let t=e;return q.defined(t)&&q.string(t.uri)&&q.integer(t.version)}e.is=n})(om||={}),(function(e){function t(e,t){return{uri:e,version:t}}e.create=t;function n(e){let t=e;return q.defined(t)&&q.string(t.uri)&&(t.version===null||q.integer(t.version))}e.is=n})(sm||={}),(function(e){e.ABAP=`abap`,e.WindowsBat=`bat`,e.BibTeX=`bibtex`,e.Clojure=`clojure`,e.Coffeescript=`coffeescript`,e.C=`c`,e.CPP=`cpp`,e.CSharp=`csharp`,e.CSS=`css`,e.D=`d`,e.Delphi=`pascal`,e.Diff=`diff`,e.Dart=`dart`,e.Dockerfile=`dockerfile`,e.Elixir=`elixir`,e.Erlang=`erlang`,e.FSharp=`fsharp`,e.GitCommit=`git-commit`,e.GitRebase=`git-rebase`,e.Go=`go`,e.Groovy=`groovy`,e.Handlebars=`handlebars`,e.Haskell=`haskell`,e.HTML=`html`,e.Ini=`ini`,e.Java=`java`,e.JavaScript=`javascript`,e.JavaScriptReact=`javascriptreact`,e.JSON=`json`,e.LaTeX=`latex`,e.Less=`less`,e.Lua=`lua`,e.Makefile=`makefile`,e.Markdown=`markdown`,e.ObjectiveC=`objective-c`,e.ObjectiveCPP=`objective-cpp`,e.Pascal=`pascal`,e.Perl=`perl`,e.Perl6=`perl6`,e.PHP=`php`,e.Plaintext=`plaintext`,e.Powershell=`powershell`,e.Pug=`jade`,e.Python=`python`,e.R=`r`,e.Razor=`razor`,e.Ruby=`ruby`,e.Rust=`rust`,e.SCSS=`scss`,e.SASS=`sass`,e.Scala=`scala`,e.ShaderLab=`shaderlab`,e.ShellScript=`shellscript`,e.SQL=`sql`,e.Swift=`swift`,e.TypeScript=`typescript`,e.TypeScriptReact=`typescriptreact`,e.TeX=`tex`,e.VisualBasic=`vb`,e.XML=`xml`,e.XSL=`xsl`,e.YAML=`yaml`})(cm||={}),(function(e){function t(e,t,n,r){return{uri:e,languageId:t,version:n,text:r}}e.create=t;function n(e){let t=e;return q.defined(t)&&q.string(t.uri)&&q.string(t.languageId)&&q.integer(t.version)&&q.string(t.text)}e.is=n})(lm||={}),(function(e){e.PlainText=`plaintext`,e.Markdown=`markdown`;function t(t){let n=t;return n===e.PlainText||n===e.Markdown}e.is=t})(um||={}),(function(e){function t(e){let t=e;return q.objectLiteral(e)&&um.is(t.kind)&&q.string(t.value)}e.is=t})(dm||={}),(function(e){e.Text=1,e.Method=2,e.Function=3,e.Constructor=4,e.Field=5,e.Variable=6,e.Class=7,e.Interface=8,e.Module=9,e.Property=10,e.Unit=11,e.Value=12,e.Enum=13,e.Keyword=14,e.Snippet=15,e.Color=16,e.File=17,e.Reference=18,e.Folder=19,e.EnumMember=20,e.Constant=21,e.Struct=22,e.Event=23,e.Operator=24,e.TypeParameter=25})(fm||={}),(function(e){e.PlainText=1,e.Snippet=2})(pm||={}),(function(e){e.Deprecated=1})(mm||={}),(function(e){function t(e,t,n){return{newText:e,insert:t,replace:n}}e.create=t;function n(e){let t=e;return t&&q.string(t.newText)&&K.is(t.insert)&&K.is(t.replace)}e.is=n})(hm||={}),(function(e){e.asIs=1,e.adjustIndentation=2})(gm||={}),(function(e){e.Replace=1,e.Merge=2})(_m||={}),(function(e){function t(e){let t=e;return t&&(q.string(t.detail)||t.detail===void 0)&&(q.string(t.description)||t.description===void 0)}e.is=t})(vm||={}),(function(e){function t(e){return{label:e}}e.create=t})(ym||={}),(function(e){function t(e,t){return{items:e||[],isIncomplete:!!t}}e.create=t})(bm||={}),(function(e){function t(e){return e.replace(/[\\`*_{}[\]()#+\-.!]/g,`\\$&`)}e.fromPlainText=t;function n(e){let t=e;return q.string(t)||q.objectLiteral(t)&&q.string(t.language)&&q.string(t.value)}e.is=n})(xm||={}),(function(e){function t(e){let t=e;return!!t&&q.objectLiteral(t)&&(dm.is(t.contents)||xm.is(t.contents)||q.typedArray(t.contents,xm.is))&&(e.range===void 0||K.is(e.range))}e.is=t})(Sm||={}),(function(e){function t(e,t){return t?{label:e,documentation:t}:{label:e}}e.create=t})(Cm||={}),(function(e){function t(e,t,...n){let r={label:e};return q.defined(t)&&(r.documentation=t),q.defined(n)?r.parameters=n:r.parameters=[],r}e.create=t})(wm||={}),(function(e){e.Text=1,e.Read=2,e.Write=3})(Tm||={}),(function(e){function t(e,t){let n={range:e};return q.number(t)&&(n.kind=t),n}e.create=t})(Em||={}),(function(e){e.File=1,e.Module=2,e.Namespace=3,e.Package=4,e.Class=5,e.Method=6,e.Property=7,e.Field=8,e.Constructor=9,e.Enum=10,e.Interface=11,e.Function=12,e.Variable=13,e.Constant=14,e.String=15,e.Number=16,e.Boolean=17,e.Array=18,e.Object=19,e.Key=20,e.Null=21,e.EnumMember=22,e.Struct=23,e.Event=24,e.Operator=25,e.TypeParameter=26})(Dm||={}),(function(e){e.Deprecated=1})(Om||={}),(function(e){function t(e,t,n,r,i){let a={name:e,kind:t,location:{uri:r,range:n}};return i&&(a.containerName=i),a}e.create=t})(km||={}),(function(e){function t(e,t,n,r){return r===void 0?{name:e,kind:t,location:{uri:n}}:{name:e,kind:t,location:{uri:n,range:r}}}e.create=t})(Am||={}),(function(e){function t(e,t,n,r,i,a){let o={name:e,detail:t,kind:n,range:r,selectionRange:i};return a!==void 0&&(o.children=a),o}e.create=t;function n(e){let t=e;return t&&q.string(t.name)&&q.number(t.kind)&&K.is(t.range)&&K.is(t.selectionRange)&&(t.detail===void 0||q.string(t.detail))&&(t.deprecated===void 0||q.boolean(t.deprecated))&&(t.children===void 0||Array.isArray(t.children))&&(t.tags===void 0||Array.isArray(t.tags))}e.is=n})(jm||={}),(function(e){e.Empty=``,e.QuickFix=`quickfix`,e.Refactor=`refactor`,e.RefactorExtract=`refactor.extract`,e.RefactorInline=`refactor.inline`,e.RefactorMove=`refactor.move`,e.RefactorRewrite=`refactor.rewrite`,e.Source=`source`,e.SourceOrganizeImports=`source.organizeImports`,e.SourceFixAll=`source.fixAll`,e.Notebook=`notebook`})(Mm||={}),(function(e){e.Invoked=1,e.Automatic=2})(Nm||={}),(function(e){function t(e,t,n){let r={diagnostics:e};return t!=null&&(r.only=t),n!=null&&(r.triggerKind=n),r}e.create=t;function n(e){let t=e;return q.defined(t)&&q.typedArray(t.diagnostics,Wp.is)&&(t.only===void 0||q.typedArray(t.only,q.string))&&(t.triggerKind===void 0||t.triggerKind===Nm.Invoked||t.triggerKind===Nm.Automatic)}e.is=n})(Pm||={}),(function(e){e.LLMGenerated=1;function t(t){return q.defined(t)&&t===e.LLMGenerated}e.is=t})(Fm||={}),(function(e){function t(e,t,n){let r={title:e},i=!0;return typeof t==`string`?(i=!1,r.kind=t):Gp.is(t)?r.command=t:r.edit=t,i&&n!==void 0&&(r.kind=n),r}e.create=t;function n(e){let t=e;return t&&q.string(t.title)&&(t.diagnostics===void 0||q.typedArray(t.diagnostics,Wp.is))&&(t.kind===void 0||q.string(t.kind))&&(t.edit!==void 0||t.command!==void 0)&&(t.command===void 0||Gp.is(t.command))&&(t.isPreferred===void 0||q.boolean(t.isPreferred))&&(t.edit===void 0||em.is(t.edit))&&(t.tags===void 0||q.typedArray(t.tags,Fm.is))}e.is=n})(Im||={}),(function(e){function t(e,t){let n={range:e};return q.defined(t)&&(n.data=t),n}e.create=t;function n(e){let t=e;return q.defined(t)&&K.is(t.range)&&(q.undefined(t.command)||Gp.is(t.command))}e.is=n})(Lm||={}),(function(e){function t(e,t){return{tabSize:e,insertSpaces:t}}e.create=t;function n(e){let t=e;return q.defined(t)&&q.uinteger(t.tabSize)&&q.boolean(t.insertSpaces)}e.is=n})(Rm||={}),(function(e){function t(e,t,n){return{range:e,target:t,data:n}}e.create=t;function n(e){let t=e;return q.defined(t)&&K.is(t.range)&&(q.undefined(t.target)||q.string(t.target))}e.is=n})(zm||={}),(function(e){function t(e,t){return{range:e,parent:t}}e.create=t;function n(t){let n=t;return q.objectLiteral(n)&&K.is(n.range)&&(n.parent===void 0||e.is(n.parent))}e.is=n})(Bm||={}),(function(e){e.namespace=`namespace`,e.type=`type`,e.class=`class`,e.enum=`enum`,e.interface=`interface`,e.struct=`struct`,e.typeParameter=`typeParameter`,e.parameter=`parameter`,e.variable=`variable`,e.property=`property`,e.enumMember=`enumMember`,e.event=`event`,e.function=`function`,e.method=`method`,e.macro=`macro`,e.keyword=`keyword`,e.modifier=`modifier`,e.comment=`comment`,e.string=`string`,e.number=`number`,e.regexp=`regexp`,e.operator=`operator`,e.decorator=`decorator`,e.label=`label`})(Vm||={}),(function(e){e.declaration=`declaration`,e.definition=`definition`,e.readonly=`readonly`,e.static=`static`,e.deprecated=`deprecated`,e.abstract=`abstract`,e.async=`async`,e.modification=`modification`,e.documentation=`documentation`,e.defaultLibrary=`defaultLibrary`})(Hm||={}),(function(e){function t(e){let t=e;return q.objectLiteral(t)&&(t.resultId===void 0||typeof t.resultId==`string`)&&Array.isArray(t.data)&&(t.data.length===0||typeof t.data[0]==`number`)}e.is=t})(Um||={}),(function(e){function t(e,t){return{range:e,text:t}}e.create=t;function n(e){let t=e;return t!=null&&K.is(t.range)&&q.string(t.text)}e.is=n})(Wm||={}),(function(e){function t(e,t,n){return{range:e,variableName:t,caseSensitiveLookup:n}}e.create=t;function n(e){let t=e;return t!=null&&K.is(t.range)&&q.boolean(t.caseSensitiveLookup)&&(q.string(t.variableName)||t.variableName===void 0)}e.is=n})(Gm||={}),(function(e){function t(e,t){return{range:e,expression:t}}e.create=t;function n(e){let t=e;return t!=null&&K.is(t.range)&&(q.string(t.expression)||t.expression===void 0)}e.is=n})(Km||={}),(function(e){function t(e,t){return{frameId:e,stoppedLocation:t}}e.create=t;function n(e){let t=e;return q.defined(t)&&K.is(e.stoppedLocation)}e.is=n})(qm||={}),(function(e){e.Type=1,e.Parameter=2;function t(e){return e===1||e===2}e.is=t})(Jm||={}),(function(e){function t(e){return{value:e}}e.create=t;function n(e){let t=e;return q.objectLiteral(t)&&(t.tooltip===void 0||q.string(t.tooltip)||dm.is(t.tooltip))&&(t.location===void 0||Np.is(t.location))&&(t.command===void 0||Gp.is(t.command))}e.is=n})(Ym||={}),(function(e){function t(e,t,n){let r={position:e,label:t};return n!==void 0&&(r.kind=n),r}e.create=t;function n(e){let t=e;return q.objectLiteral(t)&&G.is(t.position)&&(q.string(t.label)||q.typedArray(t.label,Ym.is))&&(t.kind===void 0||Jm.is(t.kind))&&t.textEdits===void 0||q.typedArray(t.textEdits,Kp.is)&&(t.tooltip===void 0||q.string(t.tooltip)||dm.is(t.tooltip))&&(t.paddingLeft===void 0||q.boolean(t.paddingLeft))&&(t.paddingRight===void 0||q.boolean(t.paddingRight))}e.is=n})(Xm||={}),(function(e){function t(e){return{kind:`snippet`,value:e}}e.createSnippet=t;function n(e){let t=e;return q.objectLiteral(t)&&t.kind===`snippet`&&q.string(t.value)}e.isSnippet=n})(Zm||={}),(function(e){function t(e,t,n,r){return{insertText:e,filterText:t,range:n,command:r}}e.create=t})(Qm||={}),(function(e){function t(e){return{items:e}}e.create=t})($m||={}),(function(e){e.Invoked=1,e.Automatic=2})(eh||={}),(function(e){function t(e,t){return{range:e,text:t}}e.create=t})(th||={}),(function(e){function t(e,t){return{triggerKind:e,selectedCompletionInfo:t}}e.create=t})(nh||={}),(function(e){function t(e){let t=e;return q.objectLiteral(t)&&Ap.is(t.uri)&&q.string(t.name)}e.is=t})(rh||={}),ih=[`
`,`\r
`,`\r`],(function(e){function t(e,t,n,r){return new oh(e,t,n,r)}e.create=t;function n(e){let t=e;return!!(q.defined(t)&&q.string(t.uri)&&(q.undefined(t.languageId)||q.string(t.languageId))&&q.uinteger(t.lineCount)&&q.func(t.getText)&&q.func(t.positionAt)&&q.func(t.offsetAt))}e.is=n;function r(e,t){let n=e.getText(),r=i(t,(e,t)=>{let n=e.range.start.line-t.range.start.line;return n===0?e.range.start.character-t.range.start.character:n}),a=n.length;for(let t=r.length-1;t>=0;t--){let i=r[t],o=e.offsetAt(i.range.start),s=e.offsetAt(i.range.end);if(s<=a)n=n.substring(0,o)+i.newText+n.substring(s,n.length);else throw Error(`Overlapping edit`);a=o}return n}e.applyEdits=r;function i(e,t){if(e.length<=1)return e;let n=e.length/2|0,r=e.slice(0,n),a=e.slice(n);i(r,t),i(a,t);let o=0,s=0,c=0;for(;o<r.length&&s<a.length;)t(r[o],a[s])<=0?e[c++]=r[o++]:e[c++]=a[s++];for(;o<r.length;)e[c++]=r[o++];for(;s<a.length;)e[c++]=a[s++];return e}})(ah||={}),oh=class{constructor(e,t,n,r){this._uri=e,this._languageId=t,this._version=n,this._content=r,this._lineOffsets=void 0}get uri(){return this._uri}get languageId(){return this._languageId}get version(){return this._version}getText(e){if(e){let t=this.offsetAt(e.start),n=this.offsetAt(e.end);return this._content.substring(t,n)}return this._content}update(e,t){this._content=e.text,this._version=t,this._lineOffsets=void 0}getLineOffsets(){if(this._lineOffsets===void 0){let e=[],t=this._content,n=!0;for(let r=0;r<t.length;r++){n&&=(e.push(r),!1);let i=t.charAt(r);n=i===`\r`||i===`
`,i===`\r`&&r+1<t.length&&t.charAt(r+1)===`
`&&r++}n&&t.length>0&&e.push(t.length),this._lineOffsets=e}return this._lineOffsets}positionAt(e){e=Math.max(Math.min(e,this._content.length),0);let t=this.getLineOffsets(),n=0,r=t.length;if(r===0)return G.create(0,e);for(;n<r;){let i=Math.floor((n+r)/2);t[i]>e?r=i:n=i+1}let i=n-1;return G.create(i,e-t[i])}offsetAt(e){let t=this.getLineOffsets();if(e.line>=t.length)return this._content.length;if(e.line<0)return 0;let n=t[e.line],r=e.line+1<t.length?t[e.line+1]:this._content.length;return Math.max(Math.min(n+e.character,r),n)}get lineCount(){return this.getLineOffsets().length}},(function(e){let t=Object.prototype.toString;function n(e){return e!==void 0}e.defined=n;function r(e){return e===void 0}e.undefined=r;function i(e){return e===!0||e===!1}e.boolean=i;function a(e){return t.call(e)===`[object String]`}e.string=a;function o(e){return t.call(e)===`[object Number]`}e.number=o;function s(e,n,r){return t.call(e)===`[object Number]`&&n<=e&&e<=r}e.numberRange=s;function c(e){return t.call(e)===`[object Number]`&&-2147483648<=e&&e<=2147483647}e.integer=c;function l(e){return t.call(e)===`[object Number]`&&0<=e&&e<=2147483647}e.uinteger=l;function u(e){return t.call(e)===`[object Function]`}e.func=u;function d(e){return typeof e==`object`&&!!e}e.objectLiteral=d;function f(e,t){return Array.isArray(e)&&e.every(t)}e.typedArray=f})(q||={})}));sh();var ch=class{constructor(){this.nodeStack=[]}get current(){return this.nodeStack[this.nodeStack.length-1]??this.rootNode}buildRootNode(e){return this.rootNode=new ph(e),this.rootNode.root=this.rootNode,this.nodeStack=[this.rootNode],this.rootNode}buildCompositeNode(e){let t=new dh;return t.grammarSource=e,t.root=this.rootNode,this.current.content.push(t),this.nodeStack.push(t),t}buildLeafNode(e,t){let n=new uh(e.startOffset,e.image.length,It(e),e.tokenType,!t);return n.grammarSource=t,n.root=this.rootNode,this.current.content.push(n),n}removeNode(e){let t=e.container;if(t){let n=t.content.indexOf(e);n>=0&&t.content.splice(n,1)}}addHiddenNodes(e){let t=[];for(let n of e){let e=new uh(n.startOffset,n.image.length,It(n),n.tokenType,!0);e.root=this.rootNode,t.push(e)}let n=this.current,r=!1;if(n.content.length>0){n.content.push(...t);return}for(;n.container;){let e=n.container.content.indexOf(n);if(e>0){n.container.content.splice(e,0,...t),r=!0;break}n=n.container}r||this.rootNode.content.unshift(...t)}construct(e){let t=this.current;typeof e.$type==`string`&&!e.$infixName&&(this.current.astNode=e),e.$cstNode=t;let n=this.nodeStack.pop();n?.content.length===0&&this.removeNode(n)}},lh=class{get hidden(){return!1}get astNode(){let e=typeof this._astNode?.$type==`string`?this._astNode:this.container?.astNode;if(!e)throw Error(`This node has no associated AST element`);return e}set astNode(e){this._astNode=e}get text(){return this.root.fullText.substring(this.offset,this.end)}},uh=class extends lh{get offset(){return this._offset}get length(){return this._length}get end(){return this._offset+this._length}get hidden(){return this._hidden}get tokenType(){return this._tokenType}get range(){return this._range}constructor(e,t,n,r,i=!1){super(),this._hidden=i,this._offset=e,this._tokenType=r,this._length=t,this._range=n}},dh=class extends lh{constructor(){super(...arguments),this.content=new fh(this)}get offset(){return this.firstNonHiddenNode?.offset??0}get length(){return this.end-this.offset}get end(){return this.lastNonHiddenNode?.end??0}get range(){let e=this.firstNonHiddenNode,t=this.lastNonHiddenNode;if(e&&t){if(this._rangeCache===void 0){let{range:n}=e,{range:r}=t;this._rangeCache={start:n.start,end:r.end.line<n.start.line?n.start:r.end}}return this._rangeCache}else return{start:G.create(0,0),end:G.create(0,0)}}get firstNonHiddenNode(){for(let e of this.content)if(!e.hidden)return e;return this.content[0]}get lastNonHiddenNode(){for(let e=this.content.length-1;e>=0;e--){let t=this.content[e];if(!t.hidden)return t}return this.content[this.content.length-1]}},fh=class e extends Array{constructor(t){super(),this.parent=t,Object.setPrototypeOf(this,e.prototype)}push(...e){return this.addParents(e),super.push(...e)}unshift(...e){return this.addParents(e),super.unshift(...e)}splice(e,t,...n){return this.addParents(n),super.splice(e,t,...n)}addParents(e){for(let t of e)t.container=this.parent}},ph=class extends dh{get text(){return this._text.substring(this.offset,this.end)}get fullText(){return this._text}constructor(e){super(),this._text=``,this._text=e??``}},mh=Symbol(`Datatype`);function hh(e){return e.$type===mh}var gh=`​`,_h=e=>e.endsWith(gh)?e:e+gh,vh=class{constructor(e,t){this._unorderedGroups=new Map,this.allRules=new Map,this.lexer=e.parser.Lexer;let n=this.lexer.definition,r=e.LanguageMetaData.mode===`production`;e.shared.profilers.LangiumProfiler?.isActive(`parsing`)?this.wrapper=new Th(n,{...e.parser.ParserConfig,skipValidations:r,errorMessageProvider:e.parser.ParserErrorMessageProvider},t,e.shared.profilers.LangiumProfiler.createTask(`parsing`,e.LanguageMetaData.languageId)):this.wrapper=new wh(n,{...e.parser.ParserConfig,skipValidations:r,errorMessageProvider:e.parser.ParserErrorMessageProvider},t)}alternatives(e,t){this.wrapper.wrapOr(e,t)}optional(e,t){this.wrapper.wrapOption(e,t)}many(e,t){this.wrapper.wrapMany(e,t)}atLeastOne(e,t){this.wrapper.wrapAtLeastOne(e,t)}getRule(e){return this.allRules.get(e)}isRecording(){return this.wrapper.IS_RECORDING}get unorderedGroups(){return this._unorderedGroups}getRuleStack(){return this.wrapper.RULE_STACK}finalize(){this.wrapper.wrapSelfAnalysis()}},yh=class extends vh{get current(){return this.stack[this.stack.length-1]}constructor(e){super(e,!1),this.nodeBuilder=new ch,this.stack=[],this.assignmentMap=new Map,this.operatorPrecedence=new Map,this.linker=e.references.Linker,this.converter=e.parser.ValueConverter,this.astReflection=e.shared.AstReflection}rule(e,t){let n=this.computeRuleType(e),r;Ie(e)&&(r=e.name,this.registerPrecedenceMap(e));let i=this.wrapper.DEFINE_RULE(_h(e.name),this.startImplementation(n,r,t).bind(this));return this.allRules.set(e.name,i),$e(e)&&e.entry&&(this.mainRule=i),i}registerPrecedenceMap(e){let t=e.name,n=new Map;for(let t=0;t<e.operators.precedences.length;t++){let r=e.operators.precedences[t];for(let e of r.operators)n.set(e.value,{precedence:t,rightAssoc:r.associativity===`right`})}this.operatorPrecedence.set(t,n)}computeRuleType(e){return Ie(e)?zn(e):e.fragment?void 0:In(e)?mh:zn(e)}parse(e,t={}){this.nodeBuilder.buildRootNode(e);let n=this.lexerResult=this.lexer.tokenize(e);this.wrapper.input=n.tokens;let r=t.rule?this.allRules.get(t.rule):this.mainRule;if(!r)throw Error(t.rule?`No rule found with name '${t.rule}'`:`No main rule available.`);let i=this.doParse(r);return this.nodeBuilder.addHiddenNodes(n.hidden),this.unorderedGroups.clear(),this.lexerResult=void 0,w(i,{deep:!0}),{value:i,lexerErrors:n.errors,lexerReport:n.report,parserErrors:this.wrapper.errors}}doParse(e){let t=this.wrapper.rule(e);if(this.stack.length>0&&(t=this.construct()),t===void 0)throw Error(`No result from parser`);if(this.stack.length>0)throw Error(`Parser stack is not empty after parsing`);return t}startImplementation(e,t,n){return r=>{let i=!this.isRecording()&&e!==void 0;if(i){let n={$type:e};this.stack.push(n),e===mh?n.value=``:t!==void 0&&(n.$infixName=t)}return n(r),i?this.construct():void 0}}extractHiddenTokens(e){let t=this.lexerResult.hidden;if(!t.length)return[];let n=e.startOffset;for(let e=0;e<t.length;e++)if(t[e].startOffset>n)return t.splice(0,e);return t.splice(0,t.length)}consume(e,t,n){let r=this.wrapper.wrapConsume(e,t);if(!this.isRecording()&&this.isValidToken(r)){let e=this.extractHiddenTokens(r);this.nodeBuilder.addHiddenNodes(e);let t=this.nodeBuilder.buildLeafNode(r,n),{assignment:i,crossRef:a}=this.getAssignment(n),o=this.current;if(i){let e=He(n)?r.image:this.converter.convert(r.image,t);this.assign(i.operator,i.feature,e,t,a)}else if(hh(o)){let e=r.image;He(n)||(e=this.converter.convert(e,t).toString()),o.value+=e}}}isValidToken(e){return!e.isInsertedInRecovery&&!isNaN(e.startOffset)&&typeof e.endOffset==`number`&&!isNaN(e.endOffset)}subrule(e,t,n,r,i){let a;!this.isRecording()&&!n&&(a=this.nodeBuilder.buildCompositeNode(r));let o;try{o=this.wrapper.wrapSubrule(e,t,i)}finally{this.isRecording()||(o===void 0&&!n&&(o=this.construct()),o!==void 0&&a&&a.length>0&&this.performSubruleAssignment(o,r,a))}}performSubruleAssignment(e,t,n){let{assignment:r,crossRef:i}=this.getAssignment(t);if(r)this.assign(r.operator,r.feature,e,n,i);else if(!r){let t=this.current;if(hh(t))t.value+=e.toString();else if(typeof e==`object`&&e){let n=this.assignWithoutOverride(e,t);this.stack.pop(),this.stack.push(n)}}}action(e,t){if(!this.isRecording()){let n=this.current;if(t.feature&&t.operator){n=this.construct(),this.nodeBuilder.removeNode(n.$cstNode),this.nodeBuilder.buildCompositeNode(t).content.push(n.$cstNode);let r={$type:e};this.stack.push(r),this.assign(t.operator,t.feature,n,n.$cstNode)}else n.$type=e}}construct(){if(this.isRecording())return;let e=this.stack.pop();return this.nodeBuilder.construct(e),`$infixName`in e?this.constructInfix(e,this.operatorPrecedence.get(e.$infixName)):hh(e)?this.converter.convert(e.value,e.$cstNode):(ae(this.astReflection,e),e)}constructInfix(e,t){let n=e.parts;if(!Array.isArray(n)||n.length===0)return;let r=e.operators;if(!Array.isArray(r)||n.length<2)return n[0];let i=0,a=-1;for(let e=0;e<r.length;e++){let n=r[e],o=t.get(n)??{precedence:1/0,rightAssoc:!1};o.precedence>a?(a=o.precedence,i=e):o.precedence===a&&(o.rightAssoc||(i=e))}let o=r.slice(0,i),s=r.slice(i+1),c=n.slice(0,i+1),l=n.slice(i+1),u={$infixName:e.$infixName,$type:e.$type,$cstNode:e.$cstNode,parts:c,operators:o},d={$infixName:e.$infixName,$type:e.$type,$cstNode:e.$cstNode,parts:l,operators:s},f=this.constructInfix(u,t),p=this.constructInfix(d,t);return{$type:e.$type,$cstNode:e.$cstNode,left:f,operator:r[i],right:p}}getAssignment(e){if(!this.assignmentMap.has(e)){let t=T(e,he);this.assignmentMap.set(e,{assignment:t,crossRef:t&&we(t.terminal)?t.terminal.isMulti?`multi`:`single`:void 0})}return this.assignmentMap.get(e)}assign(e,t,n,r,i){let a=this.current,o;switch(o=i===`single`&&typeof n==`string`?this.linker.buildReference(a,t,r,n):i===`multi`&&typeof n==`string`?this.linker.buildMultiReference(a,t,r,n):n,e){case`=`:a[t]=o;break;case`?=`:a[t]=!0;break;case`+=`:Array.isArray(a[t])||(a[t]=[]),a[t].push(o)}}assignWithoutOverride(e,t){for(let[n,r]of Object.entries(t)){let t=e[n];t===void 0?e[n]=r:Array.isArray(t)&&Array.isArray(r)&&(r.push(...t),e[n]=r)}let n=e.$cstNode;return n&&(n.astNode=void 0,e.$cstNode=void 0),e}get definitionErrors(){return this.wrapper.definitionErrors}},bh=class{buildMismatchTokenMessage(e){return oa.buildMismatchTokenMessage(e)}buildNotAllInputParsedMessage(e){return oa.buildNotAllInputParsedMessage(e)}buildNoViableAltMessage(e){return oa.buildNoViableAltMessage(e)}buildEarlyExitMessage(e){return oa.buildEarlyExitMessage(e)}},xh=class extends bh{buildMismatchTokenMessage({expected:e,actual:t}){return`Expecting ${e.LABEL?"`"+e.LABEL+"`":e.name.endsWith(`:KW`)?`keyword '${e.name.substring(0,e.name.length-3)}'`:`token of type '${e.name}'`} but found \`${t.image}\`.`}buildNotAllInputParsedMessage({firstRedundant:e}){return`Expecting end of file but found \`${e.image}\`.`}},Sh=class extends vh{constructor(e){super(e,!0),this.tokens=[],this.elementStack=[],this.lastElementStack=[],this.nextTokenIndex=0,this.stackSize=0}action(){}construct(){}parse(e){this.resetState();let t=this.lexer.tokenize(e,{mode:`partial`});return this.tokens=t.tokens,this.wrapper.input=[...this.tokens],this.mainRule.call(this.wrapper,{}),this.unorderedGroups.clear(),{tokens:this.tokens,elementStack:[...this.lastElementStack],tokenIndex:this.nextTokenIndex}}rule(e,t){let n=this.wrapper.DEFINE_RULE(_h(e.name),this.startImplementation(t).bind(this));return this.allRules.set(e.name,n),e.entry&&(this.mainRule=n),n}resetState(){this.elementStack=[],this.lastElementStack=[],this.nextTokenIndex=0,this.stackSize=0}startImplementation(e){return t=>{let n=this.keepStackSize();try{e(t)}finally{this.resetStackSize(n)}}}removeUnexpectedElements(){this.elementStack.splice(this.stackSize)}keepStackSize(){let e=this.elementStack.length;return this.stackSize=e,e}resetStackSize(e){this.removeUnexpectedElements(),this.stackSize=e}consume(e,t,n){this.wrapper.wrapConsume(e,t),this.isRecording()||(this.lastElementStack=[...this.elementStack,n],this.nextTokenIndex=this.currIdx+1)}subrule(e,t,n,r,i){this.before(r),this.wrapper.wrapSubrule(e,t,i),this.after(r)}before(e){this.isRecording()||this.elementStack.push(e)}after(e){if(!this.isRecording()){let t=this.elementStack.lastIndexOf(e);t>=0&&this.elementStack.splice(t)}}get currIdx(){return this.wrapper.currIdx}},Ch={recoveryEnabled:!0,nodeLocationTracking:`full`,skipValidations:!0,errorMessageProvider:new xh},wh=class extends fs{constructor(e,t,n){let r=t&&`maxLookahead`in t;super(e,{...Ch,lookaheadStrategy:r?new Eo({maxLookahead:t.maxLookahead}):new Qf({logging:t.skipValidations?()=>{}:void 0,incomplete:n}),...t})}get IS_RECORDING(){return this.RECORDING_PHASE}DEFINE_RULE(e,t,n){return this.RULE(e,t,n)}wrapSelfAnalysis(){this.performSelfAnalysis()}wrapConsume(e,t){return this.consume(e,t,void 0)}wrapSubrule(e,t,n){return this.subrule(e,t,{ARGS:[n]})}wrapOr(e,t){this.or(e,t)}wrapOption(e,t){this.option(e,t)}wrapMany(e,t){this.many(e,t)}wrapAtLeastOne(e,t){this.atLeastOne(e,t)}rule(e){return e.call(this,{})}},Th=class extends wh{constructor(e,t,n,r){super(e,t,n),this.task=r}rule(e){this.task.start(),this.task.startSubTask(this.ruleName(e));try{return super.rule(e)}finally{this.task.stopSubTask(this.ruleName(e)),this.task.stop()}}ruleName(e){return e.ruleName}subrule(e,t,n){this.task.startSubTask(this.ruleName(t));try{return super.subrule(e,t,n)}finally{this.task.stopSubTask(this.ruleName(t))}}};function Eh(e,t,n){return Dh({parser:t,tokens:n,ruleNames:new Map},e),t}function Dh(e,t){let n=Sn(t,!1),r=S(t.rules).filter($e).filter(e=>n.has(e));for(let t of r){let n={...e,consume:1,optional:1,subrule:1,many:1,or:1};e.parser.rule(t,kh(n,t.definition))}let i=S(t.rules).filter(Ie).filter(e=>n.has(e));for(let t of i)e.parser.rule(t,Oh(e,t))}function Oh(e,t){let n=t.call.rule.ref;if(!n)throw Error(`Could not resolve reference to infix operator rule: `+t.call.rule.$refText);if(gt(n))throw Error(`Cannot use terminal rule in infix expression`);let r=t.operators.precedences.flatMap(e=>e.operators),i={$type:`Group`,elements:[]},a={$container:i,$type:`Assignment`,feature:`parts`,operator:`+=`,terminal:t.call},o={$container:i,$type:`Group`,elements:[],cardinality:`*`};i.elements.push(a,o);let s={$container:o,$type:`Assignment`,feature:`operators`,operator:`+=`,terminal:{$type:`Alternatives`,elements:r}},c={...a,$container:o};o.elements.push(s,c);let l=r.map(t=>e.tokens[t.value]).map((t,n)=>({ALT:()=>e.parser.consume(n,t,s)})),u;return t=>{u??=Vh(e,n),e.parser.subrule(0,u,!1,a,t),e.parser.many(0,{DEF:()=>{e.parser.alternatives(0,l),e.parser.subrule(1,u,!1,c,t)}})}}function kh(e,t,n=!1){let r;if(He(t))r=zh(e,t);else if(le(t))r=Ah(e,t);else if(he(t))r=kh(e,t.terminal);else if(we(t))r=Rh(e,t);else if(ot(t))r=jh(e,t);else if(de(t))r=Ph(e,t);else if(Tt(t))r=Fh(e,t);else if(Me(t))r=Ih(e,t);else if(Oe(t)){let n=e.consume++;r=()=>e.parser.consume(n,ra,t)}else throw new Yt(t.$cstNode,`Unexpected element type: ${t.$type}`);return Bh(e,n?void 0:Lh(t),r,t.cardinality)}function Ah(e,t){let n=zn(t);return()=>e.parser.action(n,t)}function jh(e,t){let n=t.rule.ref;if(N(n)){let r=e.subrule++,i=$e(n)&&n.fragment,a=t.arguments.length>0?Mh(n,t.arguments):()=>({}),o;return s=>{o??=Vh(e,n),e.parser.subrule(r,o,i,t,a(s))}}else if(gt(n)){let r=e.consume++,i=Uh(e,n.name);return()=>e.parser.consume(r,i,t)}else if(n)Xt(n);else throw new Yt(t.$cstNode,`Undefined rule: ${t.rule.$refText}`)}function Mh(e,t){if(t.some(e=>e.calledByName)){let e=t.map(e=>({parameterName:e.parameter?.ref?.name,predicate:Nh(e.value)}));return t=>{let n={};for(let{parameterName:r,predicate:i}of e)r&&(n[r]=i(t));return n}}else{let n=t.map(e=>Nh(e.value));return t=>{let r={};for(let i=0;i<n.length;i++)if(i<e.parameters.length){let a=e.parameters[i].name,o=n[i];r[a]=o(t)}return r}}}function Nh(e){if(Ee(e)){let t=Nh(e.left),n=Nh(e.right);return e=>t(e)||n(e)}else if(Se(e)){let t=Nh(e.left),n=Nh(e.right);return e=>t(e)&&n(e)}else if(qe(e)){let t=Nh(e.value);return e=>!t(e)}else if(Ze(e)){let t=e.parameter.ref.name;return e=>e!==void 0&&e[t]===!0}else if(_e(e)){let t=!!e.true;return()=>t}Xt(e)}function Ph(e,t){if(t.elements.length===1)return kh(e,t.elements[0]);{let n=[];for(let r of t.elements){let t={ALT:kh(e,r,!0)},i=Lh(r);i&&(t.GATE=Nh(i)),n.push(t)}let r=e.or++;return t=>e.parser.alternatives(r,n.map(e=>{let n={ALT:()=>e.ALT(t)},r=e.GATE;return r&&(n.GATE=()=>r(t)),n}))}}function Fh(e,t){if(t.elements.length===1)return kh(e,t.elements[0]);let n=[];for(let r of t.elements){let t={ALT:kh(e,r,!0)},i=Lh(r);i&&(t.GATE=Nh(i)),n.push(t)}let r=e.or++,i=(e,t)=>`uGroup_${e}_${t.getRuleStack().join(`-`)}`,a=Bh(e,Lh(t),t=>e.parser.alternatives(r,n.map((n,a)=>{let o={ALT:()=>!0},s=e.parser;o.ALT=()=>{if(n.ALT(t),!s.isRecording()){let e=i(r,s);s.unorderedGroups.get(e)||s.unorderedGroups.set(e,[]);let t=s.unorderedGroups.get(e);t?.[a]===void 0&&(t[a]=!0)}};let c=n.GATE;return c?o.GATE=()=>c(t):o.GATE=()=>!s.unorderedGroups.get(i(r,s))?.[a],o})),`*`);return t=>{a(t),e.parser.isRecording()||e.parser.unorderedGroups.delete(i(r,e.parser))}}function Ih(e,t){let n=t.elements.map(t=>kh(e,t));return e=>n.forEach(t=>t(e))}function Lh(e){if(Me(e))return e.guardCondition}function Rh(e,t,n=t.terminal){if(!n){if(!t.type.ref)throw Error(`Could not resolve reference to type: `+t.type.$refText);let n=Mn(t.type.ref)?.terminal;if(!n)throw Error(`Could not find name assignment for type: `+zn(t.type.ref));return Rh(e,t,n)}else if(ot(n)&&$e(n.rule.ref)){let r=n.rule.ref,i=e.subrule++,a;return n=>{a??=Vh(e,r),e.parser.subrule(i,a,!1,t,n)}}else if(ot(n)&&gt(n.rule.ref)){let r=e.consume++,i=Uh(e,n.rule.ref.name);return()=>e.parser.consume(r,i,t)}else if(He(n)){let r=e.consume++,i=Uh(e,n.value);return()=>e.parser.consume(r,i,t)}else throw Error(`Could not build cross reference parser`)}function zh(e,t){let n=e.consume++,r=e.tokens[t.value];if(!r)throw Error(`Could not find token for keyword: `+t.value);return()=>e.parser.consume(n,r,t)}function Bh(e,t,n,r){let i=t&&Nh(t);if(!r)if(i){let t=e.or++;return r=>e.parser.alternatives(t,[{ALT:()=>n(r),GATE:()=>i(r)},{ALT:us(),GATE:()=>!i(r)}])}else return n;if(r===`*`){let t=e.many++;return r=>e.parser.many(t,{DEF:()=>n(r),GATE:i?()=>i(r):void 0})}else if(r===`+`){let t=e.many++;if(i){let r=e.or++;return a=>e.parser.alternatives(r,[{ALT:()=>e.parser.atLeastOne(t,{DEF:()=>n(a)}),GATE:()=>i(a)},{ALT:us(),GATE:()=>!i(a)}])}else return r=>e.parser.atLeastOne(t,{DEF:()=>n(r)})}else if(r===`?`){let t=e.optional++;return r=>e.parser.optional(t,{DEF:()=>n(r),GATE:i?()=>i(r):void 0})}else Xt(r)}function Vh(e,t){let n=Hh(e,t),r=e.parser.getRule(n);if(!r)throw Error(`Rule "${n}" not found."`);return r}function Hh(e,t){if(N(t))return t.name;if(e.ruleNames.has(t))return e.ruleNames.get(t);{let n=t,r=n.$container,i=t.$type;for(;!$e(r);)(Me(r)||de(r)||Tt(r))&&(i=r.elements.indexOf(n).toString()+`:`+i),n=r,r=r.$container;return i=r.name+`:`+i,e.ruleNames.set(t,i),i}}function Uh(e,t){let n=e.tokens[t];if(!n)throw Error(`Token "${t}" not found."`);return n}function Wh(e){let t=e.Grammar,n=e.parser.Lexer,r=new Sh(e);return Eh(t,r,n.definition),r.finalize(),r}function Gh(e){let t=Kh(e);return t.finalize(),t}function Kh(e){let t=e.Grammar,n=e.parser.Lexer;return Eh(t,new yh(e),n.definition)}var qh=class{constructor(){this.diagnostics=[]}buildTokens(e,t){let n=S(Sn(e,!1)),r=this.buildTerminalTokens(n),i=this.buildKeywordTokens(n,r,t);return i.push(...r),i}flushLexingReport(e){return{diagnostics:this.popDiagnostics()}}popDiagnostics(){let e=[...this.diagnostics];return this.diagnostics=[],e}buildTerminalTokens(e){return e.filter(gt).filter(e=>!e.fragment).map(e=>this.buildTerminalToken(e)).toArray()}buildTerminalToken(e){let t=Hn(e),n=this.requiresCustomPattern(t)?this.regexPatternFunction(t):t,r={name:e.name,PATTERN:n};return typeof n==`function`&&(r.LINE_BREAKS=!0),e.hidden&&(r.GROUP=gn(t)?Ui.SKIPPED:`hidden`),r}requiresCustomPattern(e){return!!(e.flags.includes(`u`)||e.flags.includes(`s`))}regexPatternFunction(e){let t=new RegExp(e,e.flags+`y`);return(e,n)=>(t.lastIndex=n,t.exec(e))}buildKeywordTokens(e,t,n){return e.filter(N).flatMap(e=>k(e).filter(He)).distinct(e=>e.value).toArray().sort((e,t)=>t.value.length-e.value.length).map(e=>this.buildKeywordToken(e,t,!!n?.caseInsensitive))}buildKeywordToken(e,t,n){let r=this.buildKeywordPattern(e,n),i={name:e.value,PATTERN:r,LONGER_ALT:this.findLongerAlt(e,t)};return typeof r==`function`&&(i.LINE_BREAKS=!0),i}buildKeywordPattern(e,t){return t?new RegExp(_n(e.value),`i`):e.value}findLongerAlt(e,t){return t.reduce((t,n)=>{let r=n?.PATTERN;return r?.source&&vn(`^`+r.source+`$`,e.value)&&t.push(n),t},[])}},Jh=class{convert(e,t){let n=t.grammarSource;if(we(n)&&(n=wn(n)),ot(n)){let r=n.rule.ref;if(!r)throw Error(`This cst node was not parsed by a rule.`);return this.runConverter(r,e,t)}return e}runConverter(e,t,n){switch(e.name.toUpperCase()){case`INT`:return Yh.convertInt(t);case`STRING`:return Yh.convertString(t);case`ID`:return Yh.convertID(t)}switch(Vn(e)?.toLowerCase()){case`number`:return Yh.convertNumber(t);case`boolean`:return Yh.convertBoolean(t);case`bigint`:return Yh.convertBigint(t);case`date`:return Yh.convertDate(t);default:return t}}},Yh;(function(e){function t(e){let t=``;for(let r=1;r<e.length-1;r++){let i=e.charAt(r);if(i===`\\`){let i=e.charAt(++r);t+=n(i)}else t+=i}return t}e.convertString=t;function n(e){switch(e){case`b`:return`\b`;case`f`:return`\f`;case`n`:return`
`;case`r`:return`\r`;case`t`:return`	`;case`v`:return`\v`;case`0`:return`\0`;default:return e}}function r(e){return e.charAt(0)===`^`?e.substring(1):e}e.convertID=r;function i(e){return parseInt(e)}e.convertInt=i;function a(e){return BigInt(e)}e.convertBigint=a;function o(e){return new Date(e)}e.convertDate=o;function s(e){return Number(e)}e.convertNumber=s;function c(e){return e.toLowerCase()===`true`}e.convertBoolean=c})(Yh||={});var Xh=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.boolean=t,e.string=n,e.number=r,e.error=i,e.func=a,e.array=o,e.stringArray=s;function t(e){return e===!0||e===!1}function n(e){return typeof e==`string`||e instanceof String}function r(e){return typeof e==`number`||e instanceof Number}function i(e){return e instanceof Error}function a(e){return typeof e==`function`}function o(e){return Array.isArray(e)}function s(e){return o(e)&&e.every(e=>n(e))}})),Zh=r((e=>{var t=e&&e.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),n=e&&e.__setModuleDefault||(Object.create?(function(e,t){Object.defineProperty(e,"default",{enumerable:!0,value:t})}):function(e,t){e.default=t}),r=e&&e.__importStar||(function(){var e=function(t){return e=Object.getOwnPropertyNames||function(e){var t=[];for(var n in e)Object.prototype.hasOwnProperty.call(e,n)&&(t[t.length]=n);return t},e(t)};return function(r){if(r&&r.__esModule)return r;var i={};if(r!=null)for(var a=e(r),o=0;o<a.length;o++)a[o]!=="default"&&t(i,r,a[o]);return n(i,r),i}})();Object.defineProperty(e,"__esModule",{value:!0}),e.Message=e.NotificationType9=e.NotificationType8=e.NotificationType7=e.NotificationType6=e.NotificationType5=e.NotificationType4=e.NotificationType3=e.NotificationType2=e.NotificationType1=e.NotificationType0=e.NotificationType=e.RequestType9=e.RequestType8=e.RequestType7=e.RequestType6=e.RequestType5=e.RequestType4=e.RequestType3=e.RequestType2=e.RequestType1=e.RequestType=e.RequestType0=e.AbstractMessageSignature=e.ParameterStructures=e.ResponseError=e.ErrorCodes=void 0;var i=r(Xh()),a;(function(e){e.ParseError=-32700,e.InvalidRequest=-32600,e.MethodNotFound=-32601,e.InvalidParams=-32602,e.InternalError=-32603,e.jsonrpcReservedErrorRangeStart=-32099,e.serverErrorStart=-32099,e.MessageWriteError=-32099,e.MessageReadError=-32098,e.PendingResponseRejected=-32097,e.ConnectionInactive=-32096,e.ServerNotInitialized=-32002,e.UnknownErrorCode=-32001,e.jsonrpcReservedErrorRangeEnd=-32e3,e.serverErrorEnd=-32e3})(a||(e.ErrorCodes=a={})),e.ResponseError=class e extends Error{code;data;constructor(t,n,r){super(n),this.code=i.number(t)?t:a.UnknownErrorCode,this.data=r,Object.setPrototypeOf(this,e.prototype)}toJson(){let e={code:this.code,message:this.message};return this.data!==void 0&&(e.data=this.data),e}};var o=class e{kind;static auto=new e(`auto`);static byPosition=new e(`byPosition`);static byName=new e(`byName`);constructor(e){this.kind=e}static is(t){return t===e.auto||t===e.byName||t===e.byPosition}toString(){return this.kind}};e.ParameterStructures=o;var s=class{method;numberOfParams;constructor(e,t){this.method=e,this.numberOfParams=t}get parameterStructures(){return o.auto}};e.AbstractMessageSignature=s,e.RequestType0=class extends s{_;constructor(e){super(e,0)}},e.RequestType=class extends s{_parameterStructures;_;constructor(e,t=o.auto){super(e,1),this._parameterStructures=t}get parameterStructures(){return this._parameterStructures}},e.RequestType1=class extends s{_parameterStructures;_;constructor(e,t=o.auto){super(e,1),this._parameterStructures=t}get parameterStructures(){return this._parameterStructures}},e.RequestType2=class extends s{_;constructor(e){super(e,2)}},e.RequestType3=class extends s{_;constructor(e){super(e,3)}},e.RequestType4=class extends s{_;constructor(e){super(e,4)}},e.RequestType5=class extends s{_;constructor(e){super(e,5)}},e.RequestType6=class extends s{_;constructor(e){super(e,6)}},e.RequestType7=class extends s{_;constructor(e){super(e,7)}},e.RequestType8=class extends s{_;constructor(e){super(e,8)}},e.RequestType9=class extends s{_;constructor(e){super(e,9)}},e.NotificationType=class extends s{_parameterStructures;_;constructor(e,t=o.auto){super(e,1),this._parameterStructures=t}get parameterStructures(){return this._parameterStructures}},e.NotificationType0=class extends s{_;constructor(e){super(e,0)}},e.NotificationType1=class extends s{_parameterStructures;_;constructor(e,t=o.auto){super(e,1),this._parameterStructures=t}get parameterStructures(){return this._parameterStructures}},e.NotificationType2=class extends s{_;constructor(e){super(e,2)}},e.NotificationType3=class extends s{_;constructor(e){super(e,3)}},e.NotificationType4=class extends s{_;constructor(e){super(e,4)}},e.NotificationType5=class extends s{_;constructor(e){super(e,5)}},e.NotificationType6=class extends s{_;constructor(e){super(e,6)}},e.NotificationType7=class extends s{_;constructor(e){super(e,7)}},e.NotificationType8=class extends s{_;constructor(e){super(e,8)}},e.NotificationType9=class extends s{_;constructor(e){super(e,9)}};var c;(function(e){function t(e){let t=e;return t&&i.string(t.method)&&(i.string(t.id)||i.number(t.id))}e.isRequest=t;function n(e){let t=e;return t&&i.string(t.method)&&e.id===void 0}e.isNotification=n;function r(e){let t=e;return t&&(t.result!==void 0||!!t.error)&&(i.string(t.id)||i.number(t.id)||t.id===null)}e.isResponse=r})(c||(e.Message=c={}))})),Qh=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.LRUCache=e.LinkedMap=e.Touch=void 0;var t;(function(e){e.None=0,e.First=1,e.AsOld=e.First,e.Last=2,e.AsNew=e.Last})(t||(e.Touch=t={}));var n=class{[Symbol.toStringTag]=`LinkedMap`;_map;_head;_tail;_size;_state;constructor(){this._map=new Map,this._head=void 0,this._tail=void 0,this._size=0,this._state=0}clear(){this._map.clear(),this._head=void 0,this._tail=void 0,this._size=0,this._state++}isEmpty(){return!this._head&&!this._tail}get size(){return this._size}get first(){return this._head?.value}get last(){return this._tail?.value}before(e){let t=this._map.get(e);return t?t.previous?.value:void 0}after(e){let t=this._map.get(e);return t?t.next?.value:void 0}has(e){return this._map.has(e)}get(e,n=t.None){let r=this._map.get(e);if(r)return n!==t.None&&this.touch(r,n),r.value}set(e,n,r=t.None){let i=this._map.get(e);if(i)i.value=n,r!==t.None&&this.touch(i,r);else{switch(i={key:e,value:n,next:void 0,previous:void 0},r){case t.None:this.addItemLast(i);break;case t.First:this.addItemFirst(i);break;case t.Last:this.addItemLast(i);break;default:this.addItemLast(i);break}this._map.set(e,i),this._size++}return this}delete(e){return!!this.remove(e)}remove(e){let t=this._map.get(e);if(t)return this._map.delete(e),this.removeItem(t),this._size--,t.value}shift(){if(!this._head&&!this._tail)return;if(!this._head||!this._tail)throw Error(`Invalid list`);let e=this._head;return this._map.delete(e.key),this.removeItem(e),this._size--,e.value}forEach(e,t){let n=this._state,r=this._head;for(;r;){if(t?e.bind(t)(r.value,r.key,this):e(r.value,r.key,this),this._state!==n)throw Error(`LinkedMap got modified during iteration.`);r=r.next}}keys(){let e=this._state,t=this._head,n={[Symbol.iterator]:()=>n,next:()=>{if(this._state!==e)throw Error(`LinkedMap got modified during iteration.`);if(t){let e={value:t.key,done:!1};return t=t.next,e}else return{value:void 0,done:!0}}};return n}values(){let e=this._state,t=this._head,n={[Symbol.iterator]:()=>n,next:()=>{if(this._state!==e)throw Error(`LinkedMap got modified during iteration.`);if(t){let e={value:t.value,done:!1};return t=t.next,e}else return{value:void 0,done:!0}}};return n}entries(){let e=this._state,t=this._head,n={[Symbol.iterator]:()=>n,next:()=>{if(this._state!==e)throw Error(`LinkedMap got modified during iteration.`);if(t){let e={value:[t.key,t.value],done:!1};return t=t.next,e}else return{value:void 0,done:!0}}};return n}[Symbol.iterator](){return this.entries()}trimOld(e){if(e>=this.size)return;if(e===0){this.clear();return}let t=this._head,n=this.size;for(;t&&n>e;)this._map.delete(t.key),t=t.next,n--;this._head=t,this._size=n,t&&(t.previous=void 0),this._state++}addItemFirst(e){if(!this._head&&!this._tail)this._tail=e;else if(this._head)e.next=this._head,this._head.previous=e;else throw Error(`Invalid list`);this._head=e,this._state++}addItemLast(e){if(!this._head&&!this._tail)this._head=e;else if(this._tail)e.previous=this._tail,this._tail.next=e;else throw Error(`Invalid list`);this._tail=e,this._state++}removeItem(e){if(e===this._head&&e===this._tail)this._head=void 0,this._tail=void 0;else if(e===this._head){if(!e.next)throw Error(`Invalid list`);e.next.previous=void 0,this._head=e.next}else if(e===this._tail){if(!e.previous)throw Error(`Invalid list`);e.previous.next=void 0,this._tail=e.previous}else{let t=e.next,n=e.previous;if(!t||!n)throw Error(`Invalid list`);t.previous=n,n.next=t}e.next=void 0,e.previous=void 0,this._state++}touch(e,n){if(!this._head||!this._tail)throw Error(`Invalid list`);if(!(n!==t.First&&n!==t.Last)){if(n===t.First){if(e===this._head)return;let t=e.next,n=e.previous;e===this._tail?(n.next=void 0,this._tail=n):(t.previous=n,n.next=t),e.previous=void 0,e.next=this._head,this._head.previous=e,this._head=e,this._state++}else if(n===t.Last){if(e===this._tail)return;let t=e.next,n=e.previous;e===this._head?(t.previous=void 0,this._head=t):(t.previous=n,n.next=t),e.next=void 0,e.previous=this._tail,this._tail.next=e,this._tail=e,this._state++}}}toJSON(){let e=[];return this.forEach((t,n)=>{e.push([n,t])}),e}fromJSON(e){this.clear();for(let[t,n]of e)this.set(t,n)}};e.LinkedMap=n,e.LRUCache=class extends n{_limit;_ratio;constructor(e,t=1){super(),this._limit=e,this._ratio=Math.min(Math.max(0,t),1)}get limit(){return this._limit}set limit(e){this._limit=e,this.checkTrim()}get ratio(){return this._ratio}set ratio(e){this._ratio=Math.min(Math.max(0,e),1),this.checkTrim()}get(e,n=t.AsNew){return super.get(e,n)}peek(e){return super.get(e,t.None)}set(e,n){return super.set(e,n,t.Last),this.checkTrim(),this}checkTrim(){this.size>this._limit&&this.trimOld(Math.round(this._limit*this._ratio))}}})),$h=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.Disposable=void 0;var t;(function(e){function t(e){return{dispose:e}}e.create=t})(t||(e.Disposable=t={}))})),eg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0});var t;function n(){if(t===void 0)throw Error(`No runtime abstraction layer installed`);return t}(function(e){function n(e){if(e===void 0)throw Error(`No runtime abstraction layer provided`);t=e}e.install=n})(n||={}),e.default=n})),tg=r((e=>{var t=e&&e.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e,"__esModule",{value:!0}),e.Emitter=e.Event=void 0;var n=t(eg()),r;(function(e){let t={dispose(){}};e.None=function(){return t}})(r||(e.Event=r={}));var i=class{_callbacks;_contexts;add(e,t=null,n){this._callbacks||(this._callbacks=[],this._contexts=[]),this._callbacks.push(e),this._contexts.push(t),Array.isArray(n)&&n.push({dispose:()=>this.remove(e,t)})}remove(e,t=null){if(!this._callbacks)return;let n=!1;for(let r=0,i=this._callbacks.length;r<i;r++)if(this._callbacks[r]===e)if(this._contexts[r]===t){this._callbacks.splice(r,1),this._contexts.splice(r,1);return}else n=!0;if(n)throw Error(`When adding a listener with a context, you should remove it with the same context`)}invoke(...e){if(!this._callbacks)return[];let t=[],r=this._callbacks.slice(0),i=this._contexts.slice(0);for(let a=0,o=r.length;a<o;a++)try{t.push(r[a].apply(i[a],e))}catch(e){(0,n.default)().console.error(e)}return t}isEmpty(){return!this._callbacks||this._callbacks.length===0}dispose(){this._callbacks=void 0,this._contexts=void 0}};e.Emitter=class e{_options;static _noop=function(){};_event;_callbacks;constructor(e){this._options=e}get event(){return this._event||=(t,n,r)=>{this._callbacks||=new i,this._options&&this._options.onFirstListenerAdd&&this._callbacks.isEmpty()&&this._options.onFirstListenerAdd(this),this._callbacks.add(t,n);let a={dispose:()=>{this._callbacks&&(this._callbacks.remove(t,n),a.dispose=e._noop,this._options&&this._options.onLastListenerRemove&&this._callbacks.isEmpty()&&this._options.onLastListenerRemove(this))}};return Array.isArray(r)&&r.push(a),a},this._event}fire(e){this._callbacks&&this._callbacks.invoke.call(this._callbacks,e)}dispose(){this._callbacks&&=(this._callbacks.dispose(),void 0)}}})),ng=r((e=>{var t=e&&e.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),n=e&&e.__setModuleDefault||(Object.create?(function(e,t){Object.defineProperty(e,"default",{enumerable:!0,value:t})}):function(e,t){e.default=t}),r=e&&e.__importStar||(function(){var e=function(t){return e=Object.getOwnPropertyNames||function(e){var t=[];for(var n in e)Object.prototype.hasOwnProperty.call(e,n)&&(t[t.length]=n);return t},e(t)};return function(r){if(r&&r.__esModule)return r;var i={};if(r!=null)for(var a=e(r),o=0;o<a.length;o++)a[o]!=="default"&&t(i,r,a[o]);return n(i,r),i}})(),i=e&&e.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e,"__esModule",{value:!0}),e.CancellationTokenSource=e.CancellationToken=void 0;var a=i(eg()),o=r(Xh()),s=tg(),c;(function(e){e.None=Object.freeze({isCancellationRequested:!1,onCancellationRequested:s.Event.None}),e.Cancelled=Object.freeze({isCancellationRequested:!0,onCancellationRequested:s.Event.None});function t(t){let n=t;return n&&(n===e.None||n===e.Cancelled||o.boolean(n.isCancellationRequested)&&!!n.onCancellationRequested)}e.is=t})(c||(e.CancellationToken=c={}));var l=Object.freeze(function(e,t){let n=(0,a.default)().timer.setTimeout(e.bind(t),0);return{dispose(){n.dispose()}}}),u=class{_isCancelled=!1;_emitter;cancel(){this._isCancelled||(this._isCancelled=!0,this._emitter&&(this._emitter.fire(void 0),this.dispose()))}get isCancellationRequested(){return this._isCancelled}get onCancellationRequested(){return this._isCancelled?l:(this._emitter||=new s.Emitter,this._emitter.event)}dispose(){this._emitter&&=(this._emitter.dispose(),void 0)}};e.CancellationTokenSource=class{_token;get token(){return this._token||=new u,this._token}cancel(){this._token?this._token.cancel():this._token=c.Cancelled}dispose(){this._token?this._token instanceof u&&this._token.dispose():this._token=c.None}}})),rg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.SharedArrayReceiverStrategy=e.SharedArraySenderStrategy=void 0;var t=ng(),n;(function(e){e.Continue=0,e.Cancelled=1})(n||={}),e.SharedArraySenderStrategy=class{buffers;constructor(){this.buffers=new Map}enableCancellation(e){if(e.id===null)return;let t=new SharedArrayBuffer(4),r=new Int32Array(t,0,1);r[0]=n.Continue,this.buffers.set(e.id,t),e.$cancellationData=t}async sendCancellation(e,t){let r=this.buffers.get(t);if(r===void 0)return;let i=new Int32Array(r,0,1);Atomics.store(i,0,n.Cancelled)}cleanup(e){this.buffers.delete(e)}dispose(){this.buffers.clear()}};var r=class{data;constructor(e){this.data=new Int32Array(e,0,1)}get isCancellationRequested(){return Atomics.load(this.data,0)===n.Cancelled}get onCancellationRequested(){throw Error(`Cancellation over SharedArrayBuffer doesn't support cancellation events`)}},i=class{token;constructor(e){this.token=new r(e)}cancel(){}dispose(){}};e.SharedArrayReceiverStrategy=class{kind=`request`;createCancellationTokenSource(e){let n=e.$cancellationData;return n===void 0?new t.CancellationTokenSource:new i(n)}}})),ig=r((e=>{var t=e&&e.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e,"__esModule",{value:!0}),e.Semaphore=void 0;var n=t(eg());e.Semaphore=class{_capacity;_active;_waiting;constructor(e=1){if(e<=0)throw Error(`Capacity must be greater than 0`);this._capacity=e,this._active=0,this._waiting=[]}lock(e){return new Promise((t,n)=>{this._waiting.push({thunk:e,resolve:t,reject:n}),this.runNext()})}get active(){return this._active}runNext(){this._waiting.length===0||this._active===this._capacity||(0,n.default)().timer.setImmediate(()=>this.doRunNext())}doRunNext(){if(this._waiting.length===0||this._active===this._capacity)return;let e=this._waiting.shift();if(this._active++,this._active>this._capacity)throw Error(`Too many thunks active`);try{let t=e.thunk();t instanceof Promise?t.then(t=>{this._active--,e.resolve(t),this.runNext()},t=>{this._active--,e.reject(t),this.runNext()}):(this._active--,e.resolve(t),this.runNext())}catch(t){this._active--,e.reject(t),this.runNext()}}}})),ag=r((e=>{var t=e&&e.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),n=e&&e.__setModuleDefault||(Object.create?(function(e,t){Object.defineProperty(e,"default",{enumerable:!0,value:t})}):function(e,t){e.default=t}),r=e&&e.__importStar||(function(){var e=function(t){return e=Object.getOwnPropertyNames||function(e){var t=[];for(var n in e)Object.prototype.hasOwnProperty.call(e,n)&&(t[t.length]=n);return t},e(t)};return function(r){if(r&&r.__esModule)return r;var i={};if(r!=null)for(var a=e(r),o=0;o<a.length;o++)a[o]!=="default"&&t(i,r,a[o]);return n(i,r),i}})(),i=e&&e.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e,"__esModule",{value:!0}),e.ReadableStreamMessageReader=e.AbstractMessageReader=e.MessageReader=void 0;var a=i(eg()),o=r(Xh()),s=tg(),c=ig(),l;(function(e){function t(e){let t=e;return t&&o.func(t.listen)&&o.func(t.dispose)&&o.func(t.onError)&&o.func(t.onClose)&&o.func(t.onPartialMessage)}e.is=t})(l||(e.MessageReader=l={}));var u=class{errorEmitter;closeEmitter;partialMessageEmitter;constructor(){this.errorEmitter=new s.Emitter,this.closeEmitter=new s.Emitter,this.partialMessageEmitter=new s.Emitter}dispose(){this.errorEmitter.dispose(),this.closeEmitter.dispose(),this.partialMessageEmitter.dispose()}get onError(){return this.errorEmitter.event}fireError(e){this.errorEmitter.fire(this.asError(e))}get onClose(){return this.closeEmitter.event}fireClose(){this.closeEmitter.fire(void 0)}get onPartialMessage(){return this.partialMessageEmitter.event}firePartialMessage(e){this.partialMessageEmitter.fire(e)}asError(e){return e instanceof Error?e:Error(`Reader received error. Reason: ${o.string(e.message)?e.message:`unknown`}`)}};e.AbstractMessageReader=u;var d;(function(e){function t(e){let t,n,r=new Map,i,o=new Map;if(e===void 0||typeof e==`string`)t=e??`utf-8`;else{if(t=e.charset??`utf-8`,e.contentDecoder!==void 0&&(n=e.contentDecoder,r.set(n.name,n)),e.contentDecoders!==void 0)for(let t of e.contentDecoders)r.set(t.name,t);if(e.contentTypeDecoder!==void 0&&(i=e.contentTypeDecoder,o.set(i.name,i)),e.contentTypeDecoders!==void 0)for(let t of e.contentTypeDecoders)o.set(t.name,t)}return i===void 0&&(i=(0,a.default)().applicationJson.decoder,o.set(i.name,i)),{charset:t,contentDecoder:n,contentDecoders:r,contentTypeDecoder:i,contentTypeDecoders:o}}e.fromOptions=t})(d||={}),e.ReadableStreamMessageReader=class extends u{readable;options;callback;nextMessageLength;messageToken;buffer;partialMessageTimer;_partialMessageTimeout;readSemaphore;constructor(e,t){super(),this.readable=e,this.options=d.fromOptions(t),this.buffer=(0,a.default)().messageBuffer.create(this.options.charset),this._partialMessageTimeout=1e4,this.nextMessageLength=-1,this.messageToken=0,this.readSemaphore=new c.Semaphore(1)}set partialMessageTimeout(e){this._partialMessageTimeout=e}get partialMessageTimeout(){return this._partialMessageTimeout}listen(e){this.nextMessageLength=-1,this.messageToken=0,this.partialMessageTimer=void 0,this.callback=e;let t=this.readable.onData(e=>{this.onData(e)});return this.readable.onError(e=>this.fireError(e)),this.readable.onClose(()=>this.fireClose()),t}onData(e){try{for(this.buffer.append(e);;){if(this.nextMessageLength===-1){let e=this.buffer.tryReadHeaders(!0);if(!e)return;let t=e.get(`content-length`);if(!t){this.fireError(Error(`Header must provide a Content-Length property.\n${JSON.stringify(Object.fromEntries(e))}`));return}let n=parseInt(t);if(isNaN(n)){this.fireError(Error(`Content-Length value must be a number. Got ${t}`));return}this.nextMessageLength=n}let e=this.buffer.tryReadBody(this.nextMessageLength);if(e===void 0){this.setPartialMessageTimer();return}this.clearPartialMessageTimer(),this.nextMessageLength=-1,this.readSemaphore.lock(async()=>{let t=this.options.contentDecoder===void 0?e:await this.options.contentDecoder.decode(e),n=await this.options.contentTypeDecoder.decode(t,this.options);this.callback(n)}).catch(e=>{this.fireError(e)})}}catch(e){this.fireError(e)}}clearPartialMessageTimer(){this.partialMessageTimer&&=(this.partialMessageTimer.dispose(),void 0)}setPartialMessageTimer(){this.clearPartialMessageTimer(),!(this._partialMessageTimeout<=0)&&(this.partialMessageTimer=(0,a.default)().timer.setTimeout((e,t)=>{this.partialMessageTimer=void 0,e===this.messageToken&&(this.firePartialMessage({messageToken:e,waitingTime:t}),this.setPartialMessageTimer())},this._partialMessageTimeout,this.messageToken,this._partialMessageTimeout))}}})),og=r((e=>{var t=e&&e.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),n=e&&e.__setModuleDefault||(Object.create?(function(e,t){Object.defineProperty(e,"default",{enumerable:!0,value:t})}):function(e,t){e.default=t}),r=e&&e.__importStar||(function(){var e=function(t){return e=Object.getOwnPropertyNames||function(e){var t=[];for(var n in e)Object.prototype.hasOwnProperty.call(e,n)&&(t[t.length]=n);return t},e(t)};return function(r){if(r&&r.__esModule)return r;var i={};if(r!=null)for(var a=e(r),o=0;o<a.length;o++)a[o]!=="default"&&t(i,r,a[o]);return n(i,r),i}})(),i=e&&e.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e,"__esModule",{value:!0}),e.WriteableStreamMessageWriter=e.AbstractMessageWriter=e.MessageWriter=void 0;var a=i(eg()),o=r(Xh()),s=ig(),c=tg(),l=`Content-Length: `,u=`\r
`,d;(function(e){function t(e){let t=e;return t&&o.func(t.dispose)&&o.func(t.onClose)&&o.func(t.onError)&&o.func(t.write)}e.is=t})(d||(e.MessageWriter=d={}));var f=class{errorEmitter;closeEmitter;constructor(){this.errorEmitter=new c.Emitter,this.closeEmitter=new c.Emitter}dispose(){this.errorEmitter.dispose(),this.closeEmitter.dispose()}get onError(){return this.errorEmitter.event}fireError(e,t,n){this.errorEmitter.fire([this.asError(e),t,n])}get onClose(){return this.closeEmitter.event}fireClose(){this.closeEmitter.fire(void 0)}asError(e){return e instanceof Error?e:Error(`Writer received error. Reason: ${o.string(e.message)?e.message:`unknown`}`)}};e.AbstractMessageWriter=f;var p;(function(e){function t(e){return e===void 0||typeof e==`string`?{charset:e??`utf-8`,contentTypeEncoder:(0,a.default)().applicationJson.encoder}:{charset:e.charset??`utf-8`,contentEncoder:e.contentEncoder,contentTypeEncoder:e.contentTypeEncoder??(0,a.default)().applicationJson.encoder}}e.fromOptions=t})(p||={}),e.WriteableStreamMessageWriter=class extends f{writable;options;errorCount;writeSemaphore;constructor(e,t){super(),this.writable=e,this.options=p.fromOptions(t),this.errorCount=0,this.writeSemaphore=new s.Semaphore(1),this.writable.onError(e=>this.fireError(e)),this.writable.onClose(()=>this.fireClose())}async write(e){return this.writeSemaphore.lock(async()=>this.options.contentTypeEncoder.encode(e,this.options).then(e=>this.options.contentEncoder===void 0?e:this.options.contentEncoder.encode(e)).then(t=>{let n=[];return n.push(l,t.byteLength.toString(),u),n.push(u),this.doWrite(e,n,t)},e=>{throw this.fireError(e),e}))}async doWrite(e,t,n){try{return await this.writable.write(t.join(``),`ascii`),this.writable.write(n)}catch(t){return this.handleError(t,e),Promise.reject(t)}}handleError(e,t){this.errorCount++,this.fireError(e,t,this.errorCount)}end(){this.writable.end()}}})),sg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.AbstractMessageBuffer=void 0;var t=13,n=10,r=`\r
`;e.AbstractMessageBuffer=class{_encoding;_chunks;_totalLength;constructor(e=`utf-8`){this._encoding=e,this._chunks=[],this._totalLength=0}get encoding(){return this._encoding}append(e){let t=typeof e==`string`?this.fromString(e,this._encoding):e;this._chunks.push(t),this._totalLength+=t.byteLength}tryReadHeaders(e=!1){if(this._chunks.length===0)return;let i=0,a=0,o=0,s=0;row:for(;a<this._chunks.length;){let e=this._chunks[a];for(o=0;o<e.length;){switch(e[o]){case t:switch(i){case 0:i=1;break;case 2:i=3;break;default:i=0}break;case n:switch(i){case 1:i=2;break;case 3:i=4,o++;break row;default:i=0}break;default:i=0}o++}s+=e.byteLength,a++}if(i!==4)return;let c=this._read(s+o),l=new Map,u=this.toString(c,`ascii`).split(r);if(u.length<2)return l;for(let t=0;t<u.length-2;t++){let n=u[t],r=n.indexOf(`:`);if(r===-1)throw Error(`Message header must separate key and value using ':'\n${n}`);let i=n.substr(0,r),a=n.substr(r+1).trim();l.set(e?i.toLowerCase():i,a)}return l}tryReadBody(e){if(!(this._totalLength<e))return this._read(e)}get numberOfBytes(){return this._totalLength}_read(e){if(e===0)return this.emptyBuffer();if(e>this._totalLength)throw Error(`Cannot read so many bytes!`);if(this._chunks[0].byteLength===e){let t=this._chunks[0];return this._chunks.shift(),this._totalLength-=e,this.asNative(t)}if(this._chunks[0].byteLength>e){let t=this._chunks[0],n=this.asNative(t,e);return this._chunks[0]=t.slice(e),this._totalLength-=e,n}let t=this.allocNative(e),n=0;for(;e>0;){let r=this._chunks[0];if(r.byteLength>e){let i=r.slice(0,e);t.set(i,n),n+=e,this._chunks[0]=r.slice(e),this._totalLength-=e,e-=e}else t.set(r,n),n+=r.byteLength,this._chunks.shift(),this._totalLength-=r.byteLength,e-=r.byteLength}return t}}})),cg=r((e=>{var t=e&&e.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),n=e&&e.__setModuleDefault||(Object.create?(function(e,t){Object.defineProperty(e,"default",{enumerable:!0,value:t})}):function(e,t){e.default=t}),r=e&&e.__importStar||(function(){var e=function(t){return e=Object.getOwnPropertyNames||function(e){var t=[];for(var n in e)Object.prototype.hasOwnProperty.call(e,n)&&(t[t.length]=n);return t},e(t)};return function(r){if(r&&r.__esModule)return r;var i={};if(r!=null)for(var a=e(r),o=0;o<a.length;o++)a[o]!=="default"&&t(i,r,a[o]);return n(i,r),i}})(),i=e&&e.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e,"__esModule",{value:!0}),e.ConnectionOptions=e.MessageStrategy=e.CancellationStrategy=e.CancellationSenderStrategy=e.CancellationReceiverStrategy=e.RequestCancellationReceiverStrategy=e.IdCancellationReceiverStrategy=e.ConnectionStrategy=e.ConnectionError=e.ConnectionErrors=e.LogTraceNotification=e.SetTraceNotification=e.TraceFormat=e.TraceValues=e.TraceValue=e.Trace=e.NullLogger=e.ProgressType=e.ProgressToken=void 0,e.createMessageConnection=O;var a=i(eg()),o=r(Xh()),s=Zh(),c=Qh(),l=tg(),u=ng(),d;(function(e){e.type=new s.NotificationType(`$/cancelRequest`)})(d||={});var f;(function(e){function t(e){return typeof e==`string`||typeof e==`number`}e.is=t})(f||(e.ProgressToken=f={}));var p;(function(e){e.type=new s.NotificationType(`$/progress`)})(p||={}),e.ProgressType=class{__;_pr;constructor(){}};var m;(function(e){function t(e){return o.func(e)}e.is=t})(m||={}),e.NullLogger=Object.freeze({error:()=>{},warn:()=>{},info:()=>{},log:()=>{}});var h;(function(e){e[e.Off=0]=`Off`,e[e.Messages=1]=`Messages`,e[e.Compact=2]=`Compact`,e[e.Verbose=3]=`Verbose`})(h||(e.Trace=h={}));var g;(function(e){e.Off=`off`,e.Messages=`messages`,e.Compact=`compact`,e.Verbose=`verbose`})(g||(e.TraceValue=g={})),e.TraceValues=g,(function(e){function t(t){if(!o.string(t))return e.Off;switch(t=t.toLowerCase(),t){case`off`:return e.Off;case`messages`:return e.Messages;case`compact`:return e.Compact;case`verbose`:return e.Verbose;default:return e.Off}}e.fromString=t;function n(t){switch(t){case e.Off:return`off`;case e.Messages:return`messages`;case e.Compact:return`compact`;case e.Verbose:return`verbose`;default:return`off`}}e.toString=n})(h||(e.Trace=h={}));var _;(function(e){e.Text=`text`,e.JSON=`json`})(_||(e.TraceFormat=_={})),(function(e){function t(t){return o.string(t)?(t=t.toLowerCase(),t===`json`?e.JSON:e.Text):e.Text}e.fromString=t})(_||(e.TraceFormat=_={}));var v;(function(e){e.type=new s.NotificationType(`$/setTrace`)})(v||(e.SetTraceNotification=v={}));var y;(function(e){e.type=new s.NotificationType(`$/logTrace`)})(y||(e.LogTraceNotification=y={}));var ee;(function(e){e[e.Closed=1]=`Closed`,e[e.Disposed=2]=`Disposed`,e[e.AlreadyListening=3]=`AlreadyListening`})(ee||(e.ConnectionErrors=ee={}));var b=class e extends Error{code;constructor(t,n){super(n),this.code=t,Object.setPrototypeOf(this,e.prototype)}};e.ConnectionError=b;var x;(function(e){function t(e){let t=e;return t&&o.func(t.cancelUndispatched)}e.is=t})(x||(e.ConnectionStrategy=x={}));var S;(function(e){function t(e){let t=e;return t&&(t.kind===void 0||t.kind===`id`)&&o.func(t.createCancellationTokenSource)&&(t.dispose===void 0||o.func(t.dispose))}e.is=t})(S||(e.IdCancellationReceiverStrategy=S={}));var te;(function(e){function t(e){let t=e;return t&&t.kind===`request`&&o.func(t.createCancellationTokenSource)&&(t.dispose===void 0||o.func(t.dispose))}e.is=t})(te||(e.RequestCancellationReceiverStrategy=te={}));var C;(function(e){e.Message=Object.freeze({createCancellationTokenSource(e){return new u.CancellationTokenSource}});function t(e){return S.is(e)||te.is(e)}e.is=t})(C||(e.CancellationReceiverStrategy=C={}));var w;(function(e){e.Message=Object.freeze({sendCancellation(e,t){return e.sendNotification(d.type,{id:t})},cleanup(e){}});function t(e){let t=e;return t&&o.func(t.sendCancellation)&&o.func(t.cleanup)}e.is=t})(w||(e.CancellationSenderStrategy=w={}));var T;(function(e){e.Message=Object.freeze({receiver:C.Message,sender:w.Message});function t(e){let t=e;return t&&C.is(t.receiver)&&w.is(t.sender)}e.is=t})(T||(e.CancellationStrategy=T={}));var E;(function(e){function t(e){let t=e;return t&&o.func(t.handleMessage)}e.is=t})(E||(e.MessageStrategy=E={}));var ne;(function(e){function t(e){let t=e;return t&&(T.is(t.cancellationStrategy)||x.is(t.connectionStrategy)||E.is(t.messageStrategy)||o.number(t.maxParallelism))}e.is=t})(ne||(e.ConnectionOptions=ne={}));var D;(function(e){e[e.New=1]=`New`,e[e.Listening=2]=`Listening`,e[e.Closed=3]=`Closed`,e[e.Disposed=4]=`Disposed`})(D||={});function O(t,n,r,i){let g=r===void 0?e.NullLogger:r,x=0,te=0,C=0,w=i?.maxParallelism??-1,ne=0,O,k=new Map,A,re=new Map,ie=new Map,ae,j=new c.LinkedMap,M=new Map,oe=new Set,se=new Map,N=h.Off,ce=_.Text,P,F=D.New,le=new l.Emitter,ue=new l.Emitter,de=new l.Emitter,fe=new l.Emitter,pe=new l.Emitter,me=i&&i.cancellationStrategy?i.cancellationStrategy:T.Message;function he(e){}function ge(){return F===D.Listening}function _e(){return F===D.Closed}function ve(){return F===D.Disposed}function ye(){(F===D.New||F===D.Listening)&&(F=D.Closed,ue.fire(void 0))}function be(e){le.fire([e,void 0,void 0])}function xe(e){le.fire(e)}t.onClose(ye),t.onError(be),n.onClose(ye),n.onError(xe);function Se(e){if(e===null)throw Error(`Can't send requests with id null since the response can't be correlated.`);return`req-`+e.toString()}function Ce(e){return e===null?`res-unknown-`+(++C).toString():`res-`+e.toString()}function we(){return`not-`+(++te).toString()}function Te(e,t){s.Message.isRequest(t)?e.set(Se(t.id),t):s.Message.isResponse(t)?w===-1?e.set(Ce(t.id),t):Ae(t):e.set(we(),t)}function Ee(){ae||j.size===0||w!==-1&&ne>=w||(ae=(0,a.default)().timer.setImmediate(async()=>{if(ae=void 0,j.size===0||w!==-1&&ne>=w)return;let e=j.shift(),t;try{ne++;let n=i?.messageStrategy;t=E.is(n)?n.handleMessage(e,De):De(e)}catch(e){g.error(`Processing message queue failed: ${e.toString()}`)}finally{t instanceof Promise?t.then(()=>{ne--,Ee()}).catch(e=>{g.error(`Processing message queue failed: ${e.toString()}`)}):ne--,Ee()}}))}async function De(e){return s.Message.isRequest(e)?ke(e):s.Message.isNotification(e)?je(e):s.Message.isResponse(e)?Ae(e):Me(e)}let Oe=e=>{try{if(s.Message.isNotification(e)&&e.method===d.type.method){let t=e.params.id,r=Se(t),a=j.get(r);if(s.Message.isRequest(a)){let o=i?.connectionStrategy,s=o&&o.cancelUndispatched?o.cancelUndispatched(a,he):void 0;if(s&&(s.error!==void 0||s.result!==void 0)){j.delete(r),se.delete(t),s.id=a.id,Ie(s,e.method,Date.now()),n.write(s).catch(()=>g.error(`Sending response for canceled message failed.`));return}}let o=se.get(t);if(o!==void 0){o.cancel(),Re(e);return}else oe.add(t)}Te(j,e)}finally{Ee()}};async function ke(e){if(ve())return Promise.resolve();function t(t,r,i){let a={jsonrpc:`2.0`,id:e.id};return t instanceof s.ResponseError?a.error=t.toJson():a.result=t===void 0?null:t,Ie(a,r,i),n.write(a)}function r(t,r,i){let a={jsonrpc:`2.0`,id:e.id,error:t.toJson()};return Ie(a,r,i),n.write(a)}Le(e);let i=k.get(e.method),a,c;i&&(a=i.type,c=i.handler);let l=Date.now();if(c||O){let n=e.id??String(Date.now()),i=S.is(me.receiver)?me.receiver.createCancellationTokenSource(n):me.receiver.createCancellationTokenSource(e);e.id!==null&&oe.has(e.id)&&i.cancel(),e.id!==null&&se.set(n,i);try{let n;if(c)if(e.params===void 0){if(a!==void 0&&a.numberOfParams!==0)return r(new s.ResponseError(s.ErrorCodes.InvalidParams,`Request ${e.method} defines ${a.numberOfParams} params but received none.`),e.method,l);n=c(i.token)}else if(Array.isArray(e.params)){if(a!==void 0&&a.parameterStructures===s.ParameterStructures.byName)return r(new s.ResponseError(s.ErrorCodes.InvalidParams,`Request ${e.method} defines parameters by name but received parameters by position`),e.method,l);n=c(...e.params,i.token)}else{if(a!==void 0&&a.parameterStructures===s.ParameterStructures.byPosition)return r(new s.ResponseError(s.ErrorCodes.InvalidParams,`Request ${e.method} defines parameters by position but received parameters by name`),e.method,l);n=c(e.params,i.token)}else O&&(n=O(e.method,e.params,i.token));await t(await n,e.method,l)}catch(n){n instanceof s.ResponseError?await t(n,e.method,l):n&&o.string(n.message)?await r(new s.ResponseError(s.ErrorCodes.InternalError,`Request ${e.method} failed with message: ${n.message}`),e.method,l):await r(new s.ResponseError(s.ErrorCodes.InternalError,`Request ${e.method} failed unexpectedly without providing any details.`),e.method,l)}finally{se.delete(n)}}else await r(new s.ResponseError(s.ErrorCodes.MethodNotFound,`Unhandled method ${e.method}`),e.method,l)}function Ae(e){if(!ve())if(e.id===null)e.error?g.error(`Received response message without id: Error is: \n${JSON.stringify(e.error,void 0,4)}`):g.error(`Received response message without id. No further error information provided.`);else{let t=e.id,n=M.get(t);if(ze(e,n),n!==void 0){M.delete(t);try{if(e.error){let t=e.error;n.reject(new s.ResponseError(t.code,t.message,t.data))}else if(e.result!==void 0)n.resolve(e.result);else throw Error(`Should never happen.`)}catch(e){e.message?g.error(`Response handler '${n.method}' failed with message: ${e.message}`):g.error(`Response handler '${n.method}' failed unexpectedly.`)}}}}async function je(e){if(ve())return;let t,n;if(e.method===d.type.method){let t=e.params.id;oe.delete(t),Re(e);return}else{let r=re.get(e.method);r&&(n=r.handler,t=r.type)}if(n||A)try{if(Re(e),n)if(e.params===void 0)t!==void 0&&t.numberOfParams!==0&&t.parameterStructures!==s.ParameterStructures.byName&&g.error(`Notification ${e.method} defines ${t.numberOfParams} params but received none.`),await n();else if(Array.isArray(e.params)){let r=e.params;e.method===p.type.method&&r.length===2&&f.is(r[0])?await n({token:r[0],value:r[1]}):(t!==void 0&&(t.parameterStructures===s.ParameterStructures.byName&&g.error(`Notification ${e.method} defines parameters by name but received parameters by position`),t.numberOfParams!==e.params.length&&g.error(`Notification ${e.method} defines ${t.numberOfParams} params but received ${r.length} arguments`)),await n(...r))}else t!==void 0&&t.parameterStructures===s.ParameterStructures.byPosition&&g.error(`Notification ${e.method} defines parameters by position but received parameters by name`),await n(e.params);else A&&await A(e.method,e.params)}catch(t){t.message?g.error(`Notification handler '${e.method}' failed with message: ${t.message}`):g.error(`Notification handler '${e.method}' failed unexpectedly.`)}else de.fire(e)}function Me(e){if(!e){g.error(`Received empty message.`);return}g.error(`Received message which is neither a response nor a notification message:\n${JSON.stringify(e,null,4)}`);let t=e;if(o.string(t.id)||o.number(t.id)){let e=t.id,n=M.get(e);n&&n.reject(Error(`The received response has neither a result nor an error property.`))}}function Ne(e){if(e!=null)switch(N){case h.Verbose:return JSON.stringify(e,null,4);case h.Compact:return JSON.stringify(e);default:return}}function Pe(e){if(!(N===h.Off||!P))if(ce===_.Text){let t;(N===h.Verbose||N===h.Compact)&&e.params&&(t=`Params: ${Ne(e.params)}`),P.log(`Sending request '${e.method} - (${e.id})'.`,t)}else Be(`send-request`,e)}function Fe(e){if(!(N===h.Off||!P))if(ce===_.Text){let t;(N===h.Verbose||N===h.Compact)&&(t=e.params?`Params: ${Ne(e.params)}`:`No parameters provided.`),P.log(`Sending notification '${e.method}'.`,t)}else Be(`send-notification`,e)}function Ie(e,t,n){if(!(N===h.Off||!P))if(ce===_.Text){let r;(N===h.Verbose||N===h.Compact)&&(e.error&&e.error.data?r=`Error data: ${Ne(e.error.data)}`:e.result?r=`Result: ${Ne(e.result)}`:e.error===void 0&&(r=`No result returned.`)),P.log(`Sending response '${t} - (${e.id})'. Processing request took ${Date.now()-n}ms`,r)}else Be(`send-response`,e)}function Le(e){if(!(N===h.Off||!P))if(ce===_.Text){let t;(N===h.Verbose||N===h.Compact)&&e.params&&(t=`Params: ${Ne(e.params)}`),P.log(`Received request '${e.method} - (${e.id})'.`,t)}else Be(`receive-request`,e)}function Re(e){if(!(N===h.Off||!P||e.method===y.type.method))if(ce===_.Text){let t;(N===h.Verbose||N===h.Compact)&&(t=e.params?`Params: ${Ne(e.params)}`:`No parameters provided.`),P.log(`Received notification '${e.method}'.`,t)}else Be(`receive-notification`,e)}function ze(e,t){if(!(N===h.Off||!P))if(ce===_.Text){let n;if((N===h.Verbose||N===h.Compact)&&(e.error&&e.error.data?n=`Error data: ${Ne(e.error.data)}`:e.result?n=`Result: ${Ne(e.result)}`:e.error===void 0&&(n=`No result returned.`)),t){let r=e.error?` Request failed: ${e.error.message} (${e.error.code}).`:``;P.log(`Received response '${t.method} - (${e.id})' in ${Date.now()-t.timerStart}ms.${r}`,n)}else P.log(`Received response ${e.id} without active response promise.`,n)}else Be(`receive-response`,e)}function Be(e,t){if(!P||N===h.Off)return;let n={isLSPMessage:!0,type:e,message:t,timestamp:Date.now()};P.log(n)}function Ve(){if(_e())throw new b(ee.Closed,`Connection is closed.`);if(ve())throw new b(ee.Disposed,`Connection is disposed.`)}function He(){if(ge())throw new b(ee.AlreadyListening,`Connection is already listening`)}function Ue(){if(!ge())throw Error(`Call listen() first.`)}function We(e){return e===void 0?null:e}function Ge(e){if(e!==null)return e}function Ke(e){return e!=null&&!Array.isArray(e)&&typeof e==`object`}function qe(e,t){switch(e){case s.ParameterStructures.auto:return Ke(t)?Ge(t):[We(t)];case s.ParameterStructures.byName:if(!Ke(t))throw Error(`Received parameters by name but param is not an object literal.`);return Ge(t);case s.ParameterStructures.byPosition:return[We(t)];default:throw Error(`Unknown parameter structure ${e.toString()}`)}}function Je(e,t){let n,r=e.numberOfParams;switch(r){case 0:n=void 0;break;case 1:n=qe(e.parameterStructures,t[0]);break;default:n=[];for(let e=0;e<t.length&&e<r;e++)n.push(We(t[e]));if(t.length<r)for(let e=t.length;e<r;e++)n.push(null);break}return n}let Ye={sendNotification:(e,...t)=>{Ve();let r,i;if(o.string(e)){r=e;let n=t[0],a=0,o=s.ParameterStructures.auto;s.ParameterStructures.is(n)&&(a=1,o=n);let c=t.length,l=c-a;switch(l){case 0:i=void 0;break;case 1:i=qe(o,t[a]);break;default:if(o===s.ParameterStructures.byName)throw Error(`Received ${l} parameters for 'by Name' notification parameter structure.`);i=t.slice(a,c).map(e=>We(e));break}}else{let n=t;r=e.method,i=Je(e,n)}let a={jsonrpc:`2.0`,method:r,params:i};return Fe(a),n.write(a).catch(e=>{throw g.error(`Sending notification failed.`),e})},onNotification:(e,t)=>{Ve();let n;return o.func(e)?A=e:t&&(o.string(e)?(n=e,re.set(e,{type:void 0,handler:t})):(n=e.method,re.set(e.method,{type:e,handler:t}))),{dispose:()=>{n===void 0?A===e&&(A=void 0):re.get(n)?.handler===t&&re.delete(n)}}},onProgress:(e,t,n)=>{if(ie.has(t))throw Error(`Progress handler for token ${t} already registered`);return ie.set(t,n),{dispose:()=>{ie.get(t)===n&&ie.delete(t)}}},sendProgress:(e,t,n)=>Ye.sendNotification(p.type,{token:t,value:n}),onUnhandledProgress:fe.event,sendRequest:(e,...t)=>{Ve(),Ue();function r(e,t){let n=me.sender.sendCancellation(e,t);n===void 0?g.log(`Received no promise from cancellation strategy when cancelling id ${t}`):n.catch(()=>{g.log(`Sending cancellation messages for id ${t} failed.`)})}let i,a,c;if(o.string(e)){i=e;let n=t[0],r=t[t.length-1],o=0,l=s.ParameterStructures.auto;s.ParameterStructures.is(n)&&(o=1,l=n);let d=t.length;u.CancellationToken.is(r)&&(--d,c=r);let f=d-o;switch(f){case 0:a=void 0;break;case 1:a=qe(l,t[o]);break;default:if(l===s.ParameterStructures.byName)throw Error(`Received ${f} parameters for 'by Name' request parameter structure.`);a=t.slice(o,d).map(e=>We(e));break}}else{let n=t;i=e.method,a=Je(e,n);let r=e.numberOfParams;c=u.CancellationToken.is(n[r])?n[r]:void 0}let l=x++,d,f=!1;c!==void 0&&(c.isCancellationRequested?f=!0:d=c.onCancellationRequested(()=>{r(Ye,l)}));let p={jsonrpc:`2.0`,id:l,method:i,params:a};return Pe(p),typeof me.sender.enableCancellation==`function`&&me.sender.enableCancellation(p),new Promise(async(e,t)=>{let a={method:i,timerStart:Date.now(),resolve:t=>{e(t),me.sender.cleanup(l),d?.dispose()},reject:e=>{t(e),me.sender.cleanup(l),d?.dispose()}};try{M.set(l,a),await n.write(p),f&&r(Ye,l)}catch(e){throw M.delete(l),a.reject(new s.ResponseError(s.ErrorCodes.MessageWriteError,e.message?e.message:`Unknown reason`)),g.error(`Sending request failed.`),e}})},onRequest:(e,t)=>{Ve();let n=null;return m.is(e)?(n=void 0,O=e):o.string(e)?(n=null,t!==void 0&&(n=e,k.set(e,{handler:t,type:void 0}))):t!==void 0&&(n=e.method,k.set(e.method,{type:e,handler:t})),{dispose:()=>{n!==null&&(n===void 0?O===e&&(O=void 0):k.get(n)?.handler===t&&k.delete(n))}}},hasPendingResponse:()=>M.size>0,trace:async(e,t,n)=>{let r=!1,i=_.Text;n!==void 0&&(o.boolean(n)?r=n:(r=n.sendNotification||!1,i=n.traceFormat||_.Text)),N=e,ce=i,P=N===h.Off?void 0:t,r&&!_e()&&!ve()&&await Ye.sendNotification(v.type,{value:h.toString(e)})},onError:le.event,onClose:ue.event,onUnhandledNotification:de.event,onDispose:pe.event,end:()=>{n.end()},dispose:()=>{if(ve())return;F=D.Disposed,pe.fire(void 0);let e=new s.ResponseError(s.ErrorCodes.PendingResponseRejected,`Pending response rejected since connection got disposed`);for(let t of M.values())t.reject(e);M=new Map,se=new Map,oe=new Set,j=new c.LinkedMap,o.func(n.dispose)&&n.dispose(),o.func(t.dispose)&&t.dispose()},listen:()=>{Ve(),He(),F=D.Listening,t.listen(Oe)},inspect:()=>{(0,a.default)().console.log(`inspect`)}};return Ye.onNotification(y.type,e=>{if(N===h.Off||!P)return;let t=N===h.Verbose||N===h.Compact;P.log(e.message,t?e.verbose:void 0)}),Ye.onNotification(p.type,async e=>{let t=ie.get(e.token);t?await t(e.value):fe.fire(e)}),Ye}})),lg=r((e=>{var t=e&&e.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(e,"__esModule",{value:!0}),e.ProgressType=e.ProgressToken=e.createMessageConnection=e.NullLogger=e.ConnectionOptions=e.ConnectionStrategy=e.AbstractMessageBuffer=e.WriteableStreamMessageWriter=e.AbstractMessageWriter=e.MessageWriter=e.ReadableStreamMessageReader=e.AbstractMessageReader=e.MessageReader=e.SharedArrayReceiverStrategy=e.SharedArraySenderStrategy=e.CancellationToken=e.CancellationTokenSource=e.Emitter=e.Event=e.Disposable=e.LRUCache=e.Touch=e.LinkedMap=e.ParameterStructures=e.NotificationType9=e.NotificationType8=e.NotificationType7=e.NotificationType6=e.NotificationType5=e.NotificationType4=e.NotificationType3=e.NotificationType2=e.NotificationType1=e.NotificationType0=e.NotificationType=e.ErrorCodes=e.ResponseError=e.RequestType9=e.RequestType8=e.RequestType7=e.RequestType6=e.RequestType5=e.RequestType4=e.RequestType3=e.RequestType2=e.RequestType1=e.RequestType0=e.RequestType=e.Message=e.RAL=void 0,e.MessageStrategy=e.CancellationStrategy=e.CancellationSenderStrategy=e.RequestCancellationReceiverStrategy=e.IdCancellationReceiverStrategy=e.CancellationReceiverStrategy=e.ConnectionError=e.ConnectionErrors=e.LogTraceNotification=e.SetTraceNotification=e.TraceFormat=e.TraceValues=e.TraceValue=e.Trace=void 0;var n=Zh();Object.defineProperty(e,"Message",{enumerable:!0,get:function(){return n.Message}}),Object.defineProperty(e,"RequestType",{enumerable:!0,get:function(){return n.RequestType}}),Object.defineProperty(e,"RequestType0",{enumerable:!0,get:function(){return n.RequestType0}}),Object.defineProperty(e,"RequestType1",{enumerable:!0,get:function(){return n.RequestType1}}),Object.defineProperty(e,"RequestType2",{enumerable:!0,get:function(){return n.RequestType2}}),Object.defineProperty(e,"RequestType3",{enumerable:!0,get:function(){return n.RequestType3}}),Object.defineProperty(e,"RequestType4",{enumerable:!0,get:function(){return n.RequestType4}}),Object.defineProperty(e,"RequestType5",{enumerable:!0,get:function(){return n.RequestType5}}),Object.defineProperty(e,"RequestType6",{enumerable:!0,get:function(){return n.RequestType6}}),Object.defineProperty(e,"RequestType7",{enumerable:!0,get:function(){return n.RequestType7}}),Object.defineProperty(e,"RequestType8",{enumerable:!0,get:function(){return n.RequestType8}}),Object.defineProperty(e,"RequestType9",{enumerable:!0,get:function(){return n.RequestType9}}),Object.defineProperty(e,"ResponseError",{enumerable:!0,get:function(){return n.ResponseError}}),Object.defineProperty(e,"ErrorCodes",{enumerable:!0,get:function(){return n.ErrorCodes}}),Object.defineProperty(e,"NotificationType",{enumerable:!0,get:function(){return n.NotificationType}}),Object.defineProperty(e,"NotificationType0",{enumerable:!0,get:function(){return n.NotificationType0}}),Object.defineProperty(e,"NotificationType1",{enumerable:!0,get:function(){return n.NotificationType1}}),Object.defineProperty(e,"NotificationType2",{enumerable:!0,get:function(){return n.NotificationType2}}),Object.defineProperty(e,"NotificationType3",{enumerable:!0,get:function(){return n.NotificationType3}}),Object.defineProperty(e,"NotificationType4",{enumerable:!0,get:function(){return n.NotificationType4}}),Object.defineProperty(e,"NotificationType5",{enumerable:!0,get:function(){return n.NotificationType5}}),Object.defineProperty(e,"NotificationType6",{enumerable:!0,get:function(){return n.NotificationType6}}),Object.defineProperty(e,"NotificationType7",{enumerable:!0,get:function(){return n.NotificationType7}}),Object.defineProperty(e,"NotificationType8",{enumerable:!0,get:function(){return n.NotificationType8}}),Object.defineProperty(e,"NotificationType9",{enumerable:!0,get:function(){return n.NotificationType9}}),Object.defineProperty(e,"ParameterStructures",{enumerable:!0,get:function(){return n.ParameterStructures}});var r=Qh();Object.defineProperty(e,"LinkedMap",{enumerable:!0,get:function(){return r.LinkedMap}}),Object.defineProperty(e,"LRUCache",{enumerable:!0,get:function(){return r.LRUCache}}),Object.defineProperty(e,"Touch",{enumerable:!0,get:function(){return r.Touch}});var i=$h();Object.defineProperty(e,"Disposable",{enumerable:!0,get:function(){return i.Disposable}});var a=tg();Object.defineProperty(e,"Event",{enumerable:!0,get:function(){return a.Event}}),Object.defineProperty(e,"Emitter",{enumerable:!0,get:function(){return a.Emitter}});var o=ng();Object.defineProperty(e,"CancellationTokenSource",{enumerable:!0,get:function(){return o.CancellationTokenSource}}),Object.defineProperty(e,"CancellationToken",{enumerable:!0,get:function(){return o.CancellationToken}});var s=rg();Object.defineProperty(e,"SharedArraySenderStrategy",{enumerable:!0,get:function(){return s.SharedArraySenderStrategy}}),Object.defineProperty(e,"SharedArrayReceiverStrategy",{enumerable:!0,get:function(){return s.SharedArrayReceiverStrategy}});var c=ag();Object.defineProperty(e,"MessageReader",{enumerable:!0,get:function(){return c.MessageReader}}),Object.defineProperty(e,"AbstractMessageReader",{enumerable:!0,get:function(){return c.AbstractMessageReader}}),Object.defineProperty(e,"ReadableStreamMessageReader",{enumerable:!0,get:function(){return c.ReadableStreamMessageReader}});var l=og();Object.defineProperty(e,"MessageWriter",{enumerable:!0,get:function(){return l.MessageWriter}}),Object.defineProperty(e,"AbstractMessageWriter",{enumerable:!0,get:function(){return l.AbstractMessageWriter}}),Object.defineProperty(e,"WriteableStreamMessageWriter",{enumerable:!0,get:function(){return l.WriteableStreamMessageWriter}});var u=sg();Object.defineProperty(e,"AbstractMessageBuffer",{enumerable:!0,get:function(){return u.AbstractMessageBuffer}});var d=cg();Object.defineProperty(e,"ConnectionStrategy",{enumerable:!0,get:function(){return d.ConnectionStrategy}}),Object.defineProperty(e,"ConnectionOptions",{enumerable:!0,get:function(){return d.ConnectionOptions}}),Object.defineProperty(e,"NullLogger",{enumerable:!0,get:function(){return d.NullLogger}}),Object.defineProperty(e,"createMessageConnection",{enumerable:!0,get:function(){return d.createMessageConnection}}),Object.defineProperty(e,"ProgressToken",{enumerable:!0,get:function(){return d.ProgressToken}}),Object.defineProperty(e,"ProgressType",{enumerable:!0,get:function(){return d.ProgressType}}),Object.defineProperty(e,"Trace",{enumerable:!0,get:function(){return d.Trace}}),Object.defineProperty(e,"TraceValue",{enumerable:!0,get:function(){return d.TraceValue}}),Object.defineProperty(e,"TraceFormat",{enumerable:!0,get:function(){return d.TraceFormat}}),Object.defineProperty(e,"SetTraceNotification",{enumerable:!0,get:function(){return d.SetTraceNotification}}),Object.defineProperty(e,"LogTraceNotification",{enumerable:!0,get:function(){return d.LogTraceNotification}}),Object.defineProperty(e,"ConnectionErrors",{enumerable:!0,get:function(){return d.ConnectionErrors}}),Object.defineProperty(e,"ConnectionError",{enumerable:!0,get:function(){return d.ConnectionError}}),Object.defineProperty(e,"CancellationReceiverStrategy",{enumerable:!0,get:function(){return d.CancellationReceiverStrategy}}),Object.defineProperty(e,"IdCancellationReceiverStrategy",{enumerable:!0,get:function(){return d.IdCancellationReceiverStrategy}}),Object.defineProperty(e,"RequestCancellationReceiverStrategy",{enumerable:!0,get:function(){return d.RequestCancellationReceiverStrategy}}),Object.defineProperty(e,"CancellationSenderStrategy",{enumerable:!0,get:function(){return d.CancellationSenderStrategy}}),Object.defineProperty(e,"CancellationStrategy",{enumerable:!0,get:function(){return d.CancellationStrategy}}),Object.defineProperty(e,"MessageStrategy",{enumerable:!0,get:function(){return d.MessageStrategy}}),Object.defineProperty(e,"TraceValues",{enumerable:!0,get:function(){return d.TraceValues}}),e.RAL=t(eg()).default})),J=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.CM=e.ProtocolNotificationType=e.ProtocolNotificationType0=e.ProtocolRequestType=e.ProtocolRequestType0=e.RegistrationType=e.MessageDirection=void 0;var t=lg(),n;(function(e){e.clientToServer=`clientToServer`,e.serverToClient=`serverToClient`,e.both=`both`})(n||(e.MessageDirection=n={})),e.RegistrationType=class{____;method;constructor(e){this.method=e}},e.ProtocolRequestType0=class extends t.RequestType0{__;___;____;_pr;constructor(e){super(e)}},e.ProtocolRequestType=class extends t.RequestType{__;___;____;_pr;constructor(e){super(e,t.ParameterStructures.byName)}},e.ProtocolNotificationType0=class extends t.NotificationType0{___;____;constructor(e){super(e)}},e.ProtocolNotificationType=class extends t.NotificationType{___;____;constructor(e){super(e,t.ParameterStructures.byName)}};var r;(function(e){function t(e,t){return{client:e,server:t}}e.create=t})(r||(e.CM=r={}))})),ug=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.boolean=t,e.string=n,e.number=r,e.error=i,e.func=a,e.array=o,e.stringArray=s,e.typedArray=c,e.objectLiteral=l;function t(e){return e===!0||e===!1}function n(e){return typeof e==`string`||e instanceof String}function r(e){return typeof e==`number`||e instanceof Number}function i(e){return e instanceof Error}function a(e){return typeof e==`function`}function o(e){return Array.isArray(e)}function s(e){return o(e)&&e.every(e=>n(e))}function c(e,t){return Array.isArray(e)&&e.every(t)}function l(e){return typeof e==`object`&&!!e}})),dg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.ImplementationRequest=void 0;var t=J(),n;(function(e){e.method=`textDocument/implementation`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.implementation`,`implementationProvider`)})(n||(e.ImplementationRequest=n={}))})),fg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.TypeDefinitionRequest=void 0;var t=J(),n;(function(e){e.method=`textDocument/typeDefinition`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.typeDefinition`,`typeDefinitionProvider`)})(n||(e.TypeDefinitionRequest=n={}))})),pg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.DidChangeWorkspaceFoldersNotification=e.WorkspaceFoldersRequest=void 0;var t=J(),n;(function(e){e.method=`workspace/workspaceFolders`,e.messageDirection=t.MessageDirection.serverToClient,e.type=new t.ProtocolRequestType0(e.method),e.capabilities=t.CM.create(`workspace.workspaceFolders`,`workspace.workspaceFolders`)})(n||(e.WorkspaceFoldersRequest=n={}));var r;(function(e){e.method=`workspace/didChangeWorkspaceFolders`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolNotificationType(e.method),e.capabilities=t.CM.create(void 0,`workspace.workspaceFolders.changeNotifications`)})(r||(e.DidChangeWorkspaceFoldersNotification=r={}))})),mg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.ConfigurationRequest=void 0;var t=J(),n;(function(e){e.method=`workspace/configuration`,e.messageDirection=t.MessageDirection.serverToClient,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`workspace.configuration`,void 0)})(n||(e.ConfigurationRequest=n={}))})),hg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.ColorPresentationRequest=e.DocumentColorRequest=void 0;var t=J(),n;(function(e){e.method=`textDocument/documentColor`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.colorProvider`,`colorProvider`)})(n||(e.DocumentColorRequest=n={}));var r;(function(e){e.method=`textDocument/colorPresentation`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.colorProvider`,`colorProvider`)})(r||(e.ColorPresentationRequest=r={}))})),gg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.FoldingRangeRefreshRequest=e.FoldingRangeRequest=void 0;var t=J(),n;(function(e){e.method=`textDocument/foldingRange`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.foldingRange`,`foldingRangeProvider`)})(n||(e.FoldingRangeRequest=n={}));var r;(function(e){e.method=`workspace/foldingRange/refresh`,e.messageDirection=t.MessageDirection.serverToClient,e.type=new t.ProtocolRequestType0(e.method),e.capabilities=t.CM.create(`workspace.foldingRange.refreshSupport`,void 0)})(r||(e.FoldingRangeRefreshRequest=r={}))})),_g=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.DeclarationRequest=void 0;var t=J(),n;(function(e){e.method=`textDocument/declaration`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.declaration`,`declarationProvider`)})(n||(e.DeclarationRequest=n={}))})),vg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.SelectionRangeRequest=void 0;var t=J(),n;(function(e){e.method=`textDocument/selectionRange`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.selectionRange`,`selectionRangeProvider`)})(n||(e.SelectionRangeRequest=n={}))})),yg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.WorkDoneProgressCancelNotification=e.WorkDoneProgressCreateRequest=e.WorkDoneProgress=void 0;var t=lg(),n=J(),r;(function(e){e.type=new t.ProgressType;function n(t){return t===e.type}e.is=n})(r||(e.WorkDoneProgress=r={}));var i;(function(e){e.method=`window/workDoneProgress/create`,e.messageDirection=n.MessageDirection.serverToClient,e.type=new n.ProtocolRequestType(e.method),e.capabilities=n.CM.create(`window.workDoneProgress`,void 0)})(i||(e.WorkDoneProgressCreateRequest=i={}));var a;(function(e){e.method=`window/workDoneProgress/cancel`,e.messageDirection=n.MessageDirection.clientToServer,e.type=new n.ProtocolNotificationType(e.method)})(a||(e.WorkDoneProgressCancelNotification=a={}))})),bg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.CallHierarchyOutgoingCallsRequest=e.CallHierarchyIncomingCallsRequest=e.CallHierarchyPrepareRequest=void 0;var t=J(),n;(function(e){e.method=`textDocument/prepareCallHierarchy`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.callHierarchy`,`callHierarchyProvider`)})(n||(e.CallHierarchyPrepareRequest=n={}));var r;(function(e){e.method=`callHierarchy/incomingCalls`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.callHierarchy`,`callHierarchyProvider`)})(r||(e.CallHierarchyIncomingCallsRequest=r={}));var i;(function(e){e.method=`callHierarchy/outgoingCalls`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.callHierarchy`,`callHierarchyProvider`)})(i||(e.CallHierarchyOutgoingCallsRequest=i={}))})),xg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.SemanticTokensRefreshRequest=e.SemanticTokensRangeRequest=e.SemanticTokensDeltaRequest=e.SemanticTokensRequest=e.SemanticTokensRegistrationType=e.TokenFormat=void 0;var t=J(),n;(function(e){e.Relative=`relative`})(n||(e.TokenFormat=n={}));var r;(function(e){e.method=`textDocument/semanticTokens`,e.type=new t.RegistrationType(e.method)})(r||(e.SemanticTokensRegistrationType=r={}));var i;(function(e){e.method=`textDocument/semanticTokens/full`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.registrationMethod=r.method,e.capabilities=t.CM.create(`textDocument.semanticTokens`,`semanticTokensProvider`)})(i||(e.SemanticTokensRequest=i={}));var a;(function(e){e.method=`textDocument/semanticTokens/full/delta`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.registrationMethod=r.method,e.capabilities=t.CM.create(`textDocument.semanticTokens.requests.full.delta`,`semanticTokensProvider.full.delta`)})(a||(e.SemanticTokensDeltaRequest=a={}));var o;(function(e){e.method=`textDocument/semanticTokens/range`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.registrationMethod=r.method,e.capabilities=t.CM.create(`textDocument.semanticTokens.requests.range`,`semanticTokensProvider.range`)})(o||(e.SemanticTokensRangeRequest=o={}));var s;(function(e){e.method=`workspace/semanticTokens/refresh`,e.messageDirection=t.MessageDirection.serverToClient,e.type=new t.ProtocolRequestType0(e.method),e.capabilities=t.CM.create(`workspace.semanticTokens.refreshSupport`,void 0)})(s||(e.SemanticTokensRefreshRequest=s={}))})),Sg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.ShowDocumentRequest=void 0;var t=J(),n;(function(e){e.method=`window/showDocument`,e.messageDirection=t.MessageDirection.serverToClient,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`window.showDocument.support`,void 0)})(n||(e.ShowDocumentRequest=n={}))})),Cg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.LinkedEditingRangeRequest=void 0;var t=J(),n;(function(e){e.method=`textDocument/linkedEditingRange`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.linkedEditingRange`,`linkedEditingRangeProvider`)})(n||(e.LinkedEditingRangeRequest=n={}))})),wg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.WillDeleteFilesRequest=e.DidDeleteFilesNotification=e.DidRenameFilesNotification=e.WillRenameFilesRequest=e.DidCreateFilesNotification=e.WillCreateFilesRequest=e.FileOperationPatternKind=void 0;var t=J(),n;(function(e){e.file=`file`,e.folder=`folder`})(n||(e.FileOperationPatternKind=n={}));var r;(function(e){e.method=`workspace/willCreateFiles`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`workspace.fileOperations.willCreate`,`workspace.fileOperations.willCreate`)})(r||(e.WillCreateFilesRequest=r={}));var i;(function(e){e.method=`workspace/didCreateFiles`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolNotificationType(e.method),e.capabilities=t.CM.create(`workspace.fileOperations.didCreate`,`workspace.fileOperations.didCreate`)})(i||(e.DidCreateFilesNotification=i={}));var a;(function(e){e.method=`workspace/willRenameFiles`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`workspace.fileOperations.willRename`,`workspace.fileOperations.willRename`)})(a||(e.WillRenameFilesRequest=a={}));var o;(function(e){e.method=`workspace/didRenameFiles`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolNotificationType(e.method),e.capabilities=t.CM.create(`workspace.fileOperations.didRename`,`workspace.fileOperations.didRename`)})(o||(e.DidRenameFilesNotification=o={}));var s;(function(e){e.method=`workspace/didDeleteFiles`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolNotificationType(e.method),e.capabilities=t.CM.create(`workspace.fileOperations.didDelete`,`workspace.fileOperations.didDelete`)})(s||(e.DidDeleteFilesNotification=s={}));var c;(function(e){e.method=`workspace/willDeleteFiles`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`workspace.fileOperations.willDelete`,`workspace.fileOperations.willDelete`)})(c||(e.WillDeleteFilesRequest=c={}))})),Tg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.MonikerRequest=e.MonikerKind=e.UniquenessLevel=void 0;var t=J(),n;(function(e){e.document=`document`,e.project=`project`,e.group=`group`,e.scheme=`scheme`,e.global=`global`})(n||(e.UniquenessLevel=n={}));var r;(function(e){e.$import=`import`,e.$export=`export`,e.local=`local`})(r||(e.MonikerKind=r={}));var i;(function(e){e.method=`textDocument/moniker`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.moniker`,`monikerProvider`)})(i||(e.MonikerRequest=i={}))})),Eg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.TypeHierarchySubtypesRequest=e.TypeHierarchySupertypesRequest=e.TypeHierarchyPrepareRequest=void 0;var t=J(),n;(function(e){e.method=`textDocument/prepareTypeHierarchy`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.typeHierarchy`,`typeHierarchyProvider`)})(n||(e.TypeHierarchyPrepareRequest=n={}));var r;(function(e){e.method=`typeHierarchy/supertypes`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method)})(r||(e.TypeHierarchySupertypesRequest=r={}));var i;(function(e){e.method=`typeHierarchy/subtypes`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method)})(i||(e.TypeHierarchySubtypesRequest=i={}))})),Dg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.InlineValueRefreshRequest=e.InlineValueRequest=void 0;var t=J(),n;(function(e){e.method=`textDocument/inlineValue`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.inlineValue`,`inlineValueProvider`)})(n||(e.InlineValueRequest=n={}));var r;(function(e){e.method=`workspace/inlineValue/refresh`,e.messageDirection=t.MessageDirection.serverToClient,e.type=new t.ProtocolRequestType0(e.method),e.capabilities=t.CM.create(`workspace.inlineValue.refreshSupport`,void 0)})(r||(e.InlineValueRefreshRequest=r={}))})),Og=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.InlayHintRefreshRequest=e.InlayHintResolveRequest=e.InlayHintRequest=void 0;var t=J(),n;(function(e){e.method=`textDocument/inlayHint`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.inlayHint`,`inlayHintProvider`)})(n||(e.InlayHintRequest=n={}));var r;(function(e){e.method=`inlayHint/resolve`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.inlayHint.resolveSupport`,`inlayHintProvider.resolveProvider`)})(r||(e.InlayHintResolveRequest=r={}));var i;(function(e){e.method=`workspace/inlayHint/refresh`,e.messageDirection=t.MessageDirection.serverToClient,e.type=new t.ProtocolRequestType0(e.method),e.capabilities=t.CM.create(`workspace.inlayHint.refreshSupport`,void 0)})(i||(e.InlayHintRefreshRequest=i={}))})),kg=r((e=>{var t=e&&e.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),n=e&&e.__setModuleDefault||(Object.create?(function(e,t){Object.defineProperty(e,"default",{enumerable:!0,value:t})}):function(e,t){e.default=t}),r=e&&e.__importStar||(function(){var e=function(t){return e=Object.getOwnPropertyNames||function(e){var t=[];for(var n in e)Object.prototype.hasOwnProperty.call(e,n)&&(t[t.length]=n);return t},e(t)};return function(r){if(r&&r.__esModule)return r;var i={};if(r!=null)for(var a=e(r),o=0;o<a.length;o++)a[o]!=="default"&&t(i,r,a[o]);return n(i,r),i}})();Object.defineProperty(e,"__esModule",{value:!0}),e.DiagnosticRefreshRequest=e.WorkspaceDiagnosticRequest=e.DocumentDiagnosticRequest=e.DocumentDiagnosticReportKind=e.DiagnosticServerCancellationData=void 0;var i=lg(),a=r(ug()),o=J(),s;(function(e){function t(e){let t=e;return t&&a.boolean(t.retriggerRequest)}e.is=t})(s||(e.DiagnosticServerCancellationData=s={}));var c;(function(e){e.Full=`full`,e.Unchanged=`unchanged`})(c||(e.DocumentDiagnosticReportKind=c={}));var l;(function(e){e.method=`textDocument/diagnostic`,e.messageDirection=o.MessageDirection.clientToServer,e.type=new o.ProtocolRequestType(e.method),e.partialResult=new i.ProgressType,e.capabilities=o.CM.create(`textDocument.diagnostic`,`diagnosticProvider`)})(l||(e.DocumentDiagnosticRequest=l={}));var u;(function(e){e.method=`workspace/diagnostic`,e.messageDirection=o.MessageDirection.clientToServer,e.type=new o.ProtocolRequestType(e.method),e.partialResult=new i.ProgressType,e.capabilities=o.CM.create(`workspace.diagnostics`,`diagnosticProvider.workspaceDiagnostics`)})(u||(e.WorkspaceDiagnosticRequest=u={}));var d;(function(e){e.method=`workspace/diagnostic/refresh`,e.messageDirection=o.MessageDirection.serverToClient,e.type=new o.ProtocolRequestType0(e.method),e.capabilities=o.CM.create(`workspace.diagnostics.refreshSupport`,void 0)})(d||(e.DiagnosticRefreshRequest=d={}))})),Ag=r((t=>{var n=t&&t.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),r=t&&t.__setModuleDefault||(Object.create?(function(e,t){Object.defineProperty(e,"default",{enumerable:!0,value:t})}):function(e,t){e.default=t}),i=t&&t.__importStar||(function(){var e=function(t){return e=Object.getOwnPropertyNames||function(e){var t=[];for(var n in e)Object.prototype.hasOwnProperty.call(e,n)&&(t[t.length]=n);return t},e(t)};return function(t){if(t&&t.__esModule)return t;var i={};if(t!=null)for(var a=e(t),o=0;o<a.length;o++)a[o]!=="default"&&n(i,t,a[o]);return r(i,t),i}})();Object.defineProperty(t,"__esModule",{value:!0}),t.DidCloseNotebookDocumentNotification=t.DidSaveNotebookDocumentNotification=t.DidChangeNotebookDocumentNotification=t.NotebookCellArrayChange=t.DidOpenNotebookDocumentNotification=t.NotebookDocumentSyncRegistrationType=t.NotebookDocument=t.NotebookCell=t.ExecutionSummary=t.NotebookCellKind=void 0;var a=(sh(),e(Op)),o=i(ug()),s=J(),c;(function(e){e.Markup=1,e.Code=2;function t(e){return e===1||e===2}e.is=t})(c||(t.NotebookCellKind=c={}));var l;(function(e){function t(e,t){let n={executionOrder:e};return(t===!0||t===!1)&&(n.success=t),n}e.create=t;function n(e){let t=e;return o.objectLiteral(t)&&a.uinteger.is(t.executionOrder)&&(t.success===void 0||o.boolean(t.success))}e.is=n;function r(e,t){return e===t?!0:e==null||t==null?!1:e.executionOrder===t.executionOrder&&e.success===t.success}e.equals=r})(l||(t.ExecutionSummary=l={}));var u;(function(e){function t(e,t){return{kind:e,document:t}}e.create=t;function n(e){let t=e;return o.objectLiteral(t)&&c.is(t.kind)&&a.DocumentUri.is(t.document)&&(t.metadata===void 0||o.objectLiteral(t.metadata))}e.is=n;function r(e,t){let n=new Set;return e.document!==t.document&&n.add(`document`),e.kind!==t.kind&&n.add(`kind`),e.executionSummary!==t.executionSummary&&n.add(`executionSummary`),(e.metadata!==void 0||t.metadata!==void 0)&&!i(e.metadata,t.metadata)&&n.add(`metadata`),(e.executionSummary!==void 0||t.executionSummary!==void 0)&&!l.equals(e.executionSummary,t.executionSummary)&&n.add(`executionSummary`),n}e.diff=r;function i(e,t){if(e===t)return!0;if(e==null||t==null||typeof e!=typeof t||typeof e!=`object`)return!1;let n=Array.isArray(e),r=Array.isArray(t);if(n!==r)return!1;if(n&&r){if(e.length!==t.length)return!1;for(let n=0;n<e.length;n++)if(!i(e[n],t[n]))return!1}if(o.objectLiteral(e)&&o.objectLiteral(t)){let n=Object.keys(e),r=Object.keys(t);if(n.length!==r.length||(n.sort(),r.sort(),!i(n,r)))return!1;for(let r=0;r<n.length;r++){let a=n[r];if(!i(e[a],t[a]))return!1}}return!0}})(u||(t.NotebookCell=u={}));var d;(function(e){function t(e,t,n,r){return{uri:e,notebookType:t,version:n,cells:r}}e.create=t;function n(e){let t=e;return o.objectLiteral(t)&&o.string(t.uri)&&a.integer.is(t.version)&&o.typedArray(t.cells,u.is)}e.is=n})(d||(t.NotebookDocument=d={}));var f;(function(e){e.method=`notebookDocument/sync`,e.messageDirection=s.MessageDirection.clientToServer,e.type=new s.RegistrationType(e.method)})(f||(t.NotebookDocumentSyncRegistrationType=f={}));var p;(function(e){e.method=`notebookDocument/didOpen`,e.messageDirection=s.MessageDirection.clientToServer,e.type=new s.ProtocolNotificationType(e.method),e.registrationMethod=f.method})(p||(t.DidOpenNotebookDocumentNotification=p={}));var m;(function(e){function t(e){let t=e;return o.objectLiteral(t)&&a.uinteger.is(t.start)&&a.uinteger.is(t.deleteCount)&&(t.cells===void 0||o.typedArray(t.cells,u.is))}e.is=t;function n(e,t,n){let r={start:e,deleteCount:t};return n!==void 0&&(r.cells=n),r}e.create=n})(m||(t.NotebookCellArrayChange=m={}));var h;(function(e){e.method=`notebookDocument/didChange`,e.messageDirection=s.MessageDirection.clientToServer,e.type=new s.ProtocolNotificationType(e.method),e.registrationMethod=f.method})(h||(t.DidChangeNotebookDocumentNotification=h={}));var g;(function(e){e.method=`notebookDocument/didSave`,e.messageDirection=s.MessageDirection.clientToServer,e.type=new s.ProtocolNotificationType(e.method),e.registrationMethod=f.method})(g||(t.DidSaveNotebookDocumentNotification=g={}));var _;(function(e){e.method=`notebookDocument/didClose`,e.messageDirection=s.MessageDirection.clientToServer,e.type=new s.ProtocolNotificationType(e.method),e.registrationMethod=f.method})(_||(t.DidCloseNotebookDocumentNotification=_={}))})),jg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.InlineCompletionRequest=void 0;var t=J(),n;(function(e){e.method=`textDocument/inlineCompletion`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`textDocument.inlineCompletion`,`inlineCompletionProvider`)})(n||(e.InlineCompletionRequest=n={}))})),Mg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.TextDocumentContentRefreshRequest=e.TextDocumentContentRequest=void 0;var t=J(),n;(function(e){e.method=`workspace/textDocumentContent`,e.messageDirection=t.MessageDirection.clientToServer,e.type=new t.ProtocolRequestType(e.method),e.capabilities=t.CM.create(`workspace.textDocumentContent`,`workspace.textDocumentContent`)})(n||(e.TextDocumentContentRequest=n={}));var r;(function(e){e.method=`workspace/textDocumentContent/refresh`,e.messageDirection=t.MessageDirection.serverToClient,e.type=new t.ProtocolRequestType(e.method)})(r||(e.TextDocumentContentRefreshRequest=r={}))})),Ng=r((t=>{var n=t&&t.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),r=t&&t.__setModuleDefault||(Object.create?(function(e,t){Object.defineProperty(e,"default",{enumerable:!0,value:t})}):function(e,t){e.default=t}),i=t&&t.__importStar||(function(){var e=function(t){return e=Object.getOwnPropertyNames||function(e){var t=[];for(var n in e)Object.prototype.hasOwnProperty.call(e,n)&&(t[t.length]=n);return t},e(t)};return function(t){if(t&&t.__esModule)return t;var i={};if(t!=null)for(var a=e(t),o=0;o<a.length;o++)a[o]!=="default"&&n(i,t,a[o]);return r(i,t),i}})();Object.defineProperty(t,"__esModule",{value:!0}),t.CodeActionRequest=t.DocumentSymbolRequest=t.DocumentHighlightRequest=t.ReferencesRequest=t.DefinitionRequest=t.SignatureHelpRequest=t.SignatureHelpTriggerKind=t.HoverRequest=t.CompletionResolveRequest=t.CompletionRequest=t.CompletionTriggerKind=t.PublishDiagnosticsNotification=t.WatchKind=t.GlobPattern=t.RelativePattern=t.FileChangeType=t.DidChangeWatchedFilesNotification=t.WillSaveTextDocumentWaitUntilRequest=t.WillSaveTextDocumentNotification=t.TextDocumentSaveReason=t.DidSaveTextDocumentNotification=t.DidCloseTextDocumentNotification=t.DidChangeTextDocumentNotification=t.TextDocumentContentChangeEvent=t.DidOpenTextDocumentNotification=t.TextDocumentSyncKind=t.TelemetryEventNotification=t.LogMessageNotification=t.ShowMessageRequest=t.ShowMessageNotification=t.MessageType=t.DidChangeConfigurationNotification=t.ExitNotification=t.ShutdownRequest=t.InitializedNotification=t.InitializeErrorCodes=t.InitializeRequest=t.WorkDoneProgressOptions=t.TextDocumentRegistrationOptions=t.StaticRegistrationOptions=t.PositionEncodingKind=t.RegularExpressionEngineKind=t.FailureHandlingKind=t.ResourceOperationKind=t.UnregistrationRequest=t.RegistrationRequest=t.DocumentSelector=t.NotebookCellTextDocumentFilter=t.NotebookDocumentFilter=t.TextDocumentFilter=void 0,t.UniquenessLevel=t.WillDeleteFilesRequest=t.DidDeleteFilesNotification=t.WillRenameFilesRequest=t.DidRenameFilesNotification=t.WillCreateFilesRequest=t.DidCreateFilesNotification=t.FileOperationPatternKind=t.LinkedEditingRangeRequest=t.ShowDocumentRequest=t.SemanticTokensRegistrationType=t.SemanticTokensRefreshRequest=t.SemanticTokensRangeRequest=t.SemanticTokensDeltaRequest=t.SemanticTokensRequest=t.TokenFormat=t.CallHierarchyPrepareRequest=t.CallHierarchyOutgoingCallsRequest=t.CallHierarchyIncomingCallsRequest=t.WorkDoneProgressCancelNotification=t.WorkDoneProgressCreateRequest=t.WorkDoneProgress=t.SelectionRangeRequest=t.DeclarationRequest=t.FoldingRangeRefreshRequest=t.FoldingRangeRequest=t.ColorPresentationRequest=t.DocumentColorRequest=t.ConfigurationRequest=t.DidChangeWorkspaceFoldersNotification=t.WorkspaceFoldersRequest=t.TypeDefinitionRequest=t.ImplementationRequest=t.ApplyWorkspaceEditRequest=t.ExecuteCommandRequest=t.PrepareRenameRequest=t.RenameRequest=t.PrepareSupportDefaultBehavior=t.DocumentOnTypeFormattingRequest=t.DocumentRangesFormattingRequest=t.DocumentRangeFormattingRequest=t.DocumentFormattingRequest=t.DocumentLinkResolveRequest=t.DocumentLinkRequest=t.CodeLensRefreshRequest=t.CodeLensResolveRequest=t.CodeLensRequest=t.WorkspaceSymbolResolveRequest=t.WorkspaceSymbolRequest=t.CodeActionResolveRequest=void 0,t.TextDocumentContentRefreshRequest=t.TextDocumentContentRequest=t.InlineCompletionRequest=t.DidCloseNotebookDocumentNotification=t.DidSaveNotebookDocumentNotification=t.DidChangeNotebookDocumentNotification=t.NotebookCellArrayChange=t.DidOpenNotebookDocumentNotification=t.NotebookDocumentSyncRegistrationType=t.NotebookDocument=t.NotebookCell=t.ExecutionSummary=t.NotebookCellKind=t.DiagnosticRefreshRequest=t.WorkspaceDiagnosticRequest=t.DocumentDiagnosticRequest=t.DocumentDiagnosticReportKind=t.DiagnosticServerCancellationData=t.InlayHintRefreshRequest=t.InlayHintResolveRequest=t.InlayHintRequest=t.InlineValueRefreshRequest=t.InlineValueRequest=t.TypeHierarchySupertypesRequest=t.TypeHierarchySubtypesRequest=t.TypeHierarchyPrepareRequest=t.MonikerRequest=t.MonikerKind=void 0;var a=J(),o=(sh(),e(Op)),s=i(ug()),c=dg();Object.defineProperty(t,"ImplementationRequest",{enumerable:!0,get:function(){return c.ImplementationRequest}});var l=fg();Object.defineProperty(t,"TypeDefinitionRequest",{enumerable:!0,get:function(){return l.TypeDefinitionRequest}});var u=pg();Object.defineProperty(t,"WorkspaceFoldersRequest",{enumerable:!0,get:function(){return u.WorkspaceFoldersRequest}}),Object.defineProperty(t,"DidChangeWorkspaceFoldersNotification",{enumerable:!0,get:function(){return u.DidChangeWorkspaceFoldersNotification}});var d=mg();Object.defineProperty(t,"ConfigurationRequest",{enumerable:!0,get:function(){return d.ConfigurationRequest}});var f=hg();Object.defineProperty(t,"DocumentColorRequest",{enumerable:!0,get:function(){return f.DocumentColorRequest}}),Object.defineProperty(t,"ColorPresentationRequest",{enumerable:!0,get:function(){return f.ColorPresentationRequest}});var p=gg();Object.defineProperty(t,"FoldingRangeRequest",{enumerable:!0,get:function(){return p.FoldingRangeRequest}}),Object.defineProperty(t,"FoldingRangeRefreshRequest",{enumerable:!0,get:function(){return p.FoldingRangeRefreshRequest}});var m=_g();Object.defineProperty(t,"DeclarationRequest",{enumerable:!0,get:function(){return m.DeclarationRequest}});var h=vg();Object.defineProperty(t,"SelectionRangeRequest",{enumerable:!0,get:function(){return h.SelectionRangeRequest}});var g=yg();Object.defineProperty(t,"WorkDoneProgress",{enumerable:!0,get:function(){return g.WorkDoneProgress}}),Object.defineProperty(t,"WorkDoneProgressCreateRequest",{enumerable:!0,get:function(){return g.WorkDoneProgressCreateRequest}}),Object.defineProperty(t,"WorkDoneProgressCancelNotification",{enumerable:!0,get:function(){return g.WorkDoneProgressCancelNotification}});var _=bg();Object.defineProperty(t,"CallHierarchyIncomingCallsRequest",{enumerable:!0,get:function(){return _.CallHierarchyIncomingCallsRequest}}),Object.defineProperty(t,"CallHierarchyOutgoingCallsRequest",{enumerable:!0,get:function(){return _.CallHierarchyOutgoingCallsRequest}}),Object.defineProperty(t,"CallHierarchyPrepareRequest",{enumerable:!0,get:function(){return _.CallHierarchyPrepareRequest}});var v=xg();Object.defineProperty(t,"TokenFormat",{enumerable:!0,get:function(){return v.TokenFormat}}),Object.defineProperty(t,"SemanticTokensRequest",{enumerable:!0,get:function(){return v.SemanticTokensRequest}}),Object.defineProperty(t,"SemanticTokensDeltaRequest",{enumerable:!0,get:function(){return v.SemanticTokensDeltaRequest}}),Object.defineProperty(t,"SemanticTokensRangeRequest",{enumerable:!0,get:function(){return v.SemanticTokensRangeRequest}}),Object.defineProperty(t,"SemanticTokensRefreshRequest",{enumerable:!0,get:function(){return v.SemanticTokensRefreshRequest}}),Object.defineProperty(t,"SemanticTokensRegistrationType",{enumerable:!0,get:function(){return v.SemanticTokensRegistrationType}});var y=Sg();Object.defineProperty(t,"ShowDocumentRequest",{enumerable:!0,get:function(){return y.ShowDocumentRequest}});var ee=Cg();Object.defineProperty(t,"LinkedEditingRangeRequest",{enumerable:!0,get:function(){return ee.LinkedEditingRangeRequest}});var b=wg();Object.defineProperty(t,"FileOperationPatternKind",{enumerable:!0,get:function(){return b.FileOperationPatternKind}}),Object.defineProperty(t,"DidCreateFilesNotification",{enumerable:!0,get:function(){return b.DidCreateFilesNotification}}),Object.defineProperty(t,"WillCreateFilesRequest",{enumerable:!0,get:function(){return b.WillCreateFilesRequest}}),Object.defineProperty(t,"DidRenameFilesNotification",{enumerable:!0,get:function(){return b.DidRenameFilesNotification}}),Object.defineProperty(t,"WillRenameFilesRequest",{enumerable:!0,get:function(){return b.WillRenameFilesRequest}}),Object.defineProperty(t,"DidDeleteFilesNotification",{enumerable:!0,get:function(){return b.DidDeleteFilesNotification}}),Object.defineProperty(t,"WillDeleteFilesRequest",{enumerable:!0,get:function(){return b.WillDeleteFilesRequest}});var x=Tg();Object.defineProperty(t,"UniquenessLevel",{enumerable:!0,get:function(){return x.UniquenessLevel}}),Object.defineProperty(t,"MonikerKind",{enumerable:!0,get:function(){return x.MonikerKind}}),Object.defineProperty(t,"MonikerRequest",{enumerable:!0,get:function(){return x.MonikerRequest}});var S=Eg();Object.defineProperty(t,"TypeHierarchyPrepareRequest",{enumerable:!0,get:function(){return S.TypeHierarchyPrepareRequest}}),Object.defineProperty(t,"TypeHierarchySubtypesRequest",{enumerable:!0,get:function(){return S.TypeHierarchySubtypesRequest}}),Object.defineProperty(t,"TypeHierarchySupertypesRequest",{enumerable:!0,get:function(){return S.TypeHierarchySupertypesRequest}});var te=Dg();Object.defineProperty(t,"InlineValueRequest",{enumerable:!0,get:function(){return te.InlineValueRequest}}),Object.defineProperty(t,"InlineValueRefreshRequest",{enumerable:!0,get:function(){return te.InlineValueRefreshRequest}});var C=Og();Object.defineProperty(t,"InlayHintRequest",{enumerable:!0,get:function(){return C.InlayHintRequest}}),Object.defineProperty(t,"InlayHintResolveRequest",{enumerable:!0,get:function(){return C.InlayHintResolveRequest}}),Object.defineProperty(t,"InlayHintRefreshRequest",{enumerable:!0,get:function(){return C.InlayHintRefreshRequest}});var w=kg();Object.defineProperty(t,"DiagnosticServerCancellationData",{enumerable:!0,get:function(){return w.DiagnosticServerCancellationData}}),Object.defineProperty(t,"DocumentDiagnosticReportKind",{enumerable:!0,get:function(){return w.DocumentDiagnosticReportKind}}),Object.defineProperty(t,"DocumentDiagnosticRequest",{enumerable:!0,get:function(){return w.DocumentDiagnosticRequest}}),Object.defineProperty(t,"WorkspaceDiagnosticRequest",{enumerable:!0,get:function(){return w.WorkspaceDiagnosticRequest}}),Object.defineProperty(t,"DiagnosticRefreshRequest",{enumerable:!0,get:function(){return w.DiagnosticRefreshRequest}});var T=Ag();Object.defineProperty(t,"NotebookCellKind",{enumerable:!0,get:function(){return T.NotebookCellKind}}),Object.defineProperty(t,"ExecutionSummary",{enumerable:!0,get:function(){return T.ExecutionSummary}}),Object.defineProperty(t,"NotebookCell",{enumerable:!0,get:function(){return T.NotebookCell}}),Object.defineProperty(t,"NotebookDocument",{enumerable:!0,get:function(){return T.NotebookDocument}}),Object.defineProperty(t,"NotebookDocumentSyncRegistrationType",{enumerable:!0,get:function(){return T.NotebookDocumentSyncRegistrationType}}),Object.defineProperty(t,"DidOpenNotebookDocumentNotification",{enumerable:!0,get:function(){return T.DidOpenNotebookDocumentNotification}}),Object.defineProperty(t,"NotebookCellArrayChange",{enumerable:!0,get:function(){return T.NotebookCellArrayChange}}),Object.defineProperty(t,"DidChangeNotebookDocumentNotification",{enumerable:!0,get:function(){return T.DidChangeNotebookDocumentNotification}}),Object.defineProperty(t,"DidSaveNotebookDocumentNotification",{enumerable:!0,get:function(){return T.DidSaveNotebookDocumentNotification}}),Object.defineProperty(t,"DidCloseNotebookDocumentNotification",{enumerable:!0,get:function(){return T.DidCloseNotebookDocumentNotification}});var E=jg();Object.defineProperty(t,"InlineCompletionRequest",{enumerable:!0,get:function(){return E.InlineCompletionRequest}});var ne=Mg();Object.defineProperty(t,"TextDocumentContentRequest",{enumerable:!0,get:function(){return ne.TextDocumentContentRequest}}),Object.defineProperty(t,"TextDocumentContentRefreshRequest",{enumerable:!0,get:function(){return ne.TextDocumentContentRefreshRequest}});var D;(function(e){function t(e){let t=e;return s.string(t)||s.string(t.language)||s.string(t.scheme)||Ae.is(t.pattern)}e.is=t})(D||(t.TextDocumentFilter=D={}));var O;(function(e){function t(e){let t=e;return s.objectLiteral(t)&&(s.string(t.notebookType)||s.string(t.scheme)||s.string(t.pattern))}e.is=t})(O||(t.NotebookDocumentFilter=O={}));var k;(function(e){function t(e){let t=e;return s.objectLiteral(t)&&(s.string(t.notebook)||O.is(t.notebook))&&(t.language===void 0||s.string(t.language))}e.is=t})(k||(t.NotebookCellTextDocumentFilter=k={}));var A;(function(e){function t(e){if(!Array.isArray(e))return!1;for(let t of e)if(!s.string(t)&&!D.is(t)&&!k.is(t))return!1;return!0}e.is=t})(A||(t.DocumentSelector=A={}));var re;(function(e){e.method=`client/registerCapability`,e.messageDirection=a.MessageDirection.serverToClient,e.type=new a.ProtocolRequestType(e.method)})(re||(t.RegistrationRequest=re={}));var ie;(function(e){e.method=`client/unregisterCapability`,e.messageDirection=a.MessageDirection.serverToClient,e.type=new a.ProtocolRequestType(e.method)})(ie||(t.UnregistrationRequest=ie={}));var ae;(function(e){e.Create=`create`,e.Rename=`rename`,e.Delete=`delete`})(ae||(t.ResourceOperationKind=ae={}));var j;(function(e){e.Abort=`abort`,e.Transactional=`transactional`,e.TextOnlyTransactional=`textOnlyTransactional`,e.Undo=`undo`})(j||(t.FailureHandlingKind=j={}));var M;(function(e){e.ES2020=`ES2020`})(M||(t.RegularExpressionEngineKind=M={}));var oe;(function(e){e.UTF8=`utf-8`,e.UTF16=`utf-16`,e.UTF32=`utf-32`})(oe||(t.PositionEncodingKind=oe={}));var se;(function(e){function t(e){let t=e;return t&&s.string(t.id)&&t.id.length>0}e.hasId=t})(se||(t.StaticRegistrationOptions=se={}));var N;(function(e){function t(e){let t=e;return t&&(t.documentSelector===null||A.is(t.documentSelector))}e.is=t})(N||(t.TextDocumentRegistrationOptions=N={}));var ce;(function(e){function t(e){let t=e;return s.objectLiteral(t)&&(t.workDoneProgress===void 0||s.boolean(t.workDoneProgress))}e.is=t;function n(e){let t=e;return t&&s.boolean(t.workDoneProgress)}e.hasWorkDoneProgress=n})(ce||(t.WorkDoneProgressOptions=ce={}));var P;(function(e){e.method=`initialize`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method)})(P||(t.InitializeRequest=P={}));var F;(function(e){e.unknownProtocolVersion=1})(F||(t.InitializeErrorCodes=F={}));var le;(function(e){e.method=`initialized`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolNotificationType(e.method)})(le||(t.InitializedNotification=le={}));var ue;(function(e){e.method=`shutdown`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType0(e.method)})(ue||(t.ShutdownRequest=ue={}));var de;(function(e){e.method=`exit`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolNotificationType0(e.method)})(de||(t.ExitNotification=de={}));var fe;(function(e){e.method=`workspace/didChangeConfiguration`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolNotificationType(e.method),e.capabilities=a.CM.create(`workspace.didChangeConfiguration`,void 0)})(fe||(t.DidChangeConfigurationNotification=fe={}));var pe;(function(e){e.Error=1,e.Warning=2,e.Info=3,e.Log=4,e.Debug=5})(pe||(t.MessageType=pe={}));var me;(function(e){e.method=`window/showMessage`,e.messageDirection=a.MessageDirection.serverToClient,e.type=new a.ProtocolNotificationType(e.method),e.capabilities=a.CM.create(`window.showMessage`,void 0)})(me||(t.ShowMessageNotification=me={}));var he;(function(e){e.method=`window/showMessageRequest`,e.messageDirection=a.MessageDirection.serverToClient,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`window.showMessage`,void 0)})(he||(t.ShowMessageRequest=he={}));var ge;(function(e){e.method=`window/logMessage`,e.messageDirection=a.MessageDirection.serverToClient,e.type=new a.ProtocolNotificationType(e.method)})(ge||(t.LogMessageNotification=ge={}));var _e;(function(e){e.method=`telemetry/event`,e.messageDirection=a.MessageDirection.serverToClient,e.type=new a.ProtocolNotificationType(e.method)})(_e||(t.TelemetryEventNotification=_e={}));var ve;(function(e){e.None=0,e.Full=1,e.Incremental=2})(ve||(t.TextDocumentSyncKind=ve={}));var ye;(function(e){e.method=`textDocument/didOpen`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolNotificationType(e.method),e.capabilities=a.CM.create(`textDocument.synchronization`,`textDocumentSync.openClose`)})(ye||(t.DidOpenTextDocumentNotification=ye={}));var be;(function(e){function t(e){let t=e;return t!=null&&typeof t.text==`string`&&t.range!==void 0&&(t.rangeLength===void 0||typeof t.rangeLength==`number`)}e.isIncremental=t;function n(e){let t=e;return t!=null&&typeof t.text==`string`&&t.range===void 0&&t.rangeLength===void 0}e.isFull=n})(be||(t.TextDocumentContentChangeEvent=be={}));var xe;(function(e){e.method=`textDocument/didChange`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolNotificationType(e.method),e.capabilities=a.CM.create(`textDocument.synchronization`,`textDocumentSync`)})(xe||(t.DidChangeTextDocumentNotification=xe={}));var Se;(function(e){e.method=`textDocument/didClose`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolNotificationType(e.method),e.capabilities=a.CM.create(`textDocument.synchronization`,`textDocumentSync.openClose`)})(Se||(t.DidCloseTextDocumentNotification=Se={}));var Ce;(function(e){e.method=`textDocument/didSave`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolNotificationType(e.method),e.capabilities=a.CM.create(`textDocument.synchronization.didSave`,`textDocumentSync.save`)})(Ce||(t.DidSaveTextDocumentNotification=Ce={}));var we;(function(e){e.Manual=1,e.AfterDelay=2,e.FocusOut=3})(we||(t.TextDocumentSaveReason=we={}));var Te;(function(e){e.method=`textDocument/willSave`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolNotificationType(e.method),e.capabilities=a.CM.create(`textDocument.synchronization.willSave`,`textDocumentSync.willSave`)})(Te||(t.WillSaveTextDocumentNotification=Te={}));var Ee;(function(e){e.method=`textDocument/willSaveWaitUntil`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.synchronization.willSaveWaitUntil`,`textDocumentSync.willSaveWaitUntil`)})(Ee||(t.WillSaveTextDocumentWaitUntilRequest=Ee={}));var De;(function(e){e.method=`workspace/didChangeWatchedFiles`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolNotificationType(e.method),e.capabilities=a.CM.create(`workspace.didChangeWatchedFiles`,void 0)})(De||(t.DidChangeWatchedFilesNotification=De={}));var Oe;(function(e){e.Created=1,e.Changed=2,e.Deleted=3})(Oe||(t.FileChangeType=Oe={}));var ke;(function(e){function t(e){let t=e;return s.objectLiteral(t)&&(o.URI.is(t.baseUri)||o.WorkspaceFolder.is(t.baseUri))&&s.string(t.pattern)}e.is=t})(ke||(t.RelativePattern=ke={}));var Ae;(function(e){function t(e){let t=e;return s.string(t)||ke.is(t)}e.is=t})(Ae||(t.GlobPattern=Ae={}));var je;(function(e){e.Create=1,e.Change=2,e.Delete=4})(je||(t.WatchKind=je={}));var Me;(function(e){e.method=`textDocument/publishDiagnostics`,e.messageDirection=a.MessageDirection.serverToClient,e.type=new a.ProtocolNotificationType(e.method),e.capabilities=a.CM.create(`textDocument.publishDiagnostics`,void 0)})(Me||(t.PublishDiagnosticsNotification=Me={}));var Ne;(function(e){e.Invoked=1,e.TriggerCharacter=2,e.TriggerForIncompleteCompletions=3})(Ne||(t.CompletionTriggerKind=Ne={}));var Pe;(function(e){e.method=`textDocument/completion`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.completion`,`completionProvider`)})(Pe||(t.CompletionRequest=Pe={}));var Fe;(function(e){e.method=`completionItem/resolve`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.completion.completionItem.resolveSupport`,`completionProvider.resolveProvider`)})(Fe||(t.CompletionResolveRequest=Fe={}));var Ie;(function(e){e.method=`textDocument/hover`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.hover`,`hoverProvider`)})(Ie||(t.HoverRequest=Ie={}));var Le;(function(e){e.Invoked=1,e.TriggerCharacter=2,e.ContentChange=3})(Le||(t.SignatureHelpTriggerKind=Le={}));var Re;(function(e){e.method=`textDocument/signatureHelp`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.signatureHelp`,`signatureHelpProvider`)})(Re||(t.SignatureHelpRequest=Re={}));var ze;(function(e){e.method=`textDocument/definition`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.definition`,`definitionProvider`)})(ze||(t.DefinitionRequest=ze={}));var Be;(function(e){e.method=`textDocument/references`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.references`,`referencesProvider`)})(Be||(t.ReferencesRequest=Be={}));var Ve;(function(e){e.method=`textDocument/documentHighlight`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.documentHighlight`,`documentHighlightProvider`)})(Ve||(t.DocumentHighlightRequest=Ve={}));var He;(function(e){e.method=`textDocument/documentSymbol`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.documentSymbol`,`documentSymbolProvider`)})(He||(t.DocumentSymbolRequest=He={}));var Ue;(function(e){e.method=`textDocument/codeAction`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.codeAction`,`codeActionProvider`)})(Ue||(t.CodeActionRequest=Ue={}));var We;(function(e){e.method=`codeAction/resolve`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.codeAction.resolveSupport`,`codeActionProvider.resolveProvider`)})(We||(t.CodeActionResolveRequest=We={}));var Ge;(function(e){e.method=`workspace/symbol`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`workspace.symbol`,`workspaceSymbolProvider`)})(Ge||(t.WorkspaceSymbolRequest=Ge={}));var Ke;(function(e){e.method=`workspaceSymbol/resolve`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`workspace.symbol.resolveSupport`,`workspaceSymbolProvider.resolveProvider`)})(Ke||(t.WorkspaceSymbolResolveRequest=Ke={}));var qe;(function(e){e.method=`textDocument/codeLens`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.codeLens`,`codeLensProvider`)})(qe||(t.CodeLensRequest=qe={}));var Je;(function(e){e.method=`codeLens/resolve`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.codeLens.resolveSupport`,`codeLensProvider.resolveProvider`)})(Je||(t.CodeLensResolveRequest=Je={}));var Ye;(function(e){e.method=`workspace/codeLens/refresh`,e.messageDirection=a.MessageDirection.serverToClient,e.type=new a.ProtocolRequestType0(e.method),e.capabilities=a.CM.create(`workspace.codeLens`,void 0)})(Ye||(t.CodeLensRefreshRequest=Ye={}));var Xe;(function(e){e.method=`textDocument/documentLink`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.documentLink`,`documentLinkProvider`)})(Xe||(t.DocumentLinkRequest=Xe={}));var Ze;(function(e){e.method=`documentLink/resolve`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.documentLink`,`documentLinkProvider.resolveProvider`)})(Ze||(t.DocumentLinkResolveRequest=Ze={}));var Qe;(function(e){e.method=`textDocument/formatting`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.formatting`,`documentFormattingProvider`)})(Qe||(t.DocumentFormattingRequest=Qe={}));var $e;(function(e){e.method=`textDocument/rangeFormatting`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.rangeFormatting`,`documentRangeFormattingProvider`)})($e||(t.DocumentRangeFormattingRequest=$e={}));var et;(function(e){e.method=`textDocument/rangesFormatting`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.rangeFormatting.rangesSupport`,`documentRangeFormattingProvider.rangesSupport`)})(et||(t.DocumentRangesFormattingRequest=et={}));var tt;(function(e){e.method=`textDocument/onTypeFormatting`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.onTypeFormatting`,`documentOnTypeFormattingProvider`)})(tt||(t.DocumentOnTypeFormattingRequest=tt={}));var nt;(function(e){e.Identifier=1})(nt||(t.PrepareSupportDefaultBehavior=nt={}));var rt;(function(e){e.method=`textDocument/rename`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.rename`,`renameProvider`)})(rt||(t.RenameRequest=rt={}));var it;(function(e){e.method=`textDocument/prepareRename`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`textDocument.rename.prepareSupport`,`renameProvider.prepareProvider`)})(it||(t.PrepareRenameRequest=it={}));var at;(function(e){e.method=`workspace/executeCommand`,e.messageDirection=a.MessageDirection.clientToServer,e.type=new a.ProtocolRequestType(e.method),e.capabilities=a.CM.create(`workspace.executeCommand`,`executeCommandProvider`)})(at||(t.ExecuteCommandRequest=at={}));var ot;(function(e){e.method=`workspace/applyEdit`,e.messageDirection=a.MessageDirection.serverToClient,e.type=new a.ProtocolRequestType(`workspace/applyEdit`),e.capabilities=a.CM.create(`workspace.applyEdit`,void 0)})(ot||(t.ApplyWorkspaceEditRequest=ot={}))})),Pg=r((e=>{Object.defineProperty(e,"__esModule",{value:!0}),e.createProtocolConnection=n;var t=lg();function n(e,n,r,i){return t.ConnectionStrategy.is(i)&&(i={connectionStrategy:i}),(0,t.createMessageConnection)(e,n,r,i)}})),Fg=r((t=>{var n=t&&t.__createBinding||(Object.create?(function(e,t,n,r){r===void 0&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);(!i||(`get`in i?!t.__esModule:i.writable||i.configurable))&&(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}):(function(e,t,n,r){r===void 0&&(r=n),e[r]=t[n]})),r=t&&t.__exportStar||function(e,t){for(var r in e)r!=="default"&&!Object.prototype.hasOwnProperty.call(t,r)&&n(t,e,r)};Object.defineProperty(t,"__esModule",{value:!0}),t.LSPErrorCodes=t.createProtocolConnection=void 0,r(lg(),t),r((sh(),e(Op)),t),r(J(),t),r(Ng(),t);var i=Pg();Object.defineProperty(t,"createProtocolConnection",{enumerable:!0,get:function(){return i.createProtocolConnection}});var a;(function(e){e.lspReservedErrorRangeStart=-32899,e.RequestFailed=-32803,e.ServerCancelled=-32802,e.ContentModified=-32801,e.RequestCancelled=-32800,e.lspReservedErrorRangeEnd=-32800})(a||(t.LSPErrorCodes=a={}))})),Y=Fg();function Ig(){return new Promise(e=>{typeof setImmediate>`u`?setTimeout(e,0):setImmediate(e)})}var Lg=0,Rg=10;function zg(){return Lg=performance.now(),new Y.CancellationTokenSource}var Bg=Symbol(`OperationCancelled`);function Vg(e){return e===Bg}async function Hg(e){if(e===Y.CancellationToken.None)return;let t=performance.now();if(t-Lg>=Rg&&(Lg=t,await Ig(),Lg=performance.now()),e.isCancellationRequested)throw Bg}var Ug=class{constructor(){this.promise=new Promise((e,t)=>{this.resolve=t=>(e(t),this),this.reject=e=>(t(e),this)})}},Wg=class e{constructor(e,t,n,r){this._uri=e,this._languageId=t,this._version=n,this._content=r,this._lineOffsets=void 0}get uri(){return this._uri}get languageId(){return this._languageId}get version(){return this._version}getText(e){if(e){let t=this.offsetAt(e.start),n=this.offsetAt(e.end);return this._content.substring(t,n)}return this._content}update(t,n){for(let n of t)if(e.isIncremental(n)){let e=Yg(n.range),t=this.offsetAt(e.start),r=this.offsetAt(e.end);this._content=this._content.substring(0,t)+n.text+this._content.substring(r,this._content.length);let i=Math.max(e.start.line,0),a=Math.max(e.end.line,0),o=this._lineOffsets,s=qg(n.text,!1,t);if(a-i===s.length)for(let e=0,t=s.length;e<t;e++)o[e+i+1]=s[e];else s.length<1e4?o.splice(i+1,a-i,...s):this._lineOffsets=o=o.slice(0,i+1).concat(s,o.slice(a+1));let c=n.text.length-(r-t);if(c!==0)for(let e=i+1+s.length,t=o.length;e<t;e++)o[e]=o[e]+c}else if(e.isFull(n))this._content=n.text,this._lineOffsets=void 0;else throw Error(`Unknown change event received`);this._version=n}getLineOffsets(){return this._lineOffsets===void 0&&(this._lineOffsets=qg(this._content,!0)),this._lineOffsets}positionAt(e){e=Math.max(Math.min(e,this._content.length),0);let t=this.getLineOffsets(),n=0,r=t.length;if(r===0)return{line:0,character:e};for(;n<r;){let i=Math.floor((n+r)/2);t[i]>e?r=i:n=i+1}let i=n-1;return e=this.ensureBeforeEOL(e,t[i]),{line:i,character:e-t[i]}}offsetAt(e){let t=this.getLineOffsets();if(e.line>=t.length)return this._content.length;if(e.line<0)return 0;let n=t[e.line];if(e.character<=0)return n;let r=e.line+1<t.length?t[e.line+1]:this._content.length,i=Math.min(n+e.character,r);return this.ensureBeforeEOL(i,n)}getLineRange(e){let t=this.getLineOffsets();if(e>=t.length){let e=t.length-1;return{start:{line:e,character:0},end:{line:e,character:this._content.length-t[e]}}}else if(e<0)return{start:{line:0,character:0},end:{line:0,character:0}};let n=t[e],r=e+1<t.length?t[e+1]:this._content.length,i=this.ensureBeforeEOL(r,n);return{start:{line:e,character:0},end:{line:e,character:i-n}}}getEOLCharacters(e){let t=this.getLineOffsets();if(e>=t.length||e<0)return``;let n=e+1<t.length?t[e+1]:this._content.length,r=this.ensureBeforeEOL(n,t[e]);return this._content.substring(r,n)}ensureBeforeEOL(e,t){for(;e>t&&Jg(this._content.charCodeAt(e-1));)e--;return e}get lineCount(){return this.getLineOffsets().length}static isIncremental(e){let t=e;return t!=null&&typeof t.text==`string`&&t.range!==void 0&&(t.rangeLength===void 0||typeof t.rangeLength==`number`)}static isFull(e){let t=e;return t!=null&&typeof t.text==`string`&&t.range===void 0&&t.rangeLength===void 0}},Gg;(function(e){function t(e,t,n,r){return new Wg(e,t,n,r)}e.create=t;function n(e,t,n){if(e instanceof Wg)return e.update(t,n),e;throw Error(`TextDocument.update: document must be created by TextDocument.create`)}e.update=n;function r(e,t){let n=e.getText(),r=Kg(t.map(Xg),(e,t)=>{let n=e.range.start.line-t.range.start.line;return n===0?e.range.start.character-t.range.start.character:n}),i=0,a=[];for(let t of r){let r=e.offsetAt(t.range.start);if(r<i)throw Error(`Overlapping edit`);r>i&&a.push(n.substring(i,r)),t.newText.length&&a.push(t.newText),i=e.offsetAt(t.range.end)}return a.push(n.substr(i)),a.join(``)}e.applyEdits=r})(Gg||={});function Kg(e,t){if(e.length<=1)return e;let n=e.length/2|0,r=e.slice(0,n),i=e.slice(n);Kg(r,t),Kg(i,t);let a=0,o=0,s=0;for(;a<r.length&&o<i.length;)t(r[a],i[o])<=0?e[s++]=r[a++]:e[s++]=i[o++];for(;a<r.length;)e[s++]=r[a++];for(;o<i.length;)e[s++]=i[o++];return e}function qg(e,t,n=0){let r=t?[n]:[];for(let t=0;t<e.length;t++){let i=e.charCodeAt(t);Jg(i)&&(i===13&&t+1<e.length&&e.charCodeAt(t+1)===10&&t++,r.push(n+t+1))}return r}function Jg(e){return e===13||e===10}function Yg(e){let t=e.start,n=e.end;return t.line>n.line||t.line===n.line&&t.character>n.character?{start:n,end:t}:e}function Xg(e){let t=Yg(e.range);return t===e.range?e:{newText:e.newText,range:t}}var Zg;(()=>{var e={975:e=>{function t(e){if(typeof e!=`string`)throw TypeError(`Path must be a string. Received `+JSON.stringify(e))}function n(e,t){for(var n,r=``,i=0,a=-1,o=0,s=0;s<=e.length;++s){if(s<e.length)n=e.charCodeAt(s);else{if(n===47)break;n=47}if(n===47){if(!(a===s-1||o===1))if(a!==s-1&&o===2){if(r.length<2||i!==2||r.charCodeAt(r.length-1)!==46||r.charCodeAt(r.length-2)!==46){if(r.length>2){var c=r.lastIndexOf(`/`);if(c!==r.length-1){c===-1?(r=``,i=0):i=(r=r.slice(0,c)).length-1-r.lastIndexOf(`/`),a=s,o=0;continue}}else if(r.length===2||r.length===1){r=``,i=0,a=s,o=0;continue}}t&&(r.length>0?r+=`/..`:r=`..`,i=2)}else r.length>0?r+=`/`+e.slice(a+1,s):r=e.slice(a+1,s),i=s-a-1;a=s,o=0}else n===46&&o!==-1?++o:o=-1}return r}var r={resolve:function(){for(var e,r=``,i=!1,a=arguments.length-1;a>=-1&&!i;a--){var o;a>=0?o=arguments[a]:(e===void 0&&(e=process.cwd()),o=e),t(o),o.length!==0&&(r=o+`/`+r,i=o.charCodeAt(0)===47)}return r=n(r,!i),i?r.length>0?`/`+r:`/`:r.length>0?r:`.`},normalize:function(e){if(t(e),e.length===0)return`.`;var r=e.charCodeAt(0)===47,i=e.charCodeAt(e.length-1)===47;return(e=n(e,!r)).length!==0||r||(e=`.`),e.length>0&&i&&(e+=`/`),r?`/`+e:e},isAbsolute:function(e){return t(e),e.length>0&&e.charCodeAt(0)===47},join:function(){if(arguments.length===0)return`.`;for(var e,n=0;n<arguments.length;++n){var i=arguments[n];t(i),i.length>0&&(e===void 0?e=i:e+=`/`+i)}return e===void 0?`.`:r.normalize(e)},relative:function(e,n){if(t(e),t(n),e===n||(e=r.resolve(e))===(n=r.resolve(n)))return``;for(var i=1;i<e.length&&e.charCodeAt(i)===47;++i);for(var a=e.length,o=a-i,s=1;s<n.length&&n.charCodeAt(s)===47;++s);for(var c=n.length-s,l=o<c?o:c,u=-1,d=0;d<=l;++d){if(d===l){if(c>l){if(n.charCodeAt(s+d)===47)return n.slice(s+d+1);if(d===0)return n.slice(s+d)}else o>l&&(e.charCodeAt(i+d)===47?u=d:d===0&&(u=0));break}var f=e.charCodeAt(i+d);if(f!==n.charCodeAt(s+d))break;f===47&&(u=d)}var p=``;for(d=i+u+1;d<=a;++d)d!==a&&e.charCodeAt(d)!==47||(p.length===0?p+=`..`:p+=`/..`);return p.length>0?p+n.slice(s+u):(s+=u,n.charCodeAt(s)===47&&++s,n.slice(s))},_makeLong:function(e){return e},dirname:function(e){if(t(e),e.length===0)return`.`;for(var n=e.charCodeAt(0),r=n===47,i=-1,a=!0,o=e.length-1;o>=1;--o)if((n=e.charCodeAt(o))===47){if(!a){i=o;break}}else a=!1;return i===-1?r?`/`:`.`:r&&i===1?`//`:e.slice(0,i)},basename:function(e,n){if(n!==void 0&&typeof n!=`string`)throw TypeError(`"ext" argument must be a string`);t(e);var r,i=0,a=-1,o=!0;if(n!==void 0&&n.length>0&&n.length<=e.length){if(n.length===e.length&&n===e)return``;var s=n.length-1,c=-1;for(r=e.length-1;r>=0;--r){var l=e.charCodeAt(r);if(l===47){if(!o){i=r+1;break}}else c===-1&&(o=!1,c=r+1),s>=0&&(l===n.charCodeAt(s)?--s==-1&&(a=r):(s=-1,a=c))}return i===a?a=c:a===-1&&(a=e.length),e.slice(i,a)}for(r=e.length-1;r>=0;--r)if(e.charCodeAt(r)===47){if(!o){i=r+1;break}}else a===-1&&(o=!1,a=r+1);return a===-1?``:e.slice(i,a)},extname:function(e){t(e);for(var n=-1,r=0,i=-1,a=!0,o=0,s=e.length-1;s>=0;--s){var c=e.charCodeAt(s);if(c!==47)i===-1&&(a=!1,i=s+1),c===46?n===-1?n=s:o!==1&&(o=1):n!==-1&&(o=-1);else if(!a){r=s+1;break}}return n===-1||i===-1||o===0||o===1&&n===i-1&&n===r+1?``:e.slice(n,i)},format:function(e){if(typeof e!=`object`||!e)throw TypeError(`The "pathObject" argument must be of type Object. Received type `+typeof e);return function(e,t){var n=t.dir||t.root,r=t.base||(t.name||``)+(t.ext||``);return n?n===t.root?n+r:n+`/`+r:r}(0,e)},parse:function(e){t(e);var n={root:``,dir:``,base:``,ext:``,name:``};if(e.length===0)return n;var r,i=e.charCodeAt(0),a=i===47;a?(n.root=`/`,r=1):r=0;for(var o=-1,s=0,c=-1,l=!0,u=e.length-1,d=0;u>=r;--u)if((i=e.charCodeAt(u))!==47)c===-1&&(l=!1,c=u+1),i===46?o===-1?o=u:d!==1&&(d=1):o!==-1&&(d=-1);else if(!l){s=u+1;break}return o===-1||c===-1||d===0||d===1&&o===c-1&&o===s+1?c!==-1&&(n.base=n.name=s===0&&a?e.slice(1,c):e.slice(s,c)):(s===0&&a?(n.name=e.slice(1,o),n.base=e.slice(1,c)):(n.name=e.slice(s,o),n.base=e.slice(s,c)),n.ext=e.slice(o,c)),s>0?n.dir=e.slice(0,s-1):a&&(n.dir=`/`),n},sep:`/`,delimiter:`:`,win32:null,posix:null};r.posix=r,e.exports=r}},t={};function n(r){var i=t[r];if(i!==void 0)return i.exports;var a=t[r]={exports:{}};return e[r](a,a.exports,n),a.exports}n.d=(e,t)=>{for(var r in t)n.o(t,r)&&!n.o(e,r)&&Object.defineProperty(e,r,{enumerable:!0,get:t[r]})},n.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),n.r=e=>{typeof Symbol<`u`&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:`Module`}),Object.defineProperty(e,"__esModule",{value:!0})};var r={};let i;n.r(r),n.d(r,{URI:()=>u,Utils:()=>S}),typeof process==`object`?i=process.platform===`win32`:typeof navigator==`object`&&(i=navigator.userAgent.indexOf(`Windows`)>=0);let a=/^\w[\w\d+.-]*$/,o=/^\//,s=/^\/\//;function c(e,t){if(!e.scheme&&t)throw Error(`[UriError]: Scheme is missing: {scheme: "", authority: "${e.authority}", path: "${e.path}", query: "${e.query}", fragment: "${e.fragment}"}`);if(e.scheme&&!a.test(e.scheme))throw Error(`[UriError]: Scheme contains illegal characters.`);if(e.path){if(e.authority){if(!o.test(e.path))throw Error(`[UriError]: If a URI contains an authority component, then the path component must either be empty or begin with a slash ("/") character`)}else if(s.test(e.path))throw Error(`[UriError]: If a URI does not contain an authority component, then the path cannot begin with two slash characters ("//")`)}}let l=/^(([^:/?#]+?):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;class u{static isUri(e){return e instanceof u||!!e&&typeof e.authority==`string`&&typeof e.fragment==`string`&&typeof e.path==`string`&&typeof e.query==`string`&&typeof e.scheme==`string`&&typeof e.fsPath==`string`&&typeof e.with==`function`&&typeof e.toString==`function`}scheme;authority;path;query;fragment;constructor(e,t,n,r,i,a=!1){typeof e==`object`?(this.scheme=e.scheme||``,this.authority=e.authority||``,this.path=e.path||``,this.query=e.query||``,this.fragment=e.fragment||``):(this.scheme=function(e,t){return e||t?e:`file`}(e,a),this.authority=t||``,this.path=function(e,t){switch(e){case`https`:case`http`:case`file`:t?t[0]!==`/`&&(t=`/`+t):t=`/`}return t}(this.scheme,n||``),this.query=r||``,this.fragment=i||``,c(this,a))}get fsPath(){return g(this,!1)}with(e){if(!e)return this;let{scheme:t,authority:n,path:r,query:i,fragment:a}=e;return t===void 0?t=this.scheme:t===null&&(t=``),n===void 0?n=this.authority:n===null&&(n=``),r===void 0?r=this.path:r===null&&(r=``),i===void 0?i=this.query:i===null&&(i=``),a===void 0?a=this.fragment:a===null&&(a=``),t===this.scheme&&n===this.authority&&r===this.path&&i===this.query&&a===this.fragment?this:new f(t,n,r,i,a)}static parse(e,t=!1){let n=l.exec(e);return n?new f(n[2]||``,ee(n[4]||``),ee(n[5]||``),ee(n[7]||``),ee(n[9]||``),t):new f(``,``,``,``,``)}static file(e){let t=``;if(i&&(e=e.replace(/\\/g,`/`)),e[0]===`/`&&e[1]===`/`){let n=e.indexOf(`/`,2);n===-1?(t=e.substring(2),e=`/`):(t=e.substring(2,n),e=e.substring(n)||`/`)}return new f(`file`,t,e,``,``)}static from(e){let t=new f(e.scheme,e.authority,e.path,e.query,e.fragment);return c(t,!0),t}toString(e=!1){return _(this,e)}toJSON(){return this}static revive(e){if(e){if(e instanceof u)return e;{let t=new f(e);return t._formatted=e.external,t._fsPath=e._sep===d?e.fsPath:null,t}}return e}}let d=i?1:void 0;class f extends u{_formatted=null;_fsPath=null;get fsPath(){return this._fsPath||=g(this,!1),this._fsPath}toString(e=!1){return e?_(this,!0):(this._formatted||=_(this,!1),this._formatted)}toJSON(){let e={$mid:1};return this._fsPath&&(e.fsPath=this._fsPath,e._sep=d),this._formatted&&(e.external=this._formatted),this.path&&(e.path=this.path),this.scheme&&(e.scheme=this.scheme),this.authority&&(e.authority=this.authority),this.query&&(e.query=this.query),this.fragment&&(e.fragment=this.fragment),e}}let p={58:`%3A`,47:`%2F`,63:`%3F`,35:`%23`,91:`%5B`,93:`%5D`,64:`%40`,33:`%21`,36:`%24`,38:`%26`,39:`%27`,40:`%28`,41:`%29`,42:`%2A`,43:`%2B`,44:`%2C`,59:`%3B`,61:`%3D`,32:`%20`};function m(e,t,n){let r,i=-1;for(let a=0;a<e.length;a++){let o=e.charCodeAt(a);if(o>=97&&o<=122||o>=65&&o<=90||o>=48&&o<=57||o===45||o===46||o===95||o===126||t&&o===47||n&&o===91||n&&o===93||n&&o===58)i!==-1&&(r+=encodeURIComponent(e.substring(i,a)),i=-1),r!==void 0&&(r+=e.charAt(a));else{r===void 0&&(r=e.substr(0,a));let t=p[o];t===void 0?i===-1&&(i=a):(i!==-1&&(r+=encodeURIComponent(e.substring(i,a)),i=-1),r+=t)}}return i!==-1&&(r+=encodeURIComponent(e.substring(i))),r===void 0?e:r}function h(e){let t;for(let n=0;n<e.length;n++){let r=e.charCodeAt(n);r===35||r===63?(t===void 0&&(t=e.substr(0,n)),t+=p[r]):t!==void 0&&(t+=e[n])}return t===void 0?e:t}function g(e,t){let n;return n=e.authority&&e.path.length>1&&e.scheme===`file`?`//${e.authority}${e.path}`:e.path.charCodeAt(0)===47&&(e.path.charCodeAt(1)>=65&&e.path.charCodeAt(1)<=90||e.path.charCodeAt(1)>=97&&e.path.charCodeAt(1)<=122)&&e.path.charCodeAt(2)===58?t?e.path.substr(1):e.path[1].toLowerCase()+e.path.substr(2):e.path,i&&(n=n.replace(/\//g,`\\`)),n}function _(e,t){let n=t?h:m,r=``,{scheme:i,authority:a,path:o,query:s,fragment:c}=e;if(i&&(r+=i,r+=`:`),(a||i===`file`)&&(r+=`/`,r+=`/`),a){let e=a.indexOf(`@`);if(e!==-1){let t=a.substr(0,e);a=a.substr(e+1),e=t.lastIndexOf(`:`),e===-1?r+=n(t,!1,!1):(r+=n(t.substr(0,e),!1,!1),r+=`:`,r+=n(t.substr(e+1),!1,!0)),r+=`@`}a=a.toLowerCase(),e=a.lastIndexOf(`:`),e===-1?r+=n(a,!1,!0):(r+=n(a.substr(0,e),!1,!0),r+=a.substr(e))}if(o){if(o.length>=3&&o.charCodeAt(0)===47&&o.charCodeAt(2)===58){let e=o.charCodeAt(1);e>=65&&e<=90&&(o=`/${String.fromCharCode(e+32)}:${o.substr(3)}`)}else if(o.length>=2&&o.charCodeAt(1)===58){let e=o.charCodeAt(0);e>=65&&e<=90&&(o=`${String.fromCharCode(e+32)}:${o.substr(2)}`)}r+=n(o,!0,!1)}return s&&(r+=`?`,r+=n(s,!1,!1)),c&&(r+=`#`,r+=t?c:m(c,!1,!1)),r}function v(e){try{return decodeURIComponent(e)}catch{return e.length>3?e.substr(0,3)+v(e.substr(3)):e}}let y=/(%[0-9A-Za-z][0-9A-Za-z])+/g;function ee(e){return e.match(y)?e.replace(y,(e=>v(e))):e}var b=n(975);let x=b.posix||b;var S;(function(e){e.joinPath=function(e,...t){return e.with({path:x.join(e.path,...t)})},e.resolvePath=function(e,...t){let n=e.path,r=!1;n[0]!==`/`&&(n=`/`+n,r=!0);let i=x.resolve(n,...t);return r&&i[0]===`/`&&!e.authority&&(i=i.substring(1)),e.with({path:i})},e.dirname=function(e){if(e.path.length===0||e.path===`/`)return e;let t=x.dirname(e.path);return t.length===1&&t.charCodeAt(0)===46&&(t=``),e.with({path:t})},e.basename=function(e){return x.basename(e.path)},e.extname=function(e){return x.extname(e.path)}})(S||={}),Zg=r})();var{URI:Qg,Utils:$g}=Zg,e_;(function(e){e.basename=$g.basename,e.dirname=$g.dirname,e.extname=$g.extname,e.joinPath=$g.joinPath,e.resolvePath=$g.resolvePath;let t=typeof process==`object`&&process?.platform===`win32`;function n(e,t){return e?.toString()===t?.toString()}e.equals=n;function r(e,n){let r=typeof e==`string`?Qg.parse(e).path:e.path,i=typeof n==`string`?Qg.parse(n).path:n.path,a=r.split(`/`).filter(e=>e.length>0),o=i.split(`/`).filter(e=>e.length>0);if(t){let e=/^[A-Z]:$/;if(a[0]&&e.test(a[0])&&(a[0]=a[0].toLowerCase()),o[0]&&e.test(o[0])&&(o[0]=o[0].toLowerCase()),a[0]!==o[0])return i.substring(1)}let s=0;for(;s<a.length&&a[s]===o[s];s++);return`../`.repeat(a.length-s)+o.slice(s).join(`/`)}e.relative=r;function i(e){return Qg.parse(e.toString()).toString()}e.normalize=i;function a(e,t){let n=typeof e==`string`?e:e.path,r=typeof t==`string`?t:t.path;return r.charAt(r.length-1)===`/`&&(r=r.slice(0,-1)),n.charAt(n.length-1)===`/`&&(n=n.slice(0,-1)),r===n?!0:r.length<n.length||r.charAt(n.length)!==`/`?!1:r.startsWith(n)}e.contains=a})(e_||={});var t_=class{constructor(){this.root={name:``,children:new Map}}normalizeUri(e){return e_.normalize(e)}clear(){this.root.children.clear()}insert(e,t){let n=this.getNode(this.normalizeUri(e),!0);n.element=t}delete(e){let t=this.getNode(this.normalizeUri(e),!1);t?.parent&&t.parent.children.delete(t.name)}has(e){return this.getNode(this.normalizeUri(e),!1)?.element!==void 0}hasNode(e){return this.getNode(this.normalizeUri(e),!1)!==void 0}find(e){return this.getNode(this.normalizeUri(e),!1)?.element}findNode(e){let t=this.normalizeUri(e),n=this.getNode(t,!1);if(n)return{name:n.name,uri:e_.joinPath(Qg.parse(t),n.name).toString(),element:n.element}}findChildren(e){let t=this.normalizeUri(e),n=this.getNode(t,!1);return n?Array.from(n.children.values()).map(e=>({name:e.name,uri:e_.joinPath(Qg.parse(t),e.name).toString(),element:e.element})):[]}all(){return this.collectValues(this.root)}findAll(e){let t=this.getNode(e_.normalize(e),!1);return t?this.collectValues(t):[]}getNode(e,t){let n=e.split(`/`);e.charAt(e.length-1)===`/`&&n.pop();let r=this.root;for(let e of n){let n=r.children.get(e);if(!n)if(t)n={name:e,children:new Map,parent:r},r.children.set(e,n);else return;r=n}return r}collectValues(e){let t=[];e.element&&t.push(e.element);for(let n of e.children.values())t.push(...this.collectValues(n));return t}},X;(function(e){e[e.Changed=0]=`Changed`,e[e.Parsed=1]=`Parsed`,e[e.IndexedContent=2]=`IndexedContent`,e[e.ComputedScopes=3]=`ComputedScopes`,e[e.Linked=4]=`Linked`,e[e.IndexedReferences=5]=`IndexedReferences`,e[e.Validated=6]=`Validated`})(X||={});var n_=class{constructor(e){this.serviceRegistry=e.ServiceRegistry,this.textDocuments=e.workspace.TextDocuments,this.fileSystemProvider=e.workspace.FileSystemProvider}async fromUri(e,t=Y.CancellationToken.None){let n=await this.fileSystemProvider.readFile(e);return this.createAsync(e,n,t)}fromTextDocument(e,t,n){return t??=Qg.parse(e.uri),Y.CancellationToken.is(n)?this.createAsync(t,e,n):this.create(t,e,n)}fromString(e,t,n){return Y.CancellationToken.is(n)?this.createAsync(t,e,n):this.create(t,e,n)}fromModel(e,t){return this.create(t,{$model:e})}create(e,t,n){if(typeof t==`string`){let r=this.parse(e,t,n);return this.createLangiumDocument(r,e,void 0,t)}else if(`$model`in t){let n={value:t.$model,parserErrors:[],lexerErrors:[]};return this.createLangiumDocument(n,e)}else{let r=this.parse(e,t.getText(),n);return this.createLangiumDocument(r,e,t)}}async createAsync(e,t,n){if(typeof t==`string`){let r=await this.parseAsync(e,t,n);return this.createLangiumDocument(r,e,void 0,t)}else{let r=await this.parseAsync(e,t.getText(),n);return this.createLangiumDocument(r,e,t)}}createLangiumDocument(e,t,n,r){let i;if(n)i={parseResult:e,uri:t,state:X.Parsed,references:[],textDocument:n};else{let n=this.createTextDocumentGetter(t,r);i={parseResult:e,uri:t,state:X.Parsed,references:[],get textDocument(){return n()}}}return e.value.$document=i,i}async update(e,t){let n=e.parseResult.value.$cstNode?.root.fullText,r=this.textDocuments?.get(e.uri.toString()),i=r?r.getText():await this.fileSystemProvider.readFile(e.uri);if(r)Object.defineProperty(e,"textDocument",{value:r});else{let t=this.createTextDocumentGetter(e.uri,i);Object.defineProperty(e,"textDocument",{get:t})}return n!==i&&(e.parseResult=await this.parseAsync(e.uri,i,t),e.parseResult.value.$document=e),e.state=X.Parsed,e}parse(e,t,n){return this.serviceRegistry.getServices(e).parser.LangiumParser.parse(t,n)}parseAsync(e,t,n){return this.serviceRegistry.getServices(e).parser.AsyncParser.parse(t,n)}createTextDocumentGetter(e,t){let n=this.serviceRegistry,r;return()=>r??=Gg.create(e.toString(),n.getServices(e).LanguageMetaData.languageId,0,t??``)}},r_=class{constructor(e){this.documentTrie=new t_,this.services=e,this.langiumDocumentFactory=e.workspace.LangiumDocumentFactory,this.documentBuilder=()=>e.workspace.DocumentBuilder}get all(){return S(this.documentTrie.all())}addDocument(e){let t=e.uri.toString();if(this.documentTrie.has(t))throw Error(`A document with the URI '${t}' is already present.`);this.documentTrie.insert(t,e)}getDocument(e){let t=e.toString();return this.documentTrie.find(t)}getDocuments(e){let t=e.toString();return this.documentTrie.findAll(t)}async getOrCreateDocument(e,t){let n=this.getDocument(e);return n||(n=await this.langiumDocumentFactory.fromUri(e,t),this.addDocument(n),n)}createDocument(e,t,n){if(n)return this.langiumDocumentFactory.fromString(t,e,n).then(e=>(this.addDocument(e),e));{let n=this.langiumDocumentFactory.fromString(t,e);return this.addDocument(n),n}}hasDocument(e){return this.documentTrie.has(e.toString())}invalidateDocument(e){let t=e.toString(),n=this.documentTrie.find(t);return n&&this.documentBuilder().resetToState(n,X.Changed),n}deleteDocument(e){let t=e.toString(),n=this.documentTrie.find(t);return n&&(n.state=X.Changed,this.documentTrie.delete(t)),n}deleteDocuments(e){let t=e.toString(),n=this.documentTrie.findAll(t);for(let e of n)e.state=X.Changed;return this.documentTrie.delete(t),n}},i_=Symbol(`RefResolving`),a_=class{constructor(e,t,n,r,i){this.resolver=e,this.node=t,this.property=n,this._ref=void 0,this.$refNode=r,this.$refText=i}get ref(){return this.resolver.resolveReference(this,this.node,this.property)}get $nodeDescription(){return this._nodeDescription}get error(){return p(this._ref)?this._ref:void 0}},o_=class{constructor(e,t,n,r,i){this.resolver=e,this.node=t,this.property=n,this._items=void 0,this.$refNode=r,this.$refText=i}get items(){return this.resolver.resolveMultiReference(this,this.node,this.property)}get error(){return this._linkingError}},s_=class{constructor(e){this.reflection=e.shared.AstReflection,this.langiumDocuments=()=>e.shared.workspace.LangiumDocuments,this.scopeProvider=e.references.ScopeProvider,this.astNodeLocator=e.workspace.AstNodeLocator,this.profiler=e.shared.profilers.LangiumProfiler,this.languageId=e.LanguageMetaData.languageId,this.referenceResolver={resolveReference:this.resolveReference.bind(this),resolveMultiReference:this.resolveMultiReference.bind(this)}}async link(e,t=Y.CancellationToken.None){if(this.profiler?.isActive(`linking`)){let n=this.profiler.createTask(`linking`,this.languageId);n.start();try{for(let r of A(e.parseResult.value))await Hg(t),ie(r).forEach(t=>{let i=`${r.$type}:${t.property}`;n.startSubTask(i);try{this.doLink(t,e)}finally{n.stopSubTask(i)}})}finally{n.stop()}}else for(let n of A(e.parseResult.value))await Hg(t),ie(n).forEach(t=>this.doLink(t,e))}doLink(e,t){let n=e.reference;if(`_ref`in n&&n._ref===void 0){n._ref=i_;try{let t=this.getCandidate(e);p(t)?n._ref=t:(n._nodeDescription=t,n._ref=this.loadAstNode(t)??this.createLinkingError(e,t))}catch(t){console.error(`An error occurred while resolving reference to '${n.$refText}':`,t);let r=t.message??String(t);n._ref={info:e,message:`An error occurred while resolving reference to '${n.$refText}': ${r}`}}t.references.push(n)}else if(`_items`in n&&n._items===void 0){n._items=i_;try{let t=this.getCandidates(e),r=[];if(p(t))n._linkingError=t;else for(let e of t){let t=this.loadAstNode(e);t&&r.push({ref:t,$nodeDescription:e})}n._items=r}catch(t){n._linkingError={info:e,message:`An error occurred while resolving reference to '${n.$refText}': ${t}`},n._items=[]}t.references.push(n)}}unlink(e){for(let t of e.references)`_ref`in t?(t._ref=void 0,delete t._nodeDescription):`_items`in t&&(t._items=void 0,delete t._linkingError);e.references=[]}getCandidate(e){return this.scopeProvider.getScope(e).getElement(e.reference.$refText)??this.createLinkingError(e)}getCandidates(e){let t=this.scopeProvider.getScope(e).getElements(e.reference.$refText).distinct(e=>`${e.documentUri}#${e.path}`).toArray();return t.length>0?t:this.createLinkingError(e)}buildReference(e,t,n,r){return new a_(this.referenceResolver,e,t,n,r)}buildMultiReference(e,t,n,r){return new o_(this.referenceResolver,e,t,n,r)}resolveReference(e,t,n){if(l(e._ref))return e._ref;if(f(e._nodeDescription))e._ref=this.loadAstNode(e._nodeDescription)??this.createLinkingError({reference:e,container:t,property:n},e._nodeDescription);else if(e._ref===void 0){e._ref=i_;let r=ne(t).$document,i=this.getLinkedNode({reference:e,container:t,property:n});if(i.error&&r&&r.state<X.ComputedScopes){e._ref=void 0;return}e._ref=i.node??i.error,e._nodeDescription=i.descr,r?.references.push(e)}else e._ref===i_&&this.throwCyclicReferenceError(t,n,e.$refText);return l(e._ref)?e._ref:void 0}resolveMultiReference(e,t,n){if(Array.isArray(e._items))return e._items;if(e._items===void 0){e._items=i_;let r=ne(t).$document,i=this.getCandidates({reference:e,container:t,property:n}),a=[];if(p(i))e._linkingError=i;else{for(let e of i){let t=this.loadAstNode(e);t&&a.push({ref:t,$nodeDescription:e})}a.length===0&&(e._linkingError=this.createLinkingError({reference:e,container:t,property:n}))}e._items=a,r?.references.push(e)}else e._items===i_&&this.throwCyclicReferenceError(t,n,e.$refText);return Array.isArray(e._items)?e._items:[]}throwCyclicReferenceError(e,t,n){throw Error(`Cyclic reference resolution detected: ${this.astNodeLocator.getAstNodePath(e)}/${t} (symbol '${n}')`)}getLinkedNode(e){try{let t=this.getCandidate(e);if(p(t))return{error:t};let n=this.loadAstNode(t);return n?{node:n,descr:t}:{descr:t,error:this.createLinkingError(e,t)}}catch(t){console.error(`An error occurred while resolving reference to '${e.reference.$refText}':`,t);let n=t.message??String(t);return{error:{info:e,message:`An error occurred while resolving reference to '${e.reference.$refText}': ${n}`}}}}loadAstNode(e){if(e.node)return e.node;let t=this.langiumDocuments().getDocument(e.documentUri);if(t)return this.astNodeLocator.getAstNode(t.parseResult.value,e.path)}createLinkingError(e,t){let n=ne(e.container).$document;return n&&n.state<X.ComputedScopes&&console.warn(`Attempted reference resolution before document reached ComputedScopes state (${n.uri}).`),{info:e,message:`Could not resolve reference to ${this.reflection.getReferenceType(e)} named '${e.reference.$refText}'.`,targetDescription:t}}};function c_(e){return typeof e.name==`string`}var l_=class{getName(e){if(c_(e))return e.name}getNameNode(e){return Dn(e.$cstNode,`name`)}},u_=class{constructor(e){this.nameProvider=e.references.NameProvider,this.index=e.shared.workspace.IndexManager,this.nodeLocator=e.workspace.AstNodeLocator,this.documents=e.shared.workspace.LangiumDocuments,this.hasMultiReference=A(e.Grammar).some(e=>we(e)&&e.isMulti)}findDeclarations(e){if(e){let t=jn(e),n=e.astNode;if(t&&n){let r=n[t.feature];if(u(r)||d(r))return D(r);if(Array.isArray(r)){for(let t of r)if((u(t)||d(t))&&t.$refNode&&t.$refNode.offset<=e.offset&&t.$refNode.end>=e.end)return D(t)}}if(n){let t=this.nameProvider.getNameNode(n);if(t&&(t===e||Ft(e,t)))return this.getSelfNodes(n)}}return[]}getSelfNodes(e){if(this.hasMultiReference){let t=this.index.findAllReferences(e,this.nodeLocator.getAstNodePath(e)),n=this.getNodeFromReferenceDescription(t.head());if(n){for(let t of ie(n))if(d(t.reference)&&t.reference.items.some(t=>t.ref===e))return t.reference.items.map(e=>e.ref)}return[e]}else return[e]}getNodeFromReferenceDescription(e){if(!e)return;let t=this.documents.getDocument(e.sourceUri);if(t)return this.nodeLocator.getAstNode(t.parseResult.value,e.sourcePath)}findDeclarationNodes(e){let t=this.findDeclarations(e),n=[];for(let e of t){let t=this.nameProvider.getNameNode(e)??e.$cstNode;t&&n.push(t)}return n}findReferences(e,t){let n=[];t.includeDeclaration&&n.push(...this.getSelfReferences(e));let r=this.index.findAllReferences(e,this.nodeLocator.getAstNodePath(e));return t.documentUri&&(r=r.filter(e=>e_.equals(e.sourceUri,t.documentUri))),n.push(...r),S(n)}getSelfReferences(e){let t=this.getSelfNodes(e),n=[];for(let e of t){let t=this.nameProvider.getNameNode(e);if(t){let r=E(e),i=this.nodeLocator.getAstNodePath(e);n.push({sourceUri:r.uri,sourcePath:i,targetUri:r.uri,targetPath:i,segment:Lt(t),local:!0})}}return n}},d_=class{constructor(e){if(this.map=new Map,e)for(let[t,n]of e)this.add(t,n)}get size(){return C.sum(S(this.map.values()).map(e=>e.length))}clear(){this.map.clear()}delete(e,t){if(t===void 0)return this.map.delete(e);{let n=this.map.get(e);if(n){let r=n.indexOf(t);if(r>=0)return n.length===1?this.map.delete(e):n.splice(r,1),!0}return!1}}get(e){return this.map.get(e)??[]}getStream(e){let t=this.map.get(e);return t?S(t):b}has(e,t){if(t===void 0)return this.map.has(e);{let n=this.map.get(e);return n?n.indexOf(t)>=0:!1}}add(e,t){return this.map.has(e)?this.map.get(e).push(t):this.map.set(e,[t]),this}addAll(e,t){return this.map.has(e)?this.map.get(e).push(...t):this.map.set(e,Array.from(t)),this}forEach(e){this.map.forEach((t,n)=>t.forEach(t=>e(t,n,this)))}[Symbol.iterator](){return this.entries().iterator()}entries(){return S(this.map.entries()).flatMap(([e,t])=>t.map(t=>[e,t]))}keys(){return S(this.map.keys())}values(){return S(this.map.values()).flat()}entriesGroupedByKey(){return S(this.map.entries())}},f_=class{get size(){return this.map.size}constructor(e){if(this.map=new Map,this.inverse=new Map,e)for(let[t,n]of e)this.set(t,n)}clear(){this.map.clear(),this.inverse.clear()}set(e,t){return this.map.set(e,t),this.inverse.set(t,e),this}get(e){return this.map.get(e)}getKey(e){return this.inverse.get(e)}delete(e){let t=this.map.get(e);return t===void 0?!1:(this.map.delete(e),this.inverse.delete(t),!0)}},p_=class{constructor(e){this.nameProvider=e.references.NameProvider,this.descriptions=e.workspace.AstNodeDescriptionProvider}async collectExportedSymbols(e,t=Y.CancellationToken.None){return this.collectExportedSymbolsForNode(e.parseResult.value,e,void 0,t)}async collectExportedSymbolsForNode(e,t,n=O,r=Y.CancellationToken.None){let i=[];this.addExportedSymbol(e,i,t);for(let a of n(e))await Hg(r),this.addExportedSymbol(a,i,t);return i}addExportedSymbol(e,t,n){let r=this.nameProvider.getName(e);r&&t.push(this.descriptions.createDescription(e,r,n))}async collectLocalSymbols(e,t=Y.CancellationToken.None){let n=e.parseResult.value,r=new d_;for(let i of k(n))await Hg(t),this.addLocalSymbol(i,e,r);return r}addLocalSymbol(e,t,n){let r=e.$container;if(r){let i=this.nameProvider.getName(e);i&&n.add(r,this.descriptions.createDescription(e,i,t))}}},m_=class{constructor(e,t,n){this.elements=e,this.outerScope=t,this.caseInsensitive=n?.caseInsensitive??!1,this.concatOuterScope=n?.concatOuterScope??!0}getAllElements(){return this.outerScope?this.elements.concat(this.outerScope.getAllElements()):this.elements}getElement(e){let t=this.caseInsensitive?e.toLowerCase():e,n=this.caseInsensitive?this.elements.find(e=>e.name.toLowerCase()===t):this.elements.find(t=>t.name===e);if(n)return n;if(this.outerScope)return this.outerScope.getElement(e)}getElements(e){let t=this.caseInsensitive?e.toLowerCase():e,n=this.caseInsensitive?this.elements.filter(e=>e.name.toLowerCase()===t):this.elements.filter(t=>t.name===e);return(this.concatOuterScope||n.isEmpty())&&this.outerScope?n.concat(this.outerScope.getElements(e)):n}},h_=class{constructor(e,t,n){this.elements=new Map,this.caseInsensitive=n?.caseInsensitive??!1,this.concatOuterScope=n?.concatOuterScope??!0;for(let t of e){let e=this.caseInsensitive?t.name.toLowerCase():t.name;this.elements.set(e,t)}this.outerScope=t}getElement(e){let t=this.caseInsensitive?e.toLowerCase():e,n=this.elements.get(t);if(n)return n;if(this.outerScope)return this.outerScope.getElement(e)}getElements(e){let t=this.caseInsensitive?e.toLowerCase():e,n=this.elements.get(t),r=n?[n]:[];return(this.concatOuterScope||r.length>0)&&this.outerScope?S(r).concat(this.outerScope.getElements(e)):S(r)}getAllElements(){let e=S(this.elements.values());return this.outerScope&&(e=e.concat(this.outerScope.getAllElements())),e}},g_=class{constructor(e,t,n){this.elements=new d_,this.caseInsensitive=n?.caseInsensitive??!1,this.concatOuterScope=n?.concatOuterScope??!0;for(let t of e){let e=this.caseInsensitive?t.name.toLowerCase():t.name;this.elements.add(e,t)}this.outerScope=t}getElement(e){let t=this.caseInsensitive?e.toLowerCase():e,n=this.elements.get(t)[0];if(n)return n;if(this.outerScope)return this.outerScope.getElement(e)}getElements(e){let t=this.caseInsensitive?e.toLowerCase():e,n=this.elements.get(t);return(this.concatOuterScope||n.length===0)&&this.outerScope?S(n).concat(this.outerScope.getElements(e)):S(n)}getAllElements(){let e=S(this.elements.values());return this.outerScope&&(e=e.concat(this.outerScope.getAllElements())),e}},__=class{constructor(){this.toDispose=[],this.isDisposed=!1}onDispose(e){this.toDispose.push(e)}dispose(){this.throwIfDisposed(),this.clear(),this.isDisposed=!0,this.toDispose.forEach(e=>e.dispose())}throwIfDisposed(){if(this.isDisposed)throw Error(`This cache has already been disposed`)}},v_=class extends __{constructor(){super(...arguments),this.cache=new Map}has(e){return this.throwIfDisposed(),this.cache.has(e)}set(e,t){this.throwIfDisposed(),this.cache.set(e,t)}get(e,t){if(this.throwIfDisposed(),this.cache.has(e))return this.cache.get(e);if(t){let n=t();return this.cache.set(e,n),n}else return}delete(e){return this.throwIfDisposed(),this.cache.delete(e)}clear(){this.throwIfDisposed(),this.cache.clear()}},y_=class extends __{constructor(e){super(),this.cache=new Map,this.converter=e??(e=>e)}has(e,t){return this.throwIfDisposed(),this.cacheForContext(e).has(t)}set(e,t,n){this.throwIfDisposed(),this.cacheForContext(e).set(t,n)}get(e,t,n){this.throwIfDisposed();let r=this.cacheForContext(e);if(r.has(t))return r.get(t);if(n){let e=n();return r.set(t,e),e}else return}delete(e,t){return this.throwIfDisposed(),this.cacheForContext(e).delete(t)}clear(e){if(this.throwIfDisposed(),e){let t=this.converter(e);this.cache.delete(t)}else this.cache.clear()}cacheForContext(e){let t=this.converter(e),n=this.cache.get(t);return n||(n=new Map,this.cache.set(t,n)),n}},b_=class extends v_{constructor(e,t){super(),t?(this.toDispose.push(e.workspace.DocumentBuilder.onBuildPhase(t,()=>{this.clear()})),this.toDispose.push(e.workspace.DocumentBuilder.onUpdate((e,t)=>{t.length>0&&this.clear()}))):this.toDispose.push(e.workspace.DocumentBuilder.onUpdate(()=>{this.clear()}))}},x_=class{constructor(e){this.reflection=e.shared.AstReflection,this.nameProvider=e.references.NameProvider,this.descriptions=e.workspace.AstNodeDescriptionProvider,this.indexManager=e.shared.workspace.IndexManager,this.globalScopeCache=new b_(e.shared)}getScope(e){let t=[],n=this.reflection.getReferenceType(e),r=E(e.container).localSymbols;if(r){let i=e.container;do r.has(i)&&t.push(r.getStream(i).filter(e=>this.reflection.isSubtype(e.type,n))),i=i.$container;while(i)}let i=this.getGlobalScope(n,e);for(let e=t.length-1;e>=0;e--)i=this.createScope(t[e],i);return i}createScope(e,t,n){return new m_(S(e),t,n)}createScopeForNodes(e,t,n){return new m_(S(e).map(e=>{let t=this.nameProvider.getName(e);if(t)return this.descriptions.createDescription(e,t)}).nonNullable(),t,n)}getGlobalScope(e,t){return this.globalScopeCache.get(e,()=>new g_(this.indexManager.allElements(e)))}};function S_(e){return typeof e.$comment==`string`}function C_(e){return typeof e==`object`&&!!e&&(`$ref`in e||`$refs`in e||`$error`in e)}var w_=class{constructor(e){this.ignoreProperties=new Set([`$container`,`$containerProperty`,`$containerIndex`,`$document`,`$cstNode`]),this.langiumDocuments=e.shared.workspace.LangiumDocuments,this.astNodeLocator=e.workspace.AstNodeLocator,this.nameProvider=e.references.NameProvider,this.commentProvider=e.documentation.CommentProvider}serialize(e,t){let n=t??{},r=t?.replacer,i=(e,t)=>this.replacer(e,t,n),a=r?(e,t)=>r(e,t,i):i;try{return this.currentDocument=E(e),JSON.stringify(e,a,t?.space)}finally{this.currentDocument=void 0}}deserialize(e,t){let n=t??{},r=JSON.parse(e);return this.linkNode(r,r,n),r}replacer(e,t,{refText:n,sourceText:r,textRegions:i,comments:a,uriConverter:o}){if(!this.ignoreProperties.has(e))if(u(t)){let e=t.ref,r=n?t.$refText:void 0;if(e){let t=E(e),n=``;this.currentDocument&&this.currentDocument!==t&&(n=o?o(t.uri,e):t.uri.toString());let i=this.astNodeLocator.getAstNodePath(e);return{$ref:`${n}#${i}`,$refText:r}}else return{$error:t.error?.message??`Could not resolve reference`,$refText:r}}else if(d(t)){let e=n?t.$refText:void 0,r=[];for(let e of t.items){let t=e.ref,n=E(e.ref),i=``;this.currentDocument&&this.currentDocument!==n&&(i=o?o(n.uri,t):n.uri.toString());let a=this.astNodeLocator.getAstNodePath(t);r.push(`${i}#${a}`)}return{$refs:r,$refText:e}}else if(l(t)){let n;if(i&&(n=this.addAstNodeRegionWithAssignmentsTo({...t}),(!e||t.$document)&&n?.$textRegion&&(n.$textRegion.documentURI=this.currentDocument?.uri.toString())),r&&!e&&(n??={...t},n.$sourceText=t.$cstNode?.text),a){n??={...t};let e=this.commentProvider.getComment(t);e&&(n.$comment=e.replace(/\r/g,``))}return n??t}else return t}addAstNodeRegionWithAssignmentsTo(e){let t=e=>({offset:e.offset,end:e.end,length:e.length,range:e.range});if(e.$cstNode){let n=e.$textRegion=t(e.$cstNode),r=n.assignments={};return Object.keys(e).filter(e=>!e.startsWith(`$`)).forEach(n=>{let i=En(e.$cstNode,n).map(t);i.length!==0&&(r[n]=i)}),e}}linkNode(e,t,n,r,i,a){for(let[r,i]of Object.entries(e))if(Array.isArray(i))for(let a=0;a<i.length;a++){let o=i[a];C_(o)?i[a]=this.reviveReference(e,r,t,o,n):l(o)&&this.linkNode(o,t,n,e,r,a)}else C_(i)?e[r]=this.reviveReference(e,r,t,i,n):l(i)&&this.linkNode(i,t,n,e,r);let o=e;o.$container=r,o.$containerProperty=i,o.$containerIndex=a}reviveReference(e,t,n,r,i){let a=r.$refText,o=r.$error,s;if(r.$ref){let e=this.getRefNode(n,r.$ref,i.uriConverter);if(l(e))return a||=this.nameProvider.getName(e),{$refText:a??``,ref:e};o=e}else if(r.$refs){let e=[];for(let t of r.$refs){let r=this.getRefNode(n,t,i.uriConverter);l(r)&&e.push({ref:r})}if(e.length===0)s={$refText:a??``,items:e},o??=`Could not resolve multi-reference`;else return{$refText:a??``,items:e}}if(o)return s??={$refText:a??``,ref:void 0},s.error={info:{container:e,property:t,reference:s},message:o},s}getRefNode(e,t,n){try{let r=t.indexOf(`#`);if(r===0)return this.astNodeLocator.getAstNode(e,t.substring(1))||`Could not resolve path: `+t;if(r<0){let e=n?n(t):Qg.parse(t),r=this.langiumDocuments.getDocument(e);return r?r.parseResult.value:`Could not find document for URI: `+t}let i=n?n(t.substring(0,r)):Qg.parse(t.substring(0,r)),a=this.langiumDocuments.getDocument(i);return a?r===t.length-1?a.parseResult.value:this.astNodeLocator.getAstNode(a.parseResult.value,t.substring(r+1))||`Could not resolve URI: `+t:`Could not find document for URI: `+t}catch(e){return String(e)}}},T_=class{get map(){return this.fileExtensionMap}constructor(e){this.languageIdMap=new Map,this.fileExtensionMap=new Map,this.fileNameMap=new Map,this.textDocuments=e?.workspace.TextDocuments}register(e){let t=e.LanguageMetaData;for(let n of t.fileExtensions)this.fileExtensionMap.has(n)&&console.warn(`The file extension ${n} is used by multiple languages. It is now assigned to '${t.languageId}'.`),this.fileExtensionMap.set(n,e);if(t.fileNames)for(let n of t.fileNames)this.fileNameMap.has(n)&&console.warn(`The file name ${n} is used by multiple languages. It is now assigned to '${t.languageId}'.`),this.fileNameMap.set(n,e);this.languageIdMap.set(t.languageId,e)}getServices(e){if(this.languageIdMap.size===0)throw Error("The service registry is empty. Use `register` to register the services of a language.");let t=this.textDocuments?.get(e)?.languageId;if(t!==void 0){let e=this.languageIdMap.get(t);if(e)return e}let n=e_.extname(e),r=e_.basename(e),i=this.fileNameMap.get(r)??this.fileExtensionMap.get(n);if(!i)throw Error(t?`The service registry contains no services for the extension '${n}' for language '${t}'.`:`The service registry contains no services for the extension '${n}'.`);return i}hasServices(e){try{return this.getServices(e),!0}catch{return!1}}get all(){return Array.from(this.languageIdMap.values())}};function E_(e){return{code:e}}var D_;(function(e){e.defaults=[`fast`,`slow`,`built-in`],e.all=e.defaults})(D_||={});var O_=class{constructor(e){this.entries=new d_,this.knownCategories=new Set(D_.defaults),this.entriesBefore=[],this.entriesAfter=[],this.reflection=e.shared.AstReflection}register(e,t=this,n=`fast`){if(n===`built-in`)throw Error(`The 'built-in' category is reserved for lexer, parser, and linker errors.`);this.knownCategories.add(n);for(let[r,i]of Object.entries(e)){let e=i;if(Array.isArray(e))for(let i of e){let e={check:this.wrapValidationException(i,t),category:n};this.addEntry(r,e)}else if(typeof e==`function`){let i={check:this.wrapValidationException(e,t),category:n};this.addEntry(r,i)}else Xt(e)}}wrapValidationException(e,t){return async(n,r,i)=>{await this.handleException(()=>e.call(t,n,r,i),`An error occurred during validation`,r,n)}}async handleException(e,t,n,r){try{await e()}catch(e){if(Vg(e))throw e;console.error(`${t}:`,e),e instanceof Error&&e.stack&&console.error(e.stack),n(`error`,`${t}: ${e instanceof Error?e.message:String(e)}`,{node:r})}}addEntry(e,t){if(e===`AstNode`){this.entries.add(`AstNode`,t);return}for(let n of this.reflection.getAllSubTypes(e))this.entries.add(n,t)}getChecks(e,t){let n=S(this.entries.get(e)).concat(this.entries.get(`AstNode`));return t&&(n=n.filter(e=>t.includes(e.category))),n.map(e=>e.check)}registerBeforeDocument(e,t=this){this.entriesBefore.push(this.wrapPreparationException(e,`An error occurred during set-up of the validation`,t))}registerAfterDocument(e,t=this){this.entriesAfter.push(this.wrapPreparationException(e,`An error occurred during tear-down of the validation`,t))}wrapPreparationException(e,t,n){return async(r,i,a,o)=>{await this.handleException(()=>e.call(n,r,i,a,o),t,i,r)}}get checksBefore(){return this.entriesBefore}get checksAfter(){return this.entriesAfter}getAllValidationCategories(e){return this.knownCategories}},k_=Object.freeze({validateNode:!0,validateChildren:!0}),A_=class{constructor(e){this.validationRegistry=e.validation.ValidationRegistry,this.metadata=e.LanguageMetaData,this.profiler=e.shared.profilers.LangiumProfiler,this.languageId=e.LanguageMetaData.languageId}async validateDocument(e,t={},n=Y.CancellationToken.None){let r=e.parseResult,i=[];if(await Hg(n),(!t.categories||t.categories.includes(`built-in`))&&(this.processLexingErrors(r,i,t),t.stopAfterLexingErrors&&i.some(e=>e.data?.code===P_.LexingError)||(this.processParsingErrors(r,i,t),t.stopAfterParsingErrors&&i.some(e=>e.data?.code===P_.ParsingError))||(this.processLinkingErrors(e,i,t),t.stopAfterLinkingErrors&&i.some(e=>e.data?.code===P_.LinkingError))))return i;try{i.push(...await this.validateAst(r.value,t,n))}catch(e){if(Vg(e))throw e;console.error(`An error occurred during validation:`,e)}return await Hg(n),i}processLexingErrors(e,t,n){let r=[...e.lexerErrors,...e.lexerReport?.diagnostics??[]];for(let e of r){let n=e.severity??`error`,r={severity:M_(n),range:{start:{line:e.line-1,character:e.column-1},end:{line:e.line-1,character:e.column+e.length-1}},message:e.message,data:N_(n),source:this.getSource()};t.push(r)}}processParsingErrors(e,t,n){for(let n of e.parserErrors){let e;if(isNaN(n.token.startOffset)){if(`previousToken`in n){let t=n.previousToken;if(isNaN(t.startOffset)){let t={line:0,character:0};e={start:t,end:t}}else{let n={line:t.endLine-1,character:t.endColumn};e={start:n,end:n}}}}else e=It(n.token);if(e){let r={severity:M_(`error`),range:e,message:n.message,data:E_(P_.ParsingError),source:this.getSource()};t.push(r)}}}processLinkingErrors(e,t,n){for(let n of e.references){let e=n.error;if(e){let r={node:e.info.container,range:n.$refNode?.range,property:e.info.property,index:e.info.index,data:{code:P_.LinkingError,containerType:e.info.container.$type,property:e.info.property,refText:e.info.reference.$refText}};t.push(this.toDiagnostic(`error`,e.message,r))}}}async validateAst(e,t,n=Y.CancellationToken.None){let r=[],i=(e,t,n)=>{r.push(this.toDiagnostic(e,t,n))};return await this.validateAstBefore(e,t,i,n),await this.validateAstNodes(e,t,i,n),await this.validateAstAfter(e,t,i,n),r}async validateAstBefore(e,t,n,r=Y.CancellationToken.None){let i=this.validationRegistry.checksBefore;for(let a of i)await Hg(r),await a(e,n,t.categories??[],r)}async validateAstNodes(e,t,n,r=Y.CancellationToken.None){if(this.profiler?.isActive(`validating`)){let i=this.profiler.createTask(`validating`,this.languageId);i.start();try{let a=A(e).iterator();for(let e of a){i.startSubTask(e.$type);let o=this.validateSingleNodeOptions(e,t);if(o.validateNode)try{let i=this.validationRegistry.getChecks(e.$type,t.categories);for(let t of i)await t(e,n,r)}finally{i.stopSubTask(e.$type)}o.validateChildren||a.prune()}}finally{i.stop()}}else{let i=A(e).iterator();for(let e of i){await Hg(r);let a=this.validateSingleNodeOptions(e,t);if(a.validateNode){let i=this.validationRegistry.getChecks(e.$type,t.categories);for(let t of i)await t(e,n,r)}a.validateChildren||i.prune()}}}validateSingleNodeOptions(e,t){return k_}async validateAstAfter(e,t,n,r=Y.CancellationToken.None){let i=this.validationRegistry.checksAfter;for(let a of i)await Hg(r),await a(e,n,t.categories??[],r)}toDiagnostic(e,t,n){return{message:t,range:j_(n),severity:M_(e),code:n.code,codeDescription:n.codeDescription,tags:n.tags,relatedInformation:n.relatedInformation,data:n.data,source:this.getSource()}}getSource(){return this.metadata.languageId}};function j_(e){if(e.range)return e.range;let t;return typeof e.property==`string`?t=Dn(e.node.$cstNode,e.property,e.index):typeof e.keyword==`string`&&(t=kn(e.node.$cstNode,e.keyword,e.index)),t??=e.node.$cstNode,t?t.range:{start:{line:0,character:0},end:{line:0,character:0}}}function M_(e){switch(e){case`error`:return 1;case`warning`:return 2;case`info`:return 3;case`hint`:return 4;default:throw Error(`Invalid diagnostic severity: `+e)}}function N_(e){switch(e){case`error`:return E_(P_.LexingError);case`warning`:return E_(P_.LexingWarning);case`info`:return E_(P_.LexingInfo);case`hint`:return E_(P_.LexingHint);default:throw Error(`Invalid diagnostic severity: `+e)}}var P_;(function(e){e.LexingError=`lexing-error`,e.LexingWarning=`lexing-warning`,e.LexingInfo=`lexing-info`,e.LexingHint=`lexing-hint`,e.ParsingError=`parsing-error`,e.LinkingError=`linking-error`})(P_||={});var F_=class{constructor(e){this.astNodeLocator=e.workspace.AstNodeLocator,this.nameProvider=e.references.NameProvider}createDescription(e,t,n){let r=n??E(e);t??=this.nameProvider.getName(e);let i=this.astNodeLocator.getAstNodePath(e);if(!t)throw Error(`Node at path ${i} has no name.`);let a,o=()=>a??=Lt(this.nameProvider.getNameNode(e)??e.$cstNode);return{node:e,name:t,get nameSegment(){return o()},selectionSegment:Lt(e.$cstNode),type:e.$type,documentUri:r.uri,path:i}}},I_=class{constructor(e){this.nodeLocator=e.workspace.AstNodeLocator}async createDescriptions(e,t=Y.CancellationToken.None){let n=[],r=e.parseResult.value;for(let e of A(r))await Hg(t),ie(e).forEach(e=>{e.reference.error||n.push(...this.createInfoDescriptions(e))});return n}createInfoDescriptions(e){let t=e.reference;if(t.error||!t.$refNode)return[];let n=[];u(t)&&t.$nodeDescription?n=[t.$nodeDescription]:d(t)&&(n=t.items.map(e=>e.$nodeDescription).filter(e=>e!==void 0));let r=E(e.container).uri,i=this.nodeLocator.getAstNodePath(e.container),a=[],o=Lt(t.$refNode);for(let e of n)a.push({sourceUri:r,sourcePath:i,targetUri:e.documentUri,targetPath:e.path,segment:o,local:e_.equals(e.documentUri,r)});return a}},L_=class{constructor(){this.segmentSeparator=`/`,this.indexSeparator=`@`}getAstNodePath(e){if(e.$container){let t=this.getAstNodePath(e.$container),n=this.getPathSegment(e);return t+this.segmentSeparator+n}return``}getPathSegment({$containerProperty:e,$containerIndex:t}){if(!e)throw Error(`Missing '$containerProperty' in AST node.`);return t===void 0?e:e+this.indexSeparator+t}getAstNode(e,t){return t.split(this.segmentSeparator).reduce((e,t)=>{if(!e||t.length===0)return e;let n=t.indexOf(this.indexSeparator);if(n>0){let r=t.substring(0,n),i=parseInt(t.substring(n+1));return e[r]?.[i]}return e[t]},e)}},R_=class{constructor(e){this._ready=new Ug,this.onConfigurationSectionUpdateEmitter=new Y.Emitter,this.settings={},this.workspaceConfig=!1,this.serviceRegistry=e.ServiceRegistry}get ready(){return this._ready.promise}initialize(e){this.workspaceConfig=e.capabilities.workspace?.configuration??!1}async initialized(e){if(this.workspaceConfig){if(e.register){let t=this.serviceRegistry.all;e.register({section:t.map(e=>this.toSectionName(e.LanguageMetaData.languageId))})}if(e.fetchConfiguration){let t=this.serviceRegistry.all.map(e=>({section:this.toSectionName(e.LanguageMetaData.languageId)})),n=await e.fetchConfiguration(t);t.forEach((e,t)=>{this.updateSectionConfiguration(e.section,n[t])})}}this._ready.resolve()}updateConfiguration(e){typeof e.settings!=`object`||e.settings===null||Object.entries(e.settings).forEach(([e,t])=>{this.updateSectionConfiguration(e,t),this.onConfigurationSectionUpdateEmitter.fire({section:e,configuration:t})})}updateSectionConfiguration(e,t){this.settings[e]=t}async getConfiguration(e,t){await this.ready;let n=this.toSectionName(e);if(this.settings[n])return this.settings[n][t]}toSectionName(e){return`${e}`}get onConfigurationSectionUpdate(){return this.onConfigurationSectionUpdateEmitter.event}},z_;(function(e){function t(e){return{dispose:async()=>await e()}}e.create=t})(z_||={});var B_=class{constructor(e){this.updateBuildOptions={validation:{categories:[`built-in`,`fast`]}},this.updateListeners=[],this.buildPhaseListeners=new d_,this.documentPhaseListeners=new d_,this.buildState=new Map,this.documentBuildWaiters=new Map,this.currentState=X.Changed,this.langiumDocuments=e.workspace.LangiumDocuments,this.langiumDocumentFactory=e.workspace.LangiumDocumentFactory,this.textDocuments=e.workspace.TextDocuments,this.indexManager=e.workspace.IndexManager,this.fileSystemProvider=e.workspace.FileSystemProvider,this.workspaceManager=()=>e.workspace.WorkspaceManager,this.serviceRegistry=e.ServiceRegistry}async build(e,t={},n=Y.CancellationToken.None){for(let n of e){let e=n.uri.toString();if(n.state===X.Validated){if(typeof t.validation==`boolean`&&t.validation)this.resetToState(n,X.IndexedReferences);else if(typeof t.validation==`object`){let r=this.findMissingValidationCategories(n,t);r.length>0&&(this.buildState.set(e,{completed:!1,options:{validation:{categories:r}},result:this.buildState.get(e)?.result}),n.state=X.IndexedReferences)}}else this.buildState.delete(e)}this.currentState=X.Changed,await this.emitUpdate(e.map(e=>e.uri),[]),await this.buildDocuments(e,t,n)}async update(e,t,n=Y.CancellationToken.None){this.currentState=X.Changed;let r=[];for(let e of t){let t=this.langiumDocuments.deleteDocuments(e);for(let e of t)r.push(e.uri),this.cleanUpDeleted(e)}let i=(await Promise.all(e.map(e=>this.findChangedUris(e)))).flat();for(let e of i){let t=this.langiumDocuments.getDocument(e);t===void 0&&(t=this.langiumDocumentFactory.fromModel({$type:`INVALID`},e),t.state=X.Changed,this.langiumDocuments.addDocument(t)),this.resetToState(t,X.Changed)}let a=S(i).concat(r).map(e=>e.toString()).toSet();this.langiumDocuments.all.filter(e=>!a.has(e.uri.toString())&&this.shouldRelink(e,a)).forEach(e=>this.resetToState(e,X.ComputedScopes)),await this.emitUpdate(i,r),await Hg(n);let o=this.sortDocuments(this.langiumDocuments.all.filter(e=>e.state<X.Validated||!this.buildState.get(e.uri.toString())?.completed||this.resultsAreIncomplete(e,this.updateBuildOptions)).toArray());await this.buildDocuments(o,this.updateBuildOptions,n)}resultsAreIncomplete(e,t){return this.findMissingValidationCategories(e,t).length>=1}findMissingValidationCategories(e,t){let n=this.buildState.get(e.uri.toString()),r=this.serviceRegistry.getServices(e.uri).validation.ValidationRegistry.getAllValidationCategories(e),i=n?.result?.validationChecks?new Set(n?.result?.validationChecks):n?.completed?r:new Set;return S(t===void 0||t.validation===!0?r:typeof t.validation==`object`?t.validation.categories??r:[]).filter(e=>!i.has(e)).toArray()}async findChangedUris(e){if(this.langiumDocuments.getDocument(e)??this.textDocuments?.get(e))return[e];try{let t=await this.fileSystemProvider.stat(e);if(t.isDirectory)return await this.workspaceManager().searchFolder(e);if(this.workspaceManager().shouldIncludeEntry(t))return[e]}catch{}return[]}async emitUpdate(e,t){await Promise.all(this.updateListeners.map(n=>n(e,t)))}sortDocuments(e){let t=0,n=e.length-1;for(;t<n;){for(;t<e.length&&this.hasTextDocument(e[t]);)t++;for(;n>=0&&!this.hasTextDocument(e[n]);)n--;t<n&&([e[t],e[n]]=[e[n],e[t]])}return e}hasTextDocument(e){return!!this.textDocuments?.get(e.uri)}shouldRelink(e,t){return e.references.some(e=>e.error!==void 0)?!0:this.indexManager.isAffected(e,t)}onUpdate(e){return this.updateListeners.push(e),z_.create(()=>{let t=this.updateListeners.indexOf(e);t>=0&&this.updateListeners.splice(t,1)})}resetToState(e,t){switch(t){case X.Changed:case X.Parsed:this.indexManager.removeContent(e.uri);case X.IndexedContent:e.localSymbols=void 0;case X.ComputedScopes:this.serviceRegistry.getServices(e.uri).references.Linker.unlink(e);case X.Linked:this.indexManager.removeReferences(e.uri);case X.IndexedReferences:e.diagnostics=void 0,this.buildState.delete(e.uri.toString());case X.Validated:}e.state>t&&(e.state=t)}cleanUpDeleted(e){this.buildState.delete(e.uri.toString()),this.indexManager.remove(e.uri),e.state=X.Changed}async buildDocuments(e,t,n){this.prepareBuild(e,t),await this.runCancelable(e,X.Parsed,n,e=>this.langiumDocumentFactory.update(e,n)),await this.runCancelable(e,X.IndexedContent,n,e=>this.indexManager.updateContent(e,n)),await this.runCancelable(e,X.ComputedScopes,n,async e=>{e.localSymbols=await this.serviceRegistry.getServices(e.uri).references.ScopeComputation.collectLocalSymbols(e,n)});let r=e.filter(e=>this.shouldLink(e));await this.runCancelable(r,X.Linked,n,e=>this.serviceRegistry.getServices(e.uri).references.Linker.link(e,n)),await this.runCancelable(r,X.IndexedReferences,n,e=>this.indexManager.updateReferences(e,n));let i=e.filter(e=>this.shouldValidate(e)?!0:(this.markAsCompleted(e),!1));await this.runCancelable(i,X.Validated,n,async e=>{await this.validate(e,n),this.markAsCompleted(e)})}markAsCompleted(e){let t=this.buildState.get(e.uri.toString());t&&(t.completed=!0)}prepareBuild(e,t){for(let n of e){let e=n.uri.toString(),r=this.buildState.get(e);(!r||r.completed)&&this.buildState.set(e,{completed:!1,options:t,result:r?.result})}}async runCancelable(e,t,n,r){for(let i of e)i.state<t&&(await Hg(n),await r(i),i.state=t,await this.notifyDocumentPhase(i,t,n));let i=e.filter(e=>e.state===t);await this.notifyBuildPhase(i,t,n),this.currentState=t}onBuildPhase(e,t){return this.buildPhaseListeners.add(e,t),z_.create(()=>{this.buildPhaseListeners.delete(e,t)})}onDocumentPhase(e,t){return this.documentPhaseListeners.add(e,t),z_.create(()=>{this.documentPhaseListeners.delete(e,t)})}waitUntil(e,t,n){let r;return t&&`path`in t?r=t:n=t,n??=Y.CancellationToken.None,r?this.awaitDocumentState(e,r,n):this.awaitBuilderState(e,n)}awaitDocumentState(e,t,n){let r=this.langiumDocuments.getDocument(t);return r?r.state>=e?Promise.resolve(t):n.isCancellationRequested?Promise.reject(Bg):this.currentState>=e&&e>r.state?Promise.reject(new Y.ResponseError(Y.LSPErrorCodes.RequestFailed,`Document state of ${t.toString()} is ${X[r.state]}, requiring ${X[e]}, but workspace state is already ${X[this.currentState]}. Returning undefined.`)):new Promise((r,i)=>{let a=this.onDocumentPhase(e,e=>{e_.equals(e.uri,t)&&(a.dispose(),o.dispose(),r(e.uri))}),o=n.onCancellationRequested(()=>{a.dispose(),o.dispose(),i(Bg)})}):Promise.reject(new Y.ResponseError(Y.LSPErrorCodes.ServerCancelled,`No document found for URI: ${t.toString()}`))}awaitBuilderState(e,t){return this.currentState>=e?Promise.resolve():t.isCancellationRequested?Promise.reject(Bg):new Promise((n,r)=>{let i=this.onBuildPhase(e,()=>{i.dispose(),a.dispose(),n()}),a=t.onCancellationRequested(()=>{i.dispose(),a.dispose(),r(Bg)})})}async notifyDocumentPhase(e,t,n){let r=this.documentPhaseListeners.get(t).slice();for(let t of r)try{await Hg(n),await t(e,n)}catch(e){if(!Vg(e))throw e}}async notifyBuildPhase(e,t,n){if(e.length===0)return;let r=this.buildPhaseListeners.get(t).slice();for(let t of r)await Hg(n),await t(e,n)}shouldLink(e){return this.getBuildOptions(e).eagerLinking??!0}shouldValidate(e){return!!this.getBuildOptions(e).validation}async validate(e,t){let n=this.serviceRegistry.getServices(e.uri).validation.DocumentValidator,r=this.getBuildOptions(e),i=typeof r.validation==`object`?{...r.validation}:{};i.categories=this.findMissingValidationCategories(e,r);let a=await n.validateDocument(e,i,t);e.diagnostics?e.diagnostics.push(...a):e.diagnostics=a;let o=this.buildState.get(e.uri.toString());o&&(o.result??={},o.result.validationChecks?o.result.validationChecks=S(o.result.validationChecks).concat(i.categories).distinct().toArray():o.result.validationChecks=[...i.categories])}getBuildOptions(e){return this.buildState.get(e.uri.toString())?.options??{}}},V_=class{constructor(e){this.symbolIndex=new Map,this.symbolByTypeIndex=new y_,this.referenceIndex=new Map,this.documents=e.workspace.LangiumDocuments,this.serviceRegistry=e.ServiceRegistry,this.astReflection=e.AstReflection}findAllReferences(e,t){let n=E(e).uri,r=[];return this.referenceIndex.forEach(e=>{e.forEach(e=>{e_.equals(e.targetUri,n)&&e.targetPath===t&&r.push(e)})}),S(r)}allElements(e,t){let n=S(this.symbolIndex.keys());return t&&(n=n.filter(e=>!t||t.has(e))),n.map(t=>this.getFileDescriptions(t,e)).flat()}getFileDescriptions(e,t){return t?this.symbolByTypeIndex.get(e,t,()=>(this.symbolIndex.get(e)??[]).filter(e=>this.astReflection.isSubtype(e.type,t))):this.symbolIndex.get(e)??[]}remove(e){this.removeContent(e),this.removeReferences(e)}removeContent(e){let t=e.toString();this.symbolIndex.delete(t),this.symbolByTypeIndex.clear(t)}removeReferences(e){let t=e.toString();this.referenceIndex.delete(t)}async updateContent(e,t=Y.CancellationToken.None){let n=await this.serviceRegistry.getServices(e.uri).references.ScopeComputation.collectExportedSymbols(e,t),r=e.uri.toString();this.symbolIndex.set(r,n),this.symbolByTypeIndex.clear(r)}async updateReferences(e,t=Y.CancellationToken.None){let n=await this.serviceRegistry.getServices(e.uri).workspace.ReferenceDescriptionProvider.createDescriptions(e,t);this.referenceIndex.set(e.uri.toString(),n)}isAffected(e,t){let n=this.referenceIndex.get(e.uri.toString());return n?n.some(e=>!e.local&&t.has(e.targetUri.toString())):!1}},H_=class{constructor(e){this.initialBuildOptions={},this._ready=new Ug,this.serviceRegistry=e.ServiceRegistry,this.langiumDocuments=e.workspace.LangiumDocuments,this.documentBuilder=e.workspace.DocumentBuilder,this.fileSystemProvider=e.workspace.FileSystemProvider,this.mutex=e.workspace.WorkspaceLock}get ready(){return this._ready.promise}get workspaceFolders(){return this.folders}initialize(e){this.folders=e.workspaceFolders??void 0}initialized(e){return this.mutex.write(e=>this.initializeWorkspace(this.folders??[],e))}async initializeWorkspace(e,t=Y.CancellationToken.None){let n=await this.performStartup(e);await Hg(t),await this.documentBuilder.build(n,this.initialBuildOptions,t)}async performStartup(e){let t=[],n=e=>{t.push(e),this.langiumDocuments.hasDocument(e.uri)||this.langiumDocuments.addDocument(e)};await this.loadAdditionalDocuments(e,n);let r=[];await Promise.all(e.map(e=>this.getRootFolder(e)).map(async e=>this.traverseFolder(e,r)));let i=S(r).distinct(e=>e.toString()).filter(e=>!this.langiumDocuments.hasDocument(e));return await this.loadWorkspaceDocuments(i,n),this._ready.resolve(),t}async loadWorkspaceDocuments(e,t){await Promise.all(e.map(async e=>{t(await this.langiumDocuments.getOrCreateDocument(e))}))}loadAdditionalDocuments(e,t){return Promise.resolve()}getRootFolder(e){return Qg.parse(e.uri)}async traverseFolder(e,t){try{let n=await this.fileSystemProvider.readDirectory(e);await Promise.all(n.map(async e=>{this.shouldIncludeEntry(e)&&(e.isDirectory?await this.traverseFolder(e.uri,t):e.isFile&&t.push(e.uri))}))}catch(t){console.error(`Failure to read directory content of `+e.toString(!0),t)}}async searchFolder(e){let t=[];return await this.traverseFolder(e,t),t}shouldIncludeEntry(e){let t=e_.basename(e.uri);return t.startsWith(`.`)?!1:e.isDirectory?t!==`node_modules`&&t!==`out`:e.isFile?this.serviceRegistry.hasServices(e.uri):!1}},U_=class{buildUnexpectedCharactersMessage(e,t,n,r,i){return Vi.buildUnexpectedCharactersMessage(e,t,n,r,i)}buildUnableToPopLexerModeMessage(e){return Vi.buildUnableToPopLexerModeMessage(e)}},W_={mode:`full`},G_=class{constructor(e){this.errorMessageProvider=e.parser.LexerErrorMessageProvider,this.tokenBuilder=e.parser.TokenBuilder;let t=this.tokenBuilder.buildTokens(e.Grammar,{caseInsensitive:e.LanguageMetaData.caseInsensitive});this.tokenTypes=this.toTokenTypeDictionary(t);let n=J_(t)?Object.values(t):t,r=e.LanguageMetaData.mode===`production`;this.chevrotainLexer=new Ui(n,{positionTracking:`full`,skipValidations:r,errorMessageProvider:this.errorMessageProvider})}get definition(){return this.tokenTypes}tokenize(e,t=W_){let n=this.chevrotainLexer.tokenize(e);return{tokens:n.tokens,errors:n.errors,hidden:n.groups.hidden??[],report:this.tokenBuilder.flushLexingReport?.(e)}}toTokenTypeDictionary(e){if(J_(e))return e;let t=q_(e)?Object.values(e.modes).flat():e,n={};return t.forEach(e=>n[e.name]=e),n}};function K_(e){return Array.isArray(e)&&(e.length===0||`name`in e[0])}function q_(e){return e&&`modes`in e&&`defaultMode`in e}function J_(e){return!K_(e)&&!q_(e)}sh();function Y_(e,t,n){let r,i;typeof e==`string`?(i=t,r=n):(i=e.range.start,r=t),i||=G.create(0,0);let a=Z_(e),o=pv(r);return ov({index:0,tokens:ev({lines:a,position:i,options:o}),position:i})}function X_(e,t){let n=pv(t),r=Z_(e);if(r.length===0)return!1;let i=r[0],a=r[r.length-1],o=n.start,s=n.end;return!!o?.exec(i)&&!!s?.exec(a)}function Z_(e){let t=``;return t=typeof e==`string`?e:e.text,t.split(dn)}var Q_=/\s*(@([\p{L}][\p{L}\p{N}]*)?)/uy,$_=/\{(@[\p{L}][\p{L}\p{N}]*)(\s*)([^\r\n}]+)?\}/gu;function ev(e){let t=[],n=e.position.line,r=e.position.character;for(let i=0;i<e.lines.length;i++){let a=i===0,o=i===e.lines.length-1,s=e.lines[i],c=0;if(a&&e.options.start){let t=e.options.start?.exec(s);t&&(c=t.index+t[0].length)}else{let t=e.options.line?.exec(s);t&&(c=t.index+t[0].length)}if(o){let t=e.options.end?.exec(s);t&&(s=s.substring(0,t.index))}if(s=s.substring(0,av(s)),iv(s,c)>=s.length){if(t.length>0){let e=G.create(n,r);t.push({type:`break`,content:``,range:K.create(e,e)})}}else{Q_.lastIndex=c;let e=Q_.exec(s);if(e){let i=e[0],a=e[1],o=G.create(n,r+c),l=G.create(n,r+c+i.length);t.push({type:`tag`,content:a,range:K.create(o,l)}),c+=i.length,c=iv(s,c)}if(c<s.length){let e=s.substring(c),i=Array.from(e.matchAll($_));t.push(...tv(i,e,n,r+c))}}n++,r=0}return t.length>0&&t[t.length-1].type===`break`?t.slice(0,-1):t}function tv(e,t,n,r){let i=[];if(e.length===0){let e=G.create(n,r),a=G.create(n,r+t.length);i.push({type:`text`,content:t,range:K.create(e,a)})}else{let a=0;for(let o of e){let e=o.index,s=t.substring(a,e);s.length>0&&i.push({type:`text`,content:t.substring(a,e),range:K.create(G.create(n,a+r),G.create(n,e+r))});let c=s.length+1,l=o[1];if(i.push({type:`inline-tag`,content:l,range:K.create(G.create(n,a+c+r),G.create(n,a+c+l.length+r))}),c+=l.length,o.length===4){c+=o[2].length;let e=o[3];i.push({type:`text`,content:e,range:K.create(G.create(n,a+c+r),G.create(n,a+c+e.length+r))})}else i.push({type:`text`,content:``,range:K.create(G.create(n,a+c+r),G.create(n,a+c+r))});a=e+o[0].length}let o=t.substring(a);o.length>0&&i.push({type:`text`,content:o,range:K.create(G.create(n,a+r),G.create(n,a+r+o.length))})}return i}var nv=/\S/,rv=/\s*$/;function iv(e,t){let n=e.substring(t).match(nv);return n?t+n.index:e.length}function av(e){let t=e.match(rv);if(t&&typeof t.index==`number`)return t.index}function ov(e){let t=G.create(e.position.line,e.position.character);if(e.tokens.length===0)return new hv([],K.create(t,t));let n=[];for(;e.index<e.tokens.length;){let t=sv(e,n[n.length-1]);t&&n.push(t)}let r=n[0]?.range.start??t,i=n[n.length-1]?.range.end??t;return new hv(n,K.create(r,i))}function sv(e,t){let n=e.tokens[e.index];if(n.type===`tag`)return dv(e,!1);if(n.type===`text`||n.type===`inline-tag`)return lv(e);cv(n,t),e.index++}function cv(e,t){if(t){let n=new bv(``,e.range);`inlines`in t?t.inlines.push(n):t.content.inlines.push(n)}}function lv(e){let t=e.tokens[e.index],n=t,r=t,i=[];for(;t&&t.type!==`break`&&t.type!==`tag`;)i.push(uv(e)),r=t,t=e.tokens[e.index];return new yv(i,K.create(n.range.start,r.range.end))}function uv(e){return e.tokens[e.index].type===`inline-tag`?dv(e,!0):fv(e)}function dv(e,t){let n=e.tokens[e.index++],r=n.content.substring(1);if(e.tokens[e.index]?.type===`text`)if(t){let i=fv(e);return new gv(r,new yv([i],i.range),t,K.create(n.range.start,i.range.end))}else{let i=lv(e);return new gv(r,i,t,K.create(n.range.start,i.range.end))}else{let e=n.range;return new gv(r,new yv([],e),t,e)}}function fv(e){let t=e.tokens[e.index++];return new bv(t.content,t.range)}function pv(e){if(!e)return pv({start:`/**`,end:`*/`,line:`*`});let{start:t,end:n,line:r}=e;return{start:mv(t,!0),end:mv(n,!1),line:mv(r,!0)}}function mv(e,t){if(typeof e==`string`||typeof e==`object`){let n=typeof e==`string`?_n(e):e.source;return RegExp(t?`^\\s*${n}`:`\\s*${n}\\s*$`)}else return e}var hv=class{constructor(e,t){this.elements=e,this.range=t}getTag(e){return this.getAllTags().find(t=>t.name===e)}getTags(e){return this.getAllTags().filter(t=>t.name===e)}getAllTags(){return this.elements.filter(e=>`name`in e)}toString(){let e=``;for(let t of this.elements)if(e.length===0)e=t.toString();else{let n=t.toString();e+=xv(e)+n}return e.trim()}toMarkdown(e){let t=``;for(let n of this.elements)if(t.length===0)t=n.toMarkdown(e);else{let r=n.toMarkdown(e);t+=xv(t)+r}return t.trim()}},gv=class{constructor(e,t,n,r){this.name=e,this.content=t,this.inline=n,this.range=r}toString(){let e=`@${this.name}`,t=this.content.toString();return this.content.inlines.length===1?e=`${e} ${t}`:this.content.inlines.length>1&&(e=`${e}\n${t}`),this.inline?`{${e}}`:e}toMarkdown(e){return e?.renderTag?.(this)??this.toMarkdownDefault(e)}toMarkdownDefault(e){let t=this.content.toMarkdown(e);if(this.inline){let n=_v(this.name,t,e??{});if(typeof n==`string`)return n}let n=``;e?.tag===`italic`||e?.tag===void 0?n=`*`:e?.tag===`bold`?n=`**`:e?.tag===`bold-italic`&&(n=`***`);let r=`${n}@${this.name}${n}`;return this.content.inlines.length===1?r=`${r} — ${t}`:this.content.inlines.length>1&&(r=`${r}\n${t}`),this.inline?`{${r}}`:r}};function _v(e,t,n){if(e===`linkplain`||e===`linkcode`||e===`link`){let r=t.indexOf(` `),i=t;if(r>0){let e=iv(t,r);i=t.substring(e),t=t.substring(0,r)}return(e===`linkcode`||e===`link`&&n.link===`code`)&&(i=`\`${i}\``),n.renderLink?.(t,i)??vv(t,i)}}function vv(e,t){try{return Qg.parse(e,!0),`[${t}](${e})`}catch{return e}}var yv=class{constructor(e,t){this.inlines=e,this.range=t}toString(){let e=``;for(let t=0;t<this.inlines.length;t++){let n=this.inlines[t],r=this.inlines[t+1];e+=n.toString(),r&&r.range.start.line>n.range.start.line&&(e+=`
`)}return e}toMarkdown(e){let t=``;for(let n=0;n<this.inlines.length;n++){let r=this.inlines[n],i=this.inlines[n+1];t+=r.toMarkdown(e),i&&i.range.start.line>r.range.start.line&&(t+=`
`)}return t}},bv=class{constructor(e,t){this.text=e,this.range=t}toString(){return this.text}toMarkdown(){return this.text}};function xv(e){return e.endsWith(`
`)?`
`:`

`}var Sv=class{constructor(e){this.indexManager=e.shared.workspace.IndexManager,this.commentProvider=e.documentation.CommentProvider}getDocumentation(e){let t=this.commentProvider.getComment(e);if(t&&X_(t))return Y_(t).toMarkdown({renderLink:(t,n)=>this.documentationLinkRenderer(e,t,n),renderTag:t=>this.documentationTagRenderer(e,t)})}documentationLinkRenderer(e,t,n){let r=this.findNameInLocalSymbols(e,t)??this.findNameInGlobalScope(e,t);if(r&&r.nameSegment){let e=r.nameSegment.range.start.line+1,t=r.nameSegment.range.start.character+1;return`[${n}](${r.documentUri.with({fragment:`L${e},${t}`}).toString()})`}else return}documentationTagRenderer(e,t){}findNameInLocalSymbols(e,t){let n=E(e).localSymbols;if(!n)return;let r=e;do{let e=n.getStream(r).find(e=>e.name===t);if(e)return e;r=r.$container}while(r)}findNameInGlobalScope(e,t){return this.indexManager.allElements().find(e=>e.name===t)}},Cv=class{constructor(e){this.grammarConfig=()=>e.parser.GrammarConfig}getComment(e){return S_(e)?e.$comment:Ut(e.$cstNode,this.grammarConfig().multilineCommentRules)?.text}},wv=class{constructor(e){this.syncParser=e.parser.LangiumParser}parse(e,t){return Promise.resolve(this.syncParser.parse(e))}},Tv=class{constructor(){this.previousTokenSource=new Y.CancellationTokenSource,this.writeQueue=[],this.readQueue=[],this.done=!0}write(e){this.cancelWrite();let t=zg();return this.previousTokenSource=t,this.enqueue(this.writeQueue,e,t.token)}read(e){return this.enqueue(this.readQueue,e)}enqueue(e,t,n=Y.CancellationToken.None){let r=new Ug,i={action:t,deferred:r,cancellationToken:n};return e.push(i),this.performNextOperation(),r.promise}async performNextOperation(){if(!this.done)return;let e=[];if(this.writeQueue.length>0)e.push(this.writeQueue.shift());else if(this.readQueue.length>0)e.push(...this.readQueue.splice(0,this.readQueue.length));else return;this.done=!1,await Promise.all(e.map(async({action:e,deferred:t,cancellationToken:n})=>{try{let r=await Promise.resolve().then(()=>e(n));t.resolve(r)}catch(e){Vg(e)?t.resolve(void 0):t.reject(e)}})),this.done=!0,this.performNextOperation()}cancelWrite(){this.previousTokenSource.cancel()}},Ev=class{constructor(e){this.grammarElementIdMap=new f_,this.tokenTypeIdMap=new f_,this.grammar=e.Grammar,this.lexer=e.parser.Lexer,this.linker=e.references.Linker}dehydrate(e){return{lexerErrors:e.lexerErrors,lexerReport:e.lexerReport?this.dehydrateLexerReport(e.lexerReport):void 0,parserErrors:e.parserErrors.map(e=>({...e,message:e.message})),value:this.dehydrateAstNode(e.value,this.createDehyrationContext(e.value))}}dehydrateLexerReport(e){return e}createDehyrationContext(e){let t=new Map,n=new Map;for(let n of A(e))t.set(n,{});if(e.$cstNode)for(let t of Nt(e.$cstNode))n.set(t,{});return{astNodes:t,cstNodes:n}}dehydrateAstNode(e,t){let n=t.astNodes.get(e);n.$type=e.$type,n.$containerIndex=e.$containerIndex,n.$containerProperty=e.$containerProperty,e.$cstNode!==void 0&&(n.$cstNode=this.dehydrateCstNode(e.$cstNode,t));for(let[r,i]of Object.entries(e))if(!r.startsWith(`$`))if(Array.isArray(i)){let e=[];n[r]=e;for(let n of i)l(n)?e.push(this.dehydrateAstNode(n,t)):u(n)?e.push(this.dehydrateReference(n,t)):e.push(n)}else l(i)?n[r]=this.dehydrateAstNode(i,t):u(i)?n[r]=this.dehydrateReference(i,t):i!==void 0&&(n[r]=i);return n}dehydrateReference(e,t){let n={};return n.$refText=e.$refText,e.$refNode&&(n.$refNode=t.cstNodes.get(e.$refNode)),n}dehydrateCstNode(e,t){let n=t.cstNodes.get(e);return _(e)?n.fullText=e.fullText:n.grammarSource=this.getGrammarElementId(e.grammarSource),n.hidden=e.hidden,n.astNode=t.astNodes.get(e.astNode),h(e)?n.content=e.content.map(e=>this.dehydrateCstNode(e,t)):g(e)&&(n.tokenType=e.tokenType.name,n.offset=e.offset,n.length=e.length,n.startLine=e.range.start.line,n.startColumn=e.range.start.character,n.endLine=e.range.end.line,n.endColumn=e.range.end.character),n}hydrate(e){let t=e.value,n=this.createHydrationContext(t);return`$cstNode`in t&&this.hydrateCstNode(t.$cstNode,n),{lexerErrors:e.lexerErrors,lexerReport:e.lexerReport,parserErrors:e.parserErrors,value:this.hydrateAstNode(t,n)}}createHydrationContext(e){let t=new Map,n=new Map;for(let n of A(e))t.set(n,{});let r;if(e.$cstNode)for(let t of Nt(e.$cstNode)){let e;`fullText`in t?(e=new ph(t.fullText),r=e):`content`in t?e=new dh:`tokenType`in t&&(e=this.hydrateCstLeafNode(t)),e&&(n.set(t,e),e.root=r)}return{astNodes:t,cstNodes:n}}hydrateAstNode(e,t){let n=t.astNodes.get(e);n.$type=e.$type,n.$containerIndex=e.$containerIndex,n.$containerProperty=e.$containerProperty,e.$cstNode&&(n.$cstNode=t.cstNodes.get(e.$cstNode));for(let[r,i]of Object.entries(e))if(!r.startsWith(`$`))if(Array.isArray(i)){let e=[];n[r]=e;for(let a of i)l(a)?e.push(this.setParent(this.hydrateAstNode(a,t),n)):u(a)?e.push(this.hydrateReference(a,n,r,t)):e.push(a)}else l(i)?n[r]=this.setParent(this.hydrateAstNode(i,t),n):u(i)?n[r]=this.hydrateReference(i,n,r,t):i!==void 0&&(n[r]=i);return n}setParent(e,t){return e.$container=t,e}hydrateReference(e,t,n,r){return this.linker.buildReference(t,n,r.cstNodes.get(e.$refNode),e.$refText)}hydrateCstNode(e,t,n=0){let r=t.cstNodes.get(e);if(typeof e.grammarSource==`number`&&(r.grammarSource=this.getGrammarElement(e.grammarSource)),r.astNode=t.astNodes.get(e.astNode),h(r))for(let i of e.content){let e=this.hydrateCstNode(i,t,n++);r.content.push(e)}return r}hydrateCstLeafNode(e){let t=this.getTokenType(e.tokenType),n=e.offset,r=e.length,i=e.startLine,a=e.startColumn,o=e.endLine,s=e.endColumn,c=e.hidden;return new uh(n,r,{start:{line:i,character:a},end:{line:o,character:s}},t,c)}getTokenType(e){return this.lexer.definition[e]}getGrammarElementId(e){if(e)return this.grammarElementIdMap.size===0&&this.createGrammarElementIdMap(),this.grammarElementIdMap.get(e)}getGrammarElement(e){return this.grammarElementIdMap.size===0&&this.createGrammarElementIdMap(),this.grammarElementIdMap.getKey(e)}createGrammarElementIdMap(){let e=0;for(let t of A(this.grammar))oe(t)&&this.grammarElementIdMap.set(t,e++)}};function Dv(e){return{documentation:{CommentProvider:e=>new Cv(e),DocumentationProvider:e=>new Sv(e)},parser:{AsyncParser:e=>new wv(e),GrammarConfig:e=>Qn(e),LangiumParser:e=>Gh(e),CompletionParser:e=>Wh(e),ValueConverter:()=>new Jh,TokenBuilder:()=>new qh,Lexer:e=>new G_(e),ParserErrorMessageProvider:()=>new xh,LexerErrorMessageProvider:()=>new U_},workspace:{AstNodeLocator:()=>new L_,AstNodeDescriptionProvider:e=>new F_(e),ReferenceDescriptionProvider:e=>new I_(e)},references:{Linker:e=>new s_(e),NameProvider:()=>new l_,ScopeProvider:e=>new x_(e),ScopeComputation:e=>new p_(e),References:e=>new u_(e)},serializer:{Hydrator:e=>new Ev(e),JsonSerializer:e=>new w_(e)},validation:{DocumentValidator:e=>new A_(e),ValidationRegistry:e=>new O_(e)},shared:()=>e.shared}}function Ov(e){return{ServiceRegistry:e=>new T_(e),workspace:{LangiumDocuments:e=>new r_(e),LangiumDocumentFactory:e=>new n_(e),DocumentBuilder:e=>new B_(e),IndexManager:e=>new V_(e),WorkspaceManager:e=>new H_(e),FileSystemProvider:t=>e.fileSystemProvider(t),WorkspaceLock:()=>new Tv,ConfigurationProvider:e=>new R_(e)},profilers:{}}}var kv;(function(e){e.merge=(e,t)=>Iv(Iv({},e),t)})(kv||={});function Av(e,t,n,r,i,a,o,s,c){return Nv([e,t,n,r,i,a,o,s,c].reduce(Iv,{}))}var jv=Symbol(`isProxy`);function Mv(e){if(e&&e[jv])for(let t of Object.values(e))Mv(t);return e}function Nv(e,t){let n=new Proxy({},{deleteProperty:()=>!1,set:()=>{throw Error(`Cannot set property on injected service container`)},get:(r,i)=>i===jv||Fv(r,i,e,t||n),getOwnPropertyDescriptor:(r,i)=>(Fv(r,i,e,t||n),Object.getOwnPropertyDescriptor(r,i)),has:(t,n)=>n in e,ownKeys:()=>[...Object.getOwnPropertyNames(e)]});return n}var Pv=Symbol();function Fv(e,t,n,r){if(t in e){if(e[t]instanceof Error)throw Error(`Construction failure. Please make sure that your dependencies are constructable. Cause: `+e[t]);if(e[t]===Pv)throw Error(`Cycle detected. Please make "`+String(t)+`" lazy. Visit https://langium.org/docs/reference/configuration-services/#resolving-cyclic-dependencies`);return e[t]}else if(t in n){let i=n[t];e[t]=Pv;try{e[t]=typeof i==`function`?i(r):Nv(i,r)}catch(n){throw e[t]=n instanceof Error?n:void 0,n}return e[t]}else return}function Iv(e,t){if(t){for(let[n,r]of Object.entries(t))if(!(n===`__proto__`||n===`constructor`||n===`prototype`)&&r!=null)if(typeof r==`object`){let t=e[n];typeof t==`object`&&t?e[n]=Iv(t,r):e[n]=Iv({},r)}else e[n]=r}return e}var Lv=class{stat(e){throw Error(`No file system is available.`)}statSync(e){throw Error(`No file system is available.`)}async exists(){return!1}existsSync(){return!1}readBinary(){throw Error(`No file system is available.`)}readBinarySync(){throw Error(`No file system is available.`)}readFile(){throw Error(`No file system is available.`)}readFileSync(){throw Error(`No file system is available.`)}async readDirectory(){return[]}readDirectorySync(){return[]}},Rv={fileSystemProvider:()=>new Lv},zv={Grammar:()=>void 0,LanguageMetaData:()=>({caseInsensitive:!1,fileExtensions:[`.langium`],languageId:`langium`})},Bv={AstReflection:()=>new jt};function Vv(){let e=Av(Ov(Rv),Bv),t=Av(Dv({shared:e}),zv);return e.ServiceRegistry.register(t),t}function Hv(e){let t=Vv(),n=t.serializer.JsonSerializer.deserialize(e);return t.shared.workspace.LangiumDocumentFactory.fromModel(n,Qg.parse(`memory:/${n.name??`grammar`}.langium`)),n}var Uv,Wv=()=>Uv??=Hv(`{
  "$type": "Grammar",
  "isDeclared": true,
  "name": "Wadi",
  "rules": [
    {
      "$type": "ParserRule",
      "entry": true,
      "name": "Model",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "imports",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@1"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "assets",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@2"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "vars",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@3"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "points",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@4"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "grids",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@5"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "configurators",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@8"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "layers",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@30"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "components",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@31"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "house"
              },
              {
                "$type": "Assignment",
                "feature": "name",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@78"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Keyword",
                "value": "{"
              },
              {
                "$type": "Alternatives",
                "elements": [
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Keyword",
                        "value": "convention"
                      },
                      {
                        "$type": "Assignment",
                        "feature": "convention",
                        "operator": "=",
                        "terminal": {
                          "$type": "Alternatives",
                          "elements": [
                            {
                              "$type": "Keyword",
                              "value": "center"
                            },
                            {
                              "$type": "Keyword",
                              "value": "outer"
                            }
                          ]
                        }
                      }
                    ]
                  },
                  {
                    "$type": "Assignment",
                    "feature": "units",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@27"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Assignment",
                    "feature": "site",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@28"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Assignment",
                    "feature": "defaults",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@29"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Assignment",
                    "feature": "template",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@7"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Assignment",
                    "feature": "imports",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@1"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Assignment",
                    "feature": "assets",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@2"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Assignment",
                    "feature": "vars",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@3"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Assignment",
                    "feature": "points",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@4"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Assignment",
                    "feature": "grids",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@5"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Assignment",
                    "feature": "configurators",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@8"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Assignment",
                    "feature": "layers",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@30"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Assignment",
                    "feature": "components",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@31"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Assignment",
                    "feature": "floors",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@33"
                      },
                      "arguments": []
                    }
                  }
                ],
                "cardinality": "*"
              },
              {
                "$type": "Keyword",
                "value": "}"
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Import",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "import"
          },
          {
            "$type": "Assignment",
            "feature": "ref",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "as"
              },
              {
                "$type": "Assignment",
                "feature": "ns",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@78"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "AssetDecl",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "asset"
          },
          {
            "$type": "Assignment",
            "feature": "id",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "src"
          },
          {
            "$type": "Assignment",
            "feature": "src",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "dims"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "dx",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@79"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "dy",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@79"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "dz",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@79"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "name"
              },
              {
                "$type": "Assignment",
                "feature": "assetName",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "category"
              },
              {
                "$type": "Assignment",
                "feature": "category",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Var",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "var"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@78"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "="
          },
          {
            "$type": "Assignment",
            "feature": "value",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Point",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "point"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@78"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "{"
          },
          {
            "$type": "Keyword",
            "value": "x"
          },
          {
            "$type": "Keyword",
            "value": "="
          },
          {
            "$type": "Assignment",
            "feature": "x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ",",
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "y"
          },
          {
            "$type": "Keyword",
            "value": "="
          },
          {
            "$type": "Assignment",
            "feature": "y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "}"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Grid",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Keyword",
                "value": "guides"
              },
              {
                "$type": "Keyword",
                "value": "grid"
              }
            ]
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@78"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "{"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "x"
                  },
                  {
                    "$type": "Keyword",
                    "value": ":"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "xlines",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@6"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Keyword",
                        "value": ","
                      },
                      {
                        "$type": "Assignment",
                        "feature": "xlines",
                        "operator": "+=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@6"
                          },
                          "arguments": []
                        }
                      }
                    ],
                    "cardinality": "*"
                  },
                  {
                    "$type": "Keyword",
                    "value": "y"
                  },
                  {
                    "$type": "Keyword",
                    "value": ":"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "ylines",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@6"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Keyword",
                        "value": ","
                      },
                      {
                        "$type": "Assignment",
                        "feature": "ylines",
                        "operator": "+=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@6"
                          },
                          "arguments": []
                        }
                      }
                    ],
                    "cardinality": "*"
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Keyword",
                        "value": "origin"
                      },
                      {
                        "$type": "Keyword",
                        "value": "("
                      },
                      {
                        "$type": "Assignment",
                        "feature": "origin_x",
                        "operator": "=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@17"
                          },
                          "arguments": []
                        }
                      },
                      {
                        "$type": "Keyword",
                        "value": ","
                      },
                      {
                        "$type": "Assignment",
                        "feature": "origin_y",
                        "operator": "=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@17"
                          },
                          "arguments": []
                        }
                      },
                      {
                        "$type": "Keyword",
                        "value": ")"
                      }
                    ],
                    "cardinality": "?"
                  },
                  {
                    "$type": "Keyword",
                    "value": "spacing"
                  },
                  {
                    "$type": "Keyword",
                    "value": "("
                  },
                  {
                    "$type": "Assignment",
                    "feature": "spacing_x",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ","
                  },
                  {
                    "$type": "Assignment",
                    "feature": "spacing_y",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ")"
                  },
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Keyword",
                        "value": "extent"
                      },
                      {
                        "$type": "Keyword",
                        "value": "("
                      },
                      {
                        "$type": "Assignment",
                        "feature": "extent_x",
                        "operator": "=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@79"
                          },
                          "arguments": []
                        }
                      },
                      {
                        "$type": "Keyword",
                        "value": ","
                      },
                      {
                        "$type": "Assignment",
                        "feature": "extent_y",
                        "operator": "=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@79"
                          },
                          "arguments": []
                        }
                      },
                      {
                        "$type": "Keyword",
                        "value": ")"
                      }
                    ],
                    "cardinality": "?"
                  }
                ]
              }
            ]
          },
          {
            "$type": "Keyword",
            "value": "}"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "GridLine",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "Alternatives",
              "elements": [
                {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@78"
                  },
                  "arguments": []
                },
                {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@79"
                  },
                  "arguments": []
                }
              ]
            }
          },
          {
            "$type": "Keyword",
            "value": "@"
          },
          {
            "$type": "Assignment",
            "feature": "at",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "thick"
              },
              {
                "$type": "Assignment",
                "feature": "thickness",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@17"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "role"
              },
              {
                "$type": "Assignment",
                "feature": "role",
                "operator": "=",
                "terminal": {
                  "$type": "Alternatives",
                  "elements": [
                    {
                      "$type": "Keyword",
                      "value": "structural"
                    },
                    {
                      "$type": "Keyword",
                      "value": "planning"
                    }
                  ]
                }
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "TemplateMeta",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "template"
          },
          {
            "$type": "Keyword",
            "value": "{"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "title"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "title",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@80"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "description"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "description",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@80"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "style"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "style",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@80"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "roof"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "roof",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@80"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "tags"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "tags",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@80"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Keyword",
                        "value": ","
                      },
                      {
                        "$type": "Assignment",
                        "feature": "tags",
                        "operator": "+=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@80"
                          },
                          "arguments": []
                        }
                      }
                    ],
                    "cardinality": "*"
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "thumbnails"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "thumbs",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@80"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Keyword",
                        "value": ","
                      },
                      {
                        "$type": "Assignment",
                        "feature": "thumbs",
                        "operator": "+=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@80"
                          },
                          "arguments": []
                        }
                      }
                    ],
                    "cardinality": "*"
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "min_plot"
                  },
                  {
                    "$type": "Keyword",
                    "value": "("
                  },
                  {
                    "$type": "Assignment",
                    "feature": "minW",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@79"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ","
                  },
                  {
                    "$type": "Assignment",
                    "feature": "minL",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@79"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ")"
                  }
                ]
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "}"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Configurator",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "configurator"
          },
          {
            "$type": "Keyword",
            "value": "{"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "title"
              },
              {
                "$type": "Assignment",
                "feature": "title",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "note"
              },
              {
                "$type": "Assignment",
                "feature": "description",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Assignment",
            "feature": "items",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@9"
              },
              "arguments": []
            },
            "cardinality": "+"
          },
          {
            "$type": "Keyword",
            "value": "}"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "ConfigItem",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@10"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@11"
            },
            "arguments": []
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "ConfigGroup",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "group"
          },
          {
            "$type": "Assignment",
            "feature": "label",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "note"
              },
              {
                "$type": "Assignment",
                "feature": "description",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "{"
          },
          {
            "$type": "Assignment",
            "feature": "inputs",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@11"
              },
              "arguments": []
            },
            "cardinality": "+"
          },
          {
            "$type": "Keyword",
            "value": "}"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "ConfigInput",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@12"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@13"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@14"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@15"
            },
            "arguments": []
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "SliderInput",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "slider"
          },
          {
            "$type": "Assignment",
            "feature": "target",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@78"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "label",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "unit",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@78"
              },
              "arguments": []
            },
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "["
          },
          {
            "$type": "Assignment",
            "feature": "min",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@79"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ".."
          },
          {
            "$type": "Assignment",
            "feature": "max",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@79"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "step"
              },
              {
                "$type": "Assignment",
                "feature": "step",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@79"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "]"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "note"
              },
              {
                "$type": "Assignment",
                "feature": "description",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "NumberInput",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "number"
          },
          {
            "$type": "Assignment",
            "feature": "target",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@78"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "label",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "unit",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@78"
              },
              "arguments": []
            },
            "cardinality": "?"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "note"
              },
              {
                "$type": "Assignment",
                "feature": "description",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "ToggleInput",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "toggle"
          },
          {
            "$type": "Assignment",
            "feature": "target",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@78"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "label",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "note"
              },
              {
                "$type": "Assignment",
                "feature": "description",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "SelectInput",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "select"
          },
          {
            "$type": "Assignment",
            "feature": "target",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@78"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "label",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "{"
          },
          {
            "$type": "Assignment",
            "feature": "options",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@16"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": ","
              },
              {
                "$type": "Assignment",
                "feature": "options",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@16"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "}"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "note"
              },
              {
                "$type": "Assignment",
                "feature": "description",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "SelectOption",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "label",
            "operator": "=",
            "terminal": {
              "$type": "Alternatives",
              "elements": [
                {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@78"
                  },
                  "arguments": []
                },
                {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              ]
            }
          },
          {
            "$type": "Keyword",
            "value": "="
          },
          {
            "$type": "Assignment",
            "feature": "value",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@79"
              },
              "arguments": []
            }
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Expr",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expr"
      },
      "definition": {
        "$type": "RuleCall",
        "rule": {
          "$ref": "#/rules@18"
        },
        "arguments": []
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Addition",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expr"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@19"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "Binary"
                },
                "feature": "left",
                "operator": "="
              },
              {
                "$type": "Assignment",
                "feature": "op",
                "operator": "=",
                "terminal": {
                  "$type": "Alternatives",
                  "elements": [
                    {
                      "$type": "Keyword",
                      "value": "+"
                    },
                    {
                      "$type": "Keyword",
                      "value": "-"
                    }
                  ]
                }
              },
              {
                "$type": "Assignment",
                "feature": "right",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@19"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Multiplication",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expr"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@20"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "Binary"
                },
                "feature": "left",
                "operator": "="
              },
              {
                "$type": "Assignment",
                "feature": "op",
                "operator": "=",
                "terminal": {
                  "$type": "Alternatives",
                  "elements": [
                    {
                      "$type": "Keyword",
                      "value": "*"
                    },
                    {
                      "$type": "Keyword",
                      "value": "/"
                    }
                  ]
                }
              },
              {
                "$type": "Assignment",
                "feature": "right",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@20"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Primary",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expr"
      },
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "Neg"
                }
              },
              {
                "$type": "Keyword",
                "value": "-"
              },
              {
                "$type": "Assignment",
                "feature": "operand",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@20"
                  },
                  "arguments": []
                }
              }
            ]
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "("
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@17"
                },
                "arguments": []
              },
              {
                "$type": "Keyword",
                "value": ")"
              }
            ]
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "Num"
                }
              },
              {
                "$type": "Assignment",
                "feature": "value",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@79"
                  },
                  "arguments": []
                }
              }
            ]
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@21"
            },
            "arguments": []
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "RefOrCall",
      "inferredType": {
        "$type": "InferredType",
        "name": "Expr"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Action",
            "inferredType": {
              "$type": "InferredType",
              "name": "Ref"
            }
          },
          {
            "$type": "Assignment",
            "feature": "parts",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@78"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "."
              },
              {
                "$type": "Assignment",
                "feature": "parts",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@22"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "Call"
                },
                "feature": "callee",
                "operator": "="
              },
              {
                "$type": "Keyword",
                "value": "("
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Assignment",
                    "feature": "args",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Keyword",
                        "value": ","
                      },
                      {
                        "$type": "Assignment",
                        "feature": "args",
                        "operator": "+=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@17"
                          },
                          "arguments": []
                        }
                      }
                    ],
                    "cardinality": "*"
                  }
                ],
                "cardinality": "?"
              },
              {
                "$type": "Keyword",
                "value": ")"
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "RefPart",
      "dataType": "string",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@78"
            },
            "arguments": []
          },
          {
            "$type": "Keyword",
            "value": "x"
          },
          {
            "$type": "Keyword",
            "value": "y"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Raw",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "raw"
          },
          {
            "$type": "Assignment",
            "feature": "type",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "body",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@24"
              },
              "arguments": []
            }
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "JsonObject",
      "inferredType": {
        "$type": "InferredType",
        "name": "JsonObject"
      },
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "{"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "members",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@25"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": ","
                  },
                  {
                    "$type": "Assignment",
                    "feature": "members",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@25"
                      },
                      "arguments": []
                    }
                  }
                ],
                "cardinality": "*"
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "}"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "JsonMember",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "key",
            "operator": "=",
            "terminal": {
              "$type": "Alternatives",
              "elements": [
                {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                },
                {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@78"
                  },
                  "arguments": []
                }
              ]
            }
          },
          {
            "$type": "Keyword",
            "value": ":"
          },
          {
            "$type": "Assignment",
            "feature": "value",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@26"
              },
              "arguments": []
            }
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "JsonValue",
      "inferredType": {
        "$type": "InferredType",
        "name": "JsonValue"
      },
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@24"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "JsonArray"
                }
              },
              {
                "$type": "Keyword",
                "value": "["
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Assignment",
                    "feature": "items",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@26"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Keyword",
                        "value": ","
                      },
                      {
                        "$type": "Assignment",
                        "feature": "items",
                        "operator": "+=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@26"
                          },
                          "arguments": []
                        }
                      }
                    ],
                    "cardinality": "*"
                  }
                ],
                "cardinality": "?"
              },
              {
                "$type": "Keyword",
                "value": "]"
              }
            ]
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "JsonNum"
                }
              },
              {
                "$type": "Assignment",
                "feature": "neg",
                "operator": "?=",
                "terminal": {
                  "$type": "Keyword",
                  "value": "-"
                },
                "cardinality": "?"
              },
              {
                "$type": "Assignment",
                "feature": "num",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@79"
                  },
                  "arguments": []
                }
              }
            ]
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "JsonStr"
                }
              },
              {
                "$type": "Assignment",
                "feature": "str",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ]
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "JsonBool"
                }
              },
              {
                "$type": "Assignment",
                "feature": "bool",
                "operator": "=",
                "terminal": {
                  "$type": "Alternatives",
                  "elements": [
                    {
                      "$type": "Keyword",
                      "value": "true"
                    },
                    {
                      "$type": "Keyword",
                      "value": "false"
                    }
                  ]
                }
              }
            ]
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "JsonNull"
                }
              },
              {
                "$type": "Keyword",
                "value": "null"
              }
            ]
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Units",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "units"
          },
          {
            "$type": "Assignment",
            "feature": "system",
            "operator": "=",
            "terminal": {
              "$type": "Alternatives",
              "elements": [
                {
                  "$type": "Keyword",
                  "value": "feet_inches"
                },
                {
                  "$type": "Keyword",
                  "value": "feet"
                },
                {
                  "$type": "Keyword",
                  "value": "meters"
                },
                {
                  "$type": "Keyword",
                  "value": "centimeters"
                },
                {
                  "$type": "Keyword",
                  "value": "millimeters"
                }
              ]
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "per_unit"
              },
              {
                "$type": "Assignment",
                "feature": "per_unit",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@79"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Site",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "site"
          },
          {
            "$type": "Keyword",
            "value": "{"
          },
          {
            "$type": "Keyword",
            "value": "plot"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "plot_width",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "plot_length",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "ref"
              },
              {
                "$type": "Keyword",
                "value": "("
              },
              {
                "$type": "Assignment",
                "feature": "ref_x",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@79"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Keyword",
                "value": ","
              },
              {
                "$type": "Assignment",
                "feature": "ref_y",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@79"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Keyword",
                "value": ")"
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "}"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Defaults",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "defaults"
          },
          {
            "$type": "Keyword",
            "value": "{"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "floor_height"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "floor_height",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@79"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "wall_height"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "wall_height",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@79"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "slab_thickness"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "slab_thickness",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@79"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "wall_thickness"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "wall_thickness",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@79"
                      },
                      "arguments": []
                    }
                  }
                ]
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "}"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "LayerDecl",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "layer"
          },
          {
            "$type": "Assignment",
            "feature": "id",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "label",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "color"
              },
              {
                "$type": "Assignment",
                "feature": "color",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "group"
              },
              {
                "$type": "Assignment",
                "feature": "group",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "ComponentDef",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "component"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@78"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "goal"
              },
              {
                "$type": "Assignment",
                "feature": "goal",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "expose"
              },
              {
                "$type": "Keyword",
                "value": "as"
              },
              {
                "$type": "Assignment",
                "feature": "exposeType",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@70"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Alternatives",
                "elements": [
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Keyword",
                        "value": "layer"
                      },
                      {
                        "$type": "Assignment",
                        "feature": "exposeLayer",
                        "operator": "=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@80"
                          },
                          "arguments": []
                        }
                      }
                    ]
                  },
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Keyword",
                        "value": "label"
                      },
                      {
                        "$type": "Assignment",
                        "feature": "exposeLabel",
                        "operator": "=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@80"
                          },
                          "arguments": []
                        }
                      }
                    ]
                  }
                ],
                "cardinality": "*"
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "{"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "params",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@32"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "vars",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@3"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "points",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@4"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "objects",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@34"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "}"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "ComponentParam",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "param"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@78"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "="
              },
              {
                "$type": "Assignment",
                "feature": "default",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@79"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "label"
              },
              {
                "$type": "Assignment",
                "feature": "label",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "kind"
              },
              {
                "$type": "Assignment",
                "feature": "kind",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@78"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "unit"
              },
              {
                "$type": "Assignment",
                "feature": "unit",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Floor",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "floor"
          },
          {
            "$type": "Assignment",
            "feature": "number",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@79"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "height"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "height",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@79"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "wall_height"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "wall_height",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@79"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "slab_thickness"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "slab_thickness",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@79"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "enabled"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "enabled",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "{"
          },
          {
            "$type": "Assignment",
            "feature": "objects",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@34"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "}"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "FloorObject",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@48"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@53"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@54"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@55"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@56"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@57"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@58"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@59"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@60"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@61"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@63"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@35"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@68"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@71"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@23"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@42"
            },
            "arguments": []
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "GlbModel",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "model"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "name"
              },
              {
                "$type": "Assignment",
                "feature": "name",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "assetRef",
                "operator": "=",
                "terminal": {
                  "$type": "CrossReference",
                  "type": {
                    "$ref": "#/rules@2"
                  },
                  "terminal": {
                    "$type": "RuleCall",
                    "rule": {
                      "$ref": "#/rules@65"
                    },
                    "arguments": []
                  },
                  "deprecatedSyntax": false,
                  "isMulti": false
                }
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "asset"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "asset",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@66"
                      },
                      "arguments": []
                    }
                  }
                ]
              }
            ]
          },
          {
            "$type": "Keyword",
            "value": "at"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "rotation"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "rotation",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "scale"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "scale",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@46"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "{"
              },
              {
                "$type": "Assignment",
                "feature": "rig",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@36"
                  },
                  "arguments": []
                },
                "cardinality": "*"
              },
              {
                "$type": "Keyword",
                "value": "}"
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "RigOp",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@37"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@38"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@39"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@40"
            },
            "arguments": []
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "RigVec3",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "op",
            "operator": "=",
            "terminal": {
              "$type": "Alternatives",
              "elements": [
                {
                  "$type": "Keyword",
                  "value": "translate"
                },
                {
                  "$type": "Keyword",
                  "value": "rotate"
                },
                {
                  "$type": "Keyword",
                  "value": "scale"
                }
              ]
            }
          },
          {
            "$type": "Assignment",
            "feature": "node",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "z",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "RigVisible",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "visible"
          },
          {
            "$type": "Assignment",
            "feature": "node",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "value",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "RigMaterial",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "material"
          },
          {
            "$type": "Assignment",
            "feature": "node",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "color"
          },
          {
            "$type": "Assignment",
            "feature": "color",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "RigArray",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "array"
          },
          {
            "$type": "Assignment",
            "feature": "node",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "count"
          },
          {
            "$type": "Assignment",
            "feature": "count",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "step"
              },
              {
                "$type": "Keyword",
                "value": "{"
              },
              {
                "$type": "Assignment",
                "feature": "steps",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@41"
                  },
                  "arguments": []
                },
                "cardinality": "*"
              },
              {
                "$type": "Keyword",
                "value": "}"
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "RigStep",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "op",
            "operator": "=",
            "terminal": {
              "$type": "Alternatives",
              "elements": [
                {
                  "$type": "Keyword",
                  "value": "translate"
                },
                {
                  "$type": "Keyword",
                  "value": "rotate"
                },
                {
                  "$type": "Keyword",
                  "value": "scale"
                },
                {
                  "$type": "Keyword",
                  "value": "about"
                }
              ]
            }
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "z",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "ObjectDecl",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "type",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@70"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@47"
              },
              "arguments": []
            },
            "cardinality": "?"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "("
              },
              {
                "$type": "Assignment",
                "feature": "args",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@45"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": ","
                  },
                  {
                    "$type": "Assignment",
                    "feature": "args",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@45"
                      },
                      "arguments": []
                    }
                  }
                ],
                "cardinality": "*"
              },
              {
                "$type": "Keyword",
                "value": ")"
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "{"
              },
              {
                "$type": "Assignment",
                "feature": "fields",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@43"
                  },
                  "arguments": []
                },
                "cardinality": "*"
              },
              {
                "$type": "Keyword",
                "value": "}"
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@46"
            },
            "arguments": [],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "FieldAssign",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "key",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@44"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "value",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@45"
              },
              "arguments": []
            }
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "FieldKey",
      "dataType": "string",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@78"
            },
            "arguments": []
          },
          {
            "$type": "Keyword",
            "value": "x"
          },
          {
            "$type": "Keyword",
            "value": "y"
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@80"
            },
            "arguments": []
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Value",
      "inferredType": {
        "$type": "InferredType",
        "name": "Value"
      },
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Action",
                "inferredType": {
                  "$type": "InferredType",
                  "name": "StrVal"
                }
              },
              {
                "$type": "Assignment",
                "feature": "str",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ]
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@17"
            },
            "arguments": []
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "fragment": true,
      "name": "CommonFields",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "z_offset"
              },
              {
                "$type": "Assignment",
                "feature": "z_offset",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@17"
                  },
                  "arguments": []
                }
              }
            ]
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "enabled"
              },
              {
                "$type": "Assignment",
                "feature": "enabled",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@17"
                  },
                  "arguments": []
                }
              }
            ]
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "layer"
              },
              {
                "$type": "Assignment",
                "feature": "layer",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ]
          }
        ]
      },
      "entry": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "NameRef",
      "dataType": "string",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@78"
            },
            "arguments": []
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@80"
            },
            "arguments": []
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Room",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "room"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@47"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "at"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Keyword",
            "value": "size"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "w",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "l",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "height"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "height",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "material"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "material",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@80"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@46"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "{"
              },
              {
                "$type": "Alternatives",
                "elements": [
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Keyword",
                        "value": "connect"
                      },
                      {
                        "$type": "Assignment",
                        "feature": "connections",
                        "operator": "+=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@47"
                          },
                          "arguments": []
                        }
                      },
                      {
                        "$type": "Assignment",
                        "feature": "connections",
                        "operator": "+=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@47"
                          },
                          "arguments": []
                        },
                        "cardinality": "*"
                      }
                    ]
                  },
                  {
                    "$type": "Assignment",
                    "feature": "walls",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@49"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Assignment",
                    "feature": "items",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@64"
                      },
                      "arguments": []
                    }
                  }
                ],
                "cardinality": "*"
              },
              {
                "$type": "Keyword",
                "value": "}"
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "RoomWall",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "wall"
          },
          {
            "$type": "Assignment",
            "feature": "sides",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@52"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "sides",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@52"
              },
              "arguments": []
            },
            "cardinality": "*"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "height"
              },
              {
                "$type": "Assignment",
                "feature": "height",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@17"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "height_end"
              },
              {
                "$type": "Assignment",
                "feature": "height_end",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@17"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "{"
              },
              {
                "$type": "Assignment",
                "feature": "openings",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@50"
                  },
                  "arguments": []
                },
                "cardinality": "*"
              },
              {
                "$type": "Keyword",
                "value": "}"
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Opening",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "kind",
            "operator": "=",
            "terminal": {
              "$type": "Alternatives",
              "elements": [
                {
                  "$type": "Keyword",
                  "value": "door"
                },
                {
                  "$type": "Keyword",
                  "value": "window"
                }
              ]
            }
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@47"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "at"
          },
          {
            "$type": "Assignment",
            "feature": "offset",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "from"
              },
              {
                "$type": "Assignment",
                "feature": "anchor",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@51"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "size"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "width",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "height",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "sill"
              },
              {
                "$type": "Assignment",
                "feature": "sill",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@17"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Assignment",
            "feature": "open",
            "operator": "?=",
            "terminal": {
              "$type": "Keyword",
              "value": "open"
            },
            "cardinality": "?"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "direction"
              },
              {
                "$type": "Assignment",
                "feature": "direction",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@52"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "OpeningAnchor",
      "dataType": "string",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Keyword",
            "value": "start"
          },
          {
            "$type": "Keyword",
            "value": "center"
          },
          {
            "$type": "Keyword",
            "value": "end"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Side",
      "dataType": "string",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Keyword",
            "value": "north"
          },
          {
            "$type": "Keyword",
            "value": "south"
          },
          {
            "$type": "Keyword",
            "value": "east"
          },
          {
            "$type": "Keyword",
            "value": "west"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Wall",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "wall"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@47"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "from"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "start_x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "start_y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Keyword",
            "value": "to"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "end_x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "end_y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "height"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "height",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "height_end"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "height_end",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "facing"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "facing",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@52"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "material"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "material",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@80"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@46"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "{"
              },
              {
                "$type": "Assignment",
                "feature": "openings",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@50"
                  },
                  "arguments": []
                },
                "cardinality": "*"
              },
              {
                "$type": "Keyword",
                "value": "}"
              }
            ],
            "cardinality": "?"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Pillar",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "pillar"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@47"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "at"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Keyword",
            "value": "size"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "w_auto",
                "operator": "?=",
                "terminal": {
                  "$type": "Keyword",
                  "value": "auto"
                }
              },
              {
                "$type": "Assignment",
                "feature": "w",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@17"
                  },
                  "arguments": []
                }
              }
            ]
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "l_auto",
                "operator": "?=",
                "terminal": {
                  "$type": "Keyword",
                  "value": "auto"
                }
              },
              {
                "$type": "Assignment",
                "feature": "l",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@17"
                  },
                  "arguments": []
                }
              }
            ]
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "height"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "height",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@46"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Beam",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "beam"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "name"
              },
              {
                "$type": "Assignment",
                "feature": "name",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "at"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Keyword",
            "value": "size"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "w",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "l",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "height"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "height",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@46"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "FloorSlab",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "slab"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "name"
              },
              {
                "$type": "Assignment",
                "feature": "name",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "at"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Keyword",
            "value": "size"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "w",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "l",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "thickness"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "thickness",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@46"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Plinth",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "plinth"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "name"
              },
              {
                "$type": "Assignment",
                "feature": "name",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "at"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Keyword",
            "value": "size"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "w",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "l",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Keyword",
            "value": "height"
          },
          {
            "$type": "Assignment",
            "feature": "height",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "material"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "material",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@80"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@46"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Ground",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "ground"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "name"
              },
              {
                "$type": "Assignment",
                "feature": "name",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "at"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Keyword",
            "value": "size"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "w",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "l",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "height"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "height",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "material"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "material",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@80"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@46"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Staircase",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "staircase"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "name"
              },
              {
                "$type": "Assignment",
                "feature": "name",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "at"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "start_x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "start_y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "box"
              },
              {
                "$type": "Keyword",
                "value": "("
              },
              {
                "$type": "Assignment",
                "feature": "box_width",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@17"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Keyword",
                "value": ","
              },
              {
                "$type": "Assignment",
                "feature": "box_length",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@17"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Keyword",
                "value": ")"
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "step"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "step_rise",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "step_tread",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": ","
              },
              {
                "$type": "Assignment",
                "feature": "step_width",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@17"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Keyword",
            "value": "direction"
          },
          {
            "$type": "Assignment",
            "feature": "direction",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@52"
              },
              "arguments": []
            }
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "climb"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "climb",
                    "operator": "=",
                    "terminal": {
                      "$type": "Alternatives",
                      "elements": [
                        {
                          "$type": "Keyword",
                          "value": "up"
                        },
                        {
                          "$type": "Keyword",
                          "value": "down"
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "total_height"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "rise_height",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "max_run"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "max_run",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "landing_depth"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "landing_depth",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "landing_thickness"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "landing_thickness",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "turn"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "turn",
                    "operator": "=",
                    "terminal": {
                      "$type": "Alternatives",
                      "elements": [
                        {
                          "$type": "Keyword",
                          "value": "clockwise"
                        },
                        {
                          "$type": "Keyword",
                          "value": "anticlockwise"
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "flight_gap"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "flight_gap",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "material"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "material",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@80"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@46"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "SpiralStaircase",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "spiral_staircase"
          },
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@47"
              },
              "arguments": []
            },
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "at"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Keyword",
            "value": "radius"
          },
          {
            "$type": "Assignment",
            "feature": "radius",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "total_height"
          },
          {
            "$type": "Assignment",
            "feature": "total_height",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "turns"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "turns",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "steps"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "steps",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "tread_thickness"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "tread_thickness",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "pole_radius"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "pole_radius",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@46"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "KitchenPlatform",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "kitchen"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "name"
              },
              {
                "$type": "Assignment",
                "feature": "name",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "path"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "pts",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@62"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": ","
              },
              {
                "$type": "Assignment",
                "feature": "pts",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@62"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Keyword",
            "value": "side"
          },
          {
            "$type": "Assignment",
            "feature": "side",
            "operator": "=",
            "terminal": {
              "$type": "Alternatives",
              "elements": [
                {
                  "$type": "Keyword",
                  "value": "left"
                },
                {
                  "$type": "Keyword",
                  "value": "right"
                }
              ]
            }
          },
          {
            "$type": "Keyword",
            "value": "depth"
          },
          {
            "$type": "Assignment",
            "feature": "depth",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "height"
          },
          {
            "$type": "Assignment",
            "feature": "height",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "base_z"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "base_z",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "material"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "material",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@80"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@46"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Pt",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@79"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@79"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Item",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "item"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "name"
              },
              {
                "$type": "Assignment",
                "feature": "name",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "assetRef",
                "operator": "=",
                "terminal": {
                  "$type": "CrossReference",
                  "type": {
                    "$ref": "#/rules@2"
                  },
                  "terminal": {
                    "$type": "RuleCall",
                    "rule": {
                      "$ref": "#/rules@65"
                    },
                    "arguments": []
                  },
                  "deprecatedSyntax": false,
                  "isMulti": false
                }
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "asset"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "asset",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@66"
                      },
                      "arguments": []
                    }
                  }
                ]
              }
            ]
          },
          {
            "$type": "Keyword",
            "value": "at"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "rotation"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "rotation",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "scale"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "scale",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "anchor_to"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "anchor_to",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@80"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "anchor"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "anchor",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@67"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "gap"
                  },
                  {
                    "$type": "Keyword",
                    "value": "("
                  },
                  {
                    "$type": "Assignment",
                    "feature": "gap_x",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ","
                  },
                  {
                    "$type": "Assignment",
                    "feature": "gap_y",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ")"
                  }
                ]
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@46"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "RoomItem",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "item"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "name"
              },
              {
                "$type": "Assignment",
                "feature": "name",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "assetRef",
                "operator": "=",
                "terminal": {
                  "$type": "CrossReference",
                  "type": {
                    "$ref": "#/rules@2"
                  },
                  "terminal": {
                    "$type": "RuleCall",
                    "rule": {
                      "$ref": "#/rules@65"
                    },
                    "arguments": []
                  },
                  "deprecatedSyntax": false,
                  "isMulti": false
                }
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "asset"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "asset",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@66"
                      },
                      "arguments": []
                    }
                  }
                ]
              }
            ]
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "anchor"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "anchor",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@67"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "gap"
                  },
                  {
                    "$type": "Keyword",
                    "value": "("
                  },
                  {
                    "$type": "Assignment",
                    "feature": "gap_x",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ","
                  },
                  {
                    "$type": "Assignment",
                    "feature": "gap_y",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ")"
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "rotation"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "rotation",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "scale"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "scale",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@46"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "AssetName",
      "dataType": "string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@78"
                },
                "arguments": []
              },
              {
                "$type": "Keyword",
                "value": "."
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@80"
            },
            "arguments": []
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Asset",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "{"
          },
          {
            "$type": "Keyword",
            "value": "id"
          },
          {
            "$type": "Assignment",
            "feature": "id",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "src"
          },
          {
            "$type": "Assignment",
            "feature": "src",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "dims"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "dx",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@79"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "dy",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@79"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "dz",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@79"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "name"
              },
              {
                "$type": "Assignment",
                "feature": "name",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "category"
              },
              {
                "$type": "Assignment",
                "feature": "category",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "}"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Anchor",
      "dataType": "string",
      "definition": {
        "$type": "Alternatives",
        "elements": [
          {
            "$type": "Keyword",
            "value": "top-left"
          },
          {
            "$type": "Keyword",
            "value": "top-center"
          },
          {
            "$type": "Keyword",
            "value": "top-right"
          },
          {
            "$type": "Keyword",
            "value": "center-left"
          },
          {
            "$type": "Keyword",
            "value": "center"
          },
          {
            "$type": "Keyword",
            "value": "center-right"
          },
          {
            "$type": "Keyword",
            "value": "bottom-left"
          },
          {
            "$type": "Keyword",
            "value": "bottom-center"
          },
          {
            "$type": "Keyword",
            "value": "bottom-right"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Component",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "use"
          },
          {
            "$type": "Assignment",
            "feature": "target",
            "operator": "=",
            "terminal": {
              "$type": "CrossReference",
              "type": {
                "$ref": "#/rules@31"
              },
              "terminal": {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@70"
                },
                "arguments": []
              },
              "deprecatedSyntax": false,
              "isMulti": false
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "as"
              },
              {
                "$type": "Assignment",
                "feature": "name",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Keyword",
            "value": "at"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "x",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "y",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "rotation"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "rotation",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "with"
                  },
                  {
                    "$type": "Keyword",
                    "value": "{"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "args",
                    "operator": "+=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@69"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Group",
                    "elements": [
                      {
                        "$type": "Keyword",
                        "value": ","
                      },
                      {
                        "$type": "Assignment",
                        "feature": "args",
                        "operator": "+=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@69"
                          },
                          "arguments": []
                        }
                      }
                    ],
                    "cardinality": "*"
                  },
                  {
                    "$type": "Keyword",
                    "value": "}"
                  }
                ]
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@46"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "ComponentArg",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Assignment",
            "feature": "name",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@78"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "="
          },
          {
            "$type": "Assignment",
            "feature": "value",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "QualifiedName",
      "dataType": "string",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "RuleCall",
            "rule": {
              "$ref": "#/rules@78"
            },
            "arguments": []
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "."
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@78"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Roof",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "roof"
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": "name"
              },
              {
                "$type": "Assignment",
                "feature": "name",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@80"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "?"
          },
          {
            "$type": "Assignment",
            "feature": "roof_type",
            "operator": "=",
            "terminal": {
              "$type": "Alternatives",
              "elements": [
                {
                  "$type": "Keyword",
                  "value": "flat"
                },
                {
                  "$type": "Keyword",
                  "value": "shed"
                },
                {
                  "$type": "Keyword",
                  "value": "pitched"
                }
              ]
            }
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "endpoint"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "default_endpoint",
                    "operator": "=",
                    "terminal": {
                      "$type": "Alternatives",
                      "elements": [
                        {
                          "$type": "Keyword",
                          "value": "open"
                        },
                        {
                          "$type": "Keyword",
                          "value": "closed"
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "$type": "Assignment",
                "feature": "slope",
                "operator": "=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@72"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "overhang"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "min_overhang",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "slab_thickness"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "slab_thickness",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "parapet"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "parapet_height",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": "x"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "parapet_thickness",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "gable_wall_thickness"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "gable_wall_thickness",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "framing"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "framing",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@24"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "rafter_pitch"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "rafter_pitch",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "purlin_pitch"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "purlin_pitch",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "material"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "material",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@80"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "RuleCall",
                "rule": {
                  "$ref": "#/rules@46"
                },
                "arguments": []
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "{"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Assignment",
                "feature": "segments",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@73"
                  },
                  "arguments": []
                }
              },
              {
                "$type": "Assignment",
                "feature": "trusses",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@74"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": "}"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Slope",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "slope"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "angle"
                  },
                  {
                    "$type": "Alternatives",
                    "elements": [
                      {
                        "$type": "Group",
                        "elements": [
                          {
                            "$type": "Keyword",
                            "value": "("
                          },
                          {
                            "$type": "Assignment",
                            "feature": "angle_left",
                            "operator": "=",
                            "terminal": {
                              "$type": "RuleCall",
                              "rule": {
                                "$ref": "#/rules@17"
                              },
                              "arguments": []
                            }
                          },
                          {
                            "$type": "Keyword",
                            "value": ","
                          },
                          {
                            "$type": "Assignment",
                            "feature": "angle_right",
                            "operator": "=",
                            "terminal": {
                              "$type": "RuleCall",
                              "rule": {
                                "$ref": "#/rules@17"
                              },
                              "arguments": []
                            }
                          },
                          {
                            "$type": "Keyword",
                            "value": ")"
                          }
                        ]
                      },
                      {
                        "$type": "Assignment",
                        "feature": "angle_deg",
                        "operator": "=",
                        "terminal": {
                          "$type": "RuleCall",
                          "rule": {
                            "$ref": "#/rules@17"
                          },
                          "arguments": []
                        }
                      }
                    ]
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "height"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "ridge_h",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              }
            ]
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Segment",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "segment"
          },
          {
            "$type": "Assignment",
            "feature": "id",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": "from"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "sx",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "sy",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Keyword",
            "value": "to"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "ex",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ","
          },
          {
            "$type": "Assignment",
            "feature": "ey",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Keyword",
            "value": ")"
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "width"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "width",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "widths"
                  },
                  {
                    "$type": "Keyword",
                    "value": "("
                  },
                  {
                    "$type": "Assignment",
                    "feature": "width_left",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ","
                  },
                  {
                    "$type": "Assignment",
                    "feature": "width_right",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ")"
                  }
                ]
              }
            ]
          },
          {
            "$type": "Alternatives",
            "elements": [
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "high_side"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "shed_high_side",
                    "operator": "=",
                    "terminal": {
                      "$type": "Alternatives",
                      "elements": [
                        {
                          "$type": "Keyword",
                          "value": "left"
                        },
                        {
                          "$type": "Keyword",
                          "value": "right"
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "start_endpoint"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "start_endpoint",
                    "operator": "=",
                    "terminal": {
                      "$type": "Alternatives",
                      "elements": [
                        {
                          "$type": "Keyword",
                          "value": "open"
                        },
                        {
                          "$type": "Keyword",
                          "value": "closed"
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "end_endpoint"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "end_endpoint",
                    "operator": "=",
                    "terminal": {
                      "$type": "Alternatives",
                      "elements": [
                        {
                          "$type": "Keyword",
                          "value": "open"
                        },
                        {
                          "$type": "Keyword",
                          "value": "closed"
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "hip_setback"
                  },
                  {
                    "$type": "Keyword",
                    "value": "("
                  },
                  {
                    "$type": "Assignment",
                    "feature": "hip_setback_start",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ","
                  },
                  {
                    "$type": "Assignment",
                    "feature": "hip_setback_end",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ")"
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "gable_overhang"
                  },
                  {
                    "$type": "Keyword",
                    "value": "("
                  },
                  {
                    "$type": "Assignment",
                    "feature": "gable_overhang_start",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ","
                  },
                  {
                    "$type": "Assignment",
                    "feature": "gable_overhang_end",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ")"
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "hip_ridge_extension"
                  },
                  {
                    "$type": "Keyword",
                    "value": "("
                  },
                  {
                    "$type": "Assignment",
                    "feature": "hip_ridge_extension_start",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ","
                  },
                  {
                    "$type": "Assignment",
                    "feature": "hip_ridge_extension_end",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  },
                  {
                    "$type": "Keyword",
                    "value": ")"
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "overhang"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "min_overhang",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "overhang_start"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "overhang_start",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "overhang_end"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "overhang_end",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "overhang_low"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "overhang_low",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "overhang_high"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "overhang_high",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "overhang_left"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "overhang_left",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "overhang_right"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "overhang_right",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@17"
                      },
                      "arguments": []
                    }
                  }
                ]
              },
              {
                "$type": "Group",
                "elements": [
                  {
                    "$type": "Keyword",
                    "value": "tie_beams"
                  },
                  {
                    "$type": "Assignment",
                    "feature": "tie_beam_count",
                    "operator": "=",
                    "terminal": {
                      "$type": "RuleCall",
                      "rule": {
                        "$ref": "#/rules@79"
                      },
                      "arguments": []
                    }
                  }
                ]
              }
            ],
            "cardinality": "*"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "ParserRule",
      "name": "Truss",
      "definition": {
        "$type": "Group",
        "elements": [
          {
            "$type": "Keyword",
            "value": "truss"
          },
          {
            "$type": "Assignment",
            "feature": "segment_id",
            "operator": "=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@80"
              },
              "arguments": []
            }
          },
          {
            "$type": "Assignment",
            "feature": "type",
            "operator": "=",
            "terminal": {
              "$type": "Alternatives",
              "elements": [
                {
                  "$type": "Keyword",
                  "value": "fink"
                },
                {
                  "$type": "Keyword",
                  "value": "mono_pitch"
                }
              ]
            }
          },
          {
            "$type": "Keyword",
            "value": "at"
          },
          {
            "$type": "Keyword",
            "value": "("
          },
          {
            "$type": "Assignment",
            "feature": "positions",
            "operator": "+=",
            "terminal": {
              "$type": "RuleCall",
              "rule": {
                "$ref": "#/rules@17"
              },
              "arguments": []
            }
          },
          {
            "$type": "Group",
            "elements": [
              {
                "$type": "Keyword",
                "value": ","
              },
              {
                "$type": "Assignment",
                "feature": "positions",
                "operator": "+=",
                "terminal": {
                  "$type": "RuleCall",
                  "rule": {
                    "$ref": "#/rules@17"
                  },
                  "arguments": []
                }
              }
            ],
            "cardinality": "*"
          },
          {
            "$type": "Keyword",
            "value": ")"
          }
        ]
      },
      "entry": false,
      "fragment": false,
      "parameters": []
    },
    {
      "$type": "TerminalRule",
      "hidden": true,
      "name": "WS",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\s+/",
        "parenthesized": false
      },
      "fragment": false
    },
    {
      "$type": "TerminalRule",
      "hidden": true,
      "name": "ML_COMMENT",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\/\\\\*[\\\\s\\\\S]*?\\\\*\\\\//",
        "parenthesized": false
      },
      "fragment": false
    },
    {
      "$type": "TerminalRule",
      "hidden": true,
      "name": "SL_COMMENT",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\\\/\\\\/[^\\\\n\\\\r]*/",
        "parenthesized": false
      },
      "fragment": false
    },
    {
      "$type": "TerminalRule",
      "name": "ID",
      "definition": {
        "$type": "RegexToken",
        "regex": "/[_a-zA-Z][\\\\w]*/",
        "parenthesized": false
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "NUMBER",
      "type": {
        "$type": "ReturnType",
        "name": "number"
      },
      "definition": {
        "$type": "RegexToken",
        "regex": "/[0-9]+(\\\\.[0-9]+)?/",
        "parenthesized": false
      },
      "fragment": false,
      "hidden": false
    },
    {
      "$type": "TerminalRule",
      "name": "STRING",
      "definition": {
        "$type": "RegexToken",
        "regex": "/\\"(\\\\\\\\.|[^\\"\\\\\\\\])*\\"/",
        "parenthesized": false
      },
      "fragment": false,
      "hidden": false
    }
  ],
  "imports": [],
  "interfaces": [],
  "types": []
}`),Gv={$type:`Asset`,category:`category`,dx:`dx`,dy:`dy`,dz:`dz`,id:`id`,name:`name`,src:`src`},Kv={$type:`AssetDecl`,assetName:`assetName`,category:`category`,dx:`dx`,dy:`dy`,dz:`dz`,id:`id`,src:`src`},qv={$type:`Beam`,enabled:`enabled`,height:`height`,l:`l`,layer:`layer`,name:`name`,w:`w`,x:`x`,y:`y`,z_offset:`z_offset`},Jv={$type:`Binary`,left:`left`,op:`op`,right:`right`};function Yv(e){return Cb.isInstance(e,Jv.$type)}var Xv={$type:`Call`,args:`args`,callee:`callee`};function Zv(e){return Cb.isInstance(e,Xv.$type)}var Qv={$type:`Component`,args:`args`,enabled:`enabled`,layer:`layer`,name:`name`,rotation:`rotation`,target:`target`,x:`x`,y:`y`,z_offset:`z_offset`},$v={$type:`ComponentArg`,name:`name`,value:`value`},ey={$type:`ComponentDef`,exposeLabel:`exposeLabel`,exposeLayer:`exposeLayer`,exposeType:`exposeType`,goal:`goal`,name:`name`,objects:`objects`,params:`params`,points:`points`,vars:`vars`},ty={$type:`ComponentParam`,default:`default`,kind:`kind`,label:`label`,name:`name`,unit:`unit`},ny={$type:`ConfigGroup`,description:`description`,inputs:`inputs`,label:`label`},ry={$type:`ConfigInput`},iy={$type:`ConfigItem`},ay={$type:`Configurator`,description:`description`,items:`items`,title:`title`},oy={$type:`Defaults`,floor_height:`floor_height`,slab_thickness:`slab_thickness`,wall_height:`wall_height`,wall_thickness:`wall_thickness`},sy={$type:`Expr`},cy={$type:`FieldAssign`,key:`key`,value:`value`},ly={$type:`Floor`,enabled:`enabled`,height:`height`,name:`name`,number:`number`,objects:`objects`,slab_thickness:`slab_thickness`,wall_height:`wall_height`},uy={$type:`FloorObject`},dy={$type:`FloorSlab`,enabled:`enabled`,l:`l`,layer:`layer`,name:`name`,thickness:`thickness`,w:`w`,x:`x`,y:`y`,z_offset:`z_offset`},fy={$type:`GlbModel`,asset:`asset`,assetRef:`assetRef`,enabled:`enabled`,layer:`layer`,name:`name`,rig:`rig`,rotation:`rotation`,scale:`scale`,x:`x`,y:`y`,z_offset:`z_offset`},py={$type:`Grid`,extent_x:`extent_x`,extent_y:`extent_y`,name:`name`,origin_x:`origin_x`,origin_y:`origin_y`,spacing_x:`spacing_x`,spacing_y:`spacing_y`,xlines:`xlines`,ylines:`ylines`},my={$type:`GridLine`,at:`at`,name:`name`,role:`role`,thickness:`thickness`},hy={$type:`Ground`,enabled:`enabled`,height:`height`,l:`l`,layer:`layer`,material:`material`,name:`name`,w:`w`,x:`x`,y:`y`,z_offset:`z_offset`},gy={$type:`Import`,ns:`ns`,ref:`ref`},_y={$type:`Item`,anchor:`anchor`,anchor_to:`anchor_to`,asset:`asset`,assetRef:`assetRef`,enabled:`enabled`,gap_x:`gap_x`,gap_y:`gap_y`,layer:`layer`,name:`name`,rotation:`rotation`,scale:`scale`,x:`x`,y:`y`,z_offset:`z_offset`},vy={$type:`JsonArray`,items:`items`};function yy(e){return Cb.isInstance(e,vy.$type)}var by={$type:`JsonBool`,bool:`bool`};function xy(e){return Cb.isInstance(e,by.$type)}var Sy={$type:`JsonMember`,key:`key`,value:`value`},Cy={$type:`JsonNull`};function wy(e){return Cb.isInstance(e,Cy.$type)}var Ty={$type:`JsonNum`,neg:`neg`,num:`num`};function Ey(e){return Cb.isInstance(e,Ty.$type)}var Dy={$type:`JsonObject`,members:`members`};function Oy(e){return Cb.isInstance(e,Dy.$type)}var ky={$type:`JsonStr`,str:`str`};function Ay(e){return Cb.isInstance(e,ky.$type)}var jy={$type:`JsonValue`},My={$type:`KitchenPlatform`,base_z:`base_z`,depth:`depth`,enabled:`enabled`,height:`height`,layer:`layer`,material:`material`,name:`name`,pts:`pts`,side:`side`,z_offset:`z_offset`},Ny={$type:`LayerDecl`,color:`color`,group:`group`,id:`id`,label:`label`},Py={$type:`Model`,assets:`assets`,components:`components`,configurators:`configurators`,convention:`convention`,defaults:`defaults`,floors:`floors`,grids:`grids`,imports:`imports`,layers:`layers`,name:`name`,points:`points`,site:`site`,template:`template`,units:`units`,vars:`vars`},Fy={$type:`Neg`,operand:`operand`};function Iy(e){return Cb.isInstance(e,Fy.$type)}var Ly={$type:`Num`,value:`value`};function Ry(e){return Cb.isInstance(e,Ly.$type)}var zy={$type:`NumberInput`,description:`description`,label:`label`,target:`target`,unit:`unit`},By={$type:`ObjectDecl`,args:`args`,enabled:`enabled`,fields:`fields`,layer:`layer`,name:`name`,type:`type`,z_offset:`z_offset`},Vy={$type:`Opening`,anchor:`anchor`,direction:`direction`,height:`height`,kind:`kind`,name:`name`,offset:`offset`,open:`open`,sill:`sill`,width:`width`},Hy={$type:`Pillar`,enabled:`enabled`,height:`height`,l:`l`,l_auto:`l_auto`,layer:`layer`,name:`name`,w:`w`,w_auto:`w_auto`,x:`x`,y:`y`,z_offset:`z_offset`},Uy={$type:`Plinth`,enabled:`enabled`,height:`height`,l:`l`,layer:`layer`,material:`material`,name:`name`,w:`w`,x:`x`,y:`y`,z_offset:`z_offset`},Wy={$type:`Point`,name:`name`,x:`x`,y:`y`},Gy={$type:`Pt`,x:`x`,y:`y`},Ky={$type:`Raw`,body:`body`,type:`type`},qy={$type:`Ref`,parts:`parts`};function Jy(e){return Cb.isInstance(e,qy.$type)}var Yy={$type:`RigArray`,count:`count`,node:`node`,steps:`steps`},Xy={$type:`RigMaterial`,color:`color`,node:`node`};function Zy(e){return Cb.isInstance(e,Xy.$type)}var Qy={$type:`RigOp`},$y={$type:`RigStep`,op:`op`,x:`x`,y:`y`,z:`z`},eb={$type:`RigVec3`,node:`node`,op:`op`,x:`x`,y:`y`,z:`z`};function tb(e){return Cb.isInstance(e,eb.$type)}var nb={$type:`RigVisible`,node:`node`,value:`value`};function rb(e){return Cb.isInstance(e,nb.$type)}var Z={$type:`Roof`,default_endpoint:`default_endpoint`,enabled:`enabled`,framing:`framing`,gable_wall_thickness:`gable_wall_thickness`,layer:`layer`,material:`material`,min_overhang:`min_overhang`,name:`name`,parapet_height:`parapet_height`,parapet_thickness:`parapet_thickness`,purlin_pitch:`purlin_pitch`,rafter_pitch:`rafter_pitch`,roof_type:`roof_type`,segments:`segments`,slab_thickness:`slab_thickness`,slope:`slope`,trusses:`trusses`,z_offset:`z_offset`},ib={$type:`Room`,connections:`connections`,enabled:`enabled`,height:`height`,items:`items`,l:`l`,layer:`layer`,material:`material`,name:`name`,w:`w`,walls:`walls`,x:`x`,y:`y`,z_offset:`z_offset`},ab={$type:`RoomItem`,anchor:`anchor`,asset:`asset`,assetRef:`assetRef`,enabled:`enabled`,gap_x:`gap_x`,gap_y:`gap_y`,layer:`layer`,name:`name`,rotation:`rotation`,scale:`scale`,z_offset:`z_offset`},ob={$type:`RoomWall`,height:`height`,height_end:`height_end`,openings:`openings`,sides:`sides`},Q={$type:`Segment`,end_endpoint:`end_endpoint`,ex:`ex`,ey:`ey`,gable_overhang_end:`gable_overhang_end`,gable_overhang_start:`gable_overhang_start`,hip_ridge_extension_end:`hip_ridge_extension_end`,hip_ridge_extension_start:`hip_ridge_extension_start`,hip_setback_end:`hip_setback_end`,hip_setback_start:`hip_setback_start`,id:`id`,min_overhang:`min_overhang`,overhang_end:`overhang_end`,overhang_high:`overhang_high`,overhang_left:`overhang_left`,overhang_low:`overhang_low`,overhang_right:`overhang_right`,overhang_start:`overhang_start`,shed_high_side:`shed_high_side`,start_endpoint:`start_endpoint`,sx:`sx`,sy:`sy`,tie_beam_count:`tie_beam_count`,width:`width`,width_left:`width_left`,width_right:`width_right`},sb={$type:`SelectInput`,description:`description`,label:`label`,options:`options`,target:`target`},cb={$type:`SelectOption`,label:`label`,value:`value`},lb={$type:`Site`,plot_length:`plot_length`,plot_width:`plot_width`,ref_x:`ref_x`,ref_y:`ref_y`},ub={$type:`SliderInput`,description:`description`,label:`label`,max:`max`,min:`min`,step:`step`,target:`target`,unit:`unit`},db={$type:`Slope`,angle_deg:`angle_deg`,angle_left:`angle_left`,angle_right:`angle_right`,ridge_h:`ridge_h`},fb={$type:`SpiralStaircase`,enabled:`enabled`,layer:`layer`,name:`name`,pole_radius:`pole_radius`,radius:`radius`,steps:`steps`,total_height:`total_height`,tread_thickness:`tread_thickness`,turns:`turns`,x:`x`,y:`y`,z_offset:`z_offset`},$={$type:`Staircase`,box_length:`box_length`,box_width:`box_width`,climb:`climb`,direction:`direction`,enabled:`enabled`,flight_gap:`flight_gap`,landing_depth:`landing_depth`,landing_thickness:`landing_thickness`,layer:`layer`,material:`material`,max_run:`max_run`,name:`name`,rise_height:`rise_height`,start_x:`start_x`,start_y:`start_y`,step_rise:`step_rise`,step_tread:`step_tread`,step_width:`step_width`,turn:`turn`,z_offset:`z_offset`},pb={$type:`StrVal`,str:`str`};function mb(e){return Cb.isInstance(e,pb.$type)}var hb={$type:`TemplateMeta`,description:`description`,minL:`minL`,minW:`minW`,roof:`roof`,style:`style`,tags:`tags`,thumbs:`thumbs`,title:`title`},gb={$type:`ToggleInput`,description:`description`,label:`label`,target:`target`},_b={$type:`Truss`,positions:`positions`,segment_id:`segment_id`,type:`type`},vb={$type:`Units`,per_unit:`per_unit`,system:`system`},yb={$type:`Value`},bb={$type:`Var`,name:`name`,value:`value`},xb={$type:`Wall`,enabled:`enabled`,end_x:`end_x`,end_y:`end_y`,facing:`facing`,height:`height`,height_end:`height_end`,layer:`layer`,material:`material`,name:`name`,openings:`openings`,start_x:`start_x`,start_y:`start_y`,z_offset:`z_offset`},Sb=class extends m{types={Asset:{name:Gv.$type,properties:{category:{name:Gv.category,optional:!0},dx:{name:Gv.dx},dy:{name:Gv.dy},dz:{name:Gv.dz},id:{name:Gv.id},name:{name:Gv.name,optional:!0},src:{name:Gv.src}},superTypes:[]},AssetDecl:{name:Kv.$type,properties:{assetName:{name:Kv.assetName,optional:!0},category:{name:Kv.category,optional:!0},dx:{name:Kv.dx},dy:{name:Kv.dy},dz:{name:Kv.dz},id:{name:Kv.id},src:{name:Kv.src}},superTypes:[]},Beam:{name:qv.$type,properties:{enabled:{name:qv.enabled,optional:!0},height:{name:qv.height,optional:!0},l:{name:qv.l},layer:{name:qv.layer,optional:!0},name:{name:qv.name,optional:!0},w:{name:qv.w},x:{name:qv.x},y:{name:qv.y},z_offset:{name:qv.z_offset,optional:!0}},superTypes:[uy.$type]},Binary:{name:Jv.$type,properties:{left:{name:Jv.left},op:{name:Jv.op},right:{name:Jv.right}},superTypes:[sy.$type]},Call:{name:Xv.$type,properties:{args:{name:Xv.args,defaultValue:[],optional:!0},callee:{name:Xv.callee}},superTypes:[sy.$type]},Component:{name:Qv.$type,properties:{args:{name:Qv.args,defaultValue:[],optional:!0},enabled:{name:Qv.enabled,optional:!0},layer:{name:Qv.layer,optional:!0},name:{name:Qv.name,optional:!0},rotation:{name:Qv.rotation,optional:!0},target:{name:Qv.target,referenceType:ey.$type},x:{name:Qv.x},y:{name:Qv.y},z_offset:{name:Qv.z_offset,optional:!0}},superTypes:[uy.$type]},ComponentArg:{name:$v.$type,properties:{name:{name:$v.name},value:{name:$v.value}},superTypes:[]},ComponentDef:{name:ey.$type,properties:{exposeLabel:{name:ey.exposeLabel,optional:!0},exposeLayer:{name:ey.exposeLayer,optional:!0},exposeType:{name:ey.exposeType,optional:!0},goal:{name:ey.goal,optional:!0},name:{name:ey.name},objects:{name:ey.objects,defaultValue:[],optional:!0},params:{name:ey.params,defaultValue:[],optional:!0},points:{name:ey.points,defaultValue:[],optional:!0},vars:{name:ey.vars,defaultValue:[],optional:!0}},superTypes:[]},ComponentParam:{name:ty.$type,properties:{default:{name:ty.default,optional:!0},kind:{name:ty.kind,optional:!0},label:{name:ty.label,optional:!0},name:{name:ty.name},unit:{name:ty.unit,optional:!0}},superTypes:[]},ConfigGroup:{name:ny.$type,properties:{description:{name:ny.description,optional:!0},inputs:{name:ny.inputs,defaultValue:[]},label:{name:ny.label}},superTypes:[iy.$type]},ConfigInput:{name:ry.$type,properties:{},superTypes:[iy.$type]},ConfigItem:{name:iy.$type,properties:{},superTypes:[]},Configurator:{name:ay.$type,properties:{description:{name:ay.description,optional:!0},items:{name:ay.items,defaultValue:[]},title:{name:ay.title,optional:!0}},superTypes:[]},Defaults:{name:oy.$type,properties:{floor_height:{name:oy.floor_height,optional:!0},slab_thickness:{name:oy.slab_thickness,optional:!0},wall_height:{name:oy.wall_height,optional:!0},wall_thickness:{name:oy.wall_thickness,optional:!0}},superTypes:[]},Expr:{name:sy.$type,properties:{},superTypes:[yb.$type]},FieldAssign:{name:cy.$type,properties:{key:{name:cy.key},value:{name:cy.value}},superTypes:[]},Floor:{name:ly.$type,properties:{enabled:{name:ly.enabled,optional:!0},height:{name:ly.height,optional:!0},name:{name:ly.name},number:{name:ly.number},objects:{name:ly.objects,defaultValue:[],optional:!0},slab_thickness:{name:ly.slab_thickness,optional:!0},wall_height:{name:ly.wall_height,optional:!0}},superTypes:[]},FloorObject:{name:uy.$type,properties:{},superTypes:[]},FloorSlab:{name:dy.$type,properties:{enabled:{name:dy.enabled,optional:!0},l:{name:dy.l},layer:{name:dy.layer,optional:!0},name:{name:dy.name,optional:!0},thickness:{name:dy.thickness,optional:!0},w:{name:dy.w},x:{name:dy.x},y:{name:dy.y},z_offset:{name:dy.z_offset,optional:!0}},superTypes:[uy.$type]},GlbModel:{name:fy.$type,properties:{asset:{name:fy.asset,optional:!0},assetRef:{name:fy.assetRef,referenceType:Kv.$type,optional:!0},enabled:{name:fy.enabled,optional:!0},layer:{name:fy.layer,optional:!0},name:{name:fy.name,optional:!0},rig:{name:fy.rig,defaultValue:[],optional:!0},rotation:{name:fy.rotation,optional:!0},scale:{name:fy.scale,optional:!0},x:{name:fy.x},y:{name:fy.y},z_offset:{name:fy.z_offset,optional:!0}},superTypes:[uy.$type]},Grid:{name:py.$type,properties:{extent_x:{name:py.extent_x,optional:!0},extent_y:{name:py.extent_y,optional:!0},name:{name:py.name},origin_x:{name:py.origin_x,optional:!0},origin_y:{name:py.origin_y,optional:!0},spacing_x:{name:py.spacing_x,optional:!0},spacing_y:{name:py.spacing_y,optional:!0},xlines:{name:py.xlines,defaultValue:[],optional:!0},ylines:{name:py.ylines,defaultValue:[],optional:!0}},superTypes:[]},GridLine:{name:my.$type,properties:{at:{name:my.at},name:{name:my.name},role:{name:my.role,optional:!0},thickness:{name:my.thickness,optional:!0}},superTypes:[]},Ground:{name:hy.$type,properties:{enabled:{name:hy.enabled,optional:!0},height:{name:hy.height,optional:!0},l:{name:hy.l},layer:{name:hy.layer,optional:!0},material:{name:hy.material,optional:!0},name:{name:hy.name,optional:!0},w:{name:hy.w},x:{name:hy.x},y:{name:hy.y},z_offset:{name:hy.z_offset,optional:!0}},superTypes:[uy.$type]},Import:{name:gy.$type,properties:{ns:{name:gy.ns,optional:!0},ref:{name:gy.ref}},superTypes:[]},Item:{name:_y.$type,properties:{anchor:{name:_y.anchor,optional:!0},anchor_to:{name:_y.anchor_to,optional:!0},asset:{name:_y.asset,optional:!0},assetRef:{name:_y.assetRef,referenceType:Kv.$type,optional:!0},enabled:{name:_y.enabled,optional:!0},gap_x:{name:_y.gap_x,optional:!0},gap_y:{name:_y.gap_y,optional:!0},layer:{name:_y.layer,optional:!0},name:{name:_y.name,optional:!0},rotation:{name:_y.rotation,optional:!0},scale:{name:_y.scale,optional:!0},x:{name:_y.x},y:{name:_y.y},z_offset:{name:_y.z_offset,optional:!0}},superTypes:[uy.$type]},JsonArray:{name:vy.$type,properties:{items:{name:vy.items,defaultValue:[],optional:!0}},superTypes:[jy.$type]},JsonBool:{name:by.$type,properties:{bool:{name:by.bool}},superTypes:[jy.$type]},JsonMember:{name:Sy.$type,properties:{key:{name:Sy.key},value:{name:Sy.value}},superTypes:[]},JsonNull:{name:Cy.$type,properties:{},superTypes:[jy.$type]},JsonNum:{name:Ty.$type,properties:{neg:{name:Ty.neg,defaultValue:!1,optional:!0},num:{name:Ty.num}},superTypes:[jy.$type]},JsonObject:{name:Dy.$type,properties:{members:{name:Dy.members,defaultValue:[],optional:!0}},superTypes:[jy.$type]},JsonStr:{name:ky.$type,properties:{str:{name:ky.str}},superTypes:[jy.$type]},JsonValue:{name:jy.$type,properties:{},superTypes:[]},KitchenPlatform:{name:My.$type,properties:{base_z:{name:My.base_z,optional:!0},depth:{name:My.depth},enabled:{name:My.enabled,optional:!0},height:{name:My.height},layer:{name:My.layer,optional:!0},material:{name:My.material,optional:!0},name:{name:My.name,optional:!0},pts:{name:My.pts,defaultValue:[]},side:{name:My.side},z_offset:{name:My.z_offset,optional:!0}},superTypes:[uy.$type]},LayerDecl:{name:Ny.$type,properties:{color:{name:Ny.color,optional:!0},group:{name:Ny.group,optional:!0},id:{name:Ny.id},label:{name:Ny.label}},superTypes:[]},Model:{name:Py.$type,properties:{assets:{name:Py.assets,defaultValue:[],optional:!0},components:{name:Py.components,defaultValue:[],optional:!0},configurators:{name:Py.configurators,defaultValue:[],optional:!0},convention:{name:Py.convention,optional:!0},defaults:{name:Py.defaults,optional:!0},floors:{name:Py.floors,defaultValue:[],optional:!0},grids:{name:Py.grids,defaultValue:[],optional:!0},imports:{name:Py.imports,defaultValue:[],optional:!0},layers:{name:Py.layers,defaultValue:[],optional:!0},name:{name:Py.name,optional:!0},points:{name:Py.points,defaultValue:[],optional:!0},site:{name:Py.site,optional:!0},template:{name:Py.template,optional:!0},units:{name:Py.units,optional:!0},vars:{name:Py.vars,defaultValue:[],optional:!0}},superTypes:[]},Neg:{name:Fy.$type,properties:{operand:{name:Fy.operand}},superTypes:[sy.$type]},Num:{name:Ly.$type,properties:{value:{name:Ly.value}},superTypes:[sy.$type]},NumberInput:{name:zy.$type,properties:{description:{name:zy.description,optional:!0},label:{name:zy.label},target:{name:zy.target},unit:{name:zy.unit,optional:!0}},superTypes:[ry.$type]},ObjectDecl:{name:By.$type,properties:{args:{name:By.args,defaultValue:[],optional:!0},enabled:{name:By.enabled,optional:!0},fields:{name:By.fields,defaultValue:[],optional:!0},layer:{name:By.layer,optional:!0},name:{name:By.name,optional:!0},type:{name:By.type},z_offset:{name:By.z_offset,optional:!0}},superTypes:[uy.$type]},Opening:{name:Vy.$type,properties:{anchor:{name:Vy.anchor,optional:!0},direction:{name:Vy.direction,optional:!0},height:{name:Vy.height},kind:{name:Vy.kind},name:{name:Vy.name},offset:{name:Vy.offset},open:{name:Vy.open,defaultValue:!1,optional:!0},sill:{name:Vy.sill,optional:!0},width:{name:Vy.width}},superTypes:[]},Pillar:{name:Hy.$type,properties:{enabled:{name:Hy.enabled,optional:!0},height:{name:Hy.height,optional:!0},l:{name:Hy.l,optional:!0},l_auto:{name:Hy.l_auto,defaultValue:!1,optional:!0},layer:{name:Hy.layer,optional:!0},name:{name:Hy.name},w:{name:Hy.w,optional:!0},w_auto:{name:Hy.w_auto,defaultValue:!1,optional:!0},x:{name:Hy.x},y:{name:Hy.y},z_offset:{name:Hy.z_offset,optional:!0}},superTypes:[uy.$type]},Plinth:{name:Uy.$type,properties:{enabled:{name:Uy.enabled,optional:!0},height:{name:Uy.height},l:{name:Uy.l},layer:{name:Uy.layer,optional:!0},material:{name:Uy.material,optional:!0},name:{name:Uy.name,optional:!0},w:{name:Uy.w},x:{name:Uy.x},y:{name:Uy.y},z_offset:{name:Uy.z_offset,optional:!0}},superTypes:[uy.$type]},Point:{name:Wy.$type,properties:{name:{name:Wy.name},x:{name:Wy.x},y:{name:Wy.y}},superTypes:[]},Pt:{name:Gy.$type,properties:{x:{name:Gy.x},y:{name:Gy.y}},superTypes:[]},Raw:{name:Ky.$type,properties:{body:{name:Ky.body},type:{name:Ky.type}},superTypes:[uy.$type]},Ref:{name:qy.$type,properties:{parts:{name:qy.parts,defaultValue:[]}},superTypes:[sy.$type]},RigArray:{name:Yy.$type,properties:{count:{name:Yy.count},node:{name:Yy.node},steps:{name:Yy.steps,defaultValue:[],optional:!0}},superTypes:[Qy.$type]},RigMaterial:{name:Xy.$type,properties:{color:{name:Xy.color},node:{name:Xy.node}},superTypes:[Qy.$type]},RigOp:{name:Qy.$type,properties:{},superTypes:[]},RigStep:{name:$y.$type,properties:{op:{name:$y.op},x:{name:$y.x},y:{name:$y.y},z:{name:$y.z}},superTypes:[]},RigVec3:{name:eb.$type,properties:{node:{name:eb.node},op:{name:eb.op},x:{name:eb.x},y:{name:eb.y},z:{name:eb.z}},superTypes:[Qy.$type]},RigVisible:{name:nb.$type,properties:{node:{name:nb.node},value:{name:nb.value}},superTypes:[Qy.$type]},Roof:{name:Z.$type,properties:{default_endpoint:{name:Z.default_endpoint,optional:!0},enabled:{name:Z.enabled,optional:!0},framing:{name:Z.framing,optional:!0},gable_wall_thickness:{name:Z.gable_wall_thickness,optional:!0},layer:{name:Z.layer,optional:!0},material:{name:Z.material,optional:!0},min_overhang:{name:Z.min_overhang,optional:!0},name:{name:Z.name,optional:!0},parapet_height:{name:Z.parapet_height,optional:!0},parapet_thickness:{name:Z.parapet_thickness,optional:!0},purlin_pitch:{name:Z.purlin_pitch,optional:!0},rafter_pitch:{name:Z.rafter_pitch,optional:!0},roof_type:{name:Z.roof_type},segments:{name:Z.segments,defaultValue:[],optional:!0},slab_thickness:{name:Z.slab_thickness,optional:!0},slope:{name:Z.slope,optional:!0},trusses:{name:Z.trusses,defaultValue:[],optional:!0},z_offset:{name:Z.z_offset,optional:!0}},superTypes:[uy.$type]},Room:{name:ib.$type,properties:{connections:{name:ib.connections,defaultValue:[],optional:!0},enabled:{name:ib.enabled,optional:!0},height:{name:ib.height,optional:!0},items:{name:ib.items,defaultValue:[],optional:!0},l:{name:ib.l},layer:{name:ib.layer,optional:!0},material:{name:ib.material,optional:!0},name:{name:ib.name},w:{name:ib.w},walls:{name:ib.walls,defaultValue:[],optional:!0},x:{name:ib.x},y:{name:ib.y},z_offset:{name:ib.z_offset,optional:!0}},superTypes:[uy.$type]},RoomItem:{name:ab.$type,properties:{anchor:{name:ab.anchor,optional:!0},asset:{name:ab.asset,optional:!0},assetRef:{name:ab.assetRef,referenceType:Kv.$type,optional:!0},enabled:{name:ab.enabled,optional:!0},gap_x:{name:ab.gap_x,optional:!0},gap_y:{name:ab.gap_y,optional:!0},layer:{name:ab.layer,optional:!0},name:{name:ab.name,optional:!0},rotation:{name:ab.rotation,optional:!0},scale:{name:ab.scale,optional:!0},z_offset:{name:ab.z_offset,optional:!0}},superTypes:[]},RoomWall:{name:ob.$type,properties:{height:{name:ob.height,optional:!0},height_end:{name:ob.height_end,optional:!0},openings:{name:ob.openings,defaultValue:[],optional:!0},sides:{name:ob.sides,defaultValue:[]}},superTypes:[]},Segment:{name:Q.$type,properties:{end_endpoint:{name:Q.end_endpoint,optional:!0},ex:{name:Q.ex},ey:{name:Q.ey},gable_overhang_end:{name:Q.gable_overhang_end,optional:!0},gable_overhang_start:{name:Q.gable_overhang_start,optional:!0},hip_ridge_extension_end:{name:Q.hip_ridge_extension_end,optional:!0},hip_ridge_extension_start:{name:Q.hip_ridge_extension_start,optional:!0},hip_setback_end:{name:Q.hip_setback_end,optional:!0},hip_setback_start:{name:Q.hip_setback_start,optional:!0},id:{name:Q.id},min_overhang:{name:Q.min_overhang,optional:!0},overhang_end:{name:Q.overhang_end,optional:!0},overhang_high:{name:Q.overhang_high,optional:!0},overhang_left:{name:Q.overhang_left,optional:!0},overhang_low:{name:Q.overhang_low,optional:!0},overhang_right:{name:Q.overhang_right,optional:!0},overhang_start:{name:Q.overhang_start,optional:!0},shed_high_side:{name:Q.shed_high_side,optional:!0},start_endpoint:{name:Q.start_endpoint,optional:!0},sx:{name:Q.sx},sy:{name:Q.sy},tie_beam_count:{name:Q.tie_beam_count,optional:!0},width:{name:Q.width,optional:!0},width_left:{name:Q.width_left,optional:!0},width_right:{name:Q.width_right,optional:!0}},superTypes:[]},SelectInput:{name:sb.$type,properties:{description:{name:sb.description,optional:!0},label:{name:sb.label},options:{name:sb.options,defaultValue:[]},target:{name:sb.target}},superTypes:[ry.$type]},SelectOption:{name:cb.$type,properties:{label:{name:cb.label},value:{name:cb.value}},superTypes:[]},Site:{name:lb.$type,properties:{plot_length:{name:lb.plot_length},plot_width:{name:lb.plot_width},ref_x:{name:lb.ref_x,optional:!0},ref_y:{name:lb.ref_y,optional:!0}},superTypes:[]},SliderInput:{name:ub.$type,properties:{description:{name:ub.description,optional:!0},label:{name:ub.label},max:{name:ub.max},min:{name:ub.min},step:{name:ub.step,optional:!0},target:{name:ub.target},unit:{name:ub.unit,optional:!0}},superTypes:[ry.$type]},Slope:{name:db.$type,properties:{angle_deg:{name:db.angle_deg,optional:!0},angle_left:{name:db.angle_left,optional:!0},angle_right:{name:db.angle_right,optional:!0},ridge_h:{name:db.ridge_h,optional:!0}},superTypes:[]},SpiralStaircase:{name:fb.$type,properties:{enabled:{name:fb.enabled,optional:!0},layer:{name:fb.layer,optional:!0},name:{name:fb.name,optional:!0},pole_radius:{name:fb.pole_radius,optional:!0},radius:{name:fb.radius},steps:{name:fb.steps,optional:!0},total_height:{name:fb.total_height},tread_thickness:{name:fb.tread_thickness,optional:!0},turns:{name:fb.turns,optional:!0},x:{name:fb.x},y:{name:fb.y},z_offset:{name:fb.z_offset,optional:!0}},superTypes:[uy.$type]},Staircase:{name:$.$type,properties:{box_length:{name:$.box_length,optional:!0},box_width:{name:$.box_width,optional:!0},climb:{name:$.climb,optional:!0},direction:{name:$.direction},enabled:{name:$.enabled,optional:!0},flight_gap:{name:$.flight_gap,optional:!0},landing_depth:{name:$.landing_depth,optional:!0},landing_thickness:{name:$.landing_thickness,optional:!0},layer:{name:$.layer,optional:!0},material:{name:$.material,optional:!0},max_run:{name:$.max_run,optional:!0},name:{name:$.name,optional:!0},rise_height:{name:$.rise_height,optional:!0},start_x:{name:$.start_x},start_y:{name:$.start_y},step_rise:{name:$.step_rise},step_tread:{name:$.step_tread},step_width:{name:$.step_width,optional:!0},turn:{name:$.turn,optional:!0},z_offset:{name:$.z_offset,optional:!0}},superTypes:[uy.$type]},StrVal:{name:pb.$type,properties:{str:{name:pb.str}},superTypes:[yb.$type]},TemplateMeta:{name:hb.$type,properties:{description:{name:hb.description,optional:!0},minL:{name:hb.minL,optional:!0},minW:{name:hb.minW,optional:!0},roof:{name:hb.roof,optional:!0},style:{name:hb.style,optional:!0},tags:{name:hb.tags,defaultValue:[],optional:!0},thumbs:{name:hb.thumbs,defaultValue:[],optional:!0},title:{name:hb.title,optional:!0}},superTypes:[]},ToggleInput:{name:gb.$type,properties:{description:{name:gb.description,optional:!0},label:{name:gb.label},target:{name:gb.target}},superTypes:[ry.$type]},Truss:{name:_b.$type,properties:{positions:{name:_b.positions,defaultValue:[]},segment_id:{name:_b.segment_id},type:{name:_b.type}},superTypes:[]},Units:{name:vb.$type,properties:{per_unit:{name:vb.per_unit,optional:!0},system:{name:vb.system}},superTypes:[]},Value:{name:yb.$type,properties:{},superTypes:[]},Var:{name:bb.$type,properties:{name:{name:bb.name},value:{name:bb.value}},superTypes:[]},Wall:{name:xb.$type,properties:{enabled:{name:xb.enabled,optional:!0},end_x:{name:xb.end_x},end_y:{name:xb.end_y},facing:{name:xb.facing,optional:!0},height:{name:xb.height,optional:!0},height_end:{name:xb.height_end,optional:!0},layer:{name:xb.layer,optional:!0},material:{name:xb.material,optional:!0},name:{name:xb.name},openings:{name:xb.openings,defaultValue:[],optional:!0},start_x:{name:xb.start_x},start_y:{name:xb.start_y},z_offset:{name:xb.z_offset,optional:!0}},superTypes:[uy.$type]}}},Cb=new Sb,wb={languageId:`wadi`,fileExtensions:[`.wdl`],caseInsensitive:!1,mode:`development`},Tb={AstReflection:()=>new Sb},Eb={Grammar:()=>Wv(),LanguageMetaData:()=>wb,parser:{}};function Db(e){return Qg.parse(`memory:///${e}.wdl`)}var Ob=class extends x_{documents;constructor(e){super(e),this.documents=e.shared.workspace.LangiumDocuments}getScope(e){let t=this.reflection.getReferenceType(e)===`AssetDecl`,n=E(e.container).parseResult.value,r=[],i=(e,t,n)=>r.push(this.descriptions.createDescription(e,t,n)),a=(e,n,r)=>{if(t)for(let t of e.assets)i(t,r?`${r}.${t.id}`:t.id,n);else for(let t of e.components)i(t,r?`${r}.${t.name}`:t.name,n)};a(n,E(e.container),``);for(let e of n.imports){let t=this.documents.getDocument(Db(e.ref));t&&a(t.parseResult.value,t,e.ns??``)}return new h_(r)}},kb=[{type:`beam`,fields:[{name:`name`,kind:`text`,required:!1,doc:`Label`},{name:`x`,kind:`coord`,doc:`Top-left X`,unit:`project units`},{name:`y`,kind:`coord`,doc:`Top-left Y`,unit:`project units`},{name:`width`,kind:`extent`,doc:`X extent`,unit:`project units`},{name:`length`,kind:`extent`,doc:`Y extent`,unit:`project units`},{name:`height`,kind:`extent`,required:!1,doc:`Vertical thickness`,unit:`project units`},{name:`z_offset`,kind:`coord`,required:!1,doc:`Lift above floor base`,unit:`project units`}]},{type:`floor_slab`,fields:[{name:`name`,kind:`text`,required:!1,doc:`Label`},{name:`x`,kind:`coord`,doc:`Top-left X`,unit:`project units`},{name:`y`,kind:`coord`,doc:`Top-left Y`,unit:`project units`},{name:`width`,kind:`extent`,doc:`X extent`,unit:`project units`},{name:`length`,kind:`extent`,doc:`Y extent`,unit:`project units`},{name:`thickness`,kind:`nonneg`,required:!1,doc:`Slab thickness (defaults to floor's)`,unit:`project units`},{name:`z_offset`,kind:`coord`,required:!1,doc:`Lift above floor base`,unit:`project units`}]},{type:`pillar`,fields:[{name:`name`,kind:`text`,doc:`Label`},{name:`x`,kind:`coord`,doc:`Top-left corner X`,unit:`project units`},{name:`y`,kind:`coord`,doc:`Top-left corner Y`,unit:`project units`},{name:`width`,kind:`extent`,required:!1,doc:`X extent`,unit:`project units`},{name:`length`,kind:`extent`,required:!1,doc:`Y extent`,unit:`project units`},{name:`height`,kind:`extent`,doc:`Column height`,unit:`project units`},{name:`z_offset`,kind:`coord`,required:!1,doc:`Lift above floor base`,unit:`project units`}]},{type:`plinth`,fields:[{name:`name`,kind:`text`,required:!1,doc:`Label`},{name:`material`,kind:`text`,required:!1,doc:`Material key`},{name:`x`,kind:`coord`,doc:`Top-left X`,unit:`project units`},{name:`y`,kind:`coord`,doc:`Top-left Y`,unit:`project units`},{name:`width`,kind:`extent`,doc:`X extent`,unit:`project units`},{name:`length`,kind:`extent`,doc:`Y extent`,unit:`project units`},{name:`height`,kind:`extent`,doc:`Plinth height`,unit:`project units`},{name:`z_offset`,kind:`coord`,required:!1,doc:`Lift above ground`,unit:`project units`}],doc:'The plinth is now a normal object placed on the "Plinth" floor (the first floor, number 0), not a top-level config key. Its footprint + height match the old top-level plinth; the plinth floor\'s `height` drives the rise to the floor above (replacing the old hardcoded plinth_height seed).'},{type:`ground`,fields:[{name:`name`,kind:`text`,required:!1,doc:`Label`},{name:`material`,kind:`text`,required:!1,doc:`Material key`},{name:`x`,kind:`coord`,doc:`Top-left X`,unit:`project units`},{name:`y`,kind:`coord`,doc:`Top-left Y`,unit:`project units`},{name:`width`,kind:`extent`,doc:`X extent`,unit:`project units`},{name:`length`,kind:`extent`,doc:`Y extent`,unit:`project units`},{name:`height`,kind:`nonneg`,required:!1,doc:`Thickness (0 = flat)`,unit:`project units`},{name:`z_offset`,kind:`coord`,required:!1,doc:`Lift above origin`,unit:`project units`}],doc:"The ground plane, also on the Plinth floor. Extent defaults to the site plot when authored by the migration. `height` is an optional thickness (0 = a flat plane); slope fields are a later phase."},{type:o,fields:a,doc:c}];function Ab(e){let t=new Map;for(let n of e){let e=n.fields.map(e=>e.name);t.set(n.type,{type:n.type,positional:e.filter(e=>e!==`name`),fieldNames:new Set(e)})}return t}var jb=Ab(kb),Mb=e=>jb.get(e),Nb=()=>[...jb.keys()],Pb=e=>e.replace(/^"(.*)"$/s,`$1`),Fb=class{checkObjectDecl(e,t){let n=Mb(e.type);if(n){e.args.length>n.positional.length&&t(`error`,`'${e.type}' takes at most ${n.positional.length} positional argument(s) (${n.positional.join(`, `)}), got ${e.args.length}.`,{node:e,property:`args`});for(let r of e.fields){let i=Pb(r.key);i!==`name`&&(n.fieldNames.has(i)||t(`warning`,`Unknown field '${i}' on '${e.type}'.`,{node:r,property:`key`}))}}}};function Ib(e){let t=new Fb;e.validation.ValidationRegistry.register({ObjectDecl:(e,n)=>t.checkObjectDecl(e,n)},t)}var Lb=e=>typeof e==`string`&&/^[a-z_][a-z0-9_]*$/i.test(e),Rb=class extends qh{buildKeywordTokens(e,t,n){let r=super.buildKeywordTokens(e,t,n),i=t.find(e=>e.name===`ID`);if(!i)return r;let a=this.softKeywords(e);for(let e of r)a.has(e.name)&&(e.CATEGORIES=[...e.CATEGORIES??[],i]);return r}softKeywords(e){let t=new Set,n=new Set;for(let r of e)for(let e of A(r)){let r=e;if(r.$type===`Keyword`&&Lb(r.value)&&t.add(r.value),r.$type===`Assignment`&&r.terminal)for(let e of A(r.terminal)){let t=e;t.$type===`Keyword`&&Lb(t.value)&&n.add(t.value)}}return new Set([...t].filter(e=>!n.has(e)&&!i.has(e)&&!s.has(e)))}};export{Ut as $,Ov as A,Hg as B,mb as C,S as Ct,Mv as D,kv as E,c_ as F,Op as G,Fg as H,X as I,Rn as J,wn as K,e_ as L,Y_ as M,Y as N,Av as O,S_ as P,Hn as Q,Qg as R,rb as S,O as St,Rv as T,Kp as U,Y as V,sh as W,Fn as X,zn as Y,Pn as Z,Iy as _,ae as _t,Ob as a,oe as at,Zy as b,k as bt,Tb as c,he as ct,yy as d,Ie as dt,Ht as et,xy as f,He as ft,Ay as g,Tt as gt,Oy as h,gt as ht,Nb as i,Mt as it,X_ as j,Dv as k,Yv as l,we as lt,Ey as m,ot as mt,Ib as n,Kt as nt,Db as o,le as ot,wy as p,$e as pt,bn as q,Mb as r,Pt as rt,Eb as s,de as st,Rb as t,Gt as tt,Zv as u,Me as ut,Ry as v,T as vt,Wv as w,tb as x,A as xt,Jy as y,E as yt,Gg as z};