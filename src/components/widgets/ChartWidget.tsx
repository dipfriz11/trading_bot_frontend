import { useState, useRef, useEffect, useCallback } from "react"
import { generateCandles, formatPrice, generateOrderBook, ACCOUNTS, EXCHANGES } from "@/lib/mock-data"
import { SYMBOLS } from "@/lib/mock-data"
import type { Widget, Candle } from "@/types/terminal"
import { useTerminal } from "@/contexts/TerminalContext"
import type { ChartPlacedOrder, ChartDraftOrder } from "@/contexts/TerminalContext"
import { ChevronDown, User, Building2 } from "lucide-react"
import { PositionBarCompact } from "./PositionBar"
import { usePositionSettings } from "@/hooks/usePositionSettings"

// Local order shape (same as context but aliased for clarity)
type PlacedOrder = ChartPlacedOrder
type DraftOrder = ChartDraftOrder

type AnchorField = "qty" | "amount"

function priceToString(price: number): string {
  if (price >= 1000) return price.toFixed(2)
  if (price >= 10) return price.toFixed(2)
  if (price >= 1) return price.toFixed(4)
  return price.toFixed(6)
}

interface ChartWidgetProps {
  widget: Widget
}

const CHART_COLORS = {
  up: "#00d97e",
  down: "#ff4757",
  draft: "rgba(160,175,200,0.85)",
  draftClose: "rgba(100,115,135,0.9)",
  volume: { up: "rgba(0,217,126,0.25)", down: "rgba(255,71,87,0.25)" },
  grid: "rgba(255,255,255,0.04)",
  text: "rgba(200,214,229,0.7)",
}

// Badge for BUY (long) orders — anchored to the LEFT edge
function BuyOrderBadge({
  y, label, color, closeBtnColor, closeBtnFg, priceTagColor, priceTagFg,
  priceTag, onClose, onDragStart, axisX, padLeft, isEditing, isDraft,
}: {
  y: number; label: string; color: string
  closeBtnColor: string; closeBtnFg: string
  priceTagColor: string; priceTagFg: string
  priceTag: string; isEditing: boolean; isDraft?: boolean
  onClose: () => void
  onDragStart: (e: React.MouseEvent) => void
  axisX: number; padLeft: number
}) {
  const PAD = 8
  const CLOSE_W = 20
  const charW = 5.8
  const labelW = PAD + label.length * charW + PAD
  const badgeH = 20
  const by = y - badgeH / 2
  const badgeX = padLeft + 4
  const axisPriceW = 56

  return (
    <g>
      {/* Editing highlight ring */}
      {isEditing && (
        <rect x={badgeX - 2} y={by - 2} width={labelW + CLOSE_W + 4} height={badgeH + 4}
          fill="none" stroke={color} strokeWidth={1.5} rx={4} opacity={0.6}
          strokeDasharray="3,2" style={{ pointerEvents: "none" }} />
      )}
      {/* Badge body — acts as drag handle for draft, or select area for placed */}
      {isDraft ? (
        <g style={{ cursor: "ns-resize" }} onMouseDown={onDragStart}>
          <rect x={badgeX} y={by} width={labelW} height={badgeH}
            fill={`${color}18`} stroke={color} strokeWidth={1} rx={3} />
          <text x={badgeX + PAD} y={y + 4} fontSize={9.5} fill={color}
            fontFamily="Geist Variable, monospace" fontWeight="600"
            style={{ pointerEvents: "none" }}>
            {label}
          </text>
        </g>
      ) : (
        <g style={{ cursor: isEditing ? "grab" : "pointer" }}
          onMouseDown={onDragStart}>
          <rect x={badgeX} y={by} width={labelW} height={badgeH}
            fill={isEditing ? `${color}30` : `${color}18`} stroke={color} strokeWidth={1} rx={3} />
          <text x={badgeX + PAD} y={y + 4} fontSize={9.5} fill={color}
            fontFamily="Geist Variable, monospace" fontWeight="600"
            style={{ pointerEvents: "none" }}>
            {label}
          </text>
        </g>
      )}
      <g style={{ cursor: "pointer" }} onMouseDown={(e) => { e.stopPropagation(); onClose() }}>
        <rect x={badgeX + labelW} y={by} width={CLOSE_W} height={badgeH}
          fill={closeBtnColor} stroke={closeBtnColor} strokeWidth={1} rx={3} />
        <text x={badgeX + labelW + CLOSE_W / 2} y={y + 4.5}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={11} fill={closeBtnFg}
          fontFamily="Geist Variable, monospace" fontWeight="bold"
          style={{ pointerEvents: "none" }}>
          ×
        </text>
      </g>
      {/* Price tag on right axis */}
      <rect x={axisX} y={y - 9} width={axisPriceW} height={18}
        fill={priceTagColor} rx={2} style={{ pointerEvents: "none" }} />
      <text x={axisX + axisPriceW / 2} y={y + 4} textAnchor="middle" fontSize={9}
        fill={priceTagFg}
        fontFamily="Geist Variable, monospace" fontWeight="bold"
        style={{ pointerEvents: "none" }}>
        {priceTag}
      </text>
    </g>
  )
}

// Badge for SELL (short) orders — anchored to the RIGHT edge (just before price axis)
function SellOrderBadge({
  y, label, color, closeBtnColor, closeBtnFg, priceTagColor, priceTagFg,
  priceTag, onClose, onDragStart, axisX, isEditing, isDraft,
}: {
  y: number; label: string; color: string
  closeBtnColor: string; closeBtnFg: string
  priceTagColor: string; priceTagFg: string
  priceTag: string; isEditing: boolean; isDraft?: boolean
  onClose: () => void
  onDragStart: (e: React.MouseEvent) => void
  axisX: number
}) {
  const PAD = 8
  const CLOSE_W = 20
  const charW = 5.8
  const labelW = PAD + label.length * charW + PAD
  const badgeH = 20
  const by = y - badgeH / 2
  const axisPriceW = 56
  const badgeRight = axisX - 4
  const closeX = badgeRight - CLOSE_W - labelW
  const labelX = closeX + CLOSE_W

  return (
    <g>
      {isEditing && (
        <rect x={closeX - 2} y={by - 2} width={labelW + CLOSE_W + 4} height={badgeH + 4}
          fill="none" stroke={color} strokeWidth={1.5} rx={4} opacity={0.6}
          strokeDasharray="3,2" style={{ pointerEvents: "none" }} />
      )}
      {/* Close button */}
      <g style={{ cursor: "pointer" }} onMouseDown={(e) => { e.stopPropagation(); onClose() }}>
        <rect x={closeX} y={by} width={CLOSE_W} height={badgeH}
          fill={closeBtnColor} stroke={closeBtnColor} strokeWidth={1} rx={3} />
        <text x={closeX + CLOSE_W / 2} y={y + 4.5}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={11} fill={closeBtnFg}
          fontFamily="Geist Variable, monospace" fontWeight="bold"
          style={{ pointerEvents: "none" }}>
          ×
        </text>
      </g>
      {/* Badge body */}
      {isDraft ? (
        <g style={{ cursor: "ns-resize" }} onMouseDown={onDragStart}>
          <rect x={labelX} y={by} width={labelW} height={badgeH}
            fill={`${color}18`} stroke={color} strokeWidth={1} rx={3} />
          <text x={labelX + PAD} y={y + 4} fontSize={9.5} fill={color}
            fontFamily="Geist Variable, monospace" fontWeight="600"
            style={{ pointerEvents: "none" }}>
            {label}
          </text>
        </g>
      ) : (
        <g style={{ cursor: isEditing ? "grab" : "pointer" }}
          onMouseDown={onDragStart}>
          <rect x={labelX} y={by} width={labelW} height={badgeH}
            fill={isEditing ? `${color}30` : `${color}18`} stroke={color} strokeWidth={1} rx={3} />
          <text x={labelX + PAD} y={y + 4} fontSize={9.5} fill={color}
            fontFamily="Geist Variable, monospace" fontWeight="600"
            style={{ pointerEvents: "none" }}>
            {label}
          </text>
        </g>
      )}
      {/* Price tag on right axis */}
      <rect x={axisX} y={y - 9} width={axisPriceW} height={18}
        fill={priceTagColor} rx={2} style={{ pointerEvents: "none" }} />
      <text x={axisX + axisPriceW / 2} y={y + 4} textAnchor="middle" fontSize={9}
        fill={priceTagFg}
        fontFamily="Geist Variable, monospace" fontWeight="bold"
        style={{ pointerEvents: "none" }}>
        {priceTag}
      </text>
    </g>
  )
}

