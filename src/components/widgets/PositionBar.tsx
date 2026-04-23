import { useState, useRef, useEffect } from "react"
import { ChevronDown, X } from "lucide-react"
import { usePositionSettings, type MarginMode } from "@/hooks/usePositionSettings"

interface PositionBarProps {
  symbol: string
  marketType: "spot" | "futures"
  // Mock balance — will be replaced with real data later
  availableBalance?: number
  compact?: boolean // compact mode for under-chart form
}

const LEVERAGE_PRESETS = [1, 2, 3, 5, 10, 20, 25, 50, 75, 100, 125]

// Popover that lets user pick leverage via slider + presets
function LeveragePopover({
  symbol,
  leverage,
  onClose,
}: {
  symbol: string
  leverage: number
  onClose: () => void
}) {
  const { setLeverage } = usePositionSettings(symbol)
  const [local, setLocal] = useState(leverage)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [onClose])

  const apply = () => {
    setLeverage(local)
    onClose()
  }

  return (
    <div
      ref={ref}
      className="absolute z-50 flex flex-col gap-3 p-3 rounded-lg"
      style={{
        top: "calc(100% + 4px)",
        left: 0,
        minWidth: 220,
        background: "var(--terminal-surface, #0d1526)",
        border: "1px solid rgba(30,111,239,0.3)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-semibold" style={{ color: "rgba(200,214,229,0.9)", letterSpacing: "0.06em" }}>
          LEVERAGE
        </span>
        <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)" }} className="hover:opacity-100 transition-opacity">
          <X size={12} />
        </button>
      </div>

      {/* Current value display */}
      <div className="flex items-center justify-center">
        <span className="text-2xl font-mono font-bold" style={{ color: "#1e6fef" }}>
          {local}×
        </span>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={1}
        max={125}
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: "#1e6fef" }}
      />
      <div className="flex justify-between text-xs font-mono" style={{ color: "rgba(255,255,255,0.25)", fontSize: 9 }}>
        <span>1×</span>
        <span>25×</span>
        <span>50×</span>
        <span>100×</span>
        <span>125×</span>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1">
        {LEVERAGE_PRESETS.map((v) => (
          <button
            key={v}
            onClick={() => setLocal(v)}
            className="px-2 py-0.5 rounded text-xs font-mono transition-all"
            style={{
              background: local === v ? "rgba(30,111,239,0.2)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${local === v ? "rgba(30,111,239,0.5)" : "rgba(255,255,255,0.08)"}`,
              color: local === v ? "#1e6fef" : "rgba(255,255,255,0.45)",
              fontSize: 10,
            }}
          >
            {v}×
          </button>
        ))}
      </div>

      {/* Confirm */}
      <button
        onClick={apply}
        className="w-full py-1.5 rounded text-xs font-mono font-semibold transition-all"
        style={{
          background: "rgba(30,111,239,0.2)",
          border: "1px solid rgba(30,111,239,0.4)",
          color: "#4d9fff",
        }}
      >
        Confirm {local}×
      </button>
    </div>
  )
}

// Popover for margin mode (Cross / Isolated)
function MarginModePopover({
  symbol,
  mode,
  onClose,
}: {
  symbol: string
  mode: MarginMode
  onClose: () => void
}) {
  const { setMarginMode } = usePositionSettings(symbol)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [onClose])

  const options: { value: MarginMode; label: string; desc: string }[] = [
    { value: "cross", label: "Cross", desc: "Entire account balance used as margin. Risk of liquidation is lower, but losses can exceed margin." },
    { value: "isolated", label: "Isolated", desc: "Fixed margin per position. Losses are limited to assigned margin amount." },
  ]

  return (
    <div
      ref={ref}
      className="absolute z-50 flex flex-col gap-2 p-3 rounded-lg"
      style={{
        top: "calc(100% + 4px)",
        left: 0,
        minWidth: 240,
        background: "var(--terminal-surface, #0d1526)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono font-semibold" style={{ color: "rgba(200,214,229,0.9)", letterSpacing: "0.06em" }}>
          MARGIN MODE
        </span>
        <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)" }} className="hover:opacity-100 transition-opacity">
          <X size={12} />
        </button>
      </div>

      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => { setMarginMode(opt.value); onClose() }}
          className="flex flex-col gap-1 p-2 rounded text-left transition-all"
          style={{
            background: mode === opt.value ? "rgba(30,111,239,0.12)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${mode === opt.value ? "rgba(30,111,239,0.4)" : "rgba(255,255,255,0.07)"}`,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="rounded-full flex-shrink-0"
              style={{
                width: 8, height: 8,
                background: mode === opt.value ? "#1e6fef" : "rgba(255,255,255,0.2)",
                border: `1px solid ${mode === opt.value ? "#4d9fff" : "rgba(255,255,255,0.15)"}`,
              }}
            />
            <span
              className="text-xs font-mono font-semibold"
              style={{ color: mode === opt.value ? "#4d9fff" : "rgba(200,214,229,0.7)" }}
            >
              {opt.label}
            </span>
          </div>
          <p className="text-xs font-mono leading-relaxed" style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, paddingLeft: 16 }}>
            {opt.desc}
          </p>
        </button>
      ))}
    </div>
  )
}

