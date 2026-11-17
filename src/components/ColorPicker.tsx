import { COLOR_OPTIONS, type ColorKey } from "../utils/colors";

type Props = {
  value: string | undefined;
  onChange: (key: ColorKey) => void;
  label?: string;
};

/** Compact row of colored swatches used by notes and calendar events. */
export function ColorPicker({ value, onChange, label = "Cor" }: Props) {
  const selected = value ?? "none";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-zinc-400 shrink-0">{label}</span>
      <div className="flex items-center gap-1">
        {COLOR_OPTIONS.map((option) => {
          const active = option.key === selected;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              title={option.label}
              aria-label={`Cor ${option.label}`}
              aria-pressed={active}
              className={`w-5 h-5 rounded-full border transition-transform ${active ? "scale-110 ring-1 ring-white/70" : "hover:scale-110"}`}
              style={{
                backgroundColor: option.hex,
                borderColor: active ? "#ffffff" : "rgba(255,255,255,0.2)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
