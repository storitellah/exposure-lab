/**
 * A stepped exposure control: label, − / + steppers, a range slider and a
 * formatted value. Fully keyboard operable; touch targets ≥ 44px.
 */
import { useId } from 'react';

export interface ControlSliderProps {
  label: string;
  values: number[];
  value: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
  /** Extra description announced to screen readers. */
  describe?: string;
}

export function ControlSlider({ label, values, value, format, onChange, disabled, describe }: ControlSliderProps) {
  const id = useId();
  const idx = (() => {
    let best = 0;
    let bestD = Infinity;
    values.forEach((v, i) => {
      const d = Math.abs(Math.log(v) - Math.log(value));
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  })();

  const set = (i: number) => {
    const clamped = Math.min(values.length - 1, Math.max(0, i));
    const v = values[clamped];
    if (v !== undefined && v !== value) onChange(v);
  };

  return (
    <div className="control-row slider-row">
      <label className="control-label" htmlFor={id}>{label}</label>
      <button
        type="button"
        className="stepper-btn"
        aria-label={`${label} −`}
        onClick={() => set(idx - 1)}
        disabled={disabled || idx === 0}
      >
        −
      </button>
      <input
        id={id}
        type="range"
        min={0}
        max={values.length - 1}
        step={1}
        value={idx}
        disabled={disabled}
        aria-valuetext={format(value)}
        aria-describedby={describe ? `${id}-desc` : undefined}
        onChange={(e) => set(Number(e.target.value))}
      />
      <button
        type="button"
        className="stepper-btn"
        aria-label={`${label} +`}
        onClick={() => set(idx + 1)}
        disabled={disabled || idx === values.length - 1}
      >
        +
      </button>
      <output className="control-value" htmlFor={id}>{format(value)}</output>
      {describe && <span id={`${id}-desc`} className="sr-only">{describe}</span>}
    </div>
  );
}
