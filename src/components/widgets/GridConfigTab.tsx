import { useState, useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ChevronUp, Play, RotateCcw } from "lucide-react"
import type { GridConfig, GridMultiTpLevel } from "@/types/terminal"
import { DEFAULT_GRID_CONFIG } from "@/types/terminal"

// ─── Shared style constants ───────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 4,
  color: "rgba(200,214,229,0.9)",
  padding: "3px 7px",
  fontSize: 11,
  fontFamily: "monospace",
  width: "100%",
  outline: "none",
}

const readonlyBase: React.CSSProperties = {
  ...inputBase,
  background: "rgba(30,111,239,0.05)",
  border: "1px solid rgba(30,111,239,0.12)",
  color: "rgba(120,170,255,0.8)",
  cursor: "default",
}

// ─── Primitive UI helpers ─────────────────────────────────────────────────────

function TinyTooltipIcon({ text, color }: { text: string; color?: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const anchorRef = useRef<HTMLSpanElement>(null)

  const openTooltip = () => {
    const r = anchorRef.current?.getBoundingClientRect()
    if (r) setPos({ x: r.left + r.width / 2, y: r.top })
  }

  return (
    <span
      ref={anchorRef}
      onMouseEnter={openTooltip}
      onMouseLeave={() => setPos(null)}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ display: "inline-flex", alignItems: "center", cursor: "help", padding: "2px", pointerEvents: "auto" }}
    >
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ opacity: color ? 0.7 : 0.45, display: "block" }}>
        <circle cx="5" cy="5" r="4.5" stroke={color ?? "rgba(200,214,229,0.6)"} />
        <text x="5" y="7.5" textAnchor="middle" fontSize="6.5" fill={color ?? "rgba(200,214,229,0.8)"} fontFamily="monospace">?</text>
      </svg>
      {pos && createPortal(
        <div style={{
          position: "fixed",
          left: Math.max(8, Math.min(pos.x - 110, window.innerWidth - 248)),
          top: pos.y - 8,
          transform: "translateY(-100%)",
          zIndex: 99999, width: 220,
          background: "rgba(13,20,35,0.98)", border: `1px solid ${color ? "rgba(255,171,0,0.3)" : "rgba(30,111,239,0.25)"}`,
          borderRadius: 5, padding: "7px 9px",
          fontSize: 9, fontFamily: "monospace", color: "rgba(200,214,229,0.75)", lineHeight: 1.6,
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)", pointerEvents: "none", whiteSpace: "normal",
        }}>
          {text}
        </div>,
        document.body
      )}
    </span>
  )
}

function NI({
  value, onChange, placeholder, title, min, suffix, label, labelColor, tooltip,
}: {
  value: number | string; onChange: (v: number) => void
  placeholder?: string; title?: string; min?: number; step?: number; suffix?: string; label?: string; labelColor?: string; tooltip?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [localVal, setLocalVal] = useState(String(value))
  const isFocused = useRef(false)

  useEffect(() => {
    if (!isFocused.current) setLocalVal(String(value))
  }, [value])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY < 0 ? 1 : -1
      const current = parseFloat(String(value)) || 0
      const next = current + delta
      const result = min !== undefined ? Math.max(min, next) : next
      onChange(result)
      setLocalVal(String(result))
    }
    el.addEventListener("wheel", handler, { passive: false })
    return () => el.removeEventListener("wheel", handler)
  }, [onChange, min, value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.-]/g, "")
    setLocalVal(raw)
  }

  const handleBlur = () => {
    isFocused.current = false
    const parsed = parseFloat(localVal)
    if (!isNaN(parsed)) {
      const result = min !== undefined ? Math.max(min, parsed) : parsed
      onChange(result)
      setLocalVal(String(result))
    } else {
      setLocalVal(String(value))
    }
  }

  const tag = suffix ?? label
  const tagW = tag ? tag.length * 5.5 + 8 : 0

  const tooltipExtraW = tooltip ? 12 : 0

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={ref}
        type="text" inputMode="decimal" value={localVal}
        onChange={handleChange}
        onFocus={() => { isFocused.current = true }}
        onBlur={handleBlur}
        placeholder={placeholder ?? "0"} title={tooltip ? undefined : (title ?? placeholder)}
        style={{ ...inputBase, paddingRight: tag ? tagW + tooltipExtraW + 2 : undefined }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      {tag && (
        <span style={{ position: "absolute", right: tooltip ? 16 : 5, top: "50%", transform: "translateY(-50%)", fontSize: 7.5, opacity: labelColor ? 1 : 0.32, fontFamily: "monospace", pointerEvents: "none", whiteSpace: "nowrap", letterSpacing: "0.03em", color: labelColor }}>
          {tag}
        </span>
      )}
      {tooltip && (
        <span style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
          <TinyTooltipIcon text={tooltip} color={labelColor} />
        </span>
      )}
    </div>
  )
}

