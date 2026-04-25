import { useState, useEffect, useRef } from "react"
import { CircleCheck as CheckCircle, Circle as XCircle, Clock } from "lucide-react"
import type { Widget } from "@/types/terminal"
import { SYMBOLS } from "@/lib/mock-data"
import { useTerminal } from "@/contexts/TerminalContext"
import { PositionBar } from "./PositionBar"
import { usePositionSettings } from "@/hooks/usePositionSettings"
import { GridConfigTab } from "./GridConfigTab"
import { DcaTab } from "./DcaTab"

function priceToString(price: number): string {
  if (price >= 1000) return price.toFixed(2)
  if (price >= 10) return price.toFixed(2)
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(6)
}

type OrderSide = "buy" | "sell"
type OrderType = "market" | "limit" | "stop"
type OrderStatus = "filled" | "cancelled" | "pending"
type AnchorField = "qty" | "amount"

type Order = {
  id: string
  side: OrderSide
  type: OrderType
  symbol: string
  qty: string
  price?: string
  status: OrderStatus
  time: string
}

const MOCK_ORDERS: Order[] = [
  { id: "o1", side: "buy",  type: "limit",  symbol: "BTC/USDT", qty: "0.1",  price: "67200",  status: "filled",    time: "14:22:01" },
  { id: "o2", side: "sell", type: "market", symbol: "ETH/USDT", qty: "1.5",  price: undefined, status: "filled",    time: "14:18:45" },
  { id: "o3", side: "buy",  type: "stop",   symbol: "SOL/USDT", qty: "10",   price: "148.00", status: "cancelled", time: "13:55:10" },
  { id: "o4", side: "sell", type: "limit",  symbol: "BTC/USDT", qty: "0.05", price: "68000",  status: "pending",   time: "now" },
]

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
  } = useTerminal()

  const [tab, setTab] = useState<"new" | "history" | "grid" | "dca">("new")
  const [side, setSide] = useState<OrderSide>("buy")
  const [orderType, setOrderType] = useState<OrderType>("limit")
  const [price, setPrice] = useState("")
  const [stopPrice, setStopPrice] = useState("")
  const [qty, setQty] = useState("")
  const [amount, setAmount] = useState("")
  const [anchor, setAnchor] = useState<AnchorField>("qty")
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS)
  const [lastResult, setLastResult] = useState<{ success: boolean; msg: string } | null>(null)
  // True when user has manually edited the form while a placed order is selected (editingOrderId set)
  const [formEditMode, setFormEditMode] = useState(false)
  // Suppresses draft re-creation immediately after submit
  const suppressDraftRef = useRef(false)
  const stopProp = (e: React.MouseEvent) => e.stopPropagation()

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
  }, [effectiveSide, price, qty, orderType, activeChart?.id, isDraggingOrder, editingOrderId])

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
    const orders = placedOrders[activeChart.id] ?? []
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
  }, [placedOrders, activeChart?.id])

  // ---- Load placed order data into form when user selects it for editing ----
  useEffect(() => {
    if (!editingOrderId || !activeChart) {
      setFormEditMode(false)
      return
    }
    const order = (placedOrders[activeChart.id] ?? []).find((o) => o.id === editingOrderId)
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

    const existingOrder = placedOrders[activeChart.id]?.find((o) => o.id === editingOrderId)
    const effectiveQty = newQty > 0 ? newQty : (existingOrder?.qty ?? 0)
    const newNotional = effectiveQty * newPrice
    const newMargin = existingOrder?.marketType === "futures" && existingOrder?.leverage
      ? newNotional / existingOrder.leverage
      : newNotional

    if (existingOrder?.accountId && existingOrder?.exchangeId && existingOrder?.marketType && existingOrder?.margin != null) {
      refundOrderBalance(existingOrder.accountId, existingOrder.exchangeId, existingOrder.marketType, existingOrder.margin)
      deductOrderBalance(existingOrder.accountId, existingOrder.exchangeId, existingOrder.marketType, newMargin)
    }

    updatePlacedOrder(activeChart.id, editingOrderId, {
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

      addPlacedOrder(activeChart.id, {
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
        status: "pending",
      })
      setDraftOrder(activeChart.id, undefined)
      deductOrderBalance(accountId, exchangeId, marketType, margin)
    }

    const newOrder: Order = {
      id, side: effectiveSide, type: orderType, symbol, qty,
      price: orderType !== "market" ? price : undefined,
      status: "pending",
      time,
    }

    setOrders((prev) => [newOrder, ...prev])
    setLastResult({ success: true, msg: `${effectiveSide.toUpperCase()} ${qty} ${symbol} ${orderType === "market" ? "@ MKT" : `@ ${price}`}` })

    resetFormToNew()

    setTimeout(() => {
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "filled" } : o)))
      setLastResult(null)
    }, 1500)
  }

  const handleCancel = (id: string) => {
    setOrders((prev) => prev.map((o) => (o.id === id && o.status === "pending" ? { ...o, status: "cancelled" } : o)))
  }

  const statusIcon = (status: OrderStatus) => {
    if (status === "filled")    return <CheckCircle size={10} style={{ color: "#00e5a0" }} />
    if (status === "cancelled") return <XCircle     size={10} style={{ color: "#ff4757" }} />
    return <Clock size={10} style={{ color: "#ffd32a" }} />
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
        {(["new", "history", "grid", "dca"] as const).map((t) => (
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
            {t === "new" ? "New Order" : t === "history" ? "History" : t === "grid" ? "Grid" : "DCA"}
          </button>
        ))}
      </div>


      {tab === "new" ? (
        <div className="flex-1 overflow-auto min-h-0 px-3 py-2 flex flex-col gap-2">

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
              {/* Symbol display (readonly, driven by chart) */}
              <div className="text-xs font-mono px-2 py-1 rounded"
                style={{ background: "rgba(255,255,255,0.04)", opacity: 0.8, border: "1px solid rgba(255,255,255,0.07)" }}>
                {symbol}
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

          {/* Side toggle: Spot = Buy/Sell, Futures = Long/Short */}
          {marketType === "spot" ? (
            <div className="flex rounded overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              {(["buy", "sell"] as const).map((s) => (
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
              ))}
            </div>
          ) : (
            <div className="flex rounded overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              {(["long", "short"] as const).map((fs) => (
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
              ))}
            </div>
          )}

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
        </div>
      ) : tab === "history" ? (
        /* History */
        <div className="flex-1 overflow-auto min-h-0">
          <div className="flex gap-1 px-2 py-0.5 text-xs font-mono"
            style={{ opacity: 0.35, borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 10 }}>
            <span style={{ width: 14 }} />
            <span style={{ width: 52 }}>Symbol</span>
            <span style={{ width: 26 }}>Side</span>
            <span style={{ flex: 1 }}>Qty</span>
            <span className="text-right" style={{ width: 55 }}>Price</span>
            <span style={{ width: 20 }} />
          </div>
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-1 px-2 text-xs font-mono"
              style={{ height: 28, borderBottom: "1px solid rgba(255,255,255,0.025)" }}
            >
              <span style={{ width: 14, flexShrink: 0 }}>{statusIcon(o.status)}</span>
              <span style={{ width: 52, opacity: 0.7 }}>{o.symbol}</span>
              <span style={{ width: 26, color: o.side === "buy" ? "#00e5a0" : "#ff4757", fontWeight: 600, fontSize: 10 }}>
                {o.side.toUpperCase()}
              </span>
              <span style={{ flex: 1, opacity: 0.6 }}>{o.qty}</span>
              <span className="text-right" style={{ width: 55, opacity: 0.7 }}>
                {o.price ? o.price : "MKT"}
              </span>
              {o.status === "pending" && (
                <button
                  onClick={() => handleCancel(o.id)}
                  className="opacity-30 hover:opacity-100 transition-opacity"
                  style={{ width: 20 }}
                  onMouseDown={stopProp}
                >
                  <XCircle size={10} />
                </button>
              )}
              {o.status !== "pending" && <span style={{ width: 20 }} />}
            </div>
          ))}
        </div>
      ) : tab === "grid" ? (
        /* Grid Config */
        <div className="flex-1 overflow-auto min-h-0 flex flex-col">
          {chartWidgets.length > 1 && (
            <div className="flex gap-1 flex-wrap px-3 pt-2">
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
          )}
          <GridConfigTab
            symbol={symbol}
            marketType={marketType}
            futuresSide={futuresSide}
            entryPrice={mockPrice}
            availableBalance={freeMargin}
            leverage={posSettings.leverage}
            onSideChange={(s) => activeChart && updateWidget(activeChart.id, { futuresSide: s })}
          />
        </div>
      ) : (
        /* DCA */
        <div className="flex-1 overflow-auto min-h-0 flex flex-col">
          {chartWidgets.length > 1 && (
            <div className="flex gap-1 flex-wrap px-3 pt-2">
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
          )}
          <DcaTab
            symbol={symbol}
            futuresSide={futuresSide}
            entryPrice={mockPrice}
            availableBalance={freeMargin}
            leverage={posSettings.leverage}
            onSideChange={(s) => activeChart && updateWidget(activeChart.id, { futuresSide: s })}
          />
        </div>
      )}
    </div>
  )
}
