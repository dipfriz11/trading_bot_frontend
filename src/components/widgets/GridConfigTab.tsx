import { useState, useCallback } from "react"
import { Download, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"
import type { GridConfig, GridLevel } from "@/types/terminal"
import { DEFAULT_GRID_CONFIG } from "@/types/terminal"
import { generateLevels, calcDerivedStats, exportGridConfig } from "@/lib/grid-helpers"

// ---- Micro UI primitives matching OrderConsoleWidget style ----

const inputStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 4,
  color: "rgba(200,214,229,0.9)",
  background: "rgba(255,255,255,0.04)",
  padding: "3px 6px",
  fontSize: 11,
  fontFamily: "monospace",
  width: "100%",
  outline: "none",
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "monospace",
  opacity: 0.4,
  marginBottom: 2,
  display: "block",
}

const sectionStyle: React.CSSProperties = {
  borderBottom: "1px solid rgba(255,255,255,0.05)",
  paddingBottom: 8,
  marginBottom: 8,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col" style={{ gap: 2 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function NumInput({ value, onChange, placeholder }: { value: number | string; onChange: (v: number) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      placeholder={placeholder ?? "0"}
      style={inputStyle}
      onMouseDown={(e) => e.stopPropagation()}
    />
  )
}

function SegmentedControl<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="flex-1 transition-colors"
          style={{
            fontSize: 10,
            fontFamily: "monospace",
            padding: "3px 0",
            background: value === o.value ? "rgba(30,111,239,0.15)" : "transparent",
            color: value === o.value ? "#1e6fef" : "rgba(255,255,255,0.35)",
            border: "none",
            cursor: "pointer",
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
          width: 28,
          height: 14,
          borderRadius: 7,
          background: checked ? "rgba(30,111,239,0.4)" : "rgba(255,255,255,0.1)",
          border: `1px solid ${checked ? "rgba(30,111,239,0.6)" : "rgba(255,255,255,0.15)"}`,
          position: "relative",
          flexShrink: 0,
          transition: "background 0.15s",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 1,
            left: checked ? 13 : 1,
            width: 10,
            height: 10,
            borderRadius: "50%",
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

// ---- Read-only preview field ----
function ReadonlyField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col" style={{ gap: 2 }}>
      <label style={labelStyle}>{label}</label>
      <div
        style={{
          ...inputStyle,
          background: "rgba(30,111,239,0.05)",
          border: "1px solid rgba(30,111,239,0.15)",
          color: "rgba(100,160,255,0.8)",
          cursor: "default",
        }}
      >
        {typeof value === "number" ? value.toFixed(6) : value}
      </div>
    </div>
  )
}

// ---- Inline editable cell ----
function EditableCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      style={{
        width: "100%",
        fontSize: 10,
        fontFamily: "monospace",
        background: "transparent",
        border: "1px solid transparent",
        borderRadius: 3,
        color: "rgba(200,214,229,0.8)",
        padding: "1px 3px",
        outline: "none",
      }}
      onFocus={(e) => { e.target.style.borderColor = "rgba(30,111,239,0.4)" }}
      onBlur={(e) => { e.target.style.borderColor = "transparent" }}
      onMouseDown={(e) => e.stopPropagation()}
    />
  )
}

// ---- Main component ----

