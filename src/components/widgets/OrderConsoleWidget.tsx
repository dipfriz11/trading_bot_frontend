import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { createPortal } from "react-dom"
import type { Widget, GridSharedTpSl, GridMultiTpLevel } from "@/types/terminal"
import { DEFAULT_GRID_SHARED_TP_SL } from "@/types/terminal"
import { SYMBOLS } from "@/lib/mock-data"
import { nanoid } from "@/lib/nanoid"
import { calcGridVisualization } from "@/lib/grid-math"
import { useTerminal, useGridOrderEntry, ordersKey } from "@/contexts/TerminalContext"
import { PositionBar } from "./PositionBar"
import { usePositionSettings } from "@/hooks/usePositionSettings"
import { GridConfigTab } from "./GridConfigTab"
import { TemplateBar } from "@/components/terminal/TemplateBar"
import { useTemplates } from "@/hooks/useTemplates"

// ─── Shared style constants (mirrors GridConfigTab) ──────────────────────────

const _inputBase: React.CSSProperties = {
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

// ─── UI helpers shared with Grid blocks ──────────────────────────────────────

function _TinyTooltipIcon({ text, color }: { text: string; color?: string }) {
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
        }}>{text}</div>,
        document.body
      )}
    </span>
  )
}

function _NI({
  value, onChange, placeholder, title, min, suffix, label, labelColor, tooltip, step,
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
    const s = step ?? 1
    const handler = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation()
      const delta = e.deltaY < 0 ? s : -s
      const current = parseFloat(String(value)) || 0
      const next = current + delta
      const result = min !== undefined ? Math.max(min, next) : next
      onChange(result); setLocalVal(String(result))
    }
    el.addEventListener("wheel", handler, { passive: false })
    return () => el.removeEventListener("wheel", handler)
  }, [onChange, min, value, step])

  const tag = suffix ?? label
  const tagW = tag ? tag.length * 5.5 + 8 : 0
  const tooltipExtraW = tooltip ? 12 : 0

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={ref}
        type="text" inputMode="decimal" value={localVal}
        onChange={(e) => setLocalVal(e.target.value.replace(/[^0-9.-]/g, ""))}
        onFocus={() => { isFocused.current = true }}
        onBlur={() => {
          isFocused.current = false
          const parsed = parseFloat(localVal)
          if (!isNaN(parsed)) {
            const result = min !== undefined ? Math.max(min, parsed) : parsed
            onChange(result); setLocalVal(String(result))
          } else { setLocalVal(String(value)) }
        }}
        placeholder={placeholder ?? "0"} title={tooltip ? undefined : (title ?? placeholder)}
        style={{ ..._inputBase, paddingRight: tag ? tagW + tooltipExtraW + 2 : undefined }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      {tag && (
        <span style={{ position: "absolute", right: tooltip ? 16 : 5, top: "50%", transform: "translateY(-50%)", fontSize: 7.5, opacity: labelColor ? 1 : 0.32, fontFamily: "monospace", pointerEvents: "none", whiteSpace: "nowrap", letterSpacing: "0.03em", color: labelColor }}>
          {tag}
        </span>
      )}
      {tooltip && (
        <span style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
          <_TinyTooltipIcon text={tooltip} color={labelColor} />
        </span>
      )}
    </div>
  )
}

function _NITooltip({
  value, onChange, label, min, title, tooltip,
}: {
  value: number; onChange: (v: number) => void
  label?: string; min?: number; title?: string; tooltip: string
}) {
  const [show, setShow] = useState(false)
  const [localVal, setLocalVal] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setLocalVal(String(value))
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
          if (isNaN(parsed) || localVal === "") setLocalVal(String(value))
        }}
        placeholder="0" title={title ?? label}
        style={{ ..._inputBase, paddingRight: 60 }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <div style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 3, pointerEvents: "none" }}>
        <button
          onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
          onClick={() => setShow((s) => !s)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", pointerEvents: "auto" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
            <circle cx="5" cy="5" r="4.5" stroke="rgba(200,214,229,0.6)" />
            <text x="5" y="7.5" textAnchor="middle" fontSize="6.5" fill="rgba(200,214,229,0.8)" fontFamily="monospace">?</text>
          </svg>
        </button>
        <span style={{ fontSize: 7.5, opacity: 0.32, fontFamily: "monospace", whiteSpace: "nowrap", letterSpacing: "0.03em" }}>{label}</span>
      </div>
      {show && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 999,
          background: "rgba(13,20,35,0.98)", border: "1px solid rgba(30,111,239,0.25)",
          borderRadius: 5, padding: "7px 9px",
          fontSize: 9, fontFamily: "monospace", color: "rgba(200,214,229,0.75)", lineHeight: 1.6,
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)", pointerEvents: "none",
        }}>{tooltip}</div>
      )}
    </div>
  )
}

function _LabelTooltip({ label, tooltip, color, align = "left" }: { label: string; tooltip: string; color?: string; align?: "left" | "right" }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 3 }}>
      <span style={{ fontSize: 9, fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase", color: color ?? "rgba(200,214,229,0.55)", fontWeight: 600 }}>
        {label}
      </span>
      <button
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
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
          position: "absolute", top: "calc(100% + 4px)",
          ...(align === "right" ? { right: 0 } : { left: 0 }),
          zIndex: 999, minWidth: 160, maxWidth: 220,
          background: "rgba(13,20,35,0.98)", border: "1px solid rgba(30,111,239,0.25)",
          borderRadius: 5, padding: "7px 9px",
          fontSize: 9, fontFamily: "monospace", color: "rgba(200,214,229,0.75)", lineHeight: 1.6,
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)", pointerEvents: "none", whiteSpace: "normal",
        }}>{tooltip}</div>
      )}
    </div>
  )
}

function _MiniToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
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

function _SectionHead({
  title, expanded, onToggle, rightSlot,
}: {
  title: string; expanded: boolean; onToggle: () => void; rightSlot?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between w-full" style={{ padding: "5px 0" }}>
      <button
        className="flex items-center gap-1.5"
        style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, flex: 1, textAlign: "left" }}
        onClick={onToggle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
          {title}
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

function _Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 6 }} />
}

function _distributeClose(count: number): number[] {
  const base = Math.floor(100 / count)
  const remainder = 100 - base * count
  return Array.from({ length: count }, (_, i) => i === count - 1 ? base + remainder : base)
}

function _rebalanceClose(levels: GridMultiTpLevel[], changedIndex: number, newValue: number): GridMultiTpLevel[] {
  if (levels.length <= 1) return [{ ...levels[0], closePercent: 100 }]
  const clamped = Math.min(100, Math.max(1, newValue))
  const lastIdx = levels.length - 1
  const updated = levels.map((l, i) => i === changedIndex ? { ...l, closePercent: clamped } : l)
  if (changedIndex !== lastIdx) {
    const sumOthers = updated.slice(0, lastIdx).reduce((s, l) => s + l.closePercent, 0)
    updated[lastIdx] = { ...updated[lastIdx], closePercent: Math.max(1, 100 - sumOthers) }
  }
  return updated
}

// ─────────────────────────────────────────────────────────────────────────────

function priceToString(price: number): string {
  if (price >= 1000) return price.toFixed(2)
  if (price >= 10) return price.toFixed(2)
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(6)
}

type OrderSide = "buy" | "sell"
type OrderType = "market" | "limit" | "stop"
type AnchorField = "qty" | "amount"


const MOCK_PRICES: Record<string, number> = {
  "BTC/USDT": 67500, "ETH/USDT": 3450, "BNB/USDT": 590, "SOL/USDT": 185,
  "XRP/USDT": 0.62, "DOGE/USDT": 0.16, "ADA/USDT": 0.48, "AVAX/USDT": 38,
}

