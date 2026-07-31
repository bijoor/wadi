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
plinth floor's height, add <code>height N</code> after its name</b> (and/or set
the plinth object's own <code>"height"</code> in its <code>raw</code> block).</p>

<h3>Objects (first-class syntax)</h3>
<pre>room Name at (x, y) size (w, l) {
  wall north|south|east|west {
    door   Name at &lt;offset&gt; size (w, h)
    window Name at &lt;offset&gt; size (w, h) sill &lt;s&gt;
  }
}
pillar Name at (x, y) size (w, l) height &lt;h&gt;</pre>

<h3>Anything else → the <code>raw</code> escape</h3>
<pre>raw "type" { …fields… }     // fields = the .wadi schema for that type</pre>
<table class="ref-table">
<tr><th>type</th><th>key fields</th></tr>
<tr><td>ground</td><td>name, layer, x, y, width, length</td></tr>
<tr><td>plinth</td><td>name, layer, x, y, width, length, <b>height</b></td></tr>
<tr><td>floor_slab</td><td>x, y, width, length, thickness</td></tr>
<tr><td>beam</td><td>x, y, …, height, height_end</td></tr>
<tr><td>staircase</td><td>start_x, start_y, step_rise, step_tread, step_width, direction, max_run</td></tr>
<tr><td>roof</td><td>roof_type&nbsp;("pitched"|"shed"|"flat"), default_endpoint&nbsp;("closed"=hip&nbsp;/&nbsp;"open"=gable), slope&nbsp;{by,ridge_h}, segments[], trusses[]</td></tr>
<tr><td>kitchen_platform</td><td>path[], side, depth, height</td></tr>
<tr><td>item</td><td>asset&nbsp;{src, dimensions[w,h,d]}, x, y, rotation, scale</td></tr>
</table>
<p class="ref-note">Any raw field can carry a formula via a nested
<code>"formulas": { "field": "= expr" }</code> — that's how grid-driven raw
objects (plinth / slab) reflow. Full schema:
<code>wadi-skill/architect/reference/data-model.md</code>.</p>
`;
