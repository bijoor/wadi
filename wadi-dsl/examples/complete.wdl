// Coverage showcase — every model entity as FIRST-CLASS syntax, no `raw`:
// module imports, layers, a goal-tagged component library (definition + in-file
// `use` + cross-file `use kb.Comp`), ground, plinth, slab, beam, room (with
// openings + a pack item AND an inline item), a free-standing wall, a kitchen
// platform, free furniture, a pillar, and a gable roof that is `enabled`-gated by
// the configurator. If it compiles + validates, the DSL covers the whole model.
house CompleteShowcase {
  convention center
  units feet_inches per_unit 10

  site { plot (400, 500) ref (0, 0) }
  defaults { floor_height 116 wall_height 108 slab_thickness 8 wall_thickness 8 }  // floor_height = wall_height + slab_thickness (C4)

  // Module packs: furniture assets (item f."id") + Konkan house parts (use kb.Name).
  import "std-furniture" as f
  import "konkan/base"   as kb

  var wallT = 8
  var roof_style = 2            // 2 = Gable (drives the enabled gate below)
  point House { x = 300, y = 400 }

  // Per-house display layers (registry).
  layer "structure" "Structure" group "Frame"
  layer "furniture" "Furniture" color "#8B5A2B"

  // Reusable in-file component (with a discovery goal), authored in local coords.
  component Bench goal "a low bench to sit on" {
    param blen = 60 label "Bench length"
    param bdep = 18
    beam name "BenchTop" at (0, 0) size (blen, bdep) height 6 layer "structure"
  }

  configurator {
    slider wallT      "Wall thickness" in [6 .. 12 step 1]
    select roof_style "Roof style" { Flat = 0, Shed = 1, Gable = 2, Hip = 3 }
  }

  grid main {
    x: 1 @ wallT / 2, 2 @ House.W - wallT / 2
    y: A @ wallT / 2, B @ House.L - wallT / 2
  }

  floor 0 "Plinth" height 40 {                 // floor height == plinth height (C1)
    ground name "Ground" at (0, 0) size (400, 500) layer "ground"
    plinth name "Plinth"
      at (main.x1, main.yA) size (main.x2 - main.x1, main.yB - main.yA)
      height 40 layer "plinth"
  }

  floor 1 "Ground Floor" {
    slab at (main.x1, main.yA) size (main.x2 - main.x1, main.yB - main.yA)

    // A tie beam across the rear span.
    beam name "Tie" at (main.x1, main.yB - 8) size (main.x2 - main.x1, 8) height 8 layer "structure"

    // Living room with a door, a window, and a bed from the furniture pack
    // (`item f."id"`) anchored to a corner.
    room Living at (main.x1, main.yA) size (main.x2 - main.x1, main.yB - main.yA) {
      wall east west                                  // plain walls — several in one line
      wall south { door Main at 120 size (36, 84) }   // walls with openings: one side each
      wall north { window N1 at 100 size (60, 50) sill 35 }
      item f."bed_double" anchor bottom-right gap (12, 12) rotation 0
    }

    // A free-standing partition wall.
    wall Partition from (main.x1 + 100, main.yA) to (main.x1 + 100, main.yB - 150)
      height 108 facing east layer "structure"

    // An L-shaped kitchen counter (polyline path).
    kitchen name "Counter" path ((40, 40), (140, 40), (140, 120)) side right depth 24 height 36 layer "structure"

    // Free furniture placed by absolute plan coordinates. The inline `asset {…}`
    // form still works for a one-off GLB not in any pack.
    item name "Sofa" asset { id "sofa" src "furniture/sofa.glb" dims (1.9, 0.8, 0.9) category "living" }
      at (150, 300) rotation 90 scale 1 layer "furniture"

    // A corner column, an in-file Bench (param overridden), and a part stamped
    // from the konkan/base pack (cross-file `use kb.Comp`).
    pillar C1 at (main.x1, main.yA) size (10, 10) height 116 layer "structure"
    use Bench as "WindowBench" at (60, 60) with { blen = 80 }
    use kb.Otla at (155, 420) with { wide = 90, deep = 55 }   // entrance platform in the front yard
  }

  floor 2 "Loft" {
    // Gable roof (open endpoints), gated so it renders only when roof_style == 2.
    roof name "Gable Roof" pitched endpoint open slope angle 30 overhang 20
      enabled 1 - min(1, abs(roof_style - 2)) layer "roof" {
      segment "seg0" from (150, 0) to (150, 400) width 300 gable_overhang (20, 20) tie_beams 2
      truss "seg0" fink at (80, 200, 320)
    }
  }
}
