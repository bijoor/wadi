// Intentionally BROKEN — for testing the error path (playground red squiggles;
// the watch CLI keeps the last-good .wadi so the model never blanks).
// Two mistakes are marked; fix them to make it compile.
house Broken {
  convention center
  units feet_inches per_unit 10
  site { plot (300, 300) }

  floor 1 "Ground" {
    room Studio at (4, 4) size (200 240) {     // ERROR 1: missing comma → "200, 240"
      wall south { door Main at 90 sze (34, 84) }   // ERROR 2: "sze" should be "size"
    }
  }
}
