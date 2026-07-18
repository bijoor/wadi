// Small, styled form field primitives used by every object editor.
// Debounced-commit numeric input so live-typing doesn't push a state
// update per keystroke (feeds the 3D/SVG previews).

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

interface BaseProps {
  // Optional so grouped rows (e.g. polyline point editors) can omit the
  // label on all but the first field. FieldRow renders `{label}`, which
  // is a no-op when undefined.
  label?: string;
  hint?: string;
  error?: string;
}

interface NumberFieldProps extends BaseProps {
  value: number | undefined;
  onCommit: (n: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
}

// Number input with local buffer + debounced commit. The stored value
// is number|undefined; the input works on strings so partial inputs
// (e.g. `-`, `.`, empty during a rewrite) don't clobber the value.
export function NumberField({
  label,
  hint,
  error,
  value,
  onCommit,
  step,
  min,
  max,
  suffix,
  disabled,
  allowEmpty,
}: NumberFieldProps) {
  const [buf, setBuf] = useState<string>(value === undefined ? "" : String(value));

  // Sync outward changes (undo/redo, external replace) back to buffer.
  const lastOutward = useRef(value);
  useEffect(() => {
    if (value !== lastOutward.current) {
      setBuf(value === undefined ? "" : String(value));
      lastOutward.current = value;
    }
  }, [value]);

  const commit = (next: string) => {
    if (next === "" || next === "-" || next === ".") {
      if (allowEmpty) onCommit(undefined);
      return;
    }
    const n = Number(next);
    if (!Number.isFinite(n)) return;
    if (min !== undefined && n < min) return;
    if (max !== undefined && n > max) return;
    onCommit(n);
    lastOutward.current = n;
  };

  // step is a legacy prop — with type="text" browsers ignore it. Kept
  // in the signature so callers don't have to change; consumed here
  // just to silence unused-var lint.
  void step;

  // Use type="text" with inputMode="decimal" instead of type="number".
  // type="number" empties `e.target.value` mid-typing when the string
  // is briefly not-a-number (e.g. "86." with a lone trailing period),
  // which appears as a blanking field to the user.
  return (
    <FieldRow label={label} hint={hint} error={error}>
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={buf}
          onChange={(e) => {
            // Filter to a permissive decimal-string pattern:
            // optional leading -, digits, single '.', more digits.
            const v = e.target.value;
            if (v === "" || /^-?\d*\.?\d*$/.test(v)) {
              setBuf(v);
            }
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={inputStyle(!!error, !!disabled)}
        />
        {suffix && (
          <span className="text-[10px] text-slate-500">{suffix}</span>
        )}
      </div>
    </FieldRow>
  );
}

interface TextFieldProps extends BaseProps {
  value: string | undefined;
  onCommit: (s: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TextField({
  label,
  hint,
  error,
  value,
  onCommit,
  placeholder,
  disabled,
}: TextFieldProps) {
  const [buf, setBuf] = useState<string>(value ?? "");
  const lastOutward = useRef(value);
  useEffect(() => {
    if (value !== lastOutward.current) {
      setBuf(value ?? "");
      lastOutward.current = value;
    }
  }, [value]);
  return (
    <FieldRow label={label} hint={hint} error={error}>
      <input
        type="text"
        disabled={disabled}
        placeholder={placeholder}
        value={buf}
        onChange={(e) => setBuf(e.target.value)}
        onBlur={() => {
          onCommit(buf);
          lastOutward.current = buf;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={inputStyle(!!error, !!disabled)}
      />
    </FieldRow>
  );
}

interface SelectFieldProps<T extends string> extends BaseProps {
  value: T | undefined;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  disabled?: boolean;
}

export function SelectField<T extends string>({
  label,
  hint,
  error,
  value,
  onChange,
  options,
  disabled,
}: SelectFieldProps<T>) {
  return (
    <FieldRow label={label} hint={hint} error={error}>
      <select
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value as T)}
        className={inputStyle(!!error, !!disabled)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldRow>
  );
}

function FieldRow({
  label,
  hint,
  error,
  children,
}: BaseProps & { children: React.ReactNode }) {
  return (
    <label className="mb-2 block">
      <div className="mb-0.5 flex items-baseline gap-2">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </div>
      {children}
      {error && (
        <div className="mt-0.5 text-[10px] text-red-400">{error}</div>
      )}
    </label>
  );
}

function inputStyle(hasError: boolean, disabled: boolean) {
  return clsx(
    "w-full rounded border bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none",
    hasError ? "border-red-500" : "border-slate-700 focus:border-emerald-500",
    disabled && "cursor-not-allowed opacity-60",
  );
}

// Compact section header used inside forms to group related fields.
export function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <fieldset className="mb-3 rounded border border-slate-800 bg-slate-900/40 p-2">
      <div className="mb-2 flex items-center justify-between">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </legend>
        {actions}
      </div>
      {children}
    </fieldset>
  );
}