export function GridConfigTab() {
  const [cfg, setCfg] = useState<GridConfig>(DEFAULT_GRID_CONFIG)

  // Collapsible sections
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

  const derived = calcDerivedStats(cfg)

  return (
    <div
      className="flex flex-col h-full overflow-auto"
      style={{ padding: "8px 10px", gap: 0 }}
      onMouseDown={(e) => e.stopPropagation()}
    >

      {/* ---- 1. General params ---- */}
      <div style={sectionStyle}>
        <SectionHeader title="General" expanded={sections.general} onToggle={() => toggleSection("general")} />
        {sections.general && (
          <div className="flex flex-col" style={{ gap: 6 }}>
            <Toggle checked={cfg.enabled} onChange={(v) => update("enabled", v)} label="Grid Enabled" />

            <div className="grid grid-cols-2" style={{ gap: 6 }}>
              <Field label="Symbol">
                <input
                  value={cfg.symbol}
                  onChange={(e) => update("symbol", e.target.value)}
                  style={inputStyle}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </Field>
              <Field label="Side">
                <SegmentedControl
                  options={[{ value: "long", label: "Long" }, { value: "short", label: "Short" }]}
                  value={cfg.side}
                  onChange={(v) => update("side", v)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2" style={{ gap: 6 }}>
              <Field label="Orders Count">
                <NumInput value={cfg.ordersCount} onChange={(v) => update("ordersCount", Math.max(1, Math.round(v)))} />
              </Field>
              <Field label="Leverage ×">
                <NumInput value={cfg.leverage} onChange={(v) => update("leverage", Math.max(1, v))} />
              </Field>
            </div>

            <div className="grid grid-cols-3" style={{ gap: 6 }}>
              <Field label="Entry Price">
                <NumInput value={cfg.entryPrice} onChange={(v) => update("entryPrice", v)} />
              </Field>
              <Field label="Top Price">
                <NumInput value={cfg.topPrice} onChange={(v) => update("topPrice", v)} />
              </Field>
              <Field label="Bottom Price">
                <NumInput value={cfg.bottomPrice} onChange={(v) => update("bottomPrice", v)} />
              </Field>
            </div>

            <div className="grid grid-cols-2" style={{ gap: 6 }}>
              <Field label="Total Quote (USDT)">
                <NumInput value={cfg.totalQuote} onChange={(v) => update("totalQuote", v)} />
              </Field>
              <Field label="Qty Mode">
                <SegmentedControl
                  options={[{ value: "fixed", label: "Fixed" }, { value: "multiplier", label: "Multi" }, { value: "custom", label: "Custom" }]}
                  value={cfg.qtyMode}
                  onChange={(v) => update("qtyMode", v)}
                />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* ---- 2. Level logic ---- */}
      <div style={sectionStyle}>
        <SectionHeader title="Level Logic" expanded={sections.levels} onToggle={() => toggleSection("levels")} />
        {sections.levels && (
          <div className="flex flex-col" style={{ gap: 6 }}>
            <Field label="Grid Mode">
              <SegmentedControl
                options={[
                  { value: "arithmetic", label: "Arith" },
                  { value: "geometric", label: "Geo" },
                  { value: "custom", label: "Custom" },
                ]}
                value={cfg.gridMode}
                onChange={(v) => update("gridMode", v)}
              />
            </Field>

            <div className="grid grid-cols-2" style={{ gap: 6 }}>
              <Field label="Step %">
                <NumInput value={cfg.stepPercent} onChange={(v) => update("stepPercent", v)} placeholder="1.0" />
              </Field>
              {cfg.qtyMode === "multiplier" && (
                <Field label="Multiplier">
                  <NumInput value={cfg.multiplier} onChange={(v) => update("multiplier", v)} placeholder="1.1" />
                </Field>
              )}
            </div>

            <ReadonlyField label="Base Order Size (preview)" value={derived.baseOrderSize} />

            <button
              onClick={handleGenerate}
              className="flex items-center justify-center gap-1.5 w-full transition-colors"
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                fontWeight: 600,
                padding: "6px 0",
                borderRadius: 4,
                background: "rgba(30,111,239,0.12)",
                color: "#1e6fef",
                border: "1px solid rgba(30,111,239,0.3)",
                cursor: "pointer",
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <RefreshCw size={11} />
              Generate Levels
            </button>
          </div>
        )}
      </div>

      {/* ---- 3. TP/SL ---- */}
      <div style={sectionStyle}>
        <SectionHeader title="TP / SL" expanded={sections.tpsl} onToggle={() => toggleSection("tpsl")} />
        {sections.tpsl && (
          <div className="flex flex-col" style={{ gap: 6 }}>
            <div className="grid grid-cols-2" style={{ gap: 6 }}>
              <Field label="TP %">
                <NumInput value={cfg.tpPercent} onChange={(v) => update("tpPercent", v)} placeholder="3.0" />
              </Field>
              <Field label="SL %">
                <NumInput value={cfg.slPercent} onChange={(v) => update("slPercent", v)} placeholder="5.0" />
              </Field>
            </div>

            <Field label="TP Update Mode">
              <SegmentedControl
                options={[{ value: "fixed", label: "Fixed" }, { value: "reprice", label: "Reprice" }]}
                value={cfg.tpUpdateMode}
                onChange={(v) => update("tpUpdateMode", v)}
              />
            </Field>

            <Toggle checked={cfg.trailingEnabled} onChange={(v) => update("trailingEnabled", v)} label="Trailing Stop" />

            {cfg.trailingEnabled && (
              <Field label="Trailing Step %">
                <NumInput value={cfg.trailingStepPercent} onChange={(v) => update("trailingStepPercent", v)} placeholder="0.5" />
              </Field>
            )}
          </div>
        )}
      </div>

      {/* ---- 4. Reset TP ---- */}
      <div style={sectionStyle}>
        <SectionHeader title="Reset TP" expanded={sections.resetTp} onToggle={() => toggleSection("resetTp")} />
        {sections.resetTp && (
          <div className="flex flex-col" style={{ gap: 6 }}>
            <Toggle checked={cfg.resetTpEnabled} onChange={(v) => update("resetTpEnabled", v)} label="Reset TP Enabled (global)" />

            <div className="grid grid-cols-2" style={{ gap: 6 }}>
              <Field label="Default Reset TP %">
                <NumInput value={cfg.defaultResetTpPercent} onChange={(v) => update("defaultResetTpPercent", v)} placeholder="1.5" />
              </Field>
              <Field label="Default Close %">
                <NumInput value={cfg.defaultResetTpClosePercent} onChange={(v) => update("defaultResetTpClosePercent", v)} placeholder="50" />
              </Field>
            </div>

            <p style={{ fontSize: 10, fontFamily: "monospace", opacity: 0.35, lineHeight: 1.4 }}>
              Per-level reset TP overrides are editable in the table below.
            </p>
          </div>
        )}
      </div>

      {/* ---- 5. Levels Table ---- */}
      <div style={sectionStyle}>
        <SectionHeader title={`Levels Table (${cfg.levels.length})`} expanded={sections.table} onToggle={() => toggleSection("table")} />
        {sections.table && (
          cfg.levels.length === 0 ? (
            <div style={{ fontSize: 10, fontFamily: "monospace", opacity: 0.3, textAlign: "center", padding: "12px 0" }}>
              No levels yet — click Generate Levels
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, fontFamily: "monospace" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["#", "Price", "Qty", "RTP", "RTP%", "Close%"].map((h) => (
                      <th key={h} style={{ padding: "3px 4px", opacity: 0.4, textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cfg.levels.map((level) => (
                    <tr
                      key={level.index}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                    >
                      <td style={{ padding: "2px 4px", opacity: 0.4, textAlign: "right" }}>{level.index}</td>
                      <td style={{ padding: "2px 4px", textAlign: "right" }}>
                        <EditableCell value={level.price} onChange={(v) => updateLevel(level.index, { price: v })} />
                      </td>
                      <td style={{ padding: "2px 4px", textAlign: "right" }}>
                        <EditableCell value={level.qty} onChange={(v) => updateLevel(level.index, { qty: v })} />
                      </td>
                      <td style={{ padding: "2px 4px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={level.useResetTp}
                          onChange={(e) => updateLevel(level.index, { useResetTp: e.target.checked })}
                          style={{ accentColor: "#1e6fef", cursor: "pointer" }}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td style={{ padding: "2px 4px", textAlign: "right", opacity: level.useResetTp ? 1 : 0.3 }}>
                        {level.useResetTp ? (
                          <EditableCell value={level.resetTpPercent} onChange={(v) => updateLevel(level.index, { resetTpPercent: v })} />
                        ) : (
                          <span>{level.resetTpPercent}</span>
                        )}
                      </td>
                      <td style={{ padding: "2px 4px", textAlign: "right", opacity: level.useResetTp ? 1 : 0.3 }}>
                        {level.useResetTp ? (
                          <EditableCell value={level.resetTpClosePercent} onChange={(v) => updateLevel(level.index, { resetTpClosePercent: v })} />
                        ) : (
                          <span>{level.resetTpClosePercent}</span>
                        )}
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
          <div className="flex flex-col" style={{ gap: 6 }}>
            {/* Stats row */}
            <div className="grid grid-cols-2" style={{ gap: 4 }}>
              {[
                { label: "Total Levels", value: derived.totalLevels },
                { label: "Total Qty", value: derived.totalQty.toFixed(4) },
                { label: "Grid Amount", value: `$${derived.totalGridAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}` },
                { label: "Reset TP Levels", value: derived.resetEnabledCount },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex flex-col"
                  style={{ padding: "4px 6px", borderRadius: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <span style={{ fontSize: 9, fontFamily: "monospace", opacity: 0.4 }}>{label}</span>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(200,214,229,0.9)", fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>

            {/* JSON preview */}
            <div style={{ position: "relative" }}>
              <label style={labelStyle}>Config JSON</label>
              <pre
                style={{
                  fontSize: 9,
                  fontFamily: "monospace",
                  color: "rgba(100,160,255,0.7)",
                  background: "rgba(30,111,239,0.04)",
                  border: "1px solid rgba(30,111,239,0.12)",
                  borderRadius: 4,
                  padding: "6px 8px",
                  overflowX: "auto",
                  maxHeight: 140,
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {JSON.stringify({ ...cfg, levels: cfg.levels.slice(0, 3).concat(cfg.levels.length > 3 ? [{ "...": `${cfg.levels.length - 3} more` }] as unknown as GridLevel[] : []) }, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* ---- Export button ---- */}
      <button
        onClick={handleExport}
        className="flex items-center justify-center gap-1.5 w-full transition-colors mt-2"
        style={{
          fontSize: 11,
          fontFamily: "monospace",
          fontWeight: 600,
          padding: "7px 0",
          borderRadius: 4,
          background: "rgba(0,229,160,0.08)",
          color: "#00e5a0",
          border: "1px solid rgba(0,229,160,0.25)",
          cursor: "pointer",
          flexShrink: 0,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Download size={12} />
        Export Grid Config
      </button>
    </div>
  )
}
