// konkan_cottage — a small single-storey Konkan house assembled from the
// bundled MODULE packs, showing the whole import/reuse flow in one file:
//   • `import "std-furniture" as f`  → drop GLB furniture with `item f."id"`
//   • `import "konkan/base"   as kb` → stamp goal-tagged parts with `use kb.Name`
// The two hand-built rooms (Hall, Bedroom) are furnished; everything else
// (kitchen, bathroom, verandah, otla, tulsi vrindavan) comes from the pack.
house KonkanCottage {
  convention center
  units feet_inches per_unit 10

  site { plot (420, 440) ref (0, 0) }
  defaults { floor_height 116 wall_height 108 slab_thickness 8 wall_thickness 8 }

  import "std-furniture" as f     // furniture pack (assets → item f."id")
  import "konkan/base"   as kb    // house-parts pack (components → use kb.Name)

  // One habitable floor sitting straight on grade (no slab ⇒ slab_thickness 0, C3).
  floor 1 "Ground" slab_thickness 0 {

    // --- hand-built, furnished rooms ---
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

    // --- parts from konkan/base ---
    use kb.Kitchen  at (40, 210)                        // "cooking area with an L-shaped counter"
    use kb.Bathroom at (210, 210) with { wide = 70, deep = 60 }   // "compact enclosed wet area"
    use kb.Verandah at (40, 350) with { across = 200, deep = 70 } // "shaded sit-out along the front"
    use kb.Otla     at (260, 360)                        // "raised entrance platform (otla)"
    use kb.TulsiVrindavan at (360, 370)                  // "courtyard planter for tulsi"

    // --- compound walls — 5 ft perimeter boundary (height 50) ----------------
    // at (x,y) = top-left corner; size (w,l) = east × south extent.
    compound_wall NorthWall at (0, 0)   size (420, 8)   height 50
    compound_wall SouthWall at (0, 432) size (420, 8)   height 50
    compound_wall EastWall  at (412, 0) size (8, 440)   height 50
    compound_wall WestWall  at (0, 0)   size (8, 440)   height 50

    // --- well — circular, 3 ft diameter, rear-east yard ----------------------
    // at (x,y) = plan centre; ≥80 units from any room wall (verandah east X=240).
    well BackWell at (320, 400)
        shape circular diameter 30 parapet_height 10

    // --- solar panel — 3.5 kW roof-mount, south-facing (azimuth 180) --------
    // Centred over the main rooms; tilt 15° (low-angle for flat roof).
    solar_panel RoofArray at (210, 160)
        mount roof capacity_kw 3.5 azimuth 180 tilt 15

  }
}
