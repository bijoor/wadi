// Persona split. The same viewer bundle serves two clearly-separated surfaces:
//   • Gharkul  (owner)     — view + configure a template's exposed inputs.
//   • Nakasha  (architect) — full structural authoring (the edit panels).
// Resolved from the URL (`?mode=studio` → architect); otherwise the desktop
// app defaults to architect (that's its live-editing workflow), and the plain
// browser defaults to owner. See plans/configurator-plan.md.
import { isTauri } from "@tauri-apps/api/core";

export type Persona = "owner" | "architect";

const ARCHITECT_TOKENS = new Set(["studio", "architect", "nakasha"]);
const OWNER_TOKENS = new Set(["owner", "gharkul", "home", "configure"]);

// No explicit signal → the desktop app is the architect's live-editing tool;
// the plain browser defaults to the owner surface.
function defaultPersona(): Persona {
  try {
    return isTauri() ? "architect" : "owner";
  } catch {
    return "owner";
  }
}

let cached: Persona | null = null;

export function getPersona(): Persona {
  if (cached) return cached;
  let p: Persona = "owner";
  try {
    const mode = new URLSearchParams(location.search).get("mode");
    if (mode) {
      const m = mode.toLowerCase();
      p = ARCHITECT_TOKENS.has(m) ? "architect" : OWNER_TOKENS.has(m) ? "owner" : defaultPersona();
    } else if (/\/studio\/?$/.test(location.pathname)) {
      p = "architect";
    } else {
      p = defaultPersona();
    }
  } catch {
    /* no location — keep owner */
  }
  cached = p;
  return p;
}

export const isArchitect = (): boolean => getPersona() === "architect";
export const isOwner = (): boolean => getPersona() === "owner";

/** Switch persona in place (no reload) — updates the cached value so the next
 * getPersona()/isOwner()/isArchitect() reflects it. Callers re-apply the UI. */
export function setPersona(p: Persona): void {
  cached = p;
}

export const PERSONA_NAME: Record<Persona, string> = { owner: "Gharkul", architect: "Nakasha" };
export const PERSONA_TAGLINE: Record<Persona, string> = {
  owner: "Configure your home",
  architect: "Design studio",
};

/** The other persona and a relative URL that switches to it, preserving the rest. */
export function otherPersona(): { persona: Persona; url: string; name: string } {
  const other: Persona = isArchitect() ? "owner" : "architect";
  // Always use an explicit token so the switch sticks even in the desktop app
  // (where an absent mode would fall back to the architect default).
  const token = other === "architect" ? "studio" : "owner";
  let url = `?mode=${token}`;
  try {
    const u = new URL(location.href);
    u.searchParams.set("mode", token);
    url = u.pathname + u.search + u.hash;
  } catch {
    /* keep the simple fallback */
  }
  return { persona: other, url, name: PERSONA_NAME[other] };
}