function renderOrderLine(
  order: PlacedOrder,
  orderPrice: number,
  toY: (p: number) => number,
  minPrice: number,
  maxPrice: number,
  padding: { left: number; right: number; top: number; bottom: number },
  width: number,
  onClose: () => void,
  onDragStart: (e: React.MouseEvent) => void,
  _onSelect?: () => void,
  isEditing?: boolean,
) {
  if (orderPrice < minPrice || orderPrice > maxPrice) return null
  const y = toY(orderPrice)
  const axisX = width - padding.right

  let color: string
  let closeBtnColor: string
  let closeBtnFg: string
  let priceTagColor: string
  let priceTagFg: string
  let label: string

  if (order.isDraft) {
    color = CHART_COLORS.draft
    closeBtnColor = CHART_COLORS.draftClose
    closeBtnFg = "rgba(200,214,229,0.9)"
    priceTagColor = "rgba(80,95,115,0.9)"
    priceTagFg = "rgba(200,214,229,0.9)"
    label = `${order.side === "buy" ? "BUY" : "SELL"} | ${order.qty} — draft`
  } else {
    color = order.side === "buy" ? CHART_COLORS.up : CHART_COLORS.down
    closeBtnColor = color
    closeBtnFg = "#000"
    priceTagColor = color
    priceTagFg = "#000"
    label = `${order.side === "buy" ? "LONG" : "SHORT"} | ${order.qty}`
  }

  // Estimate badge width for line gap calculation
  const PAD = 8
  const CLOSE_W = 20
  const labelW = PAD + label.length * 5.8 + PAD
  const badgeW = labelW + CLOSE_W
  const padLeft = padding.left
  const editing = isEditing ?? false

  if (order.side === "buy") {
    const badgeX = padLeft + 4
    return (
      <g key={order.id}>
        <line x1={padLeft} y1={y} x2={badgeX - 1} y2={y}
          stroke={color} strokeWidth={1} strokeDasharray="4,3" opacity={order.isDraft ? 0.5 : 0.85} />
        <line x1={badgeX + badgeW + 2} y1={y} x2={axisX - 1} y2={y}
          stroke={color} strokeWidth={1} strokeDasharray="4,3" opacity={order.isDraft ? 0.5 : 0.85} />
        <BuyOrderBadge
          y={y} label={label} color={color}
          closeBtnColor={closeBtnColor} closeBtnFg={closeBtnFg}
          priceTagColor={priceTagColor} priceTagFg={priceTagFg}
          priceTag={formatPrice(orderPrice)}
          onClose={onClose} onDragStart={onDragStart}
          axisX={axisX} padLeft={padLeft} isEditing={editing}
          isDraft={order.isDraft}
        />
      </g>
    )
  } else {
    const SELL_CLOSE_W = 20
    const sellLabelW = PAD + label.length * 5.8 + PAD
    const sellBadgeW = SELL_CLOSE_W + sellLabelW
    const badgeRight = axisX - 4
    const badgeLeft = badgeRight - sellBadgeW
    return (
      <g key={order.id}>
        <line x1={padLeft} y1={y} x2={badgeLeft - 2} y2={y}
          stroke={color} strokeWidth={1} strokeDasharray="4,3" opacity={order.isDraft ? 0.5 : 0.85} />
        <line x1={badgeRight + 2} y1={y} x2={axisX - 1} y2={y}
          stroke={color} strokeWidth={1} strokeDasharray="4,3" opacity={order.isDraft ? 0.5 : 0.85} />
        <SellOrderBadge
          y={y} label={label} color={color}
          closeBtnColor={closeBtnColor} closeBtnFg={closeBtnFg}
          priceTagColor={priceTagColor} priceTagFg={priceTagFg}
          priceTag={formatPrice(orderPrice)}
          onClose={onClose} onDragStart={onDragStart}
          axisX={axisX} isEditing={editing}
          isDraft={order.isDraft}
        />
      </g>
    )
  }
}

interface ChartProps {
  candles: Candle[]
  width: number
  height: number
  allOrders: PlacedOrder[]
  editingOrderId: string | null
  onOrderClose: (id: string) => void
  onOrderDragStart: (id: string, e: React.MouseEvent, toPrice: (y: number) => number, minP: number, maxP: number, chartH: number, padTop: number) => void
  onBackgroundClick?: () => void
}

