// The DSL cheat-sheet shown in the playground's Reference panel. Kept in sync
// with wadi.langium by hand (the eventual Langium LSP would supply this via
// hover/completion instead).

export const REFERENCE_HTML = `
<h2>Wadi DSL (<code>.wdl</code>) reference</h2>
<p class="ref-note">Geometry is in <b>project units</b> (10 units = 1&nbsp;ft by
default). X is right, Y is down. In <code>center</code> convention, room and grid
coordinates are wall <b>centrelines</b> — adjacent rooms simply abut on a shared
line.</p>

<h3>Skeleton</h3>
<pre>house Name {
  convention center            // or: outer
  units feet_inches per_unit 10
  site { plot (width, length) ref (x, y) }
  defaults { floor_height 120 wall_height 108 slab_thickness 8 wall_thickness 8 }
  // vars, points, grid, configurator, floors…
}</pre>

<h3>Parametric core</h3>
<pre>var name = &lt;expr&gt;                      // a number, or a formula
point Name { x = &lt;expr&gt;, y = &lt;expr&gt; }   // ref as Name.x / Name.W / Name.L
grid main {
  x: 1 @ &lt;expr&gt;, 2 @ &lt;expr&gt;  [thick &lt;expr&gt;]  [role structural|planning]
  y: A @ &lt;expr&gt;, B @ &lt;expr&gt;
}                                       // line position published as main.x1 / main.yA</pre>

<h3>Formulas</h3>
<pre>+  -  *  /   ( )   -unary
min  max  clamp  round  floor  ceil  abs
refs: a var · a point (House.W) · a grid line (main.x3 - main.x1)</pre>

<h3>Control knobs (owner UI)</h3>
<p class="ref-note">The template the home owner configures. Each knob binds to a
<code>var</code> by name (<code>target</code>). <code>title</code>/<code>note</code>
label the panel; <code>group</code> sections it; each input takes a trailing
<code>note</code>. Select labels are bare ids or quoted strings.</p>
<pre>configurator {
  title "Configure your home"
  note  "Everything re-flows to fit."

  slider target "Label" ft [min .. max step s] note "help text"
  number target "Label" ft
  toggle target "Label"
  select target "Label" { Thin = 6, "10 ft (std)" = 100 }

  group "Section title" note "about this section" {
    slider target2 "Label" percent [0.1 .. 0.3 step 0.01]
  }
}</pre>
<p class="ref-note">To expose a plot dimension, model it as a <code>var</code>
and reference it from the point (<code>point House { x = W }</code>), then bind the
knob to <code>W</code> — knobs target vars, not point fields.</p>

<h3>Floors <span class="ref-dim">— array order = vertical stack</span></h3>
<pre>floor 0 "Plinth" <b>height 60</b> wall_height 108 slab_thickness 12 {
  …objects…
}</pre>
<p class="ref-note"><code>height</code> = floor-to-floor rise ·
<code>wall_height</code> = standing wall · <code>slab_thickness</code> = deck.
All three are optional and fall back to <code>defaults</code>. <b>To change the
plinth floor's height, add <code>height N</code> after its name.</b></p>

<h3>Common tail <span class="ref-dim">— every object accepts these, in this order</span></h3>
<pre>… z_offset &lt;expr&gt;  enabled &lt;expr&gt;  layer "id"  [material "id"]</pre>
<p class="ref-note"><code>enabled &lt;expr&gt;</code> is the on/off switch — set it to a
0/1 formula to gate an object on a configurator variable, e.g.
<code>enabled 1 - min(1, abs(roof_style - 3))</code> renders the object only when
<code>roof_style == 3</code>. Any geometry number can be a <b>formula</b> just by
writing an expression instead of a literal.</p>

<h3>Structure &amp; envelope</h3>
<pre>slab   [name "N"] at (x,y) size (w,l) [thickness &lt;t&gt;]
beam   [name "N"] at (x,y) size (w,l) [height &lt;h&gt;]
plinth [name "N"] at (x,y) size (w,l) height &lt;h&gt;
ground [name "N"] at (x,y) size (w,l) [height &lt;h&gt;]
pillar Name       at (x,y) size (w,l) [height &lt;h&gt;]</pre>
<p class="ref-note"><code>at (x,y)</code> is the <b>TOP-LEFT corner</b> (not the centre),
same as rooms/slabs. To centre a column on a point <code>(cx,cy)</code> — e.g. a grid
node — place it at <code>at (cx - w/2, cy - l/2)</code>.</p>

<h3>Rooms, walls &amp; openings</h3>
<pre>room Name at (x,y) size (w,l) [height &lt;h&gt;] {
  wall east west north             // plain walls — list several in one statement
  wall south { door Main at &lt;offset&gt; size (w,h) [open] }   // a wall WITH an opening: one side
  wall west { window W at &lt;offset&gt; size (w,h) [sill &lt;s&gt;] [open] }
  item asset { … } anchor center [gap (gx,gy)]   // furniture anchored in the room
}
wall Name from (x1,y1) to (x2,y2) [height &lt;h&gt;] [height_end &lt;h2&gt;] [facing north|…] { …openings… }
                                                //  height_end ≠ height ⇒ sloping-top wall</pre>
<p class="ref-note">A room shows exactly the walls you declare (a bare room with
no <code>wall</code> lines is enclosed on all four sides). Declare plain walls
compactly — <code>wall east west north</code> — and give a wall its own line only
when it carries a door/window. Omit a side to leave it open (verandah).</p>
<p class="ref-note"><b>Free-standing walls don't auto-mitre at corners.</b> Two
<code>wall … from … to …</code> that just touch at a point leave a small notch; extend
the endpoints so the bodies <b>overlap</b> (≥ ½·wall_thickness past the shared point) to
fill the corner. Room walls handle their own corners.</p>

<h3>Circulation &amp; fittings</h3>
<pre>staircase [name "N"] at (start_x, start_y) step (rise, tread, width)
  direction north|south|east|west
  [total_height &lt;h&gt;] [max_run &lt;r&gt;] [landing_depth …] [landing_thickness …] [flight_gap …] [turn clockwise|anticlockwise]
                                //  max_run ⇒ auto switchback flights (landing_thickness / flight_gap tune it)
kitchen [name "N"] path ((x,y), (x,y), …) side left|right depth &lt;d&gt; height &lt;h&gt; [base_z …]
item [name "N"] asset { id "…" src "…glb" dims (w,h,d) [category "…"] }
  at (x,y) [rotation &lt;deg&gt;] [scale &lt;s&gt;] [anchor_to "Room" anchor center gap (gx,gy)]</pre>

<h3>Roof <span class="ref-dim">— one object; flat / shed / gable / hip</span></h3>
<pre>roof [name "N"] pitched|shed|flat
  [endpoint open|closed]        // open = gable end-wall · closed = hip triangle
  [slope angle &lt;deg&gt; | slope height &lt;ridge_h&gt;]   // symmetric pitch (one value)
  [slope angle (&lt;left&gt;, &lt;right&gt;)]                  // asymmetric (saltbox) gable — angle pair
  [overhang &lt;o&gt;] [slab_thickness &lt;t&gt;] [parapet &lt;h&gt; x &lt;t&gt;] [gable_wall_thickness &lt;t&gt;]
  [framing { …json… }]          // advanced: structural member sizes (rafter/purlin/ridge/truss)
  {
    segment "id" from (x,y) to (x,y) width &lt;w&gt;
      [high_side left|right] [start_endpoint …] [end_endpoint …]
      [hip_setback (a,b)] [gable_overhang (a,b)] [hip_ridge_extension (a,b)]
      [overhang &lt;o&gt;]                            // uniform eave (all four sides)
      [overhang_start/overhang_end &lt;o&gt;]          // along axis (shed · gable end)
      [overhang_low/overhang_high &lt;o&gt;]           // SHED eaves · [overhang_left/overhang_right] PITCHED eaves
      [tie_beams N]
    truss "segId" fink|mono_pitch at (pos, pos, …)
  }</pre>
<p class="ref-note"><b>Roof coordinates are wall centrelines, like rooms.</b>
<code>from</code>/<code>to</code> is the axis and <code>width</code> its span
centred on it — author them on the same grid as the walls and the roof auto-grows
to the <b>outer wall face</b> (then <code>overhang</code> extends beyond). Don't add
½-wall fudge factors, or the roof lands half a wall thickness inside the walls.</p>
<p class="ref-note"><b>Asymmetric (saltbox) gable.</b> Give <code>slope angle</code> a
<b>pair</b> — <code>slope angle (45, 25)</code> — for two different pitches. The eaves
stay put and the ridge shifts across the width so each side takes its angle; the pair
is <code>(left, right)</code> by the segment's left normal (the same sides as
<code>overhang_left</code>/<code>right</code>). A single value is symmetric; a pair is
asymmetric — nothing else to set. Best on a single-segment gable
(<code>endpoint open</code>).</p>

<h3>Component library <span class="ref-dim">— reusable mini-house</span></h3>
<pre>component Bench {              // define once (local coords, origin 0,0)
  param blen = 60 label "Bench length"
  beam name "Top" at (0,0) size (blen, 18) height 6
}
use Bench as "B1" at (x,y) rotation 90 with { blen = 80 }   // stamp onto a floor
// rotation is optional (yaw°): 0/90/180/270 for structural components,
// any angle for furniture-only components.

import "konkan/base" as kb            // reuse another .wdl's components
use kb.Verandah as "V1" at (x,y)      // namespaced stamp from the imported module
goal "A reusable Konkan bathroom"     // module intent (house-less .wdl = a component pack)</pre>
<p class="ref-note"><b>Save &amp; reuse your own libraries.</b> A <code>.wdl</code>
of <code>component</code>/<code>asset</code> decls is a module. The
<b>📚 Library</b> toolbar menu keeps a <b>cache of loaded libraries</b> that
<code>import</code> resolves from — the same on web and desktop. Load one three
ways: <i>Save current as library</i>, <i>Load library file</i>, or (desktop) just
drop a <code>.wdl</code> beside your open file (or in a <code>modules/</code>
subfolder). Click a cached library to insert its <code>import</code> line.
Resolution order: <b>your cache → bundled packs</b> (<code>std-furniture</code>,
<code>konkan/base</code>).</p>

<h3>Layers &amp; the raw escape</h3>
<pre>layer "id" "Label" [color "#rrggbb"] [group "Group"]   // per-house layer registry
raw "type" { …literal JSON… }   // escape hatch — no shipped model needs it</pre>
<p class="ref-note">Every model object type now has first-class syntax; <code>raw</code>
remains only as a hatch to the host JSON. Full schema:
<code>wadi-skill/architect/reference/data-model.md</code>.</p>
`;
