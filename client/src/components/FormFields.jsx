import { ChevronDown } from "lucide-react";
import { useId } from "react";

export function SelectField({ label, value, onChange, options, placeholder, disabled = false }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <div className="relative">
        <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="field appearance-none pr-9 disabled:cursor-not-allowed disabled:bg-sand-100 disabled:text-sand-500">
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => {
            const opt = typeof o === "string" ? { value: o, label: o } : o;
            return <option key={opt.value} value={opt.value}>{opt.label}</option>;
          })}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      </div>
    </div>
  );
}

export function NumberField({ label, value, onChange, placeholder }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <input id={id} type="number" inputMode="numeric" min="0" step="1000" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="field" />
    </div>
  );
}
