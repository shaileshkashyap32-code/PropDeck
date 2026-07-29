// ─── Dual-range slider ──────────────────────────────────────────────────────
// Two handles over one track for a [min, max] range. Used in the admin unit
// editor to slide a configuration's price range up and down; it stays in sync
// with the number inputs (both write the same state).

interface Props {
  min: number
  max: number
  step: number
  valueMin: number
  valueMax: number
  onChange: (a: number, b: number) => void
}

export default function DualRangeSlider({ min, max, step, valueMin, valueMax, onChange }: Props) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v || min))
  const vMin = clamp(valueMin)
  const vMax = clamp(Math.max(valueMax, vMin))
  const pct = (v: number) => ((v - min) / (max - min)) * 100

  return (
    <div>
      <style>{`.drs input[type=range]{position:absolute;width:100%;height:4px;background:transparent;-webkit-appearance:none;pointer-events:none;outline:none;top:0;left:0;margin:0;padding:0}.drs input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:all;width:16px;height:16px;border-radius:50%;background:linear-gradient(135deg,#4F46E5,#9333EA);cursor:pointer;border:2px solid #E0E7FF;box-shadow:0 2px 6px rgba(79,70,229,0.5)}.drs input[type=range]::-moz-range-thumb{pointer-events:all;width:16px;height:16px;border-radius:50%;background:#6D28D9;cursor:pointer;border:2px solid #E0E7FF}`}</style>
      <div style={{ position: 'relative', height: 4, background: 'rgba(99,102,241,0.15)', borderRadius: 3 }}>
        <div style={{ position: 'absolute', left: `${pct(vMin)}%`, right: `${100 - pct(vMax)}%`, height: '100%', background: 'linear-gradient(90deg,#4F46E5,#9333EA)', borderRadius: 3 }} />
      </div>
      <div className="drs" style={{ position: 'relative', height: 16, marginTop: -4 }}>
        <input type="range" min={min} max={max} step={step} value={vMin}
          onChange={(e) => onChange(Math.min(+e.target.value, vMax), vMax)} />
        <input type="range" min={min} max={max} step={step} value={vMax}
          onChange={(e) => onChange(vMin, Math.max(+e.target.value, vMin))} />
      </div>
    </div>
  )
}
