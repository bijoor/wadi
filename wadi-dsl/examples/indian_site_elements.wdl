// indian_site_elements — demonstrates the three first-class site primitives
// (compound_wall, well, solar_panel) added on top of the konkan_cottage
// layout (same plot size, same rooms, same konkan/base components).
//
// This is a REFERENCE EXAMPLE for the architect skill. Copy the site element
// blocks into any house to add a perimeter wall, a well, or solar panels.
// All three primitives use named clauses (no raw{}); enum fields are bare
// keywords (shape circular, mount roof — never quoted strings).

house IndianSiteElements {
  convention center
  units feet_inches per_unit 10

  site { plot (420, 440) ref (0, 0) }
  defaults { floor_height 116 wall_height 108 slab_thickness 8 wall_thickness 8 }

  import "std-furniture" as f     // furniture pack (assets → item f."id")
  import "konkan/base"   as kb    // house-parts pack (components → use kb.Name)

  // One habitable floor sitting straight on grade (no slab ⇒ slab_thickness 0, C3).
  floor 1 "Ground" slab_thickness 0 {

    // --- rooms & fittings (same layout as konkan_cottage) --------------------
    room Hall at (40, 40) size (180, 150) {
      wall north east west
      wall south { door HallDoor at 80 size (36, 84) }
      item f."sofa" anchor center
    }
    room Bedroom at (240, 40) size (140, 150) {
      wall north south west
      wall east { window BedWin at 55 size (55, 55) sill 35 }
      item f."bed_double" anchor center
    }
    use kb.Kitchen        at (40, 210)
    use kb.Bathroom       at (210, 210) with { wide = 70, deep = 60 }
    use kb.Verandah       at (40, 350)  with { across = 200, deep = 70 }
    use kb.Otla           at (260, 360)
    use kb.TulsiVrindavan at (360, 370)

    // --- compound_wall — perimeter boundary, 5 ft (height 50) ----------------
    // Four walls enclose the 420×440 plot; wall_thickness 8 so corners overlap.
    // at (x, y) is the TOP-LEFT corner; size (w, l) is east × south extent.
    compound_wall NorthWall at (0, 0)   size (420, 8)   height 50
    compound_wall SouthWall at (0, 432) size (420, 8)   height 50
    compound_wall EastWall  at (412, 0) size (8, 440)   height 50
    compound_wall WestWall  at (0, 0)   size (8, 440)   height 50

    // --- well — circular, 3 ft diameter, 1 ft parapet, rear corner -----------
    // at (x, y) is the PLAN CENTRE; shape/diameter are bare keywords (no quotes).
    well DrinkingWell at (360, 390)
        shape circular
        diameter 30
        parapet_height 10
        asset { id "well_placeholder" src "furniture/sofa.glb" dims (0.9, 1.2, 0.9) }

    // --- solar_panel — roof-mount, 3.5 kW, south-facing (azimuth 180) --------
    // at (x, y) is the ARRAY CENTRE; mount/etc are bare keywords (no quotes).
    solar_panel RoofArray at (210, 50)
        mount roof
        capacity_kw 3.5
        panel_count 10
        azimuth 180
        tilt 15
        asset { id "solar_placeholder" src "furniture/sofa.glb" dims (3.3, 0.05, 1.65) }

  }
}
