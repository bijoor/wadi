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
<pre>configurator {
  slider target "Label" ft [min .. max step s]
  number target "Label" ft
  toggle target "Label"
  select target "Label" { OptA = 0, OptB = 1 }
}</pre>

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

<h3>Rooms, walls &amp; openings</h3>
<pre>room Name at (x,y) size (w,l) [height &lt;h&gt;] {
  wall north|south|east|west [height &lt;h&gt;] [height_end &lt;h&gt;] {
    door   Name at &lt;offset&gt; size (w,h) [open]
    window Name at &lt;offset&gt; size (w,h) [sill &lt;s&gt;] [open]
  }
  item asset { … } anchor center [gap (gx,gy)]   // furniture anchored in the room
}
wall Name from (x1,y1) to (x2,y2) [height &lt;h&gt;] [facing north|…] { …openings… }</pre>

<h3>Circulation &amp; fittings</h3>
<pre>staircase [name "N"] at (start_x, start_y) step (rise, tread, width)
  direction north|south|east|west
  [total_height &lt;h&gt;] [max_run &lt;r&gt;] [landing_depth …] [turn clockwise|anticlockwise]
kitchen [name "N"] path ((x,y), (x,y), …) side left|right depth &lt;d&gt; height &lt;h&gt; [base_z …]
item [name "N"] asset { id "…" src "…glb" dims (w,h,d) [category "…"] }
  at (x,y) [rotation &lt;deg&gt;] [scale &lt;s&gt;] [anchor_to "Room" anchor center gap (gx,gy)]</pre>

<h3>Roof <span class="ref-dim">— one object; flat / shed / gable / hip</span></h3>
<pre>roof [name "N"] pitched|shed|flat
  [endpoint open|closed]        // open = gable end-wall · closed = hip triangle
  [slope angle &lt;deg&gt; | slope height &lt;ridge_h&gt;]
  [overhang &lt;o&gt;] [slab_thickness &lt;t&gt;] [parapet &lt;h&gt; x &lt;t&gt;] {
    segment "id" from (x,y) to (x,y) width &lt;w&gt;
      [high_side left|right] [start_endpoint …] [end_endpoint …]
      [hip_setback (a,b)] [gable_overhang (a,b)] [hip_ridge_extension (a,b)] [tie_beams N]
    truss "segId" fink|mono_pitch at (pos, pos, …)
  }</pre>

<h3>Component library <span class="ref-dim">— reusable mini-house</span></h3>
<pre>component Bench {              // define once (local coords, origin 0,0)
  param blen = 60 label "Bench length"
  beam name "Top" at (0,0) size (blen, 18) height 6
}
use Bench as "B1" at (x,y) with { blen = 80 }   // stamp it onto a floor</pre>

<h3>Layers &amp; the raw escape</h3>
<pre>layer "id" "Label" [color "#rrggbb"] [group "Group"]   // per-house layer registry
raw "type" { …literal JSON… }   // escape hatch — no shipped model needs it</pre>
<p class="ref-note">Every model object type now has first-class syntax; <code>raw</code>
remains only as a hatch to the host JSON. Full schema:
<code>wadi-skill/architect/reference/data-model.md</code>.</p>
`;
