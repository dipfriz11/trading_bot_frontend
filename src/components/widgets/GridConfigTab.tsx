import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { ChevronDown, ChevronUp, Play, RotateCcw, Copy, Check, Plus, Trash2 } from "lucide-react"
import type { GridConfig } from "@/types/terminal"
import { DEFAULT_GRID_CONFIG } from "@/types/terminal"
import { generateLevels, calcDerivedStats, exportGridConfig } from "@/lib/grid-helpers"

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

function NI({
  value, onChange, placeholder, title, min, suffix, label,
}: {
  value: number | string; onChange: (v: number) => void
  placeholder?: string; title?: string; min?: number; step?: number; suffix?: string; label?: string
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
      const current = typeof valueRef.current === "number" ? valueRef.current : parseFloat(String(valueRef.current)) || 0
      const next = current + delta
      onChange(min !== undefined ? Math.max(min, next) : next)
    }
    el.addEventListener("wheel", handler, { passive: false })
    return () => el.removeEventListener("wheel", handler)
  }, [onChange, min])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "")
    const parsed = parseFloat(raw)
    if (!isNaN(parsed)) onChange(min !== undefined ? Math.max(min, parsed) : parsed)
    else if (raw === "" || raw === ".") onChange(0)
  }

  const tag = suffix ?? label
  const tagW = tag ? tag.length * 6 + 10 : 0

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={ref}
        type="text" inputMode="decimal" value={value}
        onChange={handleChange}
        placeholder={placeholder ?? "0"} title={title ?? placeholder}
        style={{ ...inputBase, paddingRight: tag ? tagW + 2 : undefined }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      {tag && (
        <span style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", fontSize: 7.5, opacity: 0.32, fontFamily: "monospace", pointerEvents: "none", whiteSpace: "nowrap", letterSpacing: "0.03em" }}>
          {tag}
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

function TI({ value, onChange, placeholder, title }: { value: string; onChange: (v: string) => void; placeholder?: string; title?: string }) {
  return (
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} title={title ?? placeholder} style={inputBase}
      onMouseDown={(e) => e.stopPropagation()} />
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
    <button
      className="flex items-center justify-between w-full"
      style={{ background: "transparent", border: "none", padding: "5px 0", cursor: "pointer" }}
      onClick={onToggle}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span className="flex items-center gap-1.5" style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
        {title}
        {pro && <span style={{ fontSize: 7, background: "rgba(255,170,0,0.2)", color: "#ffaa00", border: "1px solid rgba(255,170,0,0.3)", borderRadius: 2, padding: "0 3px" }}>PRO</span>}
        {badge}
      </span>
      <div className="flex items-center gap-1.5">
        {rightSlot}
        {expanded ? <ChevronUp size={9} style={{ opacity: 0.4 }} /> : <ChevronDown size={9} style={{ opacity: 0.4 }} />}
      </div>
    </button>
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
  })
  const tog = (k: keyof typeof open) => setOpen((p) => ({ ...p, [k]: !p[k] }))

  // Auto-regenerate levels on key config change
  const levels = useMemo(() => generateLevels(cfg), [
    cfg.ordersCount, cfg.entryPrice, cfg.placementMode, cfg.firstOffsetPercent,
    cfg.stepPercent, cfg.lastOffsetPercent, cfg.direction, cfg.totalQuote,
    cfg.leverage, cfg.multiplierEnabled, cfg.multiplier, cfg.topPrice, cfg.bottomPrice,
  ])

  const cfgWithLevels = useMemo(() => ({ ...cfg, levels }), [cfg, levels])
  const derived = useMemo(() => calcDerivedStats(cfgWithLevels, availableBalance), [cfgWithLevels, availableBalance])

  const handlePct = (pct: number) => {
    const amt = parseFloat(((pct / 100) * availableBalance).toFixed(2))
    upd("totalQuote", amt)
  }

  const [copied, setCopied] = useState(false)
  const handleCopyJson = () => {
    navigator.clipboard.writeText(exportGridConfig(cfgWithLevels)).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
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
          <MiniToggle checked={proMode} onChange={setProMode} />
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
              <NI value={cfg.firstOffsetPercent} onChange={(v) => upd("firstOffsetPercent", v)} label="1st order %" min={0} step={0.1} title="Distance from entry price to 1st order" />
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

      {/* ── 5. TRAIL ─────────────────────────────────── */}
      <div style={{ marginBottom: 6 }}>
        <SectionHead
          title="5. TRAIL"
          expanded={open.trail}
          onToggle={() => tog("trail")}
          rightSlot={<MiniToggle checked={cfg.trailEnabled} onChange={(v) => upd("trailEnabled", v)} />}
        />
        {open.trail && cfg.trailEnabled && (
          <div style={{ ...gap4, marginTop: 4 }}>
            {/* Trigger % */}
            <div className="grid grid-cols-1" style={{ gap: 4 }}>
              <NITooltip
                value={cfg.trailTriggerPercent}
                onChange={(v) => upd("trailTriggerPercent", v)}
                label="Trigger %"
                title="Trail trigger %"
                tooltip="Процент движения цены от края сетки, при котором сетка начинает перемещаться за ценой, сохраняя настроенное расстояние от тренда."
              />
            </div>
            {/* Info hint */}
            <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(154,164,174,0.55)", lineHeight: 1.45, padding: "4px 6px", background: "rgba(30,111,239,0.05)", border: "1px solid rgba(30,111,239,0.1)", borderRadius: 3 }}>
              Сетка перемещается за ценой сохраняя расстояние до тренда согласно конфига
            </div>
          </div>
        )}
      </div>
      <Divider />

      {/* ── 6. TAKE PROFIT ───────────────────────────── */}
      <div style={{ marginBottom: 6 }}>
        <SectionHead
          title="6. TAKE PROFIT"
          expanded={open.tp}
          onToggle={() => tog("tp")}
          rightSlot={<MiniToggle checked={cfg.tpEnabled} onChange={(v) => upd("tpEnabled", v)} />}
        />
        {open.tp && cfg.tpEnabled && (
          <div style={{ ...gap4, marginTop: 4 }}>
            <Seg
              options={[
                { v: "avg_entry", label: "Avg Entry", title: "TP based on average entry price" },
                { v: "breakeven_offset", label: "Breakeven + Offset", title: "TP above breakeven point" },
              ]}
              value={cfg.tpMode}
              onChange={(v) => upd("tpMode", v)}
            />
            <div className="grid grid-cols-2" style={{ gap: 4 }}>
              <NI value={cfg.tpPercent} onChange={(v) => upd("tpPercent", v)} label="TP %" min={0} step={0.1} title="Take profit percentage from average entry" />
              <NI value={cfg.tpClosePercent} onChange={(v) => upd("tpClosePercent", Math.min(100, Math.max(1, v)))} label="Close %" min={1} title="Percentage of position to close when TP triggers" />
            </div>

            {/* Multi TP */}
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 9, fontFamily: "monospace", opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.06em" }}>Multi TP</span>
              <MiniToggle checked={cfg.multiTpEnabled} onChange={(v) => upd("multiTpEnabled", v)} />
            </div>
            {cfg.multiTpEnabled && (
              <div style={{ ...gap4 }}>
                {/* Header */}
                <div className="grid grid-cols-3" style={{ gap: 2, fontSize: 9, fontFamily: "monospace", opacity: 0.35 }}>
                  <span style={{ paddingLeft: 4 }}>#</span>
                  <span>TP %</span>
                  <span>Close %</span>
                </div>
                {cfg.multiTpLevels.map((lvl, i) => (
                  <div key={i} className="grid grid-cols-3 items-center" style={{ gap: 2 }}>
                    <span style={{ fontSize: 9, fontFamily: "monospace", opacity: 0.4, paddingLeft: 4 }}>{i + 1}</span>
                    <NI value={lvl.tpPercent} onChange={(v) => {
                      const next = [...cfg.multiTpLevels]
                      next[i] = { ...next[i], tpPercent: v }
                      upd("multiTpLevels", next)
                    }} suffix="%" step={0.1} />
                    <NI value={lvl.closePercent} onChange={(v) => {
                      const next = [...cfg.multiTpLevels]
                      next[i] = { ...next[i], closePercent: v }
                      upd("multiTpLevels", next)
                    }} suffix="%" step={1} />
                  </div>
                ))}
                <div className="flex gap-2">
                  <button
                    onClick={() => upd("multiTpLevels", [...cfg.multiTpLevels, { tpPercent: 2, closePercent: 50 }])}
                    className="flex items-center gap-1 flex-1"
                    style={{ fontSize: 9, fontFamily: "monospace", padding: "2px 6px", background: "rgba(30,111,239,0.1)", color: "#1e6fef", border: "1px solid rgba(30,111,239,0.25)", borderRadius: 3, cursor: "pointer" }}
                    onMouseDown={stopProp}
                  >
                    <Plus size={8} /> Add Level
                  </button>
                  {cfg.multiTpLevels.length > 1 && (
                    <button
                      onClick={() => upd("multiTpLevels", cfg.multiTpLevels.slice(0, -1))}
                      style={{ fontSize: 9, fontFamily: "monospace", padding: "2px 6px", background: "rgba(255,71,87,0.08)", color: "#ff4757", border: "1px solid rgba(255,71,87,0.2)", borderRadius: 3, cursor: "pointer" }}
                      onMouseDown={stopProp}
                    >
                      <Trash2 size={8} />
                    </button>
                  )}
                </div>
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

      {/* ── 7. STOP LOSS ─────────────────────────────── */}
      <div style={{ marginBottom: 6 }}>
        <SectionHead
          title="7. STOP LOSS"
          expanded={open.sl}
          onToggle={() => tog("sl")}
          rightSlot={<MiniToggle checked={cfg.slEnabled} onChange={(v) => upd("slEnabled", v)} />}
        />
        {open.sl && cfg.slEnabled && (
          <div style={{ ...gap4, marginTop: 4 }}>
            <Seg
              options={[
                { v: "extreme_order", label: "Extreme Order", title: "SL based on last filled grid order price" },
                { v: "avg_entry", label: "Avg Entry", title: "SL based on average position price" },
              ]}
              value={cfg.slMode}
              onChange={(v) => upd("slMode", v)}
            />
            <div className="grid grid-cols-2" style={{ gap: 4 }}>
              <NI value={cfg.slPercent} onChange={(v) => upd("slPercent", v)} label="SL %" min={0} step={0.1} title="Stop loss percentage" />
              <NI value={cfg.slClosePercent} onChange={(v) => upd("slClosePercent", Math.min(100, Math.max(1, v)))} label="Close %" min={1} title="Percentage of position to close at stop loss" />
            </div>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(200,214,229,0.3)", lineHeight: 1.5 }}>
              {cfg.slMode === "extreme_order"
                ? "SL triggered from last filled grid order (extreme order)"
                : "SL calculated from average position entry price"}
            </div>
          </div>
        )}
        {open.sl && !cfg.slEnabled && (
          <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(200,214,229,0.3)", padding: "4px 0" }}>
            Stop loss disabled
          </div>
        )}
      </div>

      {/* ── 8. RESET TP (PRO) ────────────────────────── */}
      {proMode && (
        <>
          <Divider />
          <div style={{ marginBottom: 6 }}>
            <SectionHead
              title="8. RESET TP"
              expanded={open.resetTp}
              onToggle={() => tog("resetTp")}
              pro
              rightSlot={<MiniToggle checked={cfg.resetTpEnabled} onChange={(v) => upd("resetTpEnabled", v)} />}
            />
            {open.resetTp && (
              <div style={{ ...gap4, marginTop: 4 }}>
                {cfg.resetTpEnabled ? (
                  <>
                    <TI
                      value={cfg.resetTpTriggerLevels.join(",")}
                      onChange={(v) => upd("resetTpTriggerLevels", v.split(",").map((x) => parseInt(x.trim())).filter((x) => !isNaN(x)))}
                      placeholder="Trigger levels (e.g. 3,5,7)"
                      title="Comma-separated order levels that trigger a TP reset"
                    />
                    <div className="grid grid-cols-2" style={{ gap: 4 }}>
                      <NI value={cfg.defaultResetTpPercent} onChange={(v) => upd("defaultResetTpPercent", v)} label="Reset TP %" step={0.1} title="TP percentage after reset" />
                      <NI value={cfg.defaultResetTpClosePercent} onChange={(v) => upd("defaultResetTpClosePercent", v)} label="Close %" step={1} title="Position % to close during reset" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 9, fontFamily: "monospace", opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rebuild Tail</span>
                      <MiniToggle checked={cfg.resetTpRebuildTail} onChange={(v) => upd("resetTpRebuildTail", v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 9, fontFamily: "monospace", opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.06em" }}>Per Level Settings</span>
                      <MiniToggle checked={cfg.resetTpPerLevelEnabled} onChange={(v) => upd("resetTpPerLevelEnabled", v)} />
                    </div>
                    {cfg.resetTpPerLevelEnabled && derived.totalLevels > 0 && (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9, fontFamily: "monospace" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                              {["Level", "Reset TP %", "Close %"].map((h) => (
                                <th key={h} style={{ padding: "2px 4px", opacity: 0.4, textAlign: "left", fontWeight: 500 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {levels.map((_, i) => {
                              const s = cfg.resetTpPerLevelSettings[i] ?? { level: i + 1, resetTpPercent: cfg.defaultResetTpPercent, resetClosePercent: cfg.defaultResetTpClosePercent }
                              return (
                                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                                  <td style={{ padding: "2px 4px", opacity: 0.5 }}>{i + 1}</td>
                                  <td style={{ padding: "2px 4px" }}>
                                    <input type="number" value={s.resetTpPercent}
                                      onChange={(e) => {
                                        const next = [...cfg.resetTpPerLevelSettings]
                                        next[i] = { ...s, resetTpPercent: parseFloat(e.target.value) || 0 }
                                        upd("resetTpPerLevelSettings", next)
                                      }}
                                      style={{ ...inputBase, padding: "1px 4px", fontSize: 9 }}
                                      onMouseDown={stopProp}
                                    />
                                  </td>
                                  <td style={{ padding: "2px 4px" }}>
                                    <input type="number" value={s.resetClosePercent}
                                      onChange={(e) => {
                                        const next = [...cfg.resetTpPerLevelSettings]
                                        next[i] = { ...s, resetClosePercent: parseFloat(e.target.value) || 0 }
                                        upd("resetTpPerLevelSettings", next)
                                      }}
                                      style={{ ...inputBase, padding: "1px 4px", fontSize: 9 }}
                                      onMouseDown={stopProp}
                                    />
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(200,214,229,0.3)", padding: "4px 0" }}>
                    Reset TP disabled — enable toggle to configure
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── SUMMARY PANEL ────────────────────────────── */}
      <Divider />
      <div style={{ marginBottom: 6 }}>
        <SectionHead title="SUMMARY" expanded={open.summary} onToggle={() => tog("summary")} />
        {open.summary && (
          <div style={{ ...gap4, marginTop: 4 }}>
            <div className="grid grid-cols-2" style={{ gap: 3 }}>
              {[
                { label: "Total Orders", value: derived.totalLevels },
                { label: "Total Budget", value: `${cfg.totalQuote.toLocaleString("en-US")} USDT` },
                { label: "Max Position", value: `${derived.maxPositionSize.toFixed(2)} USDT` },
                { label: "Leverage", value: `${cfg.leverage}×` },
                { label: "Max Margin (Est.)", value: `${derived.maxMarginRequired.toFixed(2)} USDT` },
                { label: "Free Margin After", value: `${derived.freeMarginAfter.toFixed(2)} USDT` },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: "3px 6px", borderRadius: 4, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 8, fontFamily: "monospace", opacity: 0.35, marginBottom: 1 }}>{label}</div>
                  <div style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(200,214,229,0.9)", fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>
            {/* TP/SL summary */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 4, padding: "5px 7px" }}>
              <div style={{ fontSize: 9, fontFamily: "monospace", opacity: 0.4, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>TP / SL Summary</div>
              <div className="flex flex-col" style={{ gap: 3 }}>
                {[
                  { label: "Avg Entry", value: `${derived.avgEntryPrice.toFixed(2)} USDT` },
                  { label: "Take Profit", value: derived.tpPrice ? `${cfg.tpPercent}% (${derived.tpPrice.toFixed(2)} USDT)` : "Disabled", color: derived.tpPrice ? "#00e5a0" : undefined },
                  { label: "Stop Loss", value: derived.slPrice ? `${cfg.slPercent}% (${derived.slPrice.toFixed(2)} USDT)` : "Disabled", color: derived.slPrice ? "#ff4757" : undefined },
                  { label: "Reset TP", value: cfg.resetTpEnabled ? "Enabled" : "Disabled" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span style={{ fontSize: 9, fontFamily: "monospace", opacity: 0.45 }}>{label}</span>
                    <span style={{ fontSize: 9, fontFamily: "monospace", color: color ?? "rgba(200,214,229,0.7)", fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── GRID TABLE ───────────────────────────────── */}
      <Divider />
      <div style={{ marginBottom: 6 }}>
        <SectionHead
          title={`GRID PREVIEW (${derived.totalLevels} LEVELS)`}
          expanded={open.gridTable}
          onToggle={() => tog("gridTable")}
        />
        {open.gridTable && (
          derived.totalLevels === 0 ? (
            <div style={{ fontSize: 9, fontFamily: "monospace", opacity: 0.3, textAlign: "center", padding: "8px 0" }}>
              Configure grid to see level breakdown
            </div>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 4 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9, fontFamily: "monospace" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["#", "Price", "Qty", "Notional", "Cum.Exp."].map((h) => (
                      <th key={h} style={{ padding: "2px 4px", opacity: 0.4, textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {levels.map((lvl) => (
                    <tr key={lvl.index} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "2px 4px", opacity: 0.45, textAlign: "right" }}>{lvl.index}</td>
                      <td style={{ padding: "2px 4px", textAlign: "right", color: "#60a5fa" }}>{lvl.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: "2px 4px", textAlign: "right", color: "rgba(200,214,229,0.8)" }}>{lvl.qty.toFixed(2)}</td>
                      <td style={{ padding: "2px 4px", textAlign: "right", color: "rgba(200,214,229,0.8)" }}>{lvl.notional.toFixed(2)}</td>
                      <td style={{ padding: "2px 4px", textAlign: "right", color: "rgba(200,214,229,0.6)" }}>{lvl.cumExposure.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td colSpan={3} style={{ padding: "3px 4px", opacity: 0.4, textAlign: "right", fontSize: 8 }}>Est. Avg Entry</td>
                    <td colSpan={2} style={{ padding: "3px 4px", textAlign: "right", color: "#00e5a0", fontWeight: 700 }}>
                      {derived.avgEntryPrice.toFixed(2)} USDT
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} style={{ padding: "2px 4px", opacity: 0.4, textAlign: "right", fontSize: 8 }}>Est. Max Exposure</td>
                    <td colSpan={2} style={{ padding: "2px 4px", textAlign: "right", color: "#00e5a0", fontWeight: 700 }}>
                      {derived.maxPositionSize.toFixed(2)} USDT
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )}
      </div>

      {/* ── CONFIG JSON (PRO) ────────────────────────── */}
      {proMode && (
        <>
          <Divider />
          <div style={{ marginBottom: 6 }}>
            <SectionHead
              title="CONFIG JSON"
              expanded={open.configJson}
              onToggle={() => tog("configJson")}
              pro
              rightSlot={
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyJson() }}
                  style={{ fontSize: 8, fontFamily: "monospace", padding: "1px 5px", background: "rgba(255,255,255,0.06)", color: "rgba(200,214,229,0.6)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, cursor: "pointer" }}
                  onMouseDown={stopProp}
                >
                  {copied ? <Check size={8} /> : <Copy size={8} />}
                </button>
              }
            />
            {open.configJson && (
              <pre style={{
                fontSize: 8, fontFamily: "monospace", color: "rgba(100,160,255,0.65)",
                background: "rgba(30,111,239,0.04)", border: "1px solid rgba(30,111,239,0.12)",
                borderRadius: 4, padding: "6px 8px", overflowX: "auto",
                maxHeight: 160, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
                marginTop: 4,
              }}>
                {JSON.stringify({
                  strategy: "grid",
                  symbol: cfgWithLevels.symbol.replace("/", ""),
                  position_side: cfgWithLevels.side.toUpperCase(),
                  leverage: cfgWithLevels.leverage,
                  grid: {
                    orders_count: cfgWithLevels.ordersCount,
                    total_budget: cfgWithLevels.totalQuote,
                    placement_mode: cfgWithLevels.placementMode,
                    first_offset_percent: cfgWithLevels.firstOffsetPercent,
                    step_percent: cfgWithLevels.stepPercent,
                    last_offset_percent: cfgWithLevels.lastOffsetPercent,
                    direction: cfgWithLevels.direction,
                    qty_mode: cfgWithLevels.multiplierEnabled ? "multiplier" : "fixed",
                    qty_multiplier: cfgWithLevels.multiplier,
                  },
                }, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}

      {/* ── ACTIONS ──────────────────────────────────── */}
      <div className="flex gap-2 sticky bottom-0" style={{ paddingTop: 6, paddingBottom: 2, background: "rgba(13,17,25,0.95)" }}>
        <button
          onClick={() => setCfg({ ...DEFAULT_GRID_CONFIG, symbol: cfg.symbol, side: cfg.side, entryPrice: cfg.entryPrice, leverage: cfg.leverage })}
          className="flex items-center justify-center gap-1 flex-1"
          style={{
            fontSize: 10, fontFamily: "monospace", fontWeight: 600, padding: "6px 0",
            background: "rgba(255,255,255,0.04)", color: "rgba(200,214,229,0.6)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, cursor: "pointer",
          }}
          onMouseDown={stopProp}
          title="Reset all settings to defaults"
        >
          <RotateCcw size={10} /> Reset
        </button>
        <button
          onClick={() => tog("gridTable")}
          className="flex items-center justify-center gap-1 flex-1"
          style={{
            fontSize: 10, fontFamily: "monospace", fontWeight: 600, padding: "6px 0",
            background: "rgba(30,111,239,0.1)", color: "#1e6fef",
            border: "1px solid rgba(30,111,239,0.35)", borderRadius: 4, cursor: "pointer",
          }}
          onMouseDown={stopProp}
          title="Preview calculated grid orders"
        >
          Preview Orders
        </button>
        <button
          className="flex items-center justify-center gap-1.5 flex-1"
          style={{
            fontSize: 10, fontFamily: "monospace", fontWeight: 700, padding: "6px 0",
            background: "rgba(0,229,160,0.15)", color: "#00e5a0",
            border: "1px solid rgba(0,229,160,0.4)", borderRadius: 4, cursor: "pointer",
          }}
          onMouseDown={stopProp}
          title="Create and activate this grid bot"
        >
          <Play size={10} /> Create Bot
        </button>
      </div>
    </div>
  )
}
