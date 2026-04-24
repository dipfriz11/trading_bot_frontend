import { useState, useCallback, useEffect } from "react"
import { Download, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"
import type { GridConfig, GridLevel } from "@/types/terminal"
import { DEFAULT_GRID_CONFIG } from "@/types/terminal"
import { generateLevels, calcDerivedStats, exportGridConfig } from "@/lib/grid-helpers"

// ---- Micro UI primitives ----

const inputStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 4,
  color: "rgba(200,214,229,0.9)",
  background: "rgba(255,255,255,0.04)",
  padding: "4px 8px",
  fontSize: 11,
  fontFamily: "monospace",
  width: "100%",
  outline: "none",
}

const sectionStyle: React.CSSProperties = {
  borderBottom: "1px solid rgba(255,255,255,0.05)",
  paddingBottom: 8,
  marginBottom: 8,
}

function NumInput({
  value, onChange, placeholder, style, title,
}: {
  value: number | string
  onChange: (v: number) => void
  placeholder?: string
  style?: React.CSSProperties
  title?: string
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      placeholder={placeholder ?? "0"}
      title={title ?? placeholder}
      style={{ ...inputStyle, ...style }}
      onMouseDown={(e) => e.stopPropagation()}
    />
  )
}

function TextInput({
  value, onChange, placeholder, title,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  title?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? ""}
      title={title ?? placeholder}
      style={inputStyle}
      onMouseDown={(e) => e.stopPropagation()}
    />
  )
}

function SegmentedControl<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string; title?: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="flex-1 transition-colors"
          title={o.title}
          style={{
            fontSize: 9,
            fontFamily: "monospace",
            padding: "2px 0",
            background: value === o.value ? "rgba(30,111,239,0.15)" : "transparent",
            color: value === o.value ? "#1e6fef" : "rgba(255,255,255,0.35)",
            border: "none",
            cursor: "pointer",
            fontWeight: value === o.value ? 700 : 400,
            letterSpacing: "0.04em",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div
      className="flex items-center gap-2 cursor-pointer"
      onClick={() => onChange(!checked)}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          width: 28, height: 14, borderRadius: 7,
          background: checked ? "rgba(30,111,239,0.4)" : "rgba(255,255,255,0.1)",
          border: `1px solid ${checked ? "rgba(30,111,239,0.6)" : "rgba(255,255,255,0.15)"}`,
          position: "relative", flexShrink: 0, transition: "background 0.15s",
        }}
      >
        <div
          style={{
            position: "absolute", top: 1, left: checked ? 13 : 1,
            width: 10, height: 10, borderRadius: "50%",
            background: checked ? "#1e6fef" : "rgba(255,255,255,0.35)",
            transition: "left 0.15s",
          }}
        />
      </div>
      <span style={{ fontSize: 11, fontFamily: "monospace", opacity: checked ? 0.9 : 0.45 }}>{label}</span>
    </div>
  )
}

function SectionHeader({ title, expanded, onToggle }: { title: string; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      className="flex items-center justify-between w-full"
      style={{ background: "transparent", border: "none", padding: "4px 0", cursor: "pointer", marginBottom: expanded ? 6 : 0 }}
      onClick={onToggle}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {title}
      </span>
      {expanded ? <ChevronUp size={10} style={{ opacity: 0.4 }} /> : <ChevronDown size={10} style={{ opacity: 0.4 }} />}
    </button>
  )
}

function ReadonlyField({ placeholder, value }: { placeholder: string; value: string | number }) {
  return (
    <div
      style={{
        ...inputStyle,
        background: "rgba(30,111,239,0.05)",
        border: "1px solid rgba(30,111,239,0.15)",
        color: "rgba(100,160,255,0.8)",
        cursor: "default",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ opacity: 0.4, fontSize: 10 }}>{placeholder}</span>
      <span style={{ marginLeft: "auto" }}>{typeof value === "number" ? value.toFixed(6) : value}</span>
    </div>
  )
}

function EditableCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      style={{
        width: "100%", fontSize: 10, fontFamily: "monospace",
        background: "transparent", border: "1px solid transparent",
        borderRadius: 3, color: "rgba(200,214,229,0.8)", padding: "1px 3px", outline: "none",
      }}
      onFocus={(e) => { e.target.style.borderColor = "rgba(30,111,239,0.4)" }}
      onBlur={(e) => { e.target.style.borderColor = "transparent" }}
      onMouseDown={(e) => e.stopPropagation()}
    />
  )
}

// ---- Props ----

interface GridConfigTabProps {
  // Passed from OrderConsoleWidget to sync chart data
  symbol?: string
  marketType?: "spot" | "futures"
  futuresSide?: "long" | "short"
  entryPrice?: number
  availableBalance?: number
  leverage?: number
  onSideChange?: (side: "long" | "short") => void
}

// ---- Main component ----

export function GridConfigTab({
  symbol: externalSymbol,
  marketType: _marketType,
  futuresSide: externalFuturesSide,
  entryPrice: externalEntryPrice,
  availableBalance = 0,
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

  // Sync symbol from active chart
  useEffect(() => {
    if (externalSymbol) setCfg((prev) => ({ ...prev, symbol: externalSymbol }))
  }, [externalSymbol])

  // Sync entry price from active chart
  useEffect(() => {
    if (externalEntryPrice && externalEntryPrice > 0) {
      setCfg((prev) => ({ ...prev, entryPrice: externalEntryPrice }))
    }
  }, [externalEntryPrice])

  // Sync leverage from active chart
  useEffect(() => {
    if (externalLeverage && externalLeverage > 0) {
      setCfg((prev) => ({ ...prev, leverage: externalLeverage }))
    }
  }, [externalLeverage])

  // Sync futures side from active chart
  useEffect(() => {
    if (externalFuturesSide) setCfg((prev) => ({ ...prev, side: externalFuturesSide }))
  }, [externalFuturesSide])

  const [sections, setSections] = useState({
    general: true,
    levels: true,
    tpsl: false,
    resetTp: false,
    table: true,
    preview: false,
  })

  const toggleSection = (key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const update = useCallback(<K extends keyof GridConfig>(key: K, value: GridConfig[K]) => {
    setCfg((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleGenerate = () => {
    const levels = generateLevels(cfg)
    setCfg((prev) => ({ ...prev, levels }))
  }

  const updateLevel = (index: number, patch: Partial<GridLevel>) => {
    setCfg((prev) => ({
      ...prev,
      levels: prev.levels.map((l) => l.index === index ? { ...l, ...patch } : l),
    }))
  }

  const handleExport = () => {
    const json = exportGridConfig(cfg)
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `grid-config-${cfg.symbol.replace("/", "-")}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePctClick = (pct: number) => {
    const total = availableBalance * cfg.leverage
    const amount = (pct / 100) * total
    update("totalQuote", parseFloat(amount.toFixed(2)))
  }

  const derived = calcDerivedStats(cfg)

  // Side button style (matching New Order LONG/SHORT style)
  const sideBtn = (s: "long" | "short") => {
    const active = cfg.side === s
    const isLong = s === "long"
    const activeColor = isLong ? "#00e5a0" : "#ff4757"
    const activeBg = isLong ? "rgba(0,229,160,0.15)" : "rgba(255,71,87,0.15)"
    const activeBorder = isLong ? "#1a7a5a" : "#c02030"
    return {
      flex: 1,
      fontSize: 11,
      fontFamily: "monospace",
      fontWeight: 700,
      padding: "6px 0",
      background: active ? activeBg : "transparent",
      color: active ? activeColor : "rgba(255,255,255,0.3)",
      border: "none",
      borderBottom: active ? `2px solid ${activeBorder}` : "2px solid transparent",
      cursor: "pointer",
      letterSpacing: "0.05em",
      transition: "all 0.15s",
      textTransform: "uppercase" as const,
    }
  }

  const stopProp = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      className="flex flex-col h-full overflow-auto"
      style={{ padding: "8px 10px", gap: 0 }}
      onMouseDown={stopProp}
    >
      {/* ---- 1. General ---- */}
      <div style={sectionStyle}>
        <SectionHeader title="General" expanded={sections.general} onToggle={() => toggleSection("general")} />
        {sections.general && (
          <div className="flex flex-col" style={{ gap: 4 }}>
            <Toggle checked={cfg.enabled} onChange={(v) => update("enabled", v)} label="Grid Enabled" />

            {/* Side: Long / Short — FIRST, user decides direction */}
            <div
              className="flex rounded overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              title="Direction: Long profits when price rises, Short when it falls"
            >
              {(["long", "short"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { update("side", s); onSideChange?.(s) }}
                  title={s === "long" ? "Long — buy low, profit when price goes up" : "Short — sell high, profit when price goes down"}
                  style={{ ...sideBtn(s), fontSize: 10, padding: "3px 0" }}
                  onMouseDown={stopProp}
                >
                  {s === "long" ? "LONG" : "SHORT"}
                </button>
              ))}
            </div>

            {/* Symbol + Leverage */}
            <div className="grid grid-cols-2" style={{ gap: 4 }}>
              <TextInput
                value={cfg.symbol}
                onChange={(v) => update("symbol", v)}
                placeholder="Symbol"
                title="Trading pair (e.g. BTC/USDT)"
              />
              <NumInput
                value={cfg.leverage}
                onChange={(v) => update("leverage", Math.max(1, v))}
                placeholder="Leverage ×"
                title="Leverage multiplier (1× = no leverage)"
              />
            </div>

            {/* Orders Count */}
            <NumInput
              value={cfg.ordersCount}
              onChange={(v) => update("ordersCount", Math.max(1, Math.round(v)))}
              placeholder="Orders Count"
              title="Total number of limit orders in the grid"
            />

            {/* Entry / Top / Bottom price */}
            <div className="grid grid-cols-3" style={{ gap: 4 }}>
              <NumInput
                value={cfg.entryPrice}
                onChange={(v) => update("entryPrice", v)}
                placeholder="Entry"
                title="First order price (entry point)"
              />
              <NumInput
                value={cfg.topPrice}
                onChange={(v) => update("topPrice", v)}
                placeholder="Top"
                title="Upper price boundary of the grid"
              />
              <NumInput
                value={cfg.bottomPrice}
                onChange={(v) => update("bottomPrice", v)}
                placeholder="Bottom"
                title="Lower price boundary of the grid"
              />
            </div>

            {/* Total Quote + % buttons */}
            <div className="flex flex-col" style={{ gap: 3 }}>
              <NumInput
                value={cfg.totalQuote}
                onChange={(v) => update("totalQuote", v)}
                placeholder="Total Quote (USDT)"
                title="Total capital to allocate across all grid orders"
              />
              <div className="flex gap-1">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handlePctClick(pct)}
                    className="flex-1 transition-colors"
                    title={`Set total quote to ${pct}% of available balance`}
                    style={{
                      fontSize: 9, fontFamily: "monospace", padding: "1px 0",
                      background: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,0.4)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 3, cursor: "pointer",
                    }}
                    onMouseDown={stopProp}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Qty Mode */}
            <SegmentedControl
              options={[
                { value: "fixed", label: "Fixed", title: "Equal quantity on each grid order" },
                { value: "multiplier", label: "Multiplier", title: "Each order is larger by a set multiplier" },
                { value: "custom", label: "Custom", title: "Set quantity for each level manually" },
              ]}
              value={cfg.qtyMode}
              onChange={(v) => update("qtyMode", v)}
            />
          </div>
        )}
      </div>

      {/* ---- 2. Level Logic ---- */}
      <div style={sectionStyle}>
        <SectionHeader title="Level Logic" expanded={sections.levels} onToggle={() => toggleSection("levels")} />
        {sections.levels && (
          <div className="flex flex-col" style={{ gap: 5 }}>
            <SegmentedControl
              options={[
                { value: "arithmetic", label: "Arith", title: "Equal price distance between levels" },
                { value: "geometric", label: "Geo", title: "Equal percentage distance between levels" },
                { value: "custom", label: "Custom", title: "Set each level price manually" },
              ]}
              value={cfg.gridMode}
              onChange={(v) => update("gridMode", v)}
            />

            <div className="grid grid-cols-2" style={{ gap: 5 }}>
              <NumInput
                value={cfg.stepPercent}
                onChange={(v) => update("stepPercent", v)}
                placeholder="Step %"
                title="Percentage distance between each grid level"
              />
              {cfg.qtyMode === "multiplier" && (
                <NumInput
                  value={cfg.multiplier}
                  onChange={(v) => update("multiplier", v)}
                  placeholder="Multiplier"
                  title="Each order is this many times larger than the previous"
                />
              )}
            </div>

            <ReadonlyField placeholder="Base Order Size" value={derived.baseOrderSize} />

            {/* Generate Levels — styled like Submit button */}
            <button
              onClick={handleGenerate}
              className="flex items-center justify-center gap-1.5 w-full transition-all"
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                fontWeight: 700,
                padding: "8px 0",
                borderRadius: 4,
                background: "rgba(30,111,239,0.15)",
                color: "#1e6fef",
                border: "1px solid rgba(30,111,239,0.4)",
                cursor: "pointer",
                letterSpacing: "0.03em",
              }}
              onMouseDown={stopProp}
            >
              <RefreshCw size={12} />
              Generate Levels
            </button>
          </div>
        )}
      </div>

      {/* ---- 3. TP / SL ---- */}
      <div style={sectionStyle}>
        <SectionHeader title="TP / SL" expanded={sections.tpsl} onToggle={() => toggleSection("tpsl")} />
        {sections.tpsl && (
          <div className="flex flex-col" style={{ gap: 5 }}>
            <div className="grid grid-cols-2" style={{ gap: 5 }}>
              <NumInput
                value={cfg.tpPercent}
                onChange={(v) => update("tpPercent", v)}
                placeholder="TP %"
                title="Take Profit: close position when price rises by this % above average entry"
              />
              <NumInput
                value={cfg.slPercent}
                onChange={(v) => update("slPercent", v)}
                placeholder="SL %"
                title="Stop Loss: close position when price falls by this % below average entry"
              />
            </div>
            <SegmentedControl
              options={[
                { value: "fixed", label: "Fixed", title: "Keep TP at the original price level" },
                { value: "reprice", label: "Reprice", title: "Recalculate TP as new orders fill" },
              ]}
              value={cfg.tpUpdateMode}
              onChange={(v) => update("tpUpdateMode", v)}
            />
            <Toggle checked={cfg.trailingEnabled} onChange={(v) => update("trailingEnabled", v)} label="Trailing Stop" />
            {cfg.trailingEnabled && (
              <NumInput
                value={cfg.trailingStepPercent}
                onChange={(v) => update("trailingStepPercent", v)}
                placeholder="Trailing Step %"
                title="Trail stop follows price by this percentage distance"
              />
            )}
          </div>
        )}
      </div>

      {/* ---- 4. Reset TP ---- */}
      <div style={sectionStyle}>
        <SectionHeader title="Reset TP" expanded={sections.resetTp} onToggle={() => toggleSection("resetTp")} />
        {sections.resetTp && (
          <div className="flex flex-col" style={{ gap: 5 }}>
            <Toggle checked={cfg.resetTpEnabled} onChange={(v) => update("resetTpEnabled", v)} label="Reset TP (global)" />
            <div className="grid grid-cols-2" style={{ gap: 5 }}>
              <NumInput value={cfg.defaultResetTpPercent} onChange={(v) => update("defaultResetTpPercent", v)} placeholder="Reset TP %" />
              <NumInput value={cfg.defaultResetTpClosePercent} onChange={(v) => update("defaultResetTpClosePercent", v)} placeholder="Close %" />
            </div>
            <p style={{ fontSize: 10, fontFamily: "monospace", opacity: 0.3, lineHeight: 1.4 }}>
              Per-level overrides in the table below.
            </p>
          </div>
        )}
      </div>

      {/* ---- 5. Levels Table ---- */}
      <div style={sectionStyle}>
        <SectionHeader
          title={`Levels Table (${cfg.levels.length})`}
          expanded={sections.table}
          onToggle={() => toggleSection("table")}
        />
        {sections.table && (
          cfg.levels.length === 0 ? (
            <div style={{ fontSize: 10, fontFamily: "monospace", opacity: 0.3, textAlign: "center", padding: "10px 0" }}>
              No levels — click Generate Levels above
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "monospace" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["#", "Price", "Qty", "RTP", "TP%", "Cls%"].map((h) => (
                      <th key={h} style={{ padding: "2px 3px", opacity: 0.4, textAlign: "right", fontWeight: 500 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cfg.levels.map((level) => (
                    <tr key={level.index} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "1px 3px", opacity: 0.4, textAlign: "right" }}>{level.index}</td>
                      <td style={{ padding: "1px 3px" }}>
                        <EditableCell value={level.price} onChange={(v) => updateLevel(level.index, { price: v })} />
                      </td>
                      <td style={{ padding: "1px 3px" }}>
                        <EditableCell value={level.qty} onChange={(v) => updateLevel(level.index, { qty: v })} />
                      </td>
                      <td style={{ padding: "1px 3px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={level.useResetTp}
                          onChange={(e) => updateLevel(level.index, { useResetTp: e.target.checked })}
                          style={{ accentColor: "#1e6fef", cursor: "pointer" }}
                          onMouseDown={stopProp}
                        />
                      </td>
                      <td style={{ padding: "1px 3px", opacity: level.useResetTp ? 1 : 0.3 }}>
                        {level.useResetTp
                          ? <EditableCell value={level.resetTpPercent} onChange={(v) => updateLevel(level.index, { resetTpPercent: v })} />
                          : <span style={{ paddingLeft: 3 }}>{level.resetTpPercent}</span>
                        }
                      </td>
                      <td style={{ padding: "1px 3px", opacity: level.useResetTp ? 1 : 0.3 }}>
                        {level.useResetTp
                          ? <EditableCell value={level.resetTpClosePercent} onChange={(v) => updateLevel(level.index, { resetTpClosePercent: v })} />
                          : <span style={{ paddingLeft: 3 }}>{level.resetTpClosePercent}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* ---- 6. Preview ---- */}
      <div style={{ ...sectionStyle, borderBottom: "none", paddingBottom: 0 }}>
        <SectionHeader title="Preview" expanded={sections.preview} onToggle={() => toggleSection("preview")} />
        {sections.preview && (
          <div className="flex flex-col" style={{ gap: 5 }}>
            <div className="grid grid-cols-2" style={{ gap: 4 }}>
              {[
                { label: "Total Levels", value: derived.totalLevels },
                { label: "Total Qty", value: derived.totalQty.toFixed(4) },
                { label: "Grid Amount", value: `$${derived.totalGridAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}` },
                { label: "Reset TP Levels", value: derived.resetEnabledCount },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{ padding: "4px 6px", borderRadius: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div style={{ fontSize: 9, fontFamily: "monospace", opacity: 0.4 }}>{label}</div>
                  <div style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(200,214,229,0.9)", fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>
            <pre
              style={{
                fontSize: 9, fontFamily: "monospace", color: "rgba(100,160,255,0.7)",
                background: "rgba(30,111,239,0.04)", border: "1px solid rgba(30,111,239,0.12)",
                borderRadius: 4, padding: "6px 8px", overflowX: "auto",
                maxHeight: 120, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
              }}
            >
              {JSON.stringify({ ...cfg, levels: cfg.levels.slice(0, 3) }, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* ---- Export ---- */}
      <button
        onClick={handleExport}
        className="flex items-center justify-center gap-1.5 w-full transition-all mt-2"
        style={{
          fontSize: 11, fontFamily: "monospace", fontWeight: 700,
          padding: "7px 0", borderRadius: 4,
          background: "rgba(0,229,160,0.08)", color: "#00e5a0",
          border: "1px solid rgba(0,229,160,0.25)", cursor: "pointer", flexShrink: 0,
        }}
        onMouseDown={stopProp}
      >
        <Download size={12} />
        Export Grid Config
      </button>
    </div>
  )
}