function NITooltip({
  value, onChange, label, min, title, tooltip,
}: {
  value: number; onChange: (v: number) => void
  label?: string; min?: number; step?: number; title?: string; tooltip: string
}) {
  const [show, setShow] = useState(false)
  const [localVal, setLocalVal] = useState(String(value))
  const labelText = label ?? ""

  // Sync external value only when input is not focused
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalVal(String(value))
    }
  }, [value])

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="text" inputMode="decimal" value={localVal}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, "")
          setLocalVal(raw)
          const parsed = parseFloat(raw)
          if (!isNaN(parsed)) onChange(min !== undefined ? Math.max(min, parsed) : parsed)
        }}
        onBlur={() => {
          const parsed = parseFloat(localVal)
          if (isNaN(parsed) || localVal === "") {
            setLocalVal(String(value))
          }
        }}
        placeholder="0" title={title ?? label}
        style={{ ...inputBase, paddingRight: 60 }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      {/* ? icon + label as one inline group, flush right */}
      <div style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 3, pointerEvents: "none" }}>
        <button
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
          onClick={() => setShow((s) => !s)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", pointerEvents: "auto" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
            <circle cx="5" cy="5" r="4.5" stroke="rgba(200,214,229,0.6)" />
            <text x="5" y="7.5" textAnchor="middle" fontSize="6.5" fill="rgba(200,214,229,0.8)" fontFamily="monospace">?</text>
          </svg>
        </button>
        <span style={{ fontSize: 7.5, opacity: 0.32, fontFamily: "monospace", whiteSpace: "nowrap", letterSpacing: "0.03em" }}>
          {labelText}
        </span>
      </div>
      {show && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 999,
          background: "rgba(13,20,35,0.98)", border: "1px solid rgba(30,111,239,0.25)",
          borderRadius: 5, padding: "7px 9px",
          fontSize: 9, fontFamily: "monospace", color: "rgba(200,214,229,0.75)", lineHeight: 1.6,
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          pointerEvents: "none",
        }}>
          {tooltip}
        </div>
      )}
    </div>
  )
}

function LabelTooltip({ label, tooltip, color }: { label: string; tooltip: string; color?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 3 }}>
      <span style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase", color: color ?? "rgba(200,214,229,0.55)", fontWeight: 600 }}>
        {label}
      </span>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", lineHeight: 1 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.45 }}>
          <circle cx="5" cy="5" r="4.5" stroke="rgba(200,214,229,0.6)" />
          <text x="5" y="7.5" textAnchor="middle" fontSize="6.5" fill="rgba(200,214,229,0.8)" fontFamily="monospace">?</text>
        </svg>
      </button>
      {show && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 999, minWidth: 160, maxWidth: 220,
          background: "rgba(13,20,35,0.98)", border: "1px solid rgba(30,111,239,0.25)",
          borderRadius: 5, padding: "7px 9px",
          fontSize: 9, fontFamily: "monospace", color: "rgba(200,214,229,0.75)", lineHeight: 1.6,
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)", pointerEvents: "none", whiteSpace: "normal",
        }}>
          {tooltip}
        </div>
      )}
    </div>
  )
}

function BudgetInput({
  value, onChange, mode, onModeChange, baseSymbol,
}: {
  value: number; onChange: (v: number) => void
  mode: "quote" | "base"; onModeChange: (m: "quote" | "base") => void
  baseSymbol: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY < 0 ? 1 : -1
      const next = Math.max(0, (typeof valueRef.current === "number" ? valueRef.current : 0) + delta)
      onChange(next)
    }
    el.addEventListener("wheel", handler, { passive: false })
    return () => el.removeEventListener("wheel", handler)
  }, [onChange])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "")
    const parsed = parseFloat(raw)
    if (!isNaN(parsed)) onChange(Math.max(0, parsed))
    else if (raw === "" || raw === ".") onChange(0)
  }

  const label = mode === "quote" ? "USDT" : baseSymbol
  const labelW = label.length * 7 + 8

  return (
    <div style={{ position: "relative", flex: 1 }}>
      <input
        ref={ref}
        type="text" inputMode="decimal" value={value}
        onChange={handleChange}
        placeholder="1000" title={`Total budget in ${label}`}
        style={{ ...inputBase, paddingRight: labelW + 34 }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <div style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 2 }} onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={() => onModeChange("quote")}
          title="Budget in USDT"
          style={{
            fontSize: 8, fontFamily: "monospace", padding: "1px 4px", borderRadius: 2, cursor: "pointer", border: "none",
            background: mode === "quote" ? "rgba(30,111,239,0.35)" : "rgba(255,255,255,0.06)",
            color: mode === "quote" ? "rgba(120,170,255,0.9)" : "rgba(200,214,229,0.4)",
            transition: "all 0.15s",
          }}
        >USDT</button>
        <button
          onClick={() => onModeChange("base")}
          title={`Budget in ${baseSymbol}`}
          style={{
            fontSize: 8, fontFamily: "monospace", padding: "1px 4px", borderRadius: 2, cursor: "pointer", border: "none",
            background: mode === "base" ? "rgba(30,111,239,0.35)" : "rgba(255,255,255,0.06)",
            color: mode === "base" ? "rgba(120,170,255,0.9)" : "rgba(200,214,229,0.4)",
            transition: "all 0.15s",
          }}
        >{baseSymbol}</button>
      </div>
    </div>
  )
}

function Seg<T extends string>({
  options, value, onChange, style,
}: { options: { v: T; label: string; title?: string; pro?: boolean }[]; value: T; onChange: (v: T) => void; style?: React.CSSProperties }) {
  return (
    <div className="flex rounded overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0, ...style }}>
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} title={o.title}
          style={{
            flex: 1, fontSize: 9, fontFamily: "monospace", padding: "2px 0",
            background: value === o.v ? "rgba(30,111,239,0.18)" : "transparent",
            color: value === o.v ? "#1e6fef" : "rgba(255,255,255,0.35)",
            border: "none", cursor: "pointer",
            fontWeight: value === o.v ? 700 : 400, letterSpacing: "0.04em",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {o.label}{o.pro && <span style={{ fontSize: 7, marginLeft: 2, opacity: 0.5, color: "#ffaa00" }}>PRO</span>}
        </button>
      ))}
    </div>
  )
}

function MiniToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        width: 32, height: 16, borderRadius: 8, flexShrink: 0, cursor: "pointer",
        background: checked ? "rgba(0,229,160,0.35)" : "rgba(255,255,255,0.1)",
        border: `1px solid ${checked ? "rgba(0,229,160,0.5)" : "rgba(255,255,255,0.15)"}`,
        position: "relative", transition: "background 0.15s",
      }}
    >
      <div style={{
        position: "absolute", top: 2, left: checked ? 16 : 2,
        width: 10, height: 10, borderRadius: "50%",
        background: checked ? "#00e5a0" : "rgba(255,255,255,0.4)",
        transition: "left 0.15s",
      }} />
    </div>
  )
}