export function PositionBar({ symbol, marketType, availableBalance = 10000 }: PositionBarProps) {
  const { settings } = usePositionSettings(symbol)
  const [leverageOpen, setLeverageOpen] = useState(false)
  const [marginOpen, setMarginOpen] = useState(false)

  if (marketType === "spot") {
    // Spot: just show balance, no leverage/margin controls
    return (
      <div
        className="flex items-center justify-between px-2 py-1 rounded"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>
          Available
        </span>
        <span className="text-xs font-mono font-semibold" style={{ color: "rgba(200,214,229,0.85)" }}>
          {availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
        </span>
      </div>
    )
  }

  // Futures: balance + leverage + margin mode
  return (
    <div className="flex flex-col gap-1">
      {/* Balance row */}
      <div
        className="flex items-center justify-between px-2 py-1 rounded"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>
          Available
        </span>
        <span className="text-xs font-mono font-semibold" style={{ color: "rgba(200,214,229,0.85)" }}>
          {availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
        </span>
      </div>

      {/* Leverage + Margin row */}
      <div className="flex gap-1">
        {/* Leverage button */}
        <div className="relative flex-1">
          <button
            onClick={() => { setLeverageOpen((v) => !v); setMarginOpen(false) }}
            className="w-full flex items-center justify-between gap-1 px-2 py-1 rounded transition-all"
            style={{
              background: leverageOpen ? "rgba(30,111,239,0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${leverageOpen ? "rgba(30,111,239,0.4)" : "rgba(255,255,255,0.08)"}`,
              color: leverageOpen ? "#4d9fff" : "rgba(200,214,229,0.75)",
            }}
          >
            <span className="text-xs font-mono font-semibold" style={{ fontSize: 11 }}>
              {settings.leverage}×
            </span>
            <ChevronDown size={10} style={{ opacity: 0.5, transform: leverageOpen ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
          </button>
          {leverageOpen && (
            <LeveragePopover
              symbol={symbol}
              leverage={settings.leverage}
              onClose={() => setLeverageOpen(false)}
            />
          )}
        </div>

        {/* Margin mode button */}
        <div className="relative flex-1">
          <button
            onClick={() => { setMarginOpen((v) => !v); setLeverageOpen(false) }}
            className="w-full flex items-center justify-between gap-1 px-2 py-1 rounded transition-all"
            style={{
              background: marginOpen ? "rgba(30,111,239,0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${marginOpen ? "rgba(30,111,239,0.4)" : "rgba(255,255,255,0.08)"}`,
              color: marginOpen ? "#4d9fff" : "rgba(200,214,229,0.75)",
            }}
          >
            <span className="text-xs font-mono font-semibold capitalize" style={{ fontSize: 11 }}>
              {settings.marginMode}
            </span>
            <ChevronDown size={10} style={{ opacity: 0.5, transform: marginOpen ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
          </button>
          {marginOpen && (
            <MarginModePopover
              symbol={symbol}
              mode={settings.marginMode}
              onClose={() => setMarginOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Compact version for use inside the chart order form (inline, single row)
export function PositionBarCompact({ symbol, marketType, availableBalance = 10000 }: PositionBarProps) {
  const { settings } = usePositionSettings(symbol)
  const [leverageOpen, setLeverageOpen] = useState(false)
  const [marginOpen, setMarginOpen] = useState(false)

  if (marketType === "spot") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
          Bal:
        </span>
        <span className="text-xs font-mono font-semibold" style={{ color: "rgba(200,214,229,0.8)", fontSize: 10 }}>
          {availableBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })} USDT
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {/* Balance */}
      <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, flexShrink: 0 }}>
        {availableBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })} USDT
      </span>

      <span style={{ color: "rgba(255,255,255,0.12)", fontSize: 10 }}>|</span>

      {/* Leverage compact button */}
      <div className="relative">
        <button
          onClick={() => { setLeverageOpen((v) => !v); setMarginOpen(false) }}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-all"
          style={{
            background: leverageOpen ? "rgba(30,111,239,0.15)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${leverageOpen ? "rgba(30,111,239,0.4)" : "rgba(255,255,255,0.09)"}`,
            color: leverageOpen ? "#4d9fff" : "rgba(200,214,229,0.7)",
          }}
        >
          <span className="text-xs font-mono font-bold" style={{ fontSize: 10 }}>{settings.leverage}×</span>
          <ChevronDown size={8} style={{ opacity: 0.5 }} />
        </button>
        {leverageOpen && (
          <LeveragePopover
            symbol={symbol}
            leverage={settings.leverage}
            onClose={() => setLeverageOpen(false)}
          />
        )}
      </div>

      {/* Margin mode compact button */}
      <div className="relative">
        <button
          onClick={() => { setMarginOpen((v) => !v); setLeverageOpen(false) }}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded transition-all"
          style={{
            background: marginOpen ? "rgba(30,111,239,0.15)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${marginOpen ? "rgba(30,111,239,0.4)" : "rgba(255,255,255,0.09)"}`,
            color: marginOpen ? "#4d9fff" : "rgba(200,214,229,0.7)",
          }}
        >
          <span className="text-xs font-mono font-semibold capitalize" style={{ fontSize: 10 }}>{settings.marginMode}</span>
          <ChevronDown size={8} style={{ opacity: 0.5 }} />
        </button>
        {marginOpen && (
          <MarginModePopover
            symbol={symbol}
            mode={settings.marginMode}
            onClose={() => setMarginOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