export function OrderConsoleWidget(_props: { widget: Widget }) {
  const {
    activeTab, activeChartId, setActiveChartId,
    setDraftOrder, addPlacedOrder, placedOrders, draftOrders,
    isDraggingOrder,
    editingOrderId, setEditingOrderId,
    updatePlacedOrder,
    updateWidget,
    getBalance,
    deductOrderBalance,
    refundOrderBalance,
    tpSlOrders, setTpSl,
    setGridPreview, cancelGridPreview,
    openPosition,
  } = useTerminal()

  const [tab, setTab] = useState<"new" | "grid">("new")
  const _devTabRef = useRef(tab)
  if (import.meta.env.DEV && _devTabRef.current !== tab) {
    console.log(`[OrderConsoleWidget] tab changed: ${_devTabRef.current} → ${tab}`, new Error().stack?.split("\n").slice(1, 4).join(" | "))
    _devTabRef.current = tab
  }
  const [side, setSide] = useState<OrderSide>("buy")
  const [orderType, setOrderType] = useState<OrderType>("limit")
  const [price, setPrice] = useState("")
  const [stopPrice, setStopPrice] = useState("")
  const [tp, setTp] = useState("")
  const [sl, setSl] = useState("")
  const [qty, setQty] = useState("")
  const [amount, setAmount] = useState("")
  const [anchor, setAnchor] = useState<AnchorField>("qty")
  const [lastResult, setLastResult] = useState<{ success: boolean; msg: string } | null>(null)
  // True when user has manually edited the form while a placed order is selected (editingOrderId set)
  const [formEditMode, setFormEditMode] = useState(false)
  // Suppresses draft re-creation immediately after submit
  const suppressDraftRef = useRef(false)
  const stopProp = (e: React.MouseEvent) => e.stopPropagation()

  // ── New Order advanced state ────────────────────────────────────────────────
  const [noProMode, setNoProMode] = useState(false)
  const [noMultiPositionMode, setNoMultiPositionMode] = useState(false)
  const [noTpSl, setNoTpSl] = useState<GridSharedTpSl>({ ...DEFAULT_GRID_SHARED_TP_SL })
  const [noTrailEnabled, setNoTrailEnabled] = useState(false)
  const [noTrailTriggerPercent, setNoTrailTriggerPercent] = useState(1.0)
  const [noTrailLimitPriceEnabled, setNoTrailLimitPriceEnabled] = useState(false)
  const [noTrailLimitPrice, setNoTrailLimitPrice] = useState(0)
  const [noAutoEnabled, setNoAutoEnabled] = useState(false)
  const [noStopOnSl, setNoStopOnSl] = useState(false)
  const [noStopNew, setNoStopNew] = useState(false)
  const [noOpen, setNoOpen] = useState({ trail: true, tp: true, sl: true })
  const noTog = (k: keyof typeof noOpen) => setNoOpen((p) => ({ ...p, [k]: !p[k] }))

  const noUpd = useCallback(<K extends keyof GridSharedTpSl>(key: K, val: GridSharedTpSl[K]) => {
    setNoTpSl((p) => ({ ...p, [key]: val }))
  }, [])

  // Stable consoleId for New Order TP/SL grid preview (1-order "grid")
  const noConsoleId = `${_props.widget.id}:no`
  // Stable order ID ref so the grid line doesn't flicker on re-render
  const noOrderIdRef = useRef<string>(nanoid())

  // Templates for New Order (shared namespace "grid" with Grid tab)
  const { templates: noTemplates, saveTemplate: noSaveTemplate, deleteTemplate: noDeleteTemplate } = useTemplates<GridSharedTpSl>("grid")
  const [noActiveTemplateId, setNoActiveTemplateId] = useState<string | null>(null)
  const [noSavedCfgJson, setNoSavedCfgJson] = useState<string | null>(null)
  const noIsDirty = noActiveTemplateId !== null && noSavedCfgJson !== JSON.stringify(noTpSl)

  const handleNoSelectTemplate = (t: { id: string; config: GridSharedTpSl }) => {
    setNoTpSl(t.config)
    setNoActiveTemplateId(t.id)
    setNoSavedCfgJson(JSON.stringify(t.config))
  }

  const handleNoSaveTemplate = (name: string) => {
    noSaveTemplate(name, noTpSl)
    setTimeout(() => {
      const all = JSON.parse(localStorage.getItem("crypterm:templates:grid") ?? "[]") as Array<{ id: string; name: string }>
      const found = all.find((t) => t.name === name)
      if (found) { setNoActiveTemplateId(found.id); setNoSavedCfgJson(JSON.stringify(noTpSl)) }
    }, 0)
  }

  // Prevents cancelGridPreview immediately after order submit (keep TP/SL visible)
  const noJustPlacedRef = useRef(false)

  // ── End New Order advanced state ────────────────────────────────────────────

  // ---- Resolve active chart info ----
  const chartWidgets = activeTab?.widgets.filter((w) => w.type === "chart") ?? []
  const activeChart = chartWidgets.find((w) => w.id === activeChartId) ?? chartWidgets[0]

  // Symbol comes from active chart; falls back to selector if no chart
  const chartSymbol = activeChart?.symbol ?? null
  const [manualSymbol, setManualSymbol] = useState(SYMBOLS[0])
  const symbol = chartSymbol ?? manualSymbol

  // Market type, futures side and account from active chart
  const marketType = activeChart?.marketType ?? "spot"
  const futuresSide = activeChart?.futuresSide ?? "long"
  const accountId = activeChart?.accountId ?? "main"
  const exchangeId = activeChart?.exchangeId ?? "binance"
  // Stable key — matches the key used in placedOrders map
  const activePositionKey = ordersKey(accountId, exchangeId, marketType, symbol)
  const { walletBalance, inOrders } = getBalance(accountId, exchangeId, marketType)
  const freeMargin = walletBalance - inOrders
  const { settings: posSettings } = usePositionSettings(symbol)
  // Effective side: futures drives buy/sell from long/short
  const effectiveSide: OrderSide = marketType === "futures"
    ? (futuresSide === "long" ? "buy" : "sell")
    : side

  const ticker = symbol.split("/")[0]

  const mockPrice = MOCK_PRICES[symbol] ?? 100
  const effectivePrice = orderType === "market" ? mockPrice : (parseFloat(price) || 0)

  const qtyRef = useRef(qty)
  qtyRef.current = qty
  const priceRef = useRef(price)
  priceRef.current = price
  const sideRef = useRef(side)
  sideRef.current = side
  const orderTypeRef = useRef(orderType)
  orderTypeRef.current = orderType
  const mockPriceRef = useRef(mockPrice)
  mockPriceRef.current = mockPrice

  // True while we are programmatically updating price (init or drag sync).
  // Prevents push-draft from immediately echoing the change back as a new draft.
  const settingPriceFromExternalRef = useRef(false)
  // Prevents TP/SL form→context push when we're syncing context→form
  const settingTpSlFromContextRef = useRef(false)
  const lastTpPushedRef = useRef<number | null>(null)
  const lastSlPushedRef = useRef<number | null>(null)

  // Init price on symbol/activeChart change — runs once per chart focus
  const initialisedKeyRef = useRef<string>("")
  useEffect(() => {
    const key = `${activeChart?.id ?? ""}:${symbol}`
    if (initialisedKeyRef.current === key) return
    initialisedKeyRef.current = key
    settingPriceFromExternalRef.current = true
    setPrice(priceToString(mockPrice))
    const q = parseFloat(qtyRef.current)
    if (!isNaN(q)) setAmount((q * mockPrice).toFixed(2))
    // Use rAF so the push-draft effect sees the flag before running
    requestAnimationFrame(() => { settingPriceFromExternalRef.current = false })
  }, [symbol, activeChart?.id, mockPrice])

  // ---- Push draft order to context whenever form changes ----
  useEffect(() => {
    if (!activeChart) return
    // Don't show New Order draft while Grid tab is active
    if (tab !== "new") {
      setDraftOrder(activeChart.id, undefined)
      return
    }
    if (suppressDraftRef.current) return
    if (isDraggingOrder) return
    if (settingPriceFromExternalRef.current) return
    if (editingOrderId) {
      setDraftOrder(activeChart.id, undefined)
      return
    }
    const qtyNum = parseFloat(qty)
    const p = orderType === "market" ? mockPriceRef.current : (parseFloat(price) || 0)
    if (qtyNum > 0 && p > 0) {
      lastDraftPricePushedRef.current = p
      setDraftOrder(activeChart.id, { side: effectiveSide, price: p, qty: qtyNum, orderType: orderType === "stop" ? "limit" : orderType })
    } else {
      lastDraftPricePushedRef.current = 0
      setDraftOrder(activeChart.id, undefined)
    }
  }, [tab, effectiveSide, price, qty, orderType, activeChart?.id, isDraggingOrder, editingOrderId])

  // ---- Sync form when DRAFT is dragged on the chart ----
  // Only fires when draftOrders[activeChart.id].price changes due to a real chart drag.
  // We distinguish drag-originated changes by tracking what we last pushed.
  const lastDraftPricePushedRef = useRef<number>(0)
  const prevActiveChartIdRef2 = useRef<string | null | undefined>(null)
  useEffect(() => {
    if (!activeChart) return
    // On chart switch just reset tracking, don't sync form
    if (prevActiveChartIdRef2.current !== activeChart.id) {
      prevActiveChartIdRef2.current = activeChart.id
      lastDraftPricePushedRef.current = 0
      return
    }
    const draft = draftOrders[activeChart.id]
    if (!draft) { lastDraftPricePushedRef.current = 0; return }
    const contextPrice = draft.price
    // If the price matches what we last pushed, it's our own update — ignore
    const threshold = Math.max(contextPrice * 0.00001, 1e-8)
    if (Math.abs(contextPrice - lastDraftPricePushedRef.current) < threshold) return
    // External update (drag on chart) — sync form
    lastDraftPricePushedRef.current = contextPrice
    settingPriceFromExternalRef.current = true
    setPrice(priceToString(contextPrice))
    const q = parseFloat(qtyRef.current)
    if (!isNaN(q) && q > 0 && contextPrice > 0) setAmount((q * contextPrice).toFixed(2))
    requestAnimationFrame(() => { settingPriceFromExternalRef.current = false })
  }, [draftOrders, activeChart?.id])

  // ---- Sync form when a PLACED order is dragged on the chart ----
  const trackedPlacedPricesRef = useRef<Record<string, number>>({})
  useEffect(() => {
    if (!activeChart) return
    const orders = placedOrders[activePositionKey] ?? []
    for (const o of orders) {
      const prev = trackedPlacedPricesRef.current[o.id]
      const placedThreshold = Math.max(o.price * 0.00001, 1e-8)
      if (prev !== undefined && Math.abs(o.price - prev) > placedThreshold) {
        settingPriceFromExternalRef.current = true
        setPrice(priceToString(o.price))
        const q = parseFloat(qtyRef.current)
        if (!isNaN(q) && q > 0 && o.price > 0) setAmount((q * o.price).toFixed(2))
        requestAnimationFrame(() => { settingPriceFromExternalRef.current = false })
      }
      trackedPlacedPricesRef.current[o.id] = o.price
    }
  }, [placedOrders, activePositionKey])

  // ---- Load placed order data into form when user selects it for editing ----
  useEffect(() => {
    if (!editingOrderId || !activeChart) {
      setFormEditMode(false)
      return
    }
    const order = (placedOrders[activePositionKey] ?? []).find((o) => o.id === editingOrderId)
    if (!order) { setFormEditMode(false); return }
    settingPriceFromExternalRef.current = true
    setPrice(priceToString(order.price))
    setQty(order.qty.toString())
    setAmount((order.qty * order.price).toFixed(2))
    setSide(order.side)
    setAnchor("qty")
    setDraftOrder(activeChart.id, undefined)
    requestAnimationFrame(() => { settingPriceFromExternalRef.current = false })
  }, [editingOrderId])

  // After a placed-order drag is released, reset form so no stale draft appears
  // wasDraggingPlacedRef — true only when a PLACED order was being dragged (not draft)
  const wasDraggingRef = useRef(false)
  const wasDraggingPlacedRef = useRef(false)
  useEffect(() => {
    if (isDraggingOrder) {
      wasDraggingRef.current = true
      // editingOrderId is set by ChartWidget when a placed order drag starts
      if (editingOrderId) wasDraggingPlacedRef.current = true
    } else if (wasDraggingRef.current) {
      wasDraggingRef.current = false
      if (wasDraggingPlacedRef.current) {
        wasDraggingPlacedRef.current = false
        resetFormToNew(true)
      }
      // Draft drag end — do NOT reset form; price already synced via draftOrders effect
    }
  }, [isDraggingOrder, editingOrderId])

  // Clear draft from previous chart when active chart changes
  const prevChartIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (prevChartIdRef.current && prevChartIdRef.current !== activeChart?.id) {
      setDraftOrder(prevChartIdRef.current, undefined)
    }
    prevChartIdRef.current = activeChart?.id ?? null
  }, [activeChart?.id])

  // ---- New Order: push TP/SL preview lines to chart via grid infrastructure ----
  useEffect(() => {
    if (!activeChart || tab !== "new") {
      cancelGridPreview(noConsoleId)
      return
    }

    const qtyNum = parseFloat(qty)
    const p = orderType === "market" ? mockPriceRef.current : (parseFloat(price) || 0)
    const hasTpOrSl = noTpSl.tpEnabled || noTpSl.slEnabled

    if (!(qtyNum > 0 && p > 0) || !hasTpOrSl) {
      // Don't cancel immediately after place — keep TP/SL visible
      if (noJustPlacedRef.current) {
        noJustPlacedRef.current = false
        return
      }
      cancelGridPreview(noConsoleId)
      return
    }

    const gSide = effectiveSide === "buy" ? "long" : "short"

    // Minimal 1-order GridConfig to reuse calcGridVisualization TP/SL math
    const miniCfg = {
      enabled: true, symbol, side: gSide,
      ordersCount: 1, entryPrice: p,
      topPrice: 0, bottomPrice: 0,
      totalQuote: qtyNum * p, budgetMode: "quote" as const,
      leverage: posSettings.leverage,
      gridType: "arithmetic" as const, entryType: "limit" as const,
      placementMode: "step_percent" as const,
      firstOffsetPercent: 0, stepPercent: 1, lastOffsetPercent: 0,
      direction: "down" as const, qtyMode: "quote" as const,
      multiplier: 1, multiplierEnabled: false, density: 1,
      gridMode: "standard" as const,
      tpEnabled: noTpSl.tpEnabled, tpMode: noTpSl.tpMode,
      tpPercent: noTpSl.tpPercent, tpClosePercent: noTpSl.tpClosePercent,
      multiTpEnabled: noTpSl.multiTpEnabled, multiTpCount: noTpSl.multiTpCount,
      multiTpLevels: noTpSl.multiTpLevels,
      tpRepositionEnabled: false, perLevelTpEnabled: false, perLevelTpGroups: [],
      slEnabled: noTpSl.slEnabled, slMode: noTpSl.slMode,
      slPercent: noTpSl.slPercent, slClosePercent: noTpSl.slClosePercent,
      trailEnabled: false, trailTriggerPercent: 1,
      trailLimitPriceEnabled: false, trailLimitPrice: 0,
      autoEnabled: false, stopOnSl: false, stopNew: false,
      resetTpEnabled: false, resetTpTriggerLevels: [],
      defaultResetTpPercent: 1, defaultResetTpClosePercent: 100,
      resetTpRebuildTail: false, resetTpPerLevelEnabled: false, resetTpPerLevelSettings: [],
    }

    const viz = calcGridVisualization(miniCfg as unknown as Parameters<typeof calcGridVisualization>[0])

    // When noTpSl grid preview is active, clear the simple tpSlOrders to avoid duplicate lines
    setTpSl(activeChart.id, { tp: null, sl: null })

    setGridPreview(noConsoleId, {
      chartId: activeChart.id,
      consoleId: noConsoleId,
      side: gSide,
      orders: [{ id: noOrderIdRef.current, price: p, qty: qtyNum }],
      tpPrice: viz.tpPrice,
      slPrice: viz.slPrice,
      tpLevels: viz.tpLevels,
      symbol,
      leverage: posSettings.leverage,
      accountId,
      exchangeId,
      marketType,
    })
  }, [tab, effectiveSide, price, qty, orderType, activeChart?.id, noTpSl, symbol, posSettings.leverage, accountId, exchangeId, marketType])

  // Cleanup New Order preview on unmount
  useEffect(() => {
    return () => { cancelGridPreview(noConsoleId) }
  }, [noConsoleId])

  // ---- Sync noTpSl from chart drag/x-click (New Order grid preview) ----
  const noGridState = useGridOrderEntry(noConsoleId)
  const noChartSlPrice = noGridState?.slPrice
  const noChartTpLevels = noGridState?.tpLevels

  // SL x-click: slPrice → null → deactivate slEnabled
  const prevNoSlPriceRef = useRef<number | null | undefined>(undefined)
  useEffect(() => {
    if (prevNoSlPriceRef.current !== undefined && prevNoSlPriceRef.current !== null && noChartSlPrice === null) {
      noUpd("slEnabled", false)
    }
    prevNoSlPriceRef.current = noChartSlPrice ?? null
  }, [noChartSlPrice])

  // SL drag: slPrice changed non-null→non-null → recalc slPercent
  const prevNoSlPriceValueRef = useRef<number | null | undefined>(undefined)
  const noExpectedSlPriceRef = useRef<number | null | undefined>(undefined)
  useEffect(() => {
    const prev = prevNoSlPriceValueRef.current
    prevNoSlPriceValueRef.current = noChartSlPrice ?? null
    if (prev === undefined || prev === null || noChartSlPrice === null || noChartSlPrice === undefined) return
    if (Math.abs(noChartSlPrice - prev) < 1e-8) return
    const exp = noExpectedSlPriceRef.current
    if (exp !== undefined && exp !== null && Math.abs(noChartSlPrice - exp) < 1e-8) return
    const p = orderType === "market" ? mockPriceRef.current : (parseFloat(priceRef.current) || 0)
    if (p <= 0) return
    const gSide = effectiveSide === "buy" ? "long" : "short"
    const isLong = gSide === "long"
    const newPct = isLong
      ? (1 - noChartSlPrice / p) * 100
      : (noChartSlPrice / p - 1) * 100
    noUpd("slPercent", Math.max(0.01, Math.round(newPct * 100) / 100))
  }, [noChartSlPrice])

  // TP x-click: tpLevels count decreased
  const noChartTpLevelsKey = noChartTpLevels?.join(",") ?? ""
  const prevNoTpLevelsKeyRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const prev = prevNoTpLevelsKeyRef.current
    prevNoTpLevelsKeyRef.current = noChartTpLevelsKey
    if (prev === undefined) return
    const prevLen = prev ? prev.split(",").length : 0
    const curLen = noChartTpLevels?.length ?? 0
    if (curLen >= prevLen) return
    if (curLen === 0) {
      noUpd("tpEnabled", false)
      return
    }
    // Partial removal: sync multiTpLevels
    const p = orderType === "market" ? mockPriceRef.current : (parseFloat(priceRef.current) || 0)
    if (p <= 0) return
    const gSide = effectiveSide === "buy" ? "long" : "short"
    const isLong = gSide === "long"
    const remaining = noChartTpLevels ?? []
    const n = remaining.length
    const base = Math.floor(100 / n)
    const remainder = 100 - base * n
    const newLevels = remaining.map((price, i) => {
      const pct = isLong ? (price / p - 1) * 100 : (1 - price / p) * 100
      return { tpPercent: Math.max(0.01, Math.round(pct * 100) / 100), closePercent: i === n - 1 ? base + remainder : base }
    })
    setNoTpSl((prev) => ({ ...prev, tpPercent: newLevels[0]?.tpPercent ?? prev.tpPercent, multiTpCount: n, multiTpLevels: newLevels, multiTpEnabled: n > 1 }))
  }, [noChartTpLevelsKey])

  // TP drag: tpLevels values changed (count same) → recalc tpPercent
  const prevNoTpLevelsValuesRef = useRef<number[] | undefined>(undefined)
  useEffect(() => {
    const prev = prevNoTpLevelsValuesRef.current
    const cur = noChartTpLevels
    prevNoTpLevelsValuesRef.current = cur ? [...cur] : undefined
    if (!prev || !cur || prev.length !== cur.length || cur.length === 0) return
    const changed = cur.some((v, i) => Math.abs(v - prev[i]) > 1e-8)
    if (!changed) return
    const p = orderType === "market" ? mockPriceRef.current : (parseFloat(priceRef.current) || 0)
    if (p <= 0) return
    const gSide = effectiveSide === "buy" ? "long" : "short"
    const isLong = gSide === "long"
    const newLevels = cur.map((price, i) => {
      const pct = isLong ? (price / p - 1) * 100 : (1 - price / p) * 100
      return {
        tpPercent: Math.max(0.01, Math.round(pct * 100) / 100),
        closePercent: noTpSl.multiTpLevels[i]?.closePercent ?? Math.floor(100 / cur.length),
      }
    })
    setNoTpSl((prev) => ({ ...prev, tpPercent: newLevels[0]?.tpPercent ?? prev.tpPercent, multiTpLevels: newLevels }))
  }, [noChartTpLevelsKey])

  // ---- Push TP to context when form changes ----
  useEffect(() => {
    if (!activeChart) return
    if (settingTpSlFromContextRef.current) return
    const tpNum = parseFloat(tp)
    const newTp = !isNaN(tpNum) && tpNum > 0 ? tpNum : null
    console.log(`[TpSl][TP push] chartId=${activeChart.id} symbol=${activeChart.symbol} tp="${tp}" newTp=${newTp} settingFromCtx=${settingTpSlFromContextRef.current}`)
    lastTpPushedRef.current = newTp
    setTpSl(activeChart.id, { tp: newTp })
  }, [tp, activeChart?.id])

  // ---- Push SL to context when form changes ----
  useEffect(() => {
    if (!activeChart) return
    if (settingTpSlFromContextRef.current) return
    const slNum = parseFloat(sl)
    const newSl = !isNaN(slNum) && slNum > 0 ? slNum : null
    console.log(`[TpSl][SL push] chartId=${activeChart.id} symbol=${activeChart.symbol} sl="${sl}" newSl=${newSl} settingFromCtx=${settingTpSlFromContextRef.current}`)
    lastSlPushedRef.current = newSl
    setTpSl(activeChart.id, { sl: newSl })
  }, [sl, activeChart?.id])

  // ---- Sync TP/SL form from context (chart drag) ----
  useEffect(() => {
    if (!activeChart) return
    const tpsl = tpSlOrders[activeChart.id]
    const ctxTp = tpsl?.tp ?? null
    const ctxSl = tpsl?.sl ?? null

    // Check if context TP changed externally (chart drag)
    const threshold = (v: number) => Math.max(v * 0.00001, 1e-8)
    if (ctxTp !== null && (lastTpPushedRef.current === null || Math.abs(ctxTp - (lastTpPushedRef.current ?? 0)) > threshold(ctxTp))) {
      settingTpSlFromContextRef.current = true
      setTp(priceToString(ctxTp))
      lastTpPushedRef.current = ctxTp
      requestAnimationFrame(() => { settingTpSlFromContextRef.current = false })
    } else if (ctxTp === null && lastTpPushedRef.current !== null && lastTpPushedRef.current !== 0) {
      settingTpSlFromContextRef.current = true
      setTp("")
      lastTpPushedRef.current = null
      requestAnimationFrame(() => { settingTpSlFromContextRef.current = false })
    }

    if (ctxSl !== null && (lastSlPushedRef.current === null || Math.abs(ctxSl - (lastSlPushedRef.current ?? 0)) > threshold(ctxSl))) {
      settingTpSlFromContextRef.current = true
      setSl(priceToString(ctxSl))
      lastSlPushedRef.current = ctxSl
      requestAnimationFrame(() => { settingTpSlFromContextRef.current = false })
    } else if (ctxSl === null && lastSlPushedRef.current !== null && lastSlPushedRef.current !== 0) {
      settingTpSlFromContextRef.current = true
      setSl("")
      lastSlPushedRef.current = null
      requestAnimationFrame(() => { settingTpSlFromContextRef.current = false })
    }
  }, [tpSlOrders, activeChart?.id])

  // Reset TP/SL refs on chart switch
  useEffect(() => {
    console.log(`[TpSl][chart switch] new chartId=${activeChart?.id} symbol=${activeChart?.symbol} current tp="${tp}" sl="${sl}"`)
    lastTpPushedRef.current = null
    lastSlPushedRef.current = null
  }, [activeChart?.id])

  const handlePriceChange = (v: string) => {
    setPrice(v)
    if (editingOrderId) setFormEditMode(true)
    const p = parseFloat(v)
    if (isNaN(p) || p <= 0) return
    if (anchor === "qty") {
      const q = parseFloat(qty)
      if (!isNaN(q)) setAmount((q * p).toFixed(2))
    } else {
      const a = parseFloat(amount)
      if (!isNaN(a) && p > 0) setQty((a / p).toFixed(6))
    }
  }

  const handleQtyChange = (v: string) => {
    setAnchor("qty")
    setQty(v)
    if (editingOrderId) setFormEditMode(true)
    const q = parseFloat(v)
    if (!isNaN(q) && q > 0 && effectivePrice > 0) setAmount((q * effectivePrice).toFixed(2))
    else if (v === "") setAmount("")
  }

  const handleAmountChange = (v: string) => {
    setAnchor("amount")
    setAmount(v)
    if (editingOrderId) setFormEditMode(true)
    const a = parseFloat(v)
    if (!isNaN(a) && a > 0 && effectivePrice > 0) setQty((a / effectivePrice).toFixed(6))
    else if (v === "") setQty("")
  }

  const handlePctClick = (pct: number) => {
    const availableForOrder = marketType === "futures" ? freeMargin * posSettings.leverage : freeMargin
    if (editingOrderId) setFormEditMode(true)
    if (anchor === "qty") {
      // % of max buyable qty
      const maxQty = effectivePrice > 0 ? availableForOrder / effectivePrice : 0
      const q = (pct / 100) * maxQty
      setQty(q.toFixed(6))
      if (effectivePrice > 0) setAmount((q * effectivePrice).toFixed(2))
    } else {
      // % of available amount
      const a = (pct / 100) * availableForOrder
      setAnchor("amount")
      setAmount(a.toFixed(2))
      if (effectivePrice > 0) setQty((a / effectivePrice).toFixed(6))
    }
  }

  // ---- Save changes to a placed order ----
  const handleSaveEdit = () => {
    if (!editingOrderId || !activeChart) return
    const newPrice = parseFloat(price)
    const newQty = parseFloat(qty)
    if (isNaN(newPrice) || newPrice <= 0) return

    const existingOrder = placedOrders[activePositionKey]?.find((o) => o.id === editingOrderId)
    const effectiveQty = newQty > 0 ? newQty : (existingOrder?.qty ?? 0)
    const newNotional = effectiveQty * newPrice
    const newMargin = existingOrder?.marketType === "futures" && existingOrder?.leverage
      ? newNotional / existingOrder.leverage
      : newNotional

    if (existingOrder?.accountId && existingOrder?.exchangeId && existingOrder?.marketType && existingOrder?.margin != null) {
      refundOrderBalance(existingOrder.accountId, existingOrder.exchangeId, existingOrder.marketType, existingOrder.margin)
      deductOrderBalance(existingOrder.accountId, existingOrder.exchangeId, existingOrder.marketType, newMargin)
    }

    updatePlacedOrder(activePositionKey, editingOrderId, {
      price: newPrice,
      ...(newQty > 0 ? { qty: newQty } : {}),
      margin: newMargin,
    })
    setEditingOrderId(null)
    setFormEditMode(false)
    resetFormToNew()
  }

  // ---- Cancel editing a placed order ----
  const handleCancelEdit = () => {
    setEditingOrderId(null)
    setFormEditMode(false)
    resetFormToNew()
  }

  const resetFormToNew = (_clearQty = false) => {
    suppressDraftRef.current = true
    settingPriceFromExternalRef.current = true
    setQty("")
    setAmount("")
    setPrice(priceToString(mockPrice))
    setAnchor("qty")
    setStopPrice("")
    requestAnimationFrame(() => {
      suppressDraftRef.current = false
      settingPriceFromExternalRef.current = false
    })
  }

  const handleSubmit = () => {
    if (!qty || parseFloat(qty) <= 0) return
    if (orderType !== "market" && !price) return

    const id = Math.random().toString(36).slice(2, 10)
    const now = new Date()
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((n) => n.toString().padStart(2, "0")).join(":")

    // Place on active chart via context
    if (activeChart) {
      const notional = parseFloat(qty) * effectivePrice
      const margin = marketType === "futures" ? notional / posSettings.leverage : notional

      addPlacedOrder(activePositionKey, {
        id,
        side: effectiveSide,
        price: effectivePrice,
        qty: parseFloat(qty),
        orderType: orderType === "stop" ? "limit" : orderType,
        isDraft: false,
        symbol,
        accountId,
        exchangeId,
        marketType,
        leverage: posSettings.leverage,
        margin,
        time,
        status: orderType === "market" ? "filled" : "pending",
      })

      // Open / merge into live position immediately — virtual position exists as soon as orders are placed
      const posSide = effectiveSide === "buy" ? "long" : "short"
      openPosition({
        accountId,
        exchangeId,
        marketType,
        symbol,
        side: posSide,
        size: parseFloat(qty),
        avgEntry: effectivePrice,
        leverage: posSettings.leverage,
        markPrice: effectivePrice,
        openedAt: time,
      })

      setDraftOrder(activeChart.id, undefined)
      deductOrderBalance(accountId, exchangeId, marketType, margin)
    }

    setLastResult({ success: true, msg: `${effectiveSide.toUpperCase()} ${qty} ${symbol} ${orderType === "market" ? "@ MKT" : `@ ${price}`}` })

    // Keep TP/SL lines visible after order is placed
    if (noTpSl.tpEnabled || noTpSl.slEnabled) {
      noJustPlacedRef.current = true
    }
    resetFormToNew()

    setTimeout(() => {
      setLastResult(null)
    }, 1500)
  }


  const qtyBorder = anchor === "qty"    ? `1px solid ${effectiveSide === "buy" ? "rgba(0,229,160,0.5)" : "rgba(255,71,87,0.5)"}` : "1px solid rgba(255,255,255,0.1)"
  const amtBorder = anchor === "amount" ? `1px solid ${effectiveSide === "buy" ? "rgba(0,229,160,0.5)" : "rgba(255,71,87,0.5)"}` : "1px solid rgba(255,255,255,0.1)"

  const availableForOrder = marketType === "futures" ? Math.max(0, freeMargin) * posSettings.leverage : Math.max(0, freeMargin)
  const maxQty = effectivePrice > 0 ? availableForOrder / effectivePrice : 0
  const maxAmount = availableForOrder

  const fmtQty = (n: number) => n < 0.001 ? n.toFixed(6) : n < 1 ? n.toFixed(4) : n.toFixed(2)
  const fmtAmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab toggle */}
      <div className="flex-shrink-0 flex" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {(["new", "grid"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="text-xs font-mono px-3 py-1.5 transition-colors"
            style={{
              borderBottom: tab === t ? "2px solid #1e6fef" : "2px solid transparent",
              color: tab === t ? "#1e6fef" : "rgba(255,255,255,0.4)",
              background: "transparent",
              whiteSpace: "nowrap",
            }}
            onMouseDown={stopProp}
          >
            {t === "new" ? "New Order" : "Grid"}
          </button>
        ))}
      </div>


      {tab === "new" && (
        <div className="flex-1 overflow-auto min-h-0 flex flex-col">

          {/* Template bar */}
          <TemplateBar
            templates={noTemplates}
            activeId={noActiveTemplateId}
            onSelect={handleNoSelectTemplate}
            onSave={handleNoSaveTemplate}
            onDelete={(id) => { noDeleteTemplate(id); if (id === noActiveTemplateId) setNoActiveTemplateId(null) }}
            isDirty={noIsDirty}
          />

          <div className="flex-1 px-3 py-2 flex flex-col gap-2 overflow-auto min-h-0">

          {/* Chart selector / symbol display */}
          {chartWidgets.length > 0 ? (
            <div className="flex flex-col gap-1">
              {/* Active chart pill */}
              <div className="flex gap-1 flex-wrap">
                {chartWidgets.map((cw) => (
                  <button
                    key={cw.id}
                    onClick={() => setActiveChartId(cw.id)}
                    className="text-xs font-mono px-2 py-0.5 rounded transition-all"
                    style={{
                      background: activeChartId === cw.id ? "rgba(30,111,239,0.15)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${activeChartId === cw.id ? "rgba(30,111,239,0.4)" : "rgba(255,255,255,0.08)"}`,
                      color: activeChartId === cw.id ? "#1e6fef" : "rgba(255,255,255,0.4)",
                      fontSize: 10,
                    }}
                    onMouseDown={stopProp}
                  >
                    {activeChartId === cw.id ? "● " : "○ "}{cw.symbol ?? "—"}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* No chart in workspace — manual symbol picker */
            <select
              value={manualSymbol}
              onChange={(e) => setManualSymbol(e.target.value)}
              className="text-xs font-mono bg-transparent outline-none w-full"
              style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: "4px 6px", color: "inherit" }}
              onMouseDown={stopProp}
            >
              {SYMBOLS.map((s) => (
                <option key={s} value={s} style={{ background: "#0d1526" }}>{s}</option>
              ))}
            </select>
          )}

          {/* Position context: balance + leverage + margin mode */}
          <PositionBar
            symbol={symbol}
            marketType={marketType}
            availableBalance={walletBalance}
            inOrders={inOrders}
          />

          {/* Side toggle + PRO/M-POS in one row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Side toggle: Spot = Buy/Sell, Futures = Long/Short */}
            <div className="flex rounded overflow-hidden flex-1" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              {marketType === "spot" ? (
                (["buy", "sell"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className="flex-1 text-xs font-mono py-1.5 transition-colors font-semibold uppercase tracking-wider"
                    style={{
                      background: side === s ? (s === "buy" ? "rgba(0,229,160,0.15)" : "rgba(255,71,87,0.15)") : "transparent",
                      color: side === s ? (s === "buy" ? "#00e5a0" : "#ff4757") : "rgba(255,255,255,0.3)",
                      fontSize: 10,
                    }}
                    onMouseDown={stopProp}
                  >
                    {s === "buy" ? "BUY" : "SELL"}
                  </button>
                ))
              ) : (
                (["long", "short"] as const).map((fs) => (
                  <button
                    key={fs}
                    onClick={() => activeChart && updateWidget(activeChart.id, { futuresSide: fs })}
                    className="flex-1 text-xs font-mono py-1.5 transition-colors font-bold uppercase tracking-wider"
                    style={{
                      background: futuresSide === fs
                        ? (fs === "long" ? "rgba(0,229,160,0.18)" : "rgba(255,71,87,0.18)")
                        : "transparent",
                      color: futuresSide === fs
                        ? (fs === "long" ? "#00e5a0" : "#ff4757")
                        : "rgba(255,255,255,0.3)",
                      fontSize: 10,
                    }}
                    onMouseDown={stopProp}
                  >
                    {fs === "long" ? "LONG" : "SHORT"}
                  </button>
                ))
              )}
            </div>

            {/* PRO + M-POS toggles */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              <span style={{ fontSize: 9, fontFamily: "monospace", opacity: 0.35, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pro</span>
              <_MiniToggle
                checked={noProMode}
                onChange={(v) => {
                  setNoProMode(v)
                  if (!v) setNoMultiPositionMode(false)
                }}
              />
              {noProMode && (
                <>
                  <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
                  <span style={{ fontSize: 8, fontFamily: "monospace", opacity: noMultiPositionMode ? 0.85 : 0.3, textTransform: "uppercase", letterSpacing: "0.05em", color: noMultiPositionMode ? "rgba(255,170,0,0.9)" : undefined, whiteSpace: "nowrap" }}>M-pos</span>
                  <_MiniToggle
                    checked={noMultiPositionMode}
                    onChange={(v) => setNoMultiPositionMode(v)}
                  />
                </>
              )}
            </div>
          </div>

          {/* Order type */}
          <div className="flex gap-1">
            {(["market", "limit", "stop"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className="text-xs font-mono px-2 py-0.5 rounded capitalize transition-colors flex-1"
                style={{
                  background: orderType === t ? "rgba(30,111,239,0.15)" : "transparent",
                  color: orderType === t ? "#1e6fef" : "rgba(255,255,255,0.35)",
                  border: "1px solid",
                  borderColor: orderType === t ? "rgba(30,111,239,0.3)" : "rgba(255,255,255,0.07)",
                  fontSize: 10,
                }}
                onMouseDown={stopProp}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Stop Price */}
          {orderType === "stop" && (
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-mono" style={{ opacity: 0.4, fontSize: 10 }}>Stop Price</label>
              <input
                type="number"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                placeholder="0.00"
                className="text-xs font-mono outline-none px-2 py-1"
                style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "rgba(200,214,229,0.9)", background: "rgba(255,255,255,0.04)" }}
                onMouseDown={stopProp}
              />
            </div>
          )}

          {/* Limit Price */}
          {orderType !== "market" && (
            <div className="flex flex-col gap-0.5">
              <label className="text-xs font-mono" style={{ opacity: 0.4, fontSize: 10 }}>
                {orderType === "stop" ? "Limit Price" : "Price"}
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder="0.00"
                className="text-xs font-mono outline-none px-2 py-1"
                style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "rgba(200,214,229,0.9)", background: "rgba(255,255,255,0.04)" }}
                onMouseDown={stopProp}
              />
            </div>
          )}

          {/* Qty + Amount */}
          <div className="grid grid-cols-2 gap-1">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono" style={{ opacity: anchor === "qty" ? 1 : 0.4, fontSize: 10 }}>Qty</label>
                {maxQty > 0 && (
                  <span
                    className="text-xs font-mono cursor-pointer"
                    style={{ opacity: 0.3, fontSize: 9 }}
                    onClick={() => handlePctClick(100)}
                    onMouseDown={stopProp}
                  >
                    max {fmtQty(maxQty)}
                  </span>
                )}
              </div>
              <input
                type="number"
                value={qty}
                onChange={(e) => handleQtyChange(e.target.value)}
                onFocus={() => setAnchor("qty")}
                placeholder="0.00"
                className="text-xs font-mono outline-none px-2 py-1 w-full"
                style={{ border: qtyBorder, borderRadius: 4, color: "rgba(200,214,229,0.9)", background: "rgba(255,255,255,0.04)" }}
                onMouseDown={stopProp}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono" style={{ opacity: anchor === "amount" ? 1 : 0.4, fontSize: 10 }}>Amount</label>
                {maxAmount > 0 && (
                  <span
                    className="text-xs font-mono cursor-pointer"
                    style={{ opacity: 0.3, fontSize: 9 }}
                    onClick={() => handlePctClick(100)}
                    onMouseDown={stopProp}
                  >
                    max {fmtAmt(maxAmount)}
                  </span>
                )}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                onFocus={() => setAnchor("amount")}
                placeholder="0.00"
                className="text-xs font-mono outline-none px-2 py-1 w-full"
                style={{ border: amtBorder, borderRadius: 4, color: "rgba(200,214,229,0.9)", background: "rgba(255,255,255,0.04)" }}
                onMouseDown={stopProp}
              />
            </div>
          </div>

          {/* Quick % buttons */}
          <div className="flex gap-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => handlePctClick(pct)}
                className="flex-1 text-xs font-mono py-0.5 rounded"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", fontSize: 10 }}
                onMouseDown={stopProp}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* ── Trail + Auto ─────────────────────────────────── */}
          <_Divider />
          <div style={{ marginBottom: 2 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <_LabelTooltip
                label="Trail"
                tooltip="Трейлинг — ордер автоматически перемещается за ценой, когда цена уходит за край на заданный процент."
              />
              <div style={{ marginLeft: 5 }}>
                <_MiniToggle
                  checked={noTrailEnabled}
                  onChange={(v) => {
                    setNoTrailEnabled(v)
                    if (v) setNoOpen((p) => ({ ...p, trail: true }))
                  }}
                />
              </div>
              {noTrailEnabled && (
                <button
                  onClick={() => noTog("trail")}
                  style={{ marginLeft: 4, background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", opacity: 0.45, transition: "opacity 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.45")}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d={noOpen.trail ? "M2 3.5 L5 6.5 L8 3.5" : "M2 6.5 L5 3.5 L8 6.5"} stroke="rgba(200,214,229,0.8)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              <div style={{ flex: 1 }} />
              {/* Auto */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <_LabelTooltip
                  label="Auto"
                  color={noAutoEnabled ? "rgba(52,211,153,0.8)" : undefined}
                  tooltip="Авто-цикл: после срабатывания TP новый ордер автоматически размещается по текущей рыночной цене."
                />
                <_MiniToggle
                  checked={noAutoEnabled}
                  onChange={(v) => {
                    setNoAutoEnabled(v)
                    if (!v) { setNoStopOnSl(false); setNoStopNew(false) }
                  }}
                />
                {noAutoEnabled && (
                  <>
                    <_LabelTooltip
                      label="SL"
                      color={noStopOnSl ? "rgba(248,113,113,0.45)" : "rgba(248,113,113,0.75)"}
                      tooltip={noStopOnSl
                        ? "После срабатывания SL новый цикл НЕ запускается — цикл останавливается."
                        : "После срабатывания SL новый ордер создаётся автоматически. Включите чтобы остановить цикл после SL."}
                    />
                    <_MiniToggle checked={noStopOnSl} onChange={(v) => setNoStopOnSl(v)} />
                    <_LabelTooltip
                      label="Stop New"
                      color={noStopNew ? "rgba(251,191,36,0.8)" : undefined}
                      tooltip="Остановить цикл после следующего срабатывания TP/SL."
                      align="right"
                    />
                    <_MiniToggle checked={noStopNew} onChange={(v) => setNoStopNew(v)} />
                  </>
                )}
              </div>
            </div>
            {noTrailEnabled && noOpen.trail && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <_NITooltip
                    value={noTrailTriggerPercent}
                    onChange={(v) => setNoTrailTriggerPercent(v)}
                    label="Trigger %"
                    title="Trail trigger %"
                    tooltip="Процент выхода цены, при котором запускается трейлинг."
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <_LabelTooltip
                    label="Lim"
                    tooltip="Предельная цена трейлинга. Трейлинг останавливается при достижении этого уровня."
                    color="rgba(200,214,229,0.4)"
                  />
                  <_MiniToggle checked={noTrailLimitPriceEnabled} onChange={(v) => setNoTrailLimitPriceEnabled(v)} />
                </div>
                {noTrailLimitPriceEnabled && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <_NITooltip
                      value={noTrailLimitPrice}
                      onChange={(v) => setNoTrailLimitPrice(v)}
                      label="Lim price"
                      title="Trail limit price"
                      tooltip="Предельная цена трейлинга."
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <_Divider />

          {/* ── TAKE PROFIT ──────────────────────────────────── */}
          <div style={{ marginBottom: 4 }}>
            <_SectionHead
              title="TAKE PROFIT"
              expanded={noOpen.tp}
              onToggle={() => noTog("tp")}
              rightSlot={
                <div className="flex items-center" style={{ gap: 6 }} onMouseDown={stopProp}>
                  <_LabelTooltip
                    label="Reposition"
                    tooltip="После каждого усреднения TP автоматически смещается к средней цене позиции."
                    color="rgba(200,214,229,0.35)"
                  />
                  <_MiniToggle checked={noTpSl.tpRepositionEnabled} onChange={(v) => noUpd("tpRepositionEnabled", v)} />
                  {!(noProMode && noTpSl.perLevelTpEnabled) && (
                    <>
                      <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.1)" }} />
                      <div className="flex items-center" style={{ gap: 3 }}>
                        <span style={{ fontSize: 8.5, fontFamily: "monospace", opacity: 0.4, letterSpacing: "0.04em" }}>TP</span>
                        <div className="flex items-center" style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                          <button
                            onMouseDown={stopProp}
                            onClick={() => {
                              const n = Math.max(1, noTpSl.multiTpCount - 1)
                              const lvls = noTpSl.multiTpLevels.slice(0, n)
                              const pcts = _distributeClose(n)
                              noUpd("multiTpCount", n)
                              noUpd("multiTpLevels", lvls.map((l, i) => ({ ...l, closePercent: pcts[i] })))
                              if (n === 1) noUpd("multiTpEnabled", false)
                            }}
                            style={{ padding: "0 4px", height: 16, background: "rgba(255,255,255,0.04)", border: "none", color: "rgba(200,214,229,0.55)", cursor: "pointer", fontSize: 10, lineHeight: 1 }}
                          >−</button>
                          <span style={{ padding: "0 5px", fontSize: 9.5, fontFamily: "monospace", color: "rgba(200,214,229,0.85)", background: "rgba(255,255,255,0.02)", minWidth: 16, textAlign: "center", lineHeight: "16px" }}>
                            {noTpSl.multiTpCount}
                          </span>
                          <button
                            onMouseDown={stopProp}
                            onClick={() => {
                              const n = Math.min(10, noTpSl.multiTpCount + 1)
                              const lvls = [...noTpSl.multiTpLevels]
                              while (lvls.length < n) lvls.push({ tpPercent: parseFloat(((lvls[lvls.length - 1]?.tpPercent ?? 0) + 0.5).toFixed(2)), closePercent: 0 })
                              const pcts = _distributeClose(n)
                              noUpd("multiTpCount", n)
                              noUpd("multiTpLevels", lvls.slice(0, n).map((l, i) => ({ ...l, closePercent: pcts[i] })))
                              if (n > 1) noUpd("multiTpEnabled", true)
                            }}
                            style={{ padding: "0 4px", height: 16, background: "rgba(255,255,255,0.04)", border: "none", color: "rgba(200,214,229,0.55)", cursor: "pointer", fontSize: 10, lineHeight: 1 }}
                          >+</button>
                        </div>
                      </div>
                    </>
                  )}
                  <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.1)" }} />
                  <_MiniToggle checked={noTpSl.tpEnabled} onChange={(v) => noUpd("tpEnabled", v)} />
                </div>
              }
            />
            {noOpen.tp && noTpSl.tpEnabled && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                <div style={{ display: "grid", gridTemplateColumns: "18px 1fr 1fr", gap: 2, fontSize: 9, fontFamily: "monospace", opacity: 0.35, paddingLeft: 2 }}>
                  <span>#</span><span>TP %</span><span>Close %</span>
                </div>
                {noTpSl.multiTpLevels.slice(0, noTpSl.multiTpCount).map((lvl, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "18px 1fr 1fr", gap: 2, alignItems: "center" }}>
                    <span style={{ fontSize: 9, fontFamily: "monospace", opacity: 0.38 }}>{i + 1}</span>
                    <_NI value={lvl.tpPercent} onChange={(v) => {
                      const next = [...noTpSl.multiTpLevels]
                      next[i] = { ...next[i], tpPercent: v }
                      noUpd("multiTpLevels", next)
                    }} suffix="%" step={0.1} min={0} />
                    <_NI value={lvl.closePercent} onChange={(v) => {
                      noUpd("multiTpLevels", _rebalanceClose(noTpSl.multiTpLevels.slice(0, noTpSl.multiTpCount), i, v))
                    }} suffix="%" step={1} min={1} />
                  </div>
                ))}
              </div>
            )}
            {noOpen.tp && !noTpSl.tpEnabled && (
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(200,214,229,0.3)", padding: "4px 0" }}>
                Take profit disabled
              </div>
            )}
          </div>
          <_Divider />

          {/* ── STOP LOSS ────────────────────────────────────── */}
          <div style={{ marginBottom: 4 }}>
            <_SectionHead
              title="STOP LOSS"
              expanded={noOpen.sl}
              onToggle={() => noTog("sl")}
              rightSlot={<_MiniToggle checked={noTpSl.slEnabled} onChange={(v) => noUpd("slEnabled", v)} />}
            />
            {noOpen.sl && noTpSl.slEnabled && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden" }}>
                  {([
                    { v: "extreme_order" as const, label: "Extreme Order", tooltip: "SL размещается на заданном расстоянии (%) от крайнего ордера.\n\nПодходит для одиночного входа — стоп всегда зафиксирован относительно первого уровня." },
                    { v: "avg_entry" as const, label: "Avg Entry", tooltip: "SL рассчитывается от средней цены входа.\n\nСтоп автоматически перемещается после каждого усреднения." },
                  ] as const).map((o, i, arr) => (
                    <div key={o.v} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: noTpSl.slMode === o.v ? "rgba(30,111,239,0.18)" : "transparent", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.1)" : undefined }}>
                      <button
                        onClick={() => noUpd("slMode", noTpSl.slMode === o.v ? null : o.v)}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{ flex: 1, fontSize: 9, fontFamily: "monospace", padding: "2px 6px", background: "transparent", border: "none", cursor: "pointer", color: noTpSl.slMode === o.v ? "#1e6fef" : "rgba(255,255,255,0.35)", fontWeight: noTpSl.slMode === o.v ? 700 : 400, letterSpacing: "0.04em" }}
                      >{o.label}</button>
                      <_TinyTooltipIcon text={o.tooltip} color={noTpSl.slMode === o.v ? "rgba(30,111,239,0.7)" : undefined} />
                      <div style={{ width: 4 }} />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2" style={{ gap: 4 }}>
                  <_NI value={noTpSl.slPercent} onChange={(v) => noUpd("slPercent", v)} label="SL %" min={0} step={0.1} title="Stop loss percentage" />
                  <_NI value={noTpSl.slClosePercent} onChange={(v) => noUpd("slClosePercent", Math.min(100, Math.max(1, v)))} label="Close %" min={1} title="Percentage of position to close at stop loss" />
                </div>
              </div>
            )}
            {noOpen.sl && !noTpSl.slEnabled && (
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(200,214,229,0.3)", padding: "4px 0" }}>
                Stop loss disabled
              </div>
            )}
          </div>
          <_Divider />

          {/* Edit mode banner */}
          {editingOrderId && (
            <div className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono"
              style={{ background: "rgba(30,111,239,0.08)", border: "1px solid rgba(30,111,239,0.25)", color: "rgba(30,111,239,0.9)" }}>
              <span style={{ flex: 1 }}>Editing placed order</span>
              <button
                onClick={handleCancelEdit}
                className="opacity-60 hover:opacity-100 transition-opacity"
                style={{ fontSize: 10 }}
                onMouseDown={stopProp}
              >
                ✕ cancel
              </button>
            </div>
          )}

          {/* Submit / Save */}
          {editingOrderId && formEditMode ? (
            <div className="flex gap-1 mt-1">
              <button
                onClick={handleSaveEdit}
                className="flex-1 text-sm font-mono font-semibold py-2 rounded transition-all"
                style={{
                  background: "rgba(30,111,239,0.18)",
                  color: "#1e6fef",
                  border: "1px solid rgba(30,111,239,0.4)",
                }}
                onMouseDown={stopProp}
              >
                Save Changes
              </button>
              <button
                onClick={handleCancelEdit}
                className="text-xs font-mono py-2 px-3 rounded transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.4)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onMouseDown={stopProp}
              >
                Cancel
              </button>
            </div>
          ) : !editingOrderId ? (
            <button
              onClick={handleSubmit}
              className="w-full text-sm font-mono font-semibold py-2 rounded mt-1 transition-all"
              style={{
                background: effectiveSide === "buy" ? "#0d3d2e" : "#3d0d0d",
                color: effectiveSide === "buy" ? "#00e5a0" : "#ff4757",
                border: `1px solid ${effectiveSide === "buy" ? "#1a7a5a" : "#c02030"}`,
              }}
              onMouseDown={stopProp}
            >
              {marketType === "futures"
                ? (futuresSide === "long" ? `Long / ${ticker}` : `Short / ${ticker}`)
                : (effectiveSide === "buy" ? `Buy / ${ticker}` : `Sell / ${ticker}`)
              }
            </button>
          ) : null}

          {/* Last result */}
          {lastResult && (
            <div
              className="text-xs font-mono px-2 py-1.5 rounded text-center"
              style={{
                background: lastResult.success ? "rgba(0,229,160,0.1)" : "rgba(255,71,87,0.1)",
                color: lastResult.success ? "#00e5a0" : "#ff4757",
                border: `1px solid ${lastResult.success ? "rgba(0,229,160,0.2)" : "rgba(255,71,87,0.2)"}`,
              }}
            >
              {lastResult.success ? "✓ " : "✗ "}{lastResult.msg}
            </div>
          )}

          </div>{/* end inner px-3 py-2 flex flex-col */}
        </div>
      )}

      {/* Grid tab — always mounted to preserve slot/placed state across tab switches */}
      <div className="flex-1 overflow-auto min-h-0" style={{ display: tab === "grid" ? undefined : "none" }}>
        <GridConfigTab
          symbol={symbol}
          marketType={marketType}
          futuresSide={futuresSide}
          entryPrice={mockPrice}
          availableBalance={walletBalance}
          inOrders={inOrders}
          leverage={posSettings.leverage}
          onSideChange={(s) => activeChart && updateWidget(activeChart.id, { futuresSide: s })}
          consoleWidgetId={_props.widget.id}
          activeChartId={activeChartId}
          accountId={accountId}
          exchangeId={exchangeId}
          isVisible={tab === "grid"}
        />
      </div>
    </div>
  )
}