function SectionHead({
  title, expanded, onToggle, badge, pro, rightSlot,
}: {
  title: string; expanded: boolean; onToggle: () => void
  badge?: React.ReactNode; pro?: boolean; rightSlot?: React.ReactNode
}) {
  return (
    <div
      className="flex items-center justify-between w-full"
      style={{ padding: "5px 0" }}
    >
      <button
        className="flex items-center gap-1.5"
        style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, flex: 1, textAlign: "left" }}
        onClick={onToggle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className="flex items-center gap-1.5" style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
          {title}
          {pro && <span style={{ fontSize: 7, background: "rgba(255,170,0,0.2)", color: "#ffaa00", border: "1px solid rgba(255,170,0,0.3)", borderRadius: 2, padding: "0 3px" }}>PRO</span>}
          {badge}
        </span>
      </button>
      <div className="flex items-center gap-1.5">
        {rightSlot && (
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {rightSlot}
          </div>
        )}
        <button
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
          onClick={onToggle}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {expanded ? <ChevronUp size={9} style={{ opacity: 0.4 }} /> : <ChevronDown size={9} style={{ opacity: 0.4 }} />}
        </button>
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 6 }} />
}

function PctBtns({ onPct }: { onPct: (p: number) => void }) {
  return (
    <div className="flex gap-1">
      {[10, 20, 30, 50, 75, 100].map((p) => (
        <button key={p} onClick={() => onPct(p)} title={`${p}% of available balance`}
          style={{
            flex: 1, fontSize: 9, fontFamily: "monospace", padding: "1px 0",
            background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)",
            border: "1px solid rgba(255,255,255,0.07)", borderRadius: 3, cursor: "pointer",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >{p}%</button>
      ))}
    </div>
  )
}

// ─── Close % helpers ─────────────────────────────────────────────────────────

function distributeClose(count: number): number[] {
  const base = Math.floor(100 / count)
  const remainder = 100 - base * count
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? base + remainder : base
  )
}

