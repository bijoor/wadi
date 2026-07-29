import { describe, expect, it } from "vitest";
import { validate } from "./houseConfig";

// A minimal valid house.
const base = () => ({
  site: { reference_x: 0, reference_y: 0, plot_width: 100, plot_length: 200 },
  floors: [
    { floor_number: 0, name: "GF", objects: [{ type: "room", name: "R", x: 0, y: 0, width: 10, length: 10 }] },
  ],
});

describe("validate() tolerant mode (forward-compat share loads)", () => {
  it("strict mode rejects unknown keys; tolerant mode strips them and loads", () => {
    const cfg = base() as Record<string, unknown>;
    cfg.future_top_level = { anything: 1 }; // a whole new top-level section
    (cfg.floors as { objects: Record<string, unknown>[] }[])[0].objects[0].future_field = 42; // a new field on a room

    // Strict (default): unknown keys are a hard error.
    expect(validate(cfg).ok).toBe(false);

    // Tolerant: unknown keys dropped, the rest loads, and we're told what went.
    const t = validate(cfg, { tolerant: true });
    expect(t.ok).toBe(true);
    expect(t.data).toBeTruthy();
    expect(new Set(t.stripped)).toEqual(new Set(["future_top_level", "floors/0/objects/0/future_field"]));
    // Known data survived; the unknown key is gone.
    expect((t.data as unknown as Record<string, unknown>).future_top_level).toBeUndefined();
    expect(t.data!.floors[0].objects![0].name).toBe("R");
  });

  it("tolerant mode still fails on a REAL error (not just unknown keys)", () => {
    const cfg = base() as Record<string, unknown>;
    delete cfg.site; // required — a genuine incompatibility, not a stray key
    cfg.future_field = 1;
    const t = validate(cfg, { tolerant: true });
    expect(t.ok).toBe(false);
    expect(t.errors?.some((e) => e.path.includes("site"))).toBe(true);
  });

  it("a fully-valid config reports no stripped keys", () => {
    const t = validate(base(), { tolerant: true });
    expect(t.ok).toBe(true);
    expect(t.stripped).toBeUndefined();
  });
});