function CandlestickChart({ candles, width, height, allOrders, editingOrderId, onOrderClose, onOrderDragStart, onBackgroundClick }: ChartProps) {
  if (!candles.length || width < 2 || height < 2) return null

  const chartHeight = height * 0.72
  const volumeHeight = height * 0.18
  const padding = { left: 52, right: 56, top: 10, bottom: 20 }
  const chartAreaWidth = width - padding.left - padding.right
  const displayCount = Math.min(candles.length, Math.floor(chartAreaWidth / 8))
  const visible = candles.slice(-displayCount)

  const maxPrice = Math.max(...visible.map((c) => c.high))
  const minPrice = Math.min(...visible.map((c) => c.low))
  const priceRange = maxPrice - minPrice || 1
  const maxVol = Math.max(...visible.map((c) => c.volume)) || 1

  const toY = (price: number) => padding.top + ((maxPrice - price) / priceRange) * chartHeight
  const toPrice = (yPx: number) => minPrice + (1 - (yPx - padding.top) / chartHeight) * priceRange
  const candleW = Math.max(2, chartAreaWidth / displayCount - 1)

  const priceLabels: Array<{ price: number; y: number }> = []
  for (let i = 0; i <= 5; i++) {
    const price = minPrice + (priceRange * i) / 5
    priceLabels.push({ price, y: toY(price) })
  }

  return (
    <svg width={width} height={height} style={{ display: "block" }}
      onClick={(e) => {
        // If the click target is the SVG itself (background), cancel edit mode
        if (e.target === e.currentTarget) onBackgroundClick?.()
      }}>
      {/* Transparent background rect to catch clicks */}
      <rect x={0} y={0} width={width} height={height} fill="transparent"
        onClick={() => onBackgroundClick?.()} />
      {priceLabels.map(({ y }, i) => (
        <line key={i} x1={padding.left} y1={y} x2={width - padding.right} y2={y}
          stroke={CHART_COLORS.grid} strokeWidth={1} />
      ))}
      {priceLabels.map(({ price, y }, i) => (
        <text key={i} x={padding.left - 4} y={y + 4} textAnchor="end"
          fontSize={9} fill={CHART_COLORS.text} fontFamily="Geist Variable, monospace">
          {formatPrice(price)}
        </text>
      ))}

      {visible.map((candle, i) => {
        const cx = padding.left + i * (chartAreaWidth / displayCount) + candleW / 2
        const isUp = candle.close >= candle.open
        const color = isUp ? CHART_COLORS.up : CHART_COLORS.down
        const bodyTop = toY(Math.max(candle.open, candle.close))
        const bodyBot = toY(Math.min(candle.open, candle.close))
        const bodyH = Math.max(1, bodyBot - bodyTop)
        const volH = (candle.volume / maxVol) * volumeHeight
        const volY = padding.top + chartHeight + (height - padding.top - chartHeight - padding.bottom) * 0.1 + (volumeHeight - volH)
        return (
          <g key={candle.time}>
            <line x1={cx} y1={toY(candle.high)} x2={cx} y2={toY(candle.low)} stroke={color} strokeWidth={1} />
            <rect x={cx - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={color} />
            <rect x={cx - candleW / 2} y={volY} width={candleW} height={volH}
              fill={isUp ? CHART_COLORS.volume.up : CHART_COLORS.volume.down} />
          </g>
        )
      })}

      {(() => {
        const last = visible[visible.length - 1]
        if (!last) return null
        const y = toY(last.close)
        const color = last.close >= last.open ? CHART_COLORS.up : CHART_COLORS.down
        return (
          <g>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y}
              stroke={color} strokeWidth={1} strokeDasharray="3,3" opacity={0.6} />
            <rect x={width - padding.right} y={y - 9} width={padding.right} height={18} fill={color} rx={2} />
            <text x={width - padding.right + padding.right / 2} y={y + 4} textAnchor="middle" fontSize={9}
              fill="#000" fontFamily="Geist Variable, monospace" fontWeight="bold">
              {formatPrice(last.close)}
            </text>
          </g>
        )
      })()}

      {allOrders.map((order) => {
        const price = order.orderType === "market" ? (visible[visible.length - 1]?.close ?? 0) : order.price
        return renderOrderLine(
          order, price, toY, minPrice, maxPrice, padding, width,
          () => onOrderClose(order.id),
          (e) => onOrderDragStart(order.id, e, toPrice, minPrice, maxPrice, chartHeight, padding.top),
          undefined,
          editingOrderId === order.id,
        )
      })}
    </svg>
  )
}

function LineChart({ candles, width, height, allOrders, editingOrderId, onOrderClose, onOrderDragStart, onBackgroundClick }: ChartProps) {
  if (!candles.length || width < 2 || height < 2) return null

  const padding = { left: 52, right: 56, top: 10, bottom: 20 }
  const chartAreaWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const prices = candles.map((c) => c.close)
  const maxPrice = Math.max(...prices)
  const minPrice = Math.min(...prices)
  const priceRange = maxPrice - minPrice || 1

  const toX = (i: number) => padding.left + (i / (candles.length - 1)) * chartAreaWidth
  const toY = (price: number) => padding.top + ((maxPrice - price) / priceRange) * chartHeight
  const toPrice = (yPx: number) => minPrice + (1 - (yPx - padding.top) / chartHeight) * priceRange

  const points = candles.map((c, i) => `${toX(i)},${toY(c.close)}`).join(" ")
  const areaPoints = [
    `${padding.left},${padding.top + chartHeight}`,
    ...candles.map((c, i) => `${toX(i)},${toY(c.close)}`),
    `${padding.left + chartAreaWidth},${padding.top + chartHeight}`,
  ].join(" ")

  const priceLabels: Array<{ price: number; y: number }> = []
  for (let i = 0; i <= 5; i++) {
    const price = minPrice + (priceRange * i) / 5
    priceLabels.push({ price, y: toY(price) })
  }

  const last = candles[candles.length - 1]
  const isUp = last ? last.close >= candles[0].close : true

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <rect x={0} y={0} width={width} height={height} fill="transparent"
        onClick={() => onBackgroundClick?.()} />
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isUp ? CHART_COLORS.up : CHART_COLORS.down} stopOpacity={0.25} />
          <stop offset="100%" stopColor={isUp ? CHART_COLORS.up : CHART_COLORS.down} stopOpacity={0} />
        </linearGradient>
      </defs>

      {priceLabels.map(({ y, price }, i) => (
        <g key={i}>
          <line x1={padding.left} y1={y} x2={width - padding.right} y2={y}
            stroke={CHART_COLORS.grid} strokeWidth={1} />
          <text x={padding.left - 4} y={y + 4} textAnchor="end"
            fontSize={9} fill={CHART_COLORS.text} fontFamily="Geist Variable, monospace">
            {formatPrice(price)}
          </text>
        </g>
      ))}

      <polygon points={areaPoints} fill="url(#lineGrad)" />
      <polyline points={points} fill="none"
        stroke={isUp ? CHART_COLORS.up : CHART_COLORS.down} strokeWidth={1.5} />

      {last && (() => {
        const y = toY(last.close)
        const color = isUp ? CHART_COLORS.up : CHART_COLORS.down
        return (
          <line x1={padding.left} y1={y} x2={width - padding.right} y2={y}
            stroke={color} strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
        )
      })()}

      {allOrders.map((order) => {
        const price = order.orderType === "market" ? (candles[candles.length - 1]?.close ?? 0) : order.price
        return renderOrderLine(
          order, price, toY, minPrice, maxPrice, padding, width,
          () => onOrderClose(order.id),
          (e) => onOrderDragStart(order.id, e, toPrice, minPrice, maxPrice, chartHeight, padding.top),
          undefined,
          editingOrderId === order.id,
        )
      })}
    </svg>
  )
}

const LOCAL_DRAFT_ID = "__draft__"

