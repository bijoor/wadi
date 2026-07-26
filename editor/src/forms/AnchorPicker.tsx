import clsx from "clsx";

// 3×3 anchor picker. Rows = north→south (top/center/bottom), cols = west→east
// (left/center/right). Value is the 9-point enum used by furniture anchoring.
const ANCHORS = [
  "top-left", "top-center", "top-right",
  "center-left", "center", "center-right",
  "bottom-left", "bottom-center", "bottom-right",
] as const;

export function AnchorPicker({
  value,
  onChange,
  label,
}: {
  value?: string;
  onChange: (a: string) => void;
  label?: string;
}) {
  const sel = value ?? "center";
  return (
    <div>
      {label && <div className="mb-1 text-[11px] text-slate-300">{label}</div>}
      <div className="inline-grid grid-cols-3 gap-0.5 rounded border border-slate-700 bg-slate-900 p-1">
        {ANCHORS.map((a) => (
          <button
            key={a}
            type="button"
            title={a}
            aria-label={a}
            aria-pressed={sel === a}
            onClick={() => onChange(a)}
            className={clsx(
              "h-5 w-5 rounded-sm border transition-colors",
              sel === a
                ? "border-emerald-400 bg-emerald-500/40"
                : "border-slate-700 bg-slate-800 hover:bg-slate-700",
            )}
          />
        ))}
      </div>
      <div className="mt-0.5 text-[10px] text-slate-500">{sel}</div>
    </div>
  );
}
