// Furniture model migration. A room can hold furniture two ways: directly as
// `room.items` (the old form) or inside a `room.furniture` container (the model the
// furniture-catalog tool composes into). Mixing them double-renders and makes the
// catalog tool's seed/apply ambiguous. This offers a one-click migration on load
// that moves every room's direct items into its container.

import { useConfigStore } from "../state/configStore";

// deno-lint-ignore no-explicit-any
type Any = any;

const isFurnitureItem = (it: Any) => it && it.asset && Array.isArray(it.asset.dimensions);

// Count rooms that still carry direct furniture `items`.
export function countMigratableRooms(config: Any): number {
  let n = 0;
  for (const fl of config?.floors ?? []) {
    for (const o of fl?.objects ?? []) {
      if (o?.type === "room" && Array.isArray(o.items) && o.items.some(isFurnitureItem)) n++;
    }
  }
  return n;
}

// Move each room's direct furniture items into its `furniture` container (merged,
// locked so the auto-furnisher leaves the hand-authored set alone — matching the old
// direct-items behaviour), and clear the direct items. Pure; returns a new config.
export function migrateRoomFurniture(config: Any): { config: Any; rooms: number } {
  let rooms = 0;
  const floors = (config?.floors ?? []).map((fl: Any) => {
    const objects = (fl?.objects ?? []).map((o: Any) => {
      if (o?.type !== "room") return o;
      const direct = Array.isArray(o.items) ? o.items.filter(isFurnitureItem) : [];
      if (direct.length === 0) return o;
      rooms++;
      const prev = o.furniture ?? {};
      const items = [...(prev.items ?? []), ...direct];
      const next: Any = { ...o, furniture: { ...prev, locked: true, items } };
      // Keep any non-furniture entries that happened to sit in items; drop the rest.
      const kept = (o.items as Any[]).filter((it) => !isFurnitureItem(it));
      if (kept.length) next.items = kept; else delete next.items;
      return next;
    });
    return { ...fl, objects };
  });
  return { config: { ...config, floors }, rooms };
}

// A slim banner offering the migration; created lazily, reused.
let bannerEl: HTMLElement | null = null;
function banner(): HTMLElement {
  if (bannerEl) return bannerEl;
  const el = document.createElement("div");
  el.id = "furniture-migrate-banner";
  el.hidden = true;
  document.body.appendChild(el);
  bannerEl = el;
  return el;
}

const dismissed = new Set<string>();

function keyFor(): string {
  return useConfigStore.getState().filename ?? "(unnamed)";
}

function hide(): void { const b = banner(); b.hidden = true; }

function show(count: number): void {
  const b = banner();
  b.hidden = false;
  b.innerHTML = "";
  const msg = document.createElement("span");
  msg.className = "fmb-msg";
  msg.textContent = `${count} room${count > 1 ? "s have" : " has"} furniture in the old format.`;
  const migrate = document.createElement("button");
  migrate.className = "fmb-go";
  migrate.textContent = "Migrate to containers";
  migrate.addEventListener("click", () => {
    const st = useConfigStore.getState();
    if (!st.config) return;
    const { config } = migrateRoomFurniture(st.config);
    st.loadConfig(config, st.filename ?? undefined, st.filePath ?? null);
    hide();
  });
  const dismiss = document.createElement("button");
  dismiss.className = "fmb-x";
  dismiss.textContent = "Not now";
  dismiss.addEventListener("click", () => { dismissed.add(keyFor()); hide(); });
  b.append(msg, migrate, dismiss);
}

// Re-check whenever the loaded model changes; offer the migration once per file
// (until dismissed or migrated away).
export function wireFurnitureMigration(): void {
  const check = () => {
    const st = useConfigStore.getState();
    if (!st.config) { hide(); return; }
    const count = countMigratableRooms(st.config);
    if (count > 0 && !dismissed.has(keyFor())) show(count);
    else hide();
  };
  let lastConfig = useConfigStore.getState().config;
  let lastFile = useConfigStore.getState().filename;
  useConfigStore.subscribe((s) => {
    if (s.config !== lastConfig || s.filename !== lastFile) {
      // A different file clears its dismissal so the offer can reappear.
      if (s.filename !== lastFile) dismissed.delete(s.filename ?? "(unnamed)");
      lastConfig = s.config;
      lastFile = s.filename;
      check();
    }
  });
  check();
}