export function ChartWidget({ widget }: ChartWidgetProps) {
  const {
    activeTab, updateWidget, activeChartId, setActiveChartId,
    draftOrders, placedOrders: ctxPlacedOrders,
    setDraftOrder: ctxSetDraft,
    addPlacedOrder: ctxAddPlaced,
    removePlacedOrder: ctxRemovePlaced, updatePlacedOrderPrice: ctxUpdatePrice,
    updatePlacedOrder: ctxUpdatePlacedOrder,
    setIsDraggingOrder,
    editingOrderId, setEditingOrderId,
    deductOrderBalance,
  } = useTerminal()

  const [size, setSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const [candles, setCandles] = useState<Candle[]>([])

  // Local state: draft and editing order id for standalone mode
  const [localDraft, setLocalDraft] = useState<PlacedOrder | undefined>(undefined)
  const [localEditingOrderId, setLocalEditingOrderId] = useState<string | null>(null)
  const localDragHandlers = useRef<Map<string, (price: number) => void>>(new Map())

  const symbol = widget.symbol ?? "BTC/USDT"
  const chartType = widget.chartType ?? "candlestick"
  const marketType = widget.marketType ?? "spot"
  const futuresSide = widget.futuresSide ?? "long"

  // Whether there is an order-console widget in the current workspace
  const hasOrderConsole = !!(activeTab?.widgets.some((w) => w.type === "order-console"))
  // Whether this chart is the currently focused one
  const isActive = activeChartId === widget.id

  useEffect(() => { setCandles(generateCandles(symbol)) }, [symbol])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }))
    ro.observe(el)
    setSize({ width: el.clientWidth, height: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const last = candles[candles.length - 1]
  const prev = candles[candles.length - 2]
  const isUp = last && prev ? last.close >= prev.close : true

  // Standalone mode uses localEditingOrderId for the form; managed mode uses context editingOrderId
  const effectiveEditingOrderId = hasOrderConsole ? editingOrderId : localEditingOrderId

  // ---- Compose orders to render ----
  // Managed mode: read from context
  // Standalone mode: use local state
  const draftForChart: PlacedOrder | undefined = hasOrderConsole
    ? (draftOrders[widget.id] ? { ...draftOrders[widget.id]!, id: LOCAL_DRAFT_ID, isDraft: true } : undefined)
    : localDraft
  // Always read placed orders from context so PortfolioWidget sees them regardless of mode
  const placedForChart: PlacedOrder[] = ctxPlacedOrders[widget.id] ?? []
  const allOrders: PlacedOrder[] = [...(draftForChart ? [draftForChart] : []), ...placedForChart]

  // ---- Close handler ----
  const handleOrderClose = useCallback((id: string) => {
    if (id === LOCAL_DRAFT_ID) {
      if (hasOrderConsole) ctxSetDraft(widget.id, undefined)
      else setLocalDraft(undefined)
    } else {
      ctxRemovePlaced(widget.id, id)
      localDragHandlers.current.delete(id)
    }
  }, [hasOrderConsole, widget.id, ctxSetDraft, ctxRemovePlaced])

  // Tracks whether a drag is currently active (cursor has moved enough to be a drag)
  const isDraggingRef = useRef(false)

  // ---- Drag/click handler ----
  // Short mousedown+mouseup (no movement) = click → toggle edit mode
  // Mousedown + hold/move = drag → move order price
  const handleOrderDragStart = useCallback((
    id: string,
    e: React.MouseEvent,
    _toPrice: (yPx: number) => number,
    minP: number,
    maxP: number,
    chartH: number,
    _padTop: number,
  ) => {
    e.stopPropagation()
    e.preventDefault()

    const isDraftOrder = id === LOCAL_DRAFT_ID
    const isPlacedOrder = !isDraftOrder

    let startPrice = 0
    if (isDraftOrder) {
      startPrice = draftForChart?.price ?? 0
    } else {
      startPrice = ctxPlacedOrders[widget.id]?.find((o) => o.id === id)?.price ?? 0
    }

    const startY = e.clientY
    const DRAG_THRESHOLD = 4 // px
    let dragStarted = false
    isDraggingRef.current = false

    const startDrag = () => {
      if (dragStarted) return
      dragStarted = true
      isDraggingRef.current = true
      document.body.style.cursor = "grabbing"
      if (isPlacedOrder) setEditingOrderId(id)
    }

    const onMove = (mv: MouseEvent) => {
      const dy = mv.clientY - startY
      if (!dragStarted && Math.abs(dy) >= DRAG_THRESHOLD) startDrag()
      if (!dragStarted) return

      const pricePerPx = (maxP - minP) / chartH
      const newPrice = Math.max(minP, Math.min(maxP, startPrice - dy * pricePerPx))

      if (isDraftOrder) {
        if (hasOrderConsole) {
          const d = draftOrders[widget.id]
          if (d) ctxSetDraft(widget.id, { ...d, price: newPrice })
        } else {
          setLocalDraft((d) => d ? { ...d, price: newPrice } : d)
          localDragHandlers.current.get(LOCAL_DRAFT_ID)?.(newPrice)
        }
      } else {
        ctxUpdatePrice(widget.id, id, newPrice)
        localDragHandlers.current.get(id)?.(newPrice)
      }
    }

    const onUp = () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      document.body.style.cursor = ""
      isDraggingRef.current = false

      if (dragStarted) {
        setIsDraggingOrder(false)
        if (isPlacedOrder) setEditingOrderId(null)
      } else {
        // Was a click — toggle edit mode for placed orders
        if (isPlacedOrder) {
          if (hasOrderConsole) {
            setEditingOrderId(editingOrderId === id ? null : id)
          } else {
            setLocalEditingOrderId((prev) => prev === id ? null : id)
          }
        }
      }
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }, [hasOrderConsole, widget.id, draftForChart, draftOrders, ctxPlacedOrders, ctxSetDraft, ctxUpdatePrice, setEditingOrderId, setIsDraggingOrder, editingOrderId])

  // ---- Cancel edit when clicking chart background ----
  const handleBackgroundClick = useCallback(() => {
    if (hasOrderConsole && editingOrderId) setEditingOrderId(null)
    else if (!hasOrderConsole && localEditingOrderId) setLocalEditingOrderId(null)
  }, [hasOrderConsole, editingOrderId, setEditingOrderId, localEditingOrderId])

  // ---- Place order (standalone mode — always writes to global context) ----
  const handlePlaceOrder = useCallback((order: Omit<PlacedOrder, "id" | "isDraft">, margin?: number): string => {
    const id = Math.random().toString(36).slice(2, 10)
    const now = new Date()
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((n) => n.toString().padStart(2, "0")).join(":")
    ctxAddPlaced(widget.id, { ...order, id, isDraft: false, time, status: "pending" })
    setLocalDraft(undefined)
    const deductAmount = margin ?? order.qty * order.price
    deductOrderBalance(widget.accountId ?? "main", widget.exchangeId ?? "binance", widget.marketType ?? "spot", deductAmount)
    return id
  }, [widget.id, widget.accountId, widget.exchangeId, widget.marketType, ctxAddPlaced, deductOrderBalance])

  const registerDragPriceHandler = useCallback((id: string, fn: (p: number) => void) => {
    localDragHandlers.current.set(id, fn)
  }, [])

  const registerDraftDragHandler = useCallback((fn: (p: number) => void) => {
    localDragHandlers.current.set(LOCAL_DRAFT_ID, fn)
  }, [])

  // Use widget rect height as fallback when size hasn't been measured yet
  const containerHeight = size.height || widget.rect.height - 60
  const chartAreaHeight = widget.showOrderForm ? containerHeight * 0.6 : containerHeight

  // Focused chart border highlight when managed mode
  const focusStyle = hasOrderConsole && isActive
    ? { outline: "2px solid rgba(30,111,239,0.5)", outlineOffset: "-2px" }
    : {}

  return (
    <div
      className="flex flex-col h-full"
      style={focusStyle}
      onClick={() => {
        if (hasOrderConsole) setActiveChartId(widget.id)
      }}
    >
      {/* Top bar — symbol, price, change only */}
      <div className="flex items-center gap-2 px-2 py-1"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>

        {/* Symbol selector */}
        <select
          value={symbol}
          onChange={(e) => updateWidget(widget.id, { symbol: e.target.value })}
          className="font-mono text-xs bg-transparent border-0 outline-none cursor-pointer font-bold"
          style={{ color: "inherit", opacity: 0.9 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {SYMBOLS.map((s) => (
            <option key={s} value={s} style={{ background: "#0d1526" }}>{s}</option>
          ))}
        </select>

        {last && (
          <span className="font-mono text-xs font-bold" style={{ color: isUp ? "#00d97e" : "#ff4757" }}>
            {formatPrice(last.close)}
          </span>
        )}
        {last && prev && (
          <span className="font-mono text-xs" style={{ color: isUp ? "#00d97e" : "#ff4757" }}>
            {isUp ? "+" : ""}{(((last.close - prev.close) / prev.close) * 100).toFixed(2)}%
          </span>
        )}

        {/* Active chart indicator for managed mode */}
        {hasOrderConsole && (
          <span className="font-mono px-1.5 py-0.5 rounded"
            style={{
              fontSize: 9,
              background: isActive ? "rgba(30,111,239,0.15)" : "rgba(255,255,255,0.04)",
              color: isActive ? "#1e6fef" : "rgba(255,255,255,0.25)",
              border: `1px solid ${isActive ? "rgba(30,111,239,0.3)" : "rgba(255,255,255,0.07)"}`,
            }}>
            {isActive ? "● ACTIVE" : "○ CLICK"}
          </span>
        )}
      </div>

      {/* Chart + order book */}
      <div className="flex flex-1 min-h-0 flex-col">
        <div className="flex min-h-0 overflow-hidden"
          style={{ flex: (!hasOrderConsole && widget.showOrderForm) ? "1 1 auto" : "1 1 100%" }}>
          <div ref={containerRef} className="flex-1 min-w-0 overflow-hidden" style={{ minHeight: 0 }}>
            {size.width > 0 && (
              chartType === "candlestick"
                ? <CandlestickChart
                    candles={candles} width={size.width} height={Math.max(chartAreaHeight, 80)}
                    allOrders={allOrders}
                    editingOrderId={effectiveEditingOrderId}
                    onOrderClose={handleOrderClose}
                    onOrderDragStart={handleOrderDragStart}
                    onBackgroundClick={handleBackgroundClick}
                  />
                : <LineChart
                    candles={candles} width={size.width} height={Math.max(chartAreaHeight, 80)}
                    allOrders={allOrders}
                    editingOrderId={effectiveEditingOrderId}
                    onOrderClose={handleOrderClose}
                    onOrderDragStart={handleOrderDragStart}
                    onBackgroundClick={handleBackgroundClick}
                  />
            )}
          </div>

          {widget.showOrderBook && <OrderBookPanel symbol={symbol} />}
        </div>

        {/* Inline order form — only in standalone mode */}
        {!hasOrderConsole && widget.showOrderForm && (
          <div className="flex-shrink-0 overflow-y-auto">
            <StandaloneOrderForm
              symbol={symbol}
              currentPrice={last?.close}
              marketType={marketType}
              futuresSide={futuresSide}
              accountId={widget.accountId ?? "main"}
              exchangeId={widget.exchangeId ?? "binance"}
              onFuturesSideChange={(fs) => updateWidget(widget.id, { futuresSide: fs })}
              onDraftChange={(draft) => {
                setLocalDraft(draft ? { ...draft, id: LOCAL_DRAFT_ID, isDraft: true } : undefined)
              }}
              onPlaceOrder={handlePlaceOrder}
              registerDragPriceHandler={registerDragPriceHandler}
              registerDraftDragHandler={registerDraftDragHandler}
              editingOrder={localEditingOrderId ? (ctxPlacedOrders[widget.id] ?? []).find((o) => o.id === localEditingOrderId) : undefined}
              onUpdateOrder={(id, updates) => {
                ctxUpdatePlacedOrder(widget.id, id, updates)
                setLocalEditingOrderId(null)
              }}
              onCancelEdit={() => setLocalEditingOrderId(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ---- OrderBookPanel ----

function OrderBookPanel({ symbol }: { symbol: string }) {
  const [data, setData] = useState({ asks: [], bids: [] } as { asks: any[]; bids: any[] })

  useEffect(() => {
    const update = () => setData(generateOrderBook(symbol))
    update()
    const t = setInterval(update, 1500)
    return () => clearInterval(t)
  }, [symbol])

  const maxTotal = Math.max(
    ...(data.asks.map((a) => a.total) || [1]),
    ...(data.bids.map((b) => b.total) || [1]),
    1
  )

  return (
    <div className="flex flex-col overflow-hidden"
      style={{ width: 180, borderLeft: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
      <div className="px-2 py-1 text-xs font-mono"
        style={{ opacity: 0.5, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ color: "#ff4757", marginRight: 8 }}>ASKS</span>
        <span style={{ color: "#00d97e" }}>BIDS</span>
      </div>
      <div className="flex-1 overflow-auto">
        {data.asks.slice(0, 10).reverse().map((ask, i) => (
          <div key={i} className="relative px-1 py-px flex justify-between text-xs font-mono">
            <div className="absolute inset-0"
              style={{ background: "rgba(255,71,87,0.08)", width: `${(ask.total / maxTotal) * 100}%` }} />
            <span style={{ color: "#ff4757", position: "relative" }}>{formatPrice(ask.price)}</span>
            <span style={{ opacity: 0.7, position: "relative" }}>{ask.size.toFixed(3)}</span>
          </div>
        ))}
        <div className="px-1 py-0.5 text-center text-xs font-mono"
          style={{ opacity: 0.4, borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          spread
        </div>
        {data.bids.slice(0, 10).map((bid, i) => (
          <div key={i} className="relative px-1 py-px flex justify-between text-xs font-mono">
            <div className="absolute inset-0"
              style={{ background: "rgba(0,217,126,0.08)", width: `${(bid.total / maxTotal) * 100}%` }} />
            <span style={{ color: "#00d97e", position: "relative" }}>{formatPrice(bid.price)}</span>
            <span style={{ opacity: 0.7, position: "relative" }}>{bid.size.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Standalone order form (only rendered when no order-console) ----

function StandaloneOrderForm({
  symbol,
  currentPrice,
  marketType = "spot",
  futuresSide = "long",
  accountId = "main",
  exchangeId = "binance",
  onFuturesSideChange,
  onDraftChange,
  onPlaceOrder,
  registerDragPriceHandler,
  registerDraftDragHandler,
  editingOrder,
  onUpdateOrder,
  onCancelEdit,
}: {
  symbol: string
  currentPrice?: number
  marketType?: "spot" | "futures"
  futuresSide?: "long" | "short"
  accountId?: string
  exchangeId?: string
  onFuturesSideChange?: (fs: "long" | "short") => void
  onDraftChange: (draft: DraftOrder | undefined) => void
  onPlaceOrder: (order: Omit<PlacedOrder, "id" | "isDraft">, margin?: number) => string
  registerDragPriceHandler: (id: string, fn: (price: number) => void) => void
  registerDraftDragHandler: (fn: (price: number) => void) => void
  editingOrder?: PlacedOrder
  onUpdateOrder?: (id: string, updates: Partial<Omit<PlacedOrder, "id" | "isDraft">>) => void
  onCancelEdit?: () => void
}) {
  // For spot: buy/sell directly. For futures: side is derived from futuresSide (long=buy, short=sell)
  const [side, setSide] = useState<"buy" | "sell">("buy")

  // In futures mode keep internal side in sync with futuresSide prop
  const effectiveSide: "buy" | "sell" = marketType === "futures"
    ? (futuresSide === "long" ? "buy" : "sell")
    : side
  const [price, setPrice] = useState(() => currentPrice ? priceToString(currentPrice) : "")
  const [qty, setQty] = useState("")
  const [amount, setAmount] = useState("")
  const [orderType, setOrderType] = useState<"limit" | "market" | "stop">("limit")
  const [stopPrice, setStopPrice] = useState("")
  const [anchor, setAnchor] = useState<AnchorField>("qty")
  const [lastResult, setLastResult] = useState<{ success: boolean; msg: string } | null>(null)

  const { getBalance } = useTerminal()
  const { walletBalance, inOrders } = getBalance(accountId, exchangeId, marketType)
  const { settings: posSettings } = usePositionSettings(symbol)

  // Refs so drag callbacks always read current values without re-registering
  const qtyRef = useRef(qty)
  const amountRef = useRef(amount)
  const anchorRef = useRef(anchor)
  qtyRef.current = qty
  amountRef.current = amount
  anchorRef.current = anchor

  useEffect(() => {
    if (currentPrice && !price) {
      setPrice(priceToString(currentPrice))
    }
  }, [currentPrice])

  // Load editing order into form when edit mode activated
  useEffect(() => {
    if (editingOrder) {
      setSide(editingOrder.side)
      setPrice(priceToString(editingOrder.price))
      setQty(editingOrder.qty.toString())
      setAmount((editingOrder.qty * editingOrder.price).toFixed(2))
      setOrderType(editingOrder.orderType)
      setAnchor("qty")
      onDraftChange(undefined)
    }
  }, [editingOrder?.id])

  const effectivePrice = orderType === "market" ? (currentPrice ?? 0) : parseFloat(price) || 0

  useEffect(() => {
    if (editingOrder) {
      setStopPrice("")
      return
    }
    const qtyNum = parseFloat(qty)
    if (qtyNum > 0 && effectivePrice > 0) {
      onDraftChange({ side: effectiveSide, price: effectivePrice, qty: qtyNum, orderType: orderType === "stop" ? "limit" : orderType })
    } else {
      onDraftChange(undefined)
    }
  }, [effectiveSide, price, qty, orderType, effectivePrice, editingOrder])

  // Register draft drag handler once — uses refs to always read current state
  useEffect(() => {
    registerDraftDragHandler((newPrice: number) => {
      setPrice(priceToString(newPrice))
      if (anchorRef.current === "qty") {
        const q = parseFloat(qtyRef.current)
        if (!isNaN(q) && q > 0) setAmount((q * newPrice).toFixed(2))
      } else {
        const a = parseFloat(amountRef.current)
        if (!isNaN(a) && a > 0 && newPrice > 0) setQty((a / newPrice).toFixed(6))
      }
    })
  }, [registerDraftDragHandler])

  const handlePriceChange = (v: string) => {
    setPrice(v)
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
    const q = parseFloat(v)
    if (!isNaN(q) && q > 0 && effectivePrice > 0) setAmount((q * effectivePrice).toFixed(2))
    else if (v === "") setAmount("")
  }

  const handleAmountChange = (v: string) => {
    setAnchor("amount")
    setAmount(v)
    const a = parseFloat(v)
    if (!isNaN(a) && a > 0 && effectivePrice > 0) setQty((a / effectivePrice).toFixed(6))
    else if (v === "") setQty("")
  }

  const handlePctClick = (pct: number) => {
    const freeMargin = Math.max(0, walletBalance - inOrders)
    const availableForOrder = marketType === "futures" ? freeMargin * posSettings.leverage : freeMargin
    if (anchor === "qty") {
      const maxQty = effectivePrice > 0 ? availableForOrder / effectivePrice : 0
      const q = (pct / 100) * maxQty
      setQty(q.toFixed(6))
      if (effectivePrice > 0) setAmount((q * effectivePrice).toFixed(2))
    } else {
      const a = (pct / 100) * availableForOrder
      setAnchor("amount")
      setAmount(a.toFixed(2))
      if (effectivePrice > 0) setQty((a / effectivePrice).toFixed(6))
    }
  }

  const stopProp = (e: React.MouseEvent) => e.stopPropagation()

  const handleSubmit = () => {
    const qtyNum = parseFloat(qty)
    if (!qtyNum || qtyNum <= 0) return
    if (orderType !== "market" && !price) return

    if (editingOrder && onUpdateOrder) {
      onUpdateOrder(editingOrder.id, { side: effectiveSide, price: effectivePrice, qty: qtyNum, orderType: orderType === "stop" ? "limit" : orderType })
      setQty("")
      setAmount("")
      setAnchor("qty")
      setLastResult({ success: true, msg: `Updated ${effectiveSide.toUpperCase()} ${qty} @ ${price}` })
      setTimeout(() => setLastResult(null), 1500)
      return
    }

    const notional = qtyNum * effectivePrice
    const margin = marketType === "futures" ? notional / posSettings.leverage : notional
    const id = onPlaceOrder({
      side: effectiveSide,
      price: effectivePrice,
      qty: qtyNum,
      orderType: orderType === "stop" ? "limit" : orderType,
      symbol,
      accountId,
      exchangeId,
      marketType,
      leverage: posSettings.leverage,
      margin,
      status: "pending",
    }, margin)
    registerDragPriceHandler(id, (newPrice: number) => {
      setPrice(priceToString(newPrice))
      if (anchorRef.current === "qty") {
        const q = parseFloat(qtyRef.current)
        if (!isNaN(q) && q > 0) setAmount((q * newPrice).toFixed(2))
      } else {
        const a = parseFloat(amountRef.current)
        if (!isNaN(a) && a > 0 && newPrice > 0) setQty((a / newPrice).toFixed(6))
      }
    })

    const ticker = symbol.split("/")[0]
    setLastResult({ success: true, msg: `${effectiveSide.toUpperCase()} ${qty} ${ticker} ${orderType === "market" ? "@ MKT" : `@ ${price}`}` })
    setTimeout(() => setLastResult(null), 1500)

    setQty("")
    setAmount("")
    setAnchor("qty")
    setStopPrice("")
  }

  const handleCancelEdit = () => {
    onCancelEdit?.()
    setQty("")
    setAmount("")
    setAnchor("qty")
    setStopPrice("")
  }

  const accentColor = effectiveSide === "buy" ? "#00d97e" : "#ff4757"
  const accentBg = effectiveSide === "buy" ? "rgba(0,217,126,0.5)" : "rgba(255,71,87,0.5)"

  const qtyBorder = anchor === "qty"
    ? `1px solid ${accentBg}`
    : "1px solid rgba(255,255,255,0.1)"
  const amtBorder = anchor === "amount"
    ? `1px solid ${accentBg}`
    : "1px solid rgba(255,255,255,0.1)"

  const freeMarginCalc = Math.max(0, walletBalance - inOrders)
  const availableForOrder = marketType === "futures" ? freeMarginCalc * posSettings.leverage : freeMarginCalc
  const maxQty = effectivePrice > 0 ? availableForOrder / effectivePrice : 0
  const maxAmount = availableForOrder
  const fmtQty = (n: number) => n < 0.001 ? n.toFixed(6) : n < 1 ? n.toFixed(4) : n.toFixed(2)
  const fmtAmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 })

  const ticker = symbol.split("/")[0]

  return (
    <div className="px-2 py-1.5 flex-shrink-0 text-xs"
      style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>

      {/* Position context: balance + leverage + margin mode */}
      <div className="mb-1.5 flex items-center" onMouseDown={stopProp}>
        <PositionBarCompact
          symbol={symbol}
          marketType={marketType}
          availableBalance={walletBalance}
          inOrders={inOrders}
        />
      </div>

      {/* Spot: Buy/Sell toggle | Futures: Long/Short toggle */}
      {marketType === "spot" ? (
        <div className="flex gap-0.5 mb-1">
          {(["buy", "sell"] as const).map((s) => (
            <button key={s}
              onClick={() => setSide(s)}
              className="flex-1 py-0.5 text-xs font-mono font-bold rounded transition-all"
              style={{
                background: side === s ? (s === "buy" ? "rgba(0,217,126,0.2)" : "rgba(255,71,87,0.2)") : "transparent",
                border: `1px solid ${side === s ? (s === "buy" ? "#00d97e" : "#ff4757") : "rgba(255,255,255,0.1)"}`,
                color: side === s ? (s === "buy" ? "#00d97e" : "#ff4757") : "rgba(255,255,255,0.4)",
              }}
              onMouseDown={stopProp}
            >
              {s === "buy" ? "BUY" : "SELL"}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-0.5 mb-1">
          {(["long", "short"] as const).map((fs) => (
            <button key={fs}
              onClick={() => onFuturesSideChange?.(fs)}
              className="flex-1 py-0.5 text-xs font-mono font-bold rounded transition-all"
              style={{
                background: futuresSide === fs
                  ? (fs === "long" ? "rgba(0,217,126,0.2)" : "rgba(255,71,87,0.2)")
                  : "transparent",
                border: `1px solid ${futuresSide === fs ? (fs === "long" ? "#00d97e" : "#ff4757") : "rgba(255,255,255,0.1)"}`,
                color: futuresSide === fs
                  ? (fs === "long" ? "#00d97e" : "#ff4757")
                  : "rgba(255,255,255,0.4)",
              }}
              onMouseDown={stopProp}
            >
              {fs === "long" ? "LONG" : "SHORT"}
            </button>
          ))}
        </div>
      )}

      {/* Order type */}
      <div className="flex gap-0.5 mb-1">
        {(["limit", "market", "stop"] as const).map((t) => (
          <button key={t}
            onClick={() => setOrderType(t)}
            className="flex-1 px-1 py-0.5 text-xs font-mono rounded capitalize"
            style={{
              background: orderType === t ? "rgba(30,111,239,0.2)" : "transparent",
              border: `1px solid ${orderType === t ? "#1e6fef" : "rgba(255,255,255,0.1)"}`,
              color: orderType === t ? "#1e6fef" : "rgba(255,255,255,0.4)",
              fontSize: 10,
            }}
            onMouseDown={stopProp}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Stop trigger price */}
      {orderType === "stop" && (
        <div className="mb-1">
          <label className="text-xs font-mono" style={{ opacity: 0.5, fontSize: 10 }}>Stop Price</label>
          <input
            type="number"
            value={stopPrice}
            onChange={(e) => setStopPrice(e.target.value)}
            placeholder="0.00"
            className="w-full px-1.5 py-0.5 text-xs font-mono rounded outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "inherit", background: "rgba(255,255,255,0.04)" }}
            onMouseDown={stopProp}
          />
        </div>
      )}

      {/* Limit / Stop limit price */}
      {orderType !== "market" && (
        <div className="mb-1">
          <label className="text-xs font-mono" style={{ opacity: 0.5, fontSize: 10 }}>
            {orderType === "stop" ? "Limit Price" : "Price"}
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => handlePriceChange(e.target.value)}
            placeholder="0.00"
            className="w-full px-1.5 py-0.5 text-xs font-mono rounded outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "inherit", background: "rgba(255,255,255,0.04)" }}
            onMouseDown={stopProp}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-0.5 mb-1">
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono" style={{ opacity: anchor === "qty" ? 1 : 0.5, fontSize: 10 }}>Qty</label>
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
            placeholder="0.00"
            className="w-full px-1.5 py-0.5 text-xs font-mono rounded outline-none"
            style={{ border: qtyBorder, color: "inherit", background: "rgba(255,255,255,0.04)" }}
            onMouseDown={stopProp}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono" style={{ opacity: anchor === "amount" ? 1 : 0.5, fontSize: 10 }}>Amount</label>
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
            placeholder="0.00"
            className="w-full px-1.5 py-0.5 text-xs font-mono rounded outline-none"
            style={{ border: amtBorder, color: "inherit", background: "rgba(255,255,255,0.04)" }}
            onMouseDown={stopProp}
          />
        </div>
      </div>

      {/* Quick % buttons */}
      <div className="flex gap-0.5 mb-1" onMouseDown={stopProp}>
        {[25, 50, 75, 100].map((pct) => (
          <button
            key={pct}
            onClick={() => handlePctClick(pct)}
            className="flex-1 py-0.5 text-xs font-mono rounded"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.4)",
              fontSize: 10,
            }}
            onMouseDown={stopProp}
          >
            {pct}%
          </button>
        ))}
      </div>

      {/* Edit mode banner */}
      {editingOrder && (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded mb-1 text-xs font-mono"
          style={{ background: "rgba(30,111,239,0.08)", border: "1px solid rgba(30,111,239,0.25)", color: "rgba(30,111,239,0.9)", fontSize: 10 }}
          onMouseDown={stopProp}
        >
          <span style={{ flex: 1 }}>Editing placed order</span>
          <button onClick={handleCancelEdit} className="opacity-60 hover:opacity-100" onMouseDown={stopProp}>✕</button>
        </div>
      )}

      {editingOrder ? (
        <div className="flex gap-0.5">
          <button
            onClick={handleSubmit}
            className="flex-1 py-1.5 text-xs font-mono font-semibold rounded transition-all"
            style={{
              background: "rgba(30,111,239,0.15)",
              border: "1px solid rgba(30,111,239,0.4)",
              color: "#1e6fef",
            }}
            onMouseDown={stopProp}
          >
            Update Order
          </button>
          <button
            onClick={handleCancelEdit}
            className="px-2 py-1.5 text-xs font-mono rounded"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.5)",
            }}
            onMouseDown={stopProp}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={handleSubmit}
          className="w-full py-1.5 text-sm font-mono font-semibold rounded transition-all"
          style={{
            background: effectiveSide === "buy" ? "rgba(0,217,126,0.15)" : "rgba(255,71,87,0.15)",
            border: `1px solid ${effectiveSide === "buy" ? "rgba(0,217,126,0.3)" : "rgba(255,71,87,0.3)"}`,
            color: accentColor,
          }}
          onMouseDown={stopProp}
        >
          {marketType === "futures"
            ? (futuresSide === "long" ? `Long / ${ticker}` : `Short / ${ticker}`)
            : (effectiveSide === "buy" ? `Buy / ${ticker}` : `Sell / ${ticker}`)
          }
        </button>
      )}

      {/* Last result feedback */}
      {lastResult && (
        <div
          className="text-xs font-mono px-2 py-1 rounded text-center mt-1"
          style={{
            background: lastResult.success ? "rgba(0,217,126,0.1)" : "rgba(255,71,87,0.1)",
            color: lastResult.success ? "#00d97e" : "#ff4757",
            border: `1px solid ${lastResult.success ? "rgba(0,217,126,0.2)" : "rgba(255,71,87,0.2)"}`,
            fontSize: 10,
          }}
        >
          {lastResult.success ? "✓ " : "✗ "}{lastResult.msg}
        </div>
      )}
    </div>
  )
}

// Hover tooltip shown over the Account button
function AccountBalanceTooltip({
  accountId,
  exchangeId,
  marketType,
}: {
  accountId: string
  exchangeId: string
  marketType: "spot" | "futures"
}) {
  const acc = ACCOUNTS.find((a) => a.id === accountId)
  const { getBalance } = useTerminal()
  if (!acc) return null

  const { walletBalance, inOrders } = getBalance(accountId, exchangeId, marketType)
  const freeMargin = walletBalance - inOrders
  const exLabel = EXCHANGES.find((e) => e.id === exchangeId)?.label ?? exchangeId

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div
      className="absolute z-50 flex flex-col gap-1.5 p-3 rounded-lg pointer-events-none"
      style={{
        top: "calc(100% + 5px)",
        left: 0,
        minWidth: 230,
        background: "#0a1220",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono font-semibold" style={{ color: "rgba(200,214,229,0.9)", fontSize: 10, letterSpacing: "0.05em" }}>
          {acc.label.toUpperCase()}
        </span>
        <span className="font-mono" style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>
          {exLabel} · {marketType.toUpperCase()}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between gap-6">
          <span className="font-mono" style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>Total balance</span>
          <span className="font-mono font-semibold" style={{ color: "rgba(200,214,229,0.85)", fontSize: 10 }}>
            {fmt(walletBalance)} USDT
          </span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="font-mono" style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>In open orders</span>
          <span className="font-mono" style={{ color: "rgba(255,71,87,0.85)", fontSize: 10 }}>
            −{fmt(inOrders)} USDT
          </span>
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />

      <div className="flex justify-between gap-6">
        <span className="font-mono font-semibold" style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>Free margin</span>
        <span className="font-mono font-bold" style={{ color: "rgba(200,214,229,0.95)", fontSize: 10 }}>
          {fmt(freeMargin)} USDT
        </span>
      </div>
    </div>
  )
}

function HeaderDropdown({
  icon,
  label,
  items,
  selected,
  onSelect,
  onOpenChange,
}: {
  icon: React.ReactNode
  label: string
  items: { id: string; label: string }[]
  selected: string
  onSelect: (id: string) => void
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)

  const setOpenWithCb = (v: boolean) => {
    setOpen(v)
    onOpenChange?.(v)
  }
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenWithCb(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const selectedLabel = items.find((i) => i.id === selected)?.label ?? label

  return (
    <div ref={ref} className="relative" style={{ userSelect: "none" }}>
      <button
        onClick={() => setOpenWithCb(!open)}
        className="flex items-center gap-0.5 px-1.5 py-0.5 font-mono rounded transition-all"
        style={{
          fontSize: 9,
          border: `1px solid ${open ? "rgba(30,111,239,0.5)" : "rgba(255,255,255,0.1)"}`,
          background: open ? "rgba(30,111,239,0.1)" : "transparent",
          color: open ? "#1e6fef" : "rgba(255,255,255,0.55)",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ opacity: 0.7, display: "flex", alignItems: "center" }}>{icon}</span>
        <span className="ml-0.5">{selectedLabel}</span>
        <ChevronDown size={8} style={{ opacity: 0.6, marginLeft: 1 }} />
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 py-0.5 rounded font-mono"
          style={{
            top: "calc(100% + 3px)",
            minWidth: 130,
            background: "#0d1526",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => { onSelect(item.id); setOpenWithCb(false) }}
              className="w-full text-left px-2 py-1 transition-colors"
              style={{
                fontSize: 10,
                background: selected === item.id ? "rgba(30,111,239,0.12)" : "transparent",
                color: selected === item.id ? "#1e6fef" : "rgba(200,214,229,0.8)",
                borderLeft: selected === item.id ? "2px solid #1e6fef" : "2px solid transparent",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Header extra buttons rendered inside the WidgetWrapper header bar ----
export function ChartHeaderExtra({ widget }: { widget: Widget }) {
  const { updateWidget, activeTab } = useTerminal()
  const hasOrderConsole = !!(activeTab?.widgets.some((w) => w.type === "order-console"))

  const marketType = widget.marketType ?? "spot"
  const selectedAccount = widget.accountId ?? "main"
  const selectedExchange = widget.exchangeId ?? "binance"

  const [accountHover, setAccountHover] = useState(false)
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false)

  const stopProp = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div className="flex items-center gap-1" onMouseDown={stopProp}>
      {/* Account selector with balance tooltip on hover (hidden when dropdown is open) */}
      <div
        className="relative"
        onMouseEnter={() => setAccountHover(true)}
        onMouseLeave={() => setAccountHover(false)}
      >
        <HeaderDropdown
          icon={<User size={8} />}
          label="Account"
          items={ACCOUNTS}
          selected={selectedAccount}
          onSelect={(id) => updateWidget(widget.id, { accountId: id })}
          onOpenChange={setAccountDropdownOpen}
        />
        {accountHover && !accountDropdownOpen && (
          <AccountBalanceTooltip accountId={selectedAccount} exchangeId={selectedExchange} marketType={marketType} />
        )}
      </div>

      {/* Exchange selector */}
      <HeaderDropdown
        icon={<Building2 size={8} />}
        label="Exchange"
        items={EXCHANGES}
        selected={selectedExchange}
        onSelect={(id) => updateWidget(widget.id, { exchangeId: id })}
      />

      {/* Spot / Futures toggle */}
      <div className="flex rounded overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
        {(["spot", "futures"] as const).map((mt) => (
          <button
            key={mt}
            onClick={() => updateWidget(widget.id, { marketType: mt })}
            className="px-1.5 py-0.5 font-mono transition-all"
            style={{
              fontSize: 9,
              fontWeight: 600,
              background: marketType === mt
                ? (mt === "futures" ? "rgba(255,165,0,0.18)" : "rgba(30,111,239,0.18)")
                : "transparent",
              color: marketType === mt
                ? (mt === "futures" ? "#ffa500" : "#1e6fef")
                : "rgba(255,255,255,0.3)",
              borderRight: mt === "spot" ? "1px solid rgba(255,255,255,0.1)" : "none",
            }}
          >
            {mt === "spot" ? "SPOT" : "PERP"}
          </button>
        ))}
      </div>

      {/* Book toggle */}
      <button
        onClick={() => updateWidget(widget.id, { showOrderBook: !widget.showOrderBook })}
        className="px-1.5 py-0.5 font-mono rounded transition-all"
        style={{
          fontSize: 9,
          opacity: widget.showOrderBook ? 1 : 0.55,
          border: `1px solid ${widget.showOrderBook ? "#1e6fef" : "rgba(255,255,255,0.1)"}`,
          color: widget.showOrderBook ? "#1e6fef" : "inherit",
        }}
      >
        ≡ Book
      </button>

      {/* Order toggle — hidden when order-console is in workspace */}
      {!hasOrderConsole && (
        <button
          onClick={() => updateWidget(widget.id, { showOrderForm: !widget.showOrderForm })}
          className="px-1.5 py-0.5 font-mono rounded transition-all"
          style={{
            fontSize: 9,
            opacity: widget.showOrderForm ? 1 : 0.55,
            border: `1px solid ${widget.showOrderForm ? "#00d97e" : "rgba(255,255,255,0.1)"}`,
            color: widget.showOrderForm ? "#00d97e" : "inherit",
          }}
        >
          ⌤ Order
        </button>
      )}
    </div>
  )
}
