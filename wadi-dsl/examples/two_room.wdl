// Two rooms, NO grid — explicit centreline coordinates. Adjacent rooms just
// abut on a shared line (center convention), so Living's east edge (x=204) is
// Bedroom's west edge. A door connects them; each has a window.
house TwoRoom {
  convention center
  units feet_inches per_unit 10
  site { plot (420, 300) }
  defaults { floor_height 120 wall_height 108 slab_thickness 8 wall_thickness 8 }

  // No slab modelled ⇒ slab_thickness 0 so the walls don't float (convention C3).
  floor 1 "Ground" slab_thickness 0 {
    room Living at (4, 4) size (200, 240) {
      wall west                                       // exterior side, enclosed (C2)
      wall south { door  FrontDoor at 80 size (34, 84) }
      wall east  { door  Passage   at 90 size (32, 84) }
      wall north { window LivWin    at 70 size (60, 50) sill 35 }
    }
    room Bedroom at (204, 4) size (160, 240) {
      wall south                                      // exterior side, enclosed (C2)
      wall north { window BedWin at 60 size (55, 50) sill 35 }
      wall east  { window BedWinE at 90 size (45, 45) sill 40 }
    }
  }
}
