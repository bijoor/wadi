// Minimal valid house — one floor, one room. The smallest thing that renders.
house Minimal {
  convention center
  units feet_inches per_unit 10
  site { plot (300, 300) }
  defaults { floor_height 120 wall_height 108 slab_thickness 8 wall_thickness 8 }

  // No floor slab modelled here, so slab_thickness is 0 (convention C3) — the
  // walls sit directly on grade instead of floating on a phantom deck.
  floor 1 "Ground" slab_thickness 0 {
    room Studio at (4, 4) size (200, 240) {
      wall east west                                  // enclose the exterior sides (C2)
      wall south { door Main   at 90 size (34, 84) }
      wall north { window Light at 80 size (60, 50) sill 35 }
    }
  }
}