function rebalanceClose(levels: GridMultiTpLevel[], changedIndex: number, newValue: number): GridMultiTpLevel[] {
  if (levels.length <= 1) return [{ ...levels[0], closePercent: 100 }]
  const clamped = Math.min(100, Math.max(1, newValue))
  const lastIdx = levels.length - 1
  const updated = levels.map((l, i) =>
    i === changedIndex ? { ...l, closePercent: clamped } : l
  )
  if (changedIndex !== lastIdx) {
    const sumOthers = updated.slice(0, lastIdx).reduce((s, l) => s + l.closePercent, 0)
    const lastVal = Math.max(1, 100 - sumOthers)
    updated[lastIdx] = { ...updated[lastIdx], closePercent: lastVal }
  }
  return updated
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface GridConfigTabProps {
  symbol?: string
  marketType?: "spot" | "futures"
  futuresSide?: "long" | "short"
  entryPrice?: number
  availableBalance?: number
  leverage?: number
  onSideChange?: (side: "long" | "short") => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GridConfigTab({
  symbol: externalSymbol,
  marketType = "futures",
  futuresSide: externalFuturesSide,
  entryPrice: externalEntryPrice,
  availableBalance = 10000,
  leverage: externalLeverage,
  onSideChange,
}: GridConfigTabProps) {
  const [cfg, setCfg] = useState<GridConfig>({
    ...DEFAULT_GRID_CONFIG,
    symbol: externalSymbol ?? DEFAULT_GRID_CONFIG.symbol,
    side: externalFuturesSide ?? DEFAULT_GRID_CONFIG.side,
    entryPrice: externalEntryPrice ?? DEFAULT_GRID_CONFIG.entryPrice,
    leverage: externalLeverage ?? DEFAULT_GRID_CONFIG.leverage,
  })

  // Sync from active chart
  useEffect(() => { if (externalSymbol) setCfg((p) => ({ ...p, symbol: externalSymbol })) }, [externalSymbol])
  useEffect(() => { if (externalEntryPrice && externalEntryPrice > 0) setCfg((p) => ({ ...p, entryPrice: externalEntryPrice })) }, [externalEntryPrice])
  useEffect(() => { if (externalLeverage && externalLeverage > 0) setCfg((p) => ({ ...p, leverage: externalLeverage })) }, [externalLeverage])
  useEffect(() => { if (externalFuturesSide) setCfg((p) => ({ ...p, side: externalFuturesSide })) }, [externalFuturesSide])

  // Auto-set direction based on side
  useEffect(() => {
    setCfg((p) => ({ ...p, direction: p.side === "long" ? "below_price" : "above_price" }))
  }, [cfg.side])

  const upd = useCallback(<K extends keyof GridConfig>(key: K, val: GridConfig[K]) => {
    setCfg((p) => ({ ...p, [key]: val }))
  }, [])

  // Pro mode toggle
  const [proMode, setProMode] = useState(false)
  // Collapsed sections
  const [open, setOpen] = useState({
    entry: true,
    gridSetup: true,
    summary: false,
    trail: true,
    tp: true,
    sl: true,
    resetTp: false,
    gridTable: false,
    configJson: false,
    perLevelGroups: true,
  })
  const tog = (k: keyof typeof open) => setOpen((p) => ({ ...p, [k]: !p[k] }))

  // Auto-sync perLevelTpGroups count with ordersCount when perLevelTpEnabled
  useEffect(() => {
    if (!cfg.perLevelTpEnabled) return
    const n = cfg.ordersCount
    const cur = cfg.perLevelTpGroups
    if (cur.length === n) return
    if (cur.length < n) {
      const extra = Array.from({ length: n - cur.length }, (_, i) => ({
        afterLevel: cur.length + i + 1,
        tpCount: 1,
        levels: [{ tpPercent: 1.0, closePercent: 100 }],
        resetTpEnabled: false,
      }))
      setCfg((p) => ({ ...p, perLevelTpGroups: [...p.perLevelTpGroups, ...extra] }))
    } else {
      setCfg((p) => ({ ...p, perLevelTpGroups: p.perLevelTpGroups.slice(0, n) }))
    }
  }, [cfg.ordersCount, cfg.perLevelTpEnabled])

  const handlePct = (pct: number) => {
    const amt = parseFloat(((pct / 100) * availableBalance).toFixed(2))
    upd("totalQuote", amt)
  }

  const stopProp = (e: React.MouseEvent) => e.stopPropagation()
  const baseSymbol = cfg.symbol.split("/")[0] ?? "BTC"

  // Side button
  const gap4: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 }

  return (
    <div className="flex flex-col h-full overflow-auto" style={{ padding: "8px 10px" }} onMouseDown={stopProp}>

      {/* ── LEV + PRO row ─────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 9, fontFamily: "monospace", opacity: 0.35 }}>LEV</span>
          <div style={{ width: 52 }}>
            <NI value={cfg.leverage} onChange={(v) => upd("leverage", Math.max(1, v))} min={1} suffix="×" title="Leverage multiplier" />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 9, fontFamily: "monospace", opacity: 0.35, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pro</span>
          <MiniToggle checked={proMode} onChange={(v) => { setProMode(v); if (!v) upd("perLevelTpEnabled", false) }} />
        </div>
      </div>

      {/* ── Side toggle ───────────────────────────────── */}
      <div style={{ display: "flex", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, marginBottom: 6 }}>
        {(["long", "short"] as const).map((s, i) => (
          <button
            key={s}
            onClick={() => { upd("side", s); onSideChange?.(s) }}
            style={{
              flex: 1,
              padding: "6px 0",
              fontFamily: "monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              border: "none",
              borderLeft: i === 1 ? "1px solid rgba(255,255,255,0.1)" : "none",
              borderRadius: i === 0 ? "3px 0 0 3px" : "0 3px 3px 0",
              transition: "background 0.15s, color 0.15s",
              background: cfg.side === s
                ? (s === "long" ? "rgba(0,229,160,0.18)" : "rgba(255,71,87,0.18)")
                : "transparent",
              color: cfg.side === s
                ? (s === "long" ? "#00e5a0" : "#ff4757")
                : "rgba(255,255,255,0.3)",
            }}
            title={s === "long" ? "Long: profit when price goes up" : "Short: profit when price goes down"}
            onMouseDown={stopProp}
          >
            {marketType === "spot" ? (s === "long" ? "BUY" : "SELL") : (s === "long" ? "LONG" : "SHORT")}
          </button>
        ))}
      </div>
      <Divider />

      {/* ── ENTRY ────────────────────────────────────── */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ ...gap4, marginTop: 0 }}>
          {/* Current Price row with order type switcher */}
          <div style={{ ...readonlyBase, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "3px 6px" }}>
            <span style={{ fontSize: 9, opacity: 0.4, whiteSpace: "nowrap", fontFamily: "monospace" }}>Current Price</span>
            <span style={{ fontWeight: 700, color: "#00e5a0", fontSize: 11, flex: 1, textAlign: "right", marginRight: 6 }}>
              {cfg.entryPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <Seg
              options={[
                { v: "limit", label: "Limit", title: "Enter at a specific limit price" },
                { v: "market", label: "Stop", title: "Enter with a stop order" },
              ]}
              value={cfg.entryType}
              onChange={(v) => upd("entryType", v)}
              style={{ minWidth: 90 }}
            />
          </div>
        </div>
      </div>
      <Divider />

      {/* ── GRID SETUP ───────────────────────────────── */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
          <div style={{ width: 80, flexShrink: 0 }}>
            <NI value={cfg.ordersCount} onChange={(v) => upd("ordersCount", Math.max(3, Math.min(100, Math.round(v))))} label="Orders" placeholder="8" title="Number of grid levels (3–100)" min={3} />
          </div>
          <BudgetInput
            value={cfg.totalQuote}
            onChange={(v) => upd("totalQuote", v)}
            mode={cfg.budgetMode ?? "quote"}
            onModeChange={(m) => upd("budgetMode", m)}
            baseSymbol={baseSymbol}
          />
        </div>
        <PctBtns onPct={handlePct} />
      </div>
      <Divider />

      {/* ── GRID PLACEMENT ───────────────────────────── */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ ...gap4, marginTop: 0 }}>
          <Seg
            options={[
              { v: "step_percent", label: "Step %", title: "Place orders at equal percentage steps" },
              { v: "price_range", label: "Price Range", title: "Distribute orders across a price range" },
            ]}
            value={cfg.placementMode}
            onChange={(v) => upd("placementMode", v)}
          />

          {cfg.placementMode === "step_percent" && (
            <div className="grid grid-cols-3" style={{ gap: 4 }}>
              <NI value={cfg.firstOffsetPercent} onChange={(v) => upd("firstOffsetPercent", v)} label="1st order %" step={0.1} title="Distance from entry price to 1st order (negative = market order simulation)" />
              <NI value={cfg.lastOffsetPercent} onChange={(v) => upd("lastOffsetPercent", v)} label="Last order %" min={0} step={0.1} title="Distance from entry to last order" />
              <NI value={cfg.stepPercent} onChange={(v) => upd("stepPercent", Math.max(0.01, v))} label="Step %" min={0.01} step={0.1} title="Price step between each grid level" />
            </div>
          )}

          {cfg.placementMode === "price_range" && (
            <div className="grid grid-cols-2" style={{ gap: 4 }}>
              <NI value={cfg.topPrice} onChange={(v) => upd("topPrice", v)} label="Top Price" title="Upper boundary of the grid" />
              <NI value={cfg.bottomPrice} onChange={(v) => upd("bottomPrice", v)} label="Bottom Price" title="Lower boundary of the grid" />
            </div>
          )}
        </div>
      </div>
      <Divider />

      {/* ── MULTIPLIER + DENSITY ─────────────────────── */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ ...gap4 }}>
          <div className="grid grid-cols-2" style={{ gap: 4 }}>
            <NITooltip
              value={cfg.multiplier}
              onChange={(v) => upd("multiplier", Math.max(1.01, v))}
              label="Multiplier"
              min={1.01}
              step={0.05}
              title="Multiplier"
              tooltip="Каждый следующий ордер = предыдущий × Multiplier. Например, 1.25 — каждый ордер на 25% больше предыдущего."
            />
            <NITooltip
              value={cfg.density ?? 1}
              onChange={(v) => upd("density", Math.max(0.01, v))}
              label="Density"
              min={0.01}
              step={0.05}
              title="Density"
              tooltip={`Если выбрана "Плотность" равная 1, то ордера будут распределены в сетке равномерно, если больше 1, то ордера будут сконцентрированы ближе к концу сетки, если меньше 1, то ближе к началу.`}
            />
          </div>
        </div>
      </div>
      <Divider />

      {/* ── 5. TRAIL + AUTO RESTART ───────────────────── */}
      <div style={{ marginBottom: 6 }}>
        {/* Always-visible row: Trail [?] [toggle] [chevron if active] — — — Auto [?] TP [toggle] SL [toggle] */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <LabelTooltip
            label="Trail"
            tooltip="Трейлинг сетки — сетка автоматически перемещается за ценой, когда цена уходит за край сетки на заданный процент."
          />
          <div style={{ marginLeft: 5 }}>
            <MiniToggle
              checked={cfg.trailEnabled}
              onChange={(v) => {
                upd("trailEnabled", v)
                if (v) setOpen((p) => ({ ...p, trail: true }))
              }}
            />
          </div>

          {/* Chevron to collapse/expand Trail settings row */}
          {cfg.trailEnabled && (
            <button
              onClick={() => tog("trail")}
              title={open.trail ? "Свернуть настройки трейлинга" : "Развернуть настройки трейлинга"}
              style={{
                marginLeft: 4, background: "none", border: "none", cursor: "pointer",
                padding: 0, display: "flex", alignItems: "center", opacity: 0.45,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.45")}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d={open.trail ? "M2 3.5 L5 6.5 L8 3.5" : "M2 6.5 L5 3.5 L8 6.5"}
                  stroke="rgba(200,214,229,0.8)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </button>
          )}

          {/* Spacer always pushes Auto to the right */}
          <div style={{ flex: 1 }} />

          {/* Auto — master toggle + conditional sub-toggles */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <LabelTooltip
              label="Auto"
              color={cfg.autoEnabled ? "rgba(52,211,153,0.8)" : undefined}
              tooltip="Авто-цикл сетки: после срабатывания TP новая сетка автоматически размещается по текущей рыночной цене. По умолчанию то же происходит после SL — отключите тумблер SL чтобы остановить цикл после стопа."
            />
            <MiniToggle
              checked={cfg.autoEnabled}
              onChange={(v) => {
                upd("autoEnabled", v)
                if (!v) {
                  upd("stopOnSl", false)
                  upd("stopNew", false)
                }
              }}
            />
            {cfg.autoEnabled && (
              <>
                <LabelTooltip
                  label="SL"
                  color={cfg.stopOnSl ? "rgba(248,113,113,0.45)" : "rgba(248,113,113,0.75)"}
                  tooltip={cfg.stopOnSl
                    ? "После срабатывания SL новый цикл сетки НЕ запускается — цикл останавливается."
                    : "После срабатывания SL новая сетка создаётся автоматически (по умолчанию). Включите тумблер чтобы остановить цикл после SL."}
                />
                <MiniToggle checked={cfg.stopOnSl} onChange={(v) => upd("stopOnSl", v)} />
                <LabelTooltip
                  label="Stop New"
                  color={cfg.stopNew ? "rgba(251,191,36,0.8)" : undefined}
                  tooltip="Остановить цикл после следующего срабатывания TP/SL. При этом TP пересчитывается на уровень безубытка. Удобно для мягкого выхода из авто-цикла."
                />
                <MiniToggle checked={cfg.stopNew} onChange={(v) => upd("stopNew", v)} />
              </>
            )}
          </div>
        </div>

        {/* Row 2 — Trail settings, collapsible */}
        {cfg.trailEnabled && open.trail && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <NITooltip
                value={cfg.trailTriggerPercent}
                onChange={(v) => upd("trailTriggerPercent", v)}
                label="Trigger %"
                title="Trail trigger %"
                tooltip="Процент выхода цены за край сетки, при котором запускается перемещение сетки. Например, 1% — сетка сдвигается когда цена ушла на 1% за крайний ордер."
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <LabelTooltip
                label="Lim"
                tooltip="Предельная цена трейлинга. Если цена достигает этого уровня — трейлинг останавливается. Возобновляется автоматически, когда цена снова выполняет условие триггера."
                color="rgba(200,214,229,0.4)"
              />
              <MiniToggle checked={cfg.trailLimitPriceEnabled} onChange={(v) => upd("trailLimitPriceEnabled", v)} />
            </div>

            {cfg.trailLimitPriceEnabled && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <NITooltip
                  value={cfg.trailLimitPrice}
                  onChange={(v) => upd("trailLimitPrice", v)}
                  label="Lim price"
                  title="Trail limit price"
                  tooltip="Предельная цена трейлинга. Если цена достигает этого уровня — трейлинг останавливается. Возобновляется автоматически, когда цена снова выполняет условие триггера."
                />
              </div>
            )}
          </div>
        )}
      </div>
      <Divider />

      {/* ── TAKE PROFIT ───────────────────────────── */}
      <div style={{ marginBottom: 6 }}>
        <SectionHead
          title="TAKE PROFIT"
          expanded={open.tp}
          onToggle={() => tog("tp")}
          rightSlot={
            <div className="flex items-center" style={{ gap: 6 }} onMouseDown={stopProp}>
              {/* Reposition toggle */}
              <LabelTooltip
                label="Reposition"
                tooltip="После каждого усреднения TP автоматически смещается к средней цене позиции, сохраняя заданные расстояния и пропорции."
                color="rgba(200,214,229,0.35)"
              />
              <MiniToggle checked={cfg.tpRepositionEnabled} onChange={(v) => upd("tpRepositionEnabled", v)} />

              {/* TP count stepper — hidden when per-level groups are active */}
              {!(proMode && cfg.perLevelTpEnabled) && (
                <>
                  <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.1)" }} />
                  <div className="flex items-center" style={{ gap: 3 }}>
                    <span style={{ fontSize: 8.5, fontFamily: "monospace", opacity: 0.4, letterSpacing: "0.04em" }}>TP</span>
                    <div className="flex items-center" style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                      <button
                        onMouseDown={stopProp}
                        onClick={() => {
                          const n = Math.max(1, cfg.multiTpCount - 1)
                          const lvls = cfg.multiTpLevels.slice(0, n)
                          const pcts = distributeClose(n)
                          upd("multiTpCount", n)
                          upd("multiTpLevels", lvls.map((l, i) => ({ ...l, closePercent: pcts[i] })))
                          if (n === 1) upd("multiTpEnabled", false)
                        }}
                        style={{ padding: "0 4px", height: 16, background: "rgba(255,255,255,0.04)", border: "none", color: "rgba(200,214,229,0.55)", cursor: "pointer", fontSize: 10, lineHeight: 1 }}
                      >−</button>
                      <span style={{ padding: "0 5px", fontSize: 9.5, fontFamily: "monospace", color: "rgba(200,214,229,0.85)", background: "rgba(255,255,255,0.02)", minWidth: 16, textAlign: "center", lineHeight: "16px" }}>
                        {cfg.multiTpCount}
                      </span>
                      <button
                        onMouseDown={stopProp}
                        onClick={() => {
                          const n = Math.min(10, cfg.multiTpCount + 1)
                          const lvls = [...cfg.multiTpLevels]
                          while (lvls.length < n) lvls.push({ tpPercent: parseFloat(((lvls[lvls.length - 1]?.tpPercent ?? 0) + 0.5).toFixed(2)), closePercent: 0 })
                          const pcts = distributeClose(n)
                          upd("multiTpCount", n)
                          upd("multiTpLevels", lvls.slice(0, n).map((l, i) => ({ ...l, closePercent: pcts[i] })))
                          if (n > 1) upd("multiTpEnabled", true)
                        }}
                        style={{ padding: "0 4px", height: 16, background: "rgba(255,255,255,0.04)", border: "none", color: "rgba(200,214,229,0.55)", cursor: "pointer", fontSize: 10, lineHeight: 1 }}
                      >+</button>
                    </div>
                  </div>
                </>
              )}

              {/* Divider */}
              <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.1)" }} />

              {/* Enable toggle */}
              <MiniToggle checked={cfg.tpEnabled} onChange={(v) => upd("tpEnabled", v)} />
            </div>
          }
        />
        {open.tp && cfg.tpEnabled && (
          <div style={{ ...gap4, marginTop: 4 }}>
            {/* Standard TP table — hidden when per-level groups are active */}
            {!(proMode && cfg.perLevelTpEnabled) && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "18px 1fr 1fr", gap: 2, fontSize: 9, fontFamily: "monospace", opacity: 0.35, paddingLeft: 2 }}>
                  <span>#</span>
                  <span>TP %</span>
                  <span>Close %</span>
                </div>
                {cfg.multiTpLevels.slice(0, cfg.multiTpCount).map((lvl, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "18px 1fr 1fr", gap: 2, alignItems: "center" }}>
                    <span style={{ fontSize: 9, fontFamily: "monospace", opacity: 0.38 }}>{i + 1}</span>
                    <NI value={lvl.tpPercent} onChange={(v) => {
                      const next = [...cfg.multiTpLevels]
                      next[i] = { ...next[i], tpPercent: v }
                      upd("multiTpLevels", next)
                    }} suffix="%" step={0.1} min={0} />
                    <NI value={lvl.closePercent} onChange={(v) => {
                      upd("multiTpLevels", rebalanceClose(cfg.multiTpLevels.slice(0, cfg.multiTpCount), i, v))
                    }} suffix="%" step={1} min={1} />
                  </div>
                ))}
              </>
            )}

            {/* Per-level TP groups — pro only */}
            {proMode && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 4, ...gap4 }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center" style={{ gap: 4 }}>
                    <LabelTooltip
                      label="Per-level groups"
                      tooltip="Разные настройки TP для каждой группы уровней сетки. После заполнения N-го ордера применяются свои TP-уровни."
                      color="rgba(200,214,229,0.4)"
                    />
                    {cfg.perLevelTpEnabled && (
                      <button
                        onMouseDown={stopProp}
                        onClick={() => tog("perLevelGroups")}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(200,214,229,0.35)", display: "flex", alignItems: "center" }}
                      >
                        <ChevronDown size={10} style={{ transform: open.perLevelGroups ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                      </button>
                    )}
                  </div>
                  <MiniToggle checked={cfg.perLevelTpEnabled} onChange={(v) => upd("perLevelTpEnabled", v)} />
                </div>
                {cfg.perLevelTpEnabled && open.perLevelGroups && (
                  <div style={{ ...gap4 }}>
                    {cfg.perLevelTpGroups.map((grp, gi) => {
                      const grpTpCount = grp.tpCount ?? 1
                      const hasReset = grp.resetTpEnabled ?? false
                      // When reset enabled, first row = Reset TP, rest = Main TP
                      // Minimum TP count is 2 when reset is enabled (1 reset + 1 main)
                      return (
                        <div key={gi} style={{ borderLeft: `2px solid ${hasReset ? "rgba(255,171,0,0.35)" : "rgba(30,111,239,0.2)"}`, paddingLeft: 6, ...gap4 }}>
                          {/* Group header */}
                          <div className="flex items-center" style={{ gap: 4 }}>
                            {/* Level badge */}
                            <span style={{ fontSize: 8, fontFamily: "monospace", color: "rgba(200,214,229,0.35)", whiteSpace: "nowrap", letterSpacing: "0.04em" }}>
                              LVL {gi + 1}
                            </span>

                            {/* Reset TP toggle */}
                            <div className="flex items-center" style={{ gap: 3, marginLeft: 2 }}>
                              <span style={{ fontSize: 8, fontFamily: "monospace", color: hasReset ? "rgba(255,171,0,0.8)" : "rgba(200,214,229,0.3)", whiteSpace: "nowrap", letterSpacing: "0.04em" }}>
                                Reset TP
                              </span>
                              <TinyTooltipIcon
                                text="При срабатывании Reset TP запускается ребилд хвоста сетки: освободившаяся маржа + неиспользованный хвост пересоздаются в новые ордера. Обычный TP закрывает без ребилда."
                                color={hasReset ? "rgba(255,171,0,0.7)" : undefined}
                              />
                              <MiniToggle
                                checked={hasReset}
                                onChange={(v) => {
                                  upd("perLevelTpGroups", cfg.perLevelTpGroups.map((g, idx) => {
                                    if (idx !== gi) return g
                                    const minCount = v ? Math.max(2, g.tpCount ?? 1) : g.tpCount ?? 1
                                    const lvls = [...g.levels]
                                    while (lvls.length < minCount) lvls.push({ tpPercent: parseFloat(((lvls[lvls.length - 1]?.tpPercent ?? 0) + 0.5).toFixed(2)), closePercent: 0 })
                                    const pcts = distributeClose(minCount)
                                    return { ...g, resetTpEnabled: v, tpCount: minCount, levels: lvls.slice(0, minCount).map((l, i) => ({ ...l, closePercent: pcts[i] })) }
                                  }))
                                }}
                              />
                            </div>

                            <div style={{ flex: 1 }} />

                            {/* TP count stepper */}
                            <div className="flex items-center" style={{ gap: 3 }}>
                              <span style={{ fontSize: 8, fontFamily: "monospace", opacity: 0.35, letterSpacing: "0.04em" }}>TP</span>
                              <div className="flex items-center" style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                                <button
                                  onMouseDown={stopProp}
                                  onClick={() => {
                                    const minAllowed = hasReset ? 2 : 1
                                    const n = Math.max(minAllowed, grpTpCount - 1)
                                    const lvls = grp.levels.slice(0, n)
                                    const pcts = distributeClose(n)
                                    const next = [...cfg.perLevelTpGroups]
                                    next[gi] = { ...next[gi], tpCount: n, levels: lvls.map((l, i) => ({ ...l, closePercent: pcts[i] })) }
                                    upd("perLevelTpGroups", next)
                                  }}
                                  style={{ padding: "0 4px", height: 15, background: "rgba(255,255,255,0.04)", border: "none", color: "rgba(200,214,229,0.55)", cursor: "pointer", fontSize: 10, lineHeight: 1 }}
                                >−</button>
                                <span style={{ padding: "0 4px", fontSize: 9, fontFamily: "monospace", color: "rgba(200,214,229,0.85)", background: "rgba(255,255,255,0.02)", minWidth: 14, textAlign: "center", lineHeight: "15px" }}>
                                  {grpTpCount}
                                </span>
                                <button
                                  onMouseDown={stopProp}
                                  onClick={() => {
                                    const n = Math.min(10, grpTpCount + 1)
                                    const lvls = [...grp.levels]
                                    while (lvls.length < n) lvls.push({ tpPercent: parseFloat(((lvls[lvls.length - 1]?.tpPercent ?? 0) + 0.5).toFixed(2)), closePercent: 0 })
                                    const pcts = distributeClose(n)
                                    const next = [...cfg.perLevelTpGroups]
                                    next[gi] = { ...next[gi], tpCount: n, levels: lvls.slice(0, n).map((l, i) => ({ ...l, closePercent: pcts[i] })) }
                                    upd("perLevelTpGroups", next)
                                  }}
                                  style={{ padding: "0 4px", height: 15, background: "rgba(255,255,255,0.04)", border: "none", color: "rgba(200,214,229,0.55)", cursor: "pointer", fontSize: 10, lineHeight: 1 }}
                                >+</button>
                              </div>
                            </div>
                          </div>

                          {/* TP rows — labels are inline inside each field */}
                          {grp.levels.slice(0, grpTpCount).map((lvl, li) => {
                            const isResetRow = hasReset && li === 0
                            const tpLabel = hasReset
                              ? (li === 0 ? "Reset TP %" : "Main TP %")
                              : "TP %"
                            const tpColor = isResetRow ? "rgba(255,171,0,0.55)" : undefined
                            return (
                              <div key={li} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, alignItems: "center" }}>
                                <NI
                                  value={lvl.tpPercent}
                                  onChange={(v) => {
                                    upd("perLevelTpGroups", cfg.perLevelTpGroups.map((g, idx) => idx !== gi ? g : { ...g, levels: g.levels.map((l, lx) => lx !== li ? l : { ...l, tpPercent: v }) }))
                                  }}
                                  label={tpLabel}
                                  labelColor={tpColor}
                                  step={0.1}
                                  min={0}
                                  tooltip={isResetRow
                                    ? "Reset TP: при срабатывании запускается ребилд хвоста сетки — освободившаяся маржа + неиспользованный хвост пересоздаются в новые ордера"
                                    : undefined}
                                />
                                <NI
                                  value={lvl.closePercent}
                                  onChange={(v) => {
                                    upd("perLevelTpGroups", cfg.perLevelTpGroups.map((g, idx) => {
                                      if (idx !== gi) return g
                                      const tpCnt = g.tpCount ?? 1
                                      const rebalanced = rebalanceClose(g.levels.slice(0, tpCnt), li, v)
                                      return { ...g, levels: g.levels.map((l, lx) => lx < tpCnt ? rebalanced[lx] : l) }
                                    }))
                                  }}
                                  label="Close %"
                                  step={1}
                                  min={1}
                                  tooltip={isResetRow
                                    ? "Процент позиции закрытый при Reset TP. Освободившаяся маржа идёт на ребилд хвоста сетки"
                                    : undefined}
                                />
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {open.tp && !cfg.tpEnabled && (
          <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(200,214,229,0.3)", padding: "4px 0" }}>
            Take profit disabled
          </div>
        )}
      </div>
      <Divider />

      {/* ── STOP LOSS ─────────────────────────────── */}
      <div style={{ marginBottom: 6 }}>
        <SectionHead
          title="STOP LOSS"
          expanded={open.sl}
          onToggle={() => tog("sl")}
          rightSlot={<MiniToggle checked={cfg.slEnabled} onChange={(v) => upd("slEnabled", v)} />}
        />
        {open.sl && cfg.slEnabled && (
          <div style={{ ...gap4, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
              {([
                {
                  v: "extreme_order" as const,
                  label: "Extreme Order",
                  tooltip: "SL размещается на заданном расстоянии (%) от крайнего ордера сетки.\n\nПример: сетка из 8 ордеров, нижний ордер на 65 000 USDT, SL 2.5% → стоп на 63 375 USDT.\n\nСтоп отображается как превью сразу при настройке сетки. После входа в позицию становится реальным ордером.",
                },
                {
                  v: "avg_entry" as const,
                  label: "Avg Entry",
                  tooltip: "SL рассчитывается от средней цены входа в позицию (средневзвешенная по всем исполненным ордерам сетки).\n\nПодходит для управления риском всей позиции.\n\nСтоп отображается как превью сразу при настройке сетки. После входа в позицию становится реальным ордером.",
                },
              ] as const).map((o) => (
                <div key={o.v} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  background: cfg.slMode === o.v ? "rgba(30,111,239,0.18)" : "transparent",
                  borderRight: o.v === "extreme_order" ? "1px solid rgba(255,255,255,0.1)" : undefined,
                }}>
                  <button
                    onClick={() => upd("slMode", o.v)}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      flex: 1, fontSize: 9, fontFamily: "monospace", padding: "2px 6px",
                      background: "transparent", border: "none", cursor: "pointer",
                      color: cfg.slMode === o.v ? "#1e6fef" : "rgba(255,255,255,0.35)",
                      fontWeight: cfg.slMode === o.v ? 700 : 400, letterSpacing: "0.04em",
                    }}
                  >{o.label}</button>
                  <TinyTooltipIcon text={o.tooltip} color={cfg.slMode === o.v ? "rgba(30,111,239,0.7)" : undefined} />
                  <div style={{ width: 4 }} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2" style={{ gap: 4 }}>
              <NI value={cfg.slPercent} onChange={(v) => upd("slPercent", v)} label="SL %" min={0} step={0.1} title="Stop loss percentage" />
              <NI value={cfg.slClosePercent} onChange={(v) => upd("slClosePercent", Math.min(100, Math.max(1, v)))} label="Close %" min={1} title="Percentage of position to close at stop loss" />
            </div>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(200,214,229,0.3)", lineHeight: 1.5 }}>
              {cfg.slMode === "extreme_order"
                ? "SL размещается на заданном % от крайнего ордера сетки — превью сразу, реальный ордер после входа в позицию"
                : "SL размещается на заданном % от средней цены входа — превью сразу, реальный ордер после входа в позицию"}
            </div>
          </div>
        )}
        {open.sl && !cfg.slEnabled && (
          <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(200,214,229,0.3)", padding: "4px 0" }}>
            Stop loss disabled
          </div>
        )}
      </div>

      {/* ── ACTIONS ──────────────────────────────────── */}
      <div className="flex gap-2 sticky bottom-0" style={{ paddingTop: 6, paddingBottom: 2, background: "rgba(13,17,25,0.95)" }}>
        <button
          onClick={() => setCfg({ ...DEFAULT_GRID_CONFIG, symbol: cfg.symbol, side: cfg.side, entryPrice: cfg.entryPrice, leverage: cfg.leverage })}
          className="flex items-center justify-center gap-1"
          style={{
            fontSize: 10, fontFamily: "monospace", fontWeight: 600, padding: "6px 10px",
            background: "rgba(255,255,255,0.04)", color: "rgba(200,214,229,0.6)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, cursor: "pointer", flexShrink: 0,
          }}
          onMouseDown={stopProp}
          title="Reset all settings to defaults"
        >
          <RotateCcw size={10} /> Reset
        </button>
        <button
          className="flex items-center justify-center gap-1.5 flex-1"
          style={{
            fontSize: 11, fontFamily: "monospace", fontWeight: 700, padding: "7px 0",
            background: cfg.side === "long" ? "rgba(0,229,160,0.18)" : "rgba(248,113,113,0.15)",
            color: cfg.side === "long" ? "#00e5a0" : "#f87171",
            border: `1px solid ${cfg.side === "long" ? "rgba(0,229,160,0.45)" : "rgba(248,113,113,0.4)"}`,
            borderRadius: 4, cursor: "pointer",
          }}
          onMouseDown={stopProp}
          title={cfg.side === "long" ? "Place Long grid orders on chart" : "Place Short grid orders on chart"}
        >
          <Play size={11} />
          {cfg.side === "long" ? "Long / Grid" : "Short / Grid"}
        </button>
      </div>
    </div>
  )
}
