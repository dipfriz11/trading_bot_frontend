import { useState } from "react"
import { generatePositions, formatPrice, ACCOUNTS, EXCHANGES } from "@/lib/mock-data"
import type { Widget } from "@/types/terminal"
import { useTerminal } from "@/contexts/TerminalContext"
import type { ChartPlacedOrder, OrderSource } from "@/contexts/TerminalContext"
import { X } from "lucide-react"

const positions = generatePositions()

interface FlatOrder extends ChartPlacedOrder {
  chartId: string
}

function fmtPrice(n: number) {
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}

function fmtUSDT(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const SOURCE_BADGE_STYLES: Record<OrderSource, { bg: string; color: string; border: string }> = {
  manual: { bg: "transparent", color: "transparent", border: "transparent" },
  grid:    { bg: "rgba(77,159,255,0.1)",  color: "#4d9fff",  border: "rgba(77,159,255,0.25)" },
  dca:     { bg: "rgba(168,85,247,0.1)",  color: "#a855f7",  border: "rgba(168,85,247,0.25)" },
  bot:     { bg: "rgba(255,171,0,0.1)",   color: "#ffab00",  border: "rgba(255,171,0,0.25)" },
  webhook: { bg: "rgba(0,229,160,0.08)",  color: "#00e5a0",  border: "rgba(0,229,160,0.2)" },
}

function SourceBadge({ order }: { order: FlatOrder }) {
  const source = order.source ?? "manual"
  if (source === "manual") return null
  const style = SOURCE_BADGE_STYLES[source]

  let label = source.toUpperCase()
  if (source === "grid" && order.gridIndex != null) label = `GRID #${order.gridIndex}`
  if (source === "bot" && order.botName) label = `BOT · ${order.botName}`
  if (source === "webhook" && order.webhookName) label = `⚡ ${order.webhookName}`

  return (
    <span
      className="px-1.5 py-0.5 font-mono rounded"
      style={{
        fontSize: 8,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        letterSpacing: "0.03em",
      }}
    >
      {label}
    </span>
  )
}

function OrderRow({ order, onCancel }: { order: FlatOrder; onCancel: () => void }) {
  const accLabel = ACCOUNTS.find((a) => a.id === order.accountId)?.label ?? order.accountId ?? "—"
  const exLabel  = EXCHANGES.find((e) => e.id === order.exchangeId)?.label ?? order.exchangeId ?? "—"
  const notional = order.qty * order.price
  const isBuy = order.side === "buy"
  const isFutures = order.marketType === "futures"
  const isPending = order.status === "pending"

  return (
    <div
      className="group px-3 py-2 transition-colors hover:bg-white/[0.03]"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      {/* Row 1: Symbol + side badge + status + cancel */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {/* Side badge */}
          <span
            className="px-1.5 py-0.5 text-xs font-mono font-bold rounded"
            style={{
              background: isBuy ? "rgba(0,229,160,0.15)" : "rgba(255,71,87,0.15)",
              color: isBuy ? "#00e5a0" : "#ff4757",
              border: `1px solid ${isBuy ? "rgba(0,229,160,0.3)" : "rgba(255,71,87,0.3)"}`,
              fontSize: 9,
            }}
          >
            {isBuy ? "BUY" : "SELL"}
          </span>

          {/* Symbol */}
          <span className="text-xs font-mono font-semibold" style={{ color: "rgba(200,214,229,0.9)" }}>
            {order.symbol ?? "—"}
          </span>

          {/* Market type badge */}
          <span
            className="px-1 font-mono rounded"
            style={{
              fontSize: 8,
              background: isFutures ? "rgba(255,165,0,0.12)" : "rgba(30,111,239,0.1)",
              color: isFutures ? "#ffa500" : "#4d9fff",
              border: `1px solid ${isFutures ? "rgba(255,165,0,0.25)" : "rgba(30,111,239,0.2)"}`,
            }}
          >
            {isFutures ? "PERP" : "SPOT"}
          </span>

          {/* Order type */}
          <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>
            {order.orderType.toUpperCase()}
          </span>

          {/* Leverage for futures */}
          {isFutures && order.leverage && (
            <span className="text-xs font-mono" style={{ color: "#4d9fff", fontSize: 9 }}>
              {order.leverage}×
            </span>
          )}

          {/* Source badge */}
          <SourceBadge order={order} />
        </div>

        <div className="flex items-center gap-2">
          {/* Status */}
          <span
            className="font-mono rounded px-1.5 py-0.5"
            style={{
              fontSize: 9,
              background: isPending
                ? "rgba(255,211,42,0.1)"
                : order.status === "filled"
                  ? "rgba(0,229,160,0.1)"
                  : "rgba(255,71,87,0.1)",
              color: isPending ? "#ffd32a" : order.status === "filled" ? "#00e5a0" : "#ff4757",
              border: `1px solid ${isPending ? "rgba(255,211,42,0.2)" : order.status === "filled" ? "rgba(0,229,160,0.2)" : "rgba(255,71,87,0.2)"}`,
            }}
          >
            {order.status?.toUpperCase() ?? "PENDING"}
          </span>

          {/* Cancel button */}
          {isPending && (
            <button
              onClick={onCancel}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
              style={{ color: "rgba(255,71,87,0.7)" }}
              title="Cancel order"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Price + Qty + Notional + Margin */}
      <div className="flex items-center gap-4 mb-1">
        <div className="flex flex-col">
          <span className="font-mono" style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>Price</span>
          <span className="font-mono" style={{ color: "rgba(200,214,229,0.85)", fontSize: 10 }}>
            {fmtPrice(order.price)} USDT
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono" style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>Qty</span>
          <span className="font-mono" style={{ color: "rgba(200,214,229,0.85)", fontSize: 10 }}>
            {order.qty.toFixed(order.qty < 1 ? 6 : 4)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono" style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>Notional</span>
          <span className="font-mono" style={{ color: "rgba(200,214,229,0.85)", fontSize: 10 }}>
            {fmtUSDT(notional)} USDT
          </span>
        </div>
        {isFutures && order.margin != null && (
          <div className="flex flex-col">
            <span className="font-mono" style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>Margin</span>
            <span className="font-mono" style={{ color: "#4d9fff", fontSize: 10 }}>
              {fmtUSDT(order.margin)} USDT
            </span>
          </div>
        )}
        {order.time && (
          <div className="flex flex-col ml-auto">
            <span className="font-mono" style={{ color: "rgba(255,255,255,0.3)", fontSize: 9 }}>Time</span>
            <span className="font-mono" style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
              {order.time}
            </span>
          </div>
        )}
      </div>

      {/* Row 3: Account + Exchange */}
      <div className="flex items-center gap-2">
        <span className="font-mono" style={{ color: "rgba(255,255,255,0.25)", fontSize: 9 }}>
          {accLabel}
        </span>
        <span style={{ color: "rgba(255,255,255,0.1)", fontSize: 9 }}>·</span>
        <span className="font-mono" style={{ color: "rgba(255,255,255,0.25)", fontSize: 9 }}>
          {exLabel}
        </span>
      </div>
    </div>
  )
}

export function PortfolioWidget(_props: { widget: Widget }) {
  const [tab, setTab] = useState<"positions" | "orders">("positions")
  const { placedOrders, removePlacedOrder } = useTerminal()

  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0)

  // Collect all placed orders (non-draft) across all charts
  const allOrders: FlatOrder[] = []
  for (const [chartId, orders] of Object.entries(placedOrders)) {
    for (const o of orders) {
      if (!o.isDraft) {
        allOrders.push({ ...o, chartId })
      }
    }
  }
  // Also check active tab charts for metadata
  const pendingCount = allOrders.filter((o) => o.status === "pending" || o.status == null).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary */}
      <div
        className="flex items-center gap-4 px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div>
          <div className="text-xs font-mono" style={{ opacity: 0.5 }}>Total P&L</div>
          <div className="text-sm font-mono font-bold" style={{ color: totalPnl >= 0 ? "#00e5a0" : "#ff4757" }}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs font-mono" style={{ opacity: 0.5 }}>Positions</div>
          <div className="text-sm font-mono font-bold">{positions.length}</div>
        </div>

        <div className="ml-auto flex gap-1">
          {(["positions", "orders"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="relative px-2 py-0.5 text-xs font-mono rounded capitalize"
              style={{
                background: tab === t ? "rgba(30,111,239,0.2)" : "transparent",
                border: `1px solid ${tab === t ? "#1e6fef" : "rgba(255,255,255,0.1)"}`,
                color: tab === t ? "#1e6fef" : "rgba(255,255,255,0.4)",
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {t}
              {t === "orders" && pendingCount > 0 && (
                <span
                  className="ml-1 rounded-full px-1 font-mono font-bold"
                  style={{
                    fontSize: 8,
                    background: "rgba(255,211,42,0.2)",
                    color: "#ffd32a",
                    border: "1px solid rgba(255,211,42,0.3)",
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "positions" ? (
        <div className="flex-1 overflow-auto min-h-0">
          {/* Header */}
          <div
            className="grid px-3 py-1 text-xs font-mono flex-shrink-0"
            style={{ gridTemplateColumns: "1fr 60px 80px 80px 80px", opacity: 0.4, borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span>Symbol</span>
            <span className="text-right">Size</span>
            <span className="text-right">Entry</span>
            <span className="text-right">Mark</span>
            <span className="text-right">P&L</span>
          </div>
          {positions.map((pos, i) => (
            <div
              key={i}
              className="grid px-3 py-1.5 text-xs font-mono hover:bg-white/5 transition-colors"
              style={{ gridTemplateColumns: "1fr 60px 80px 80px 80px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}
            >
              <div>
                <span style={{ color: pos.side === "long" ? "#00e5a0" : "#ff4757" }}>
                  [{pos.side === "long" ? "L" : "S"}]
                </span>
                <span className="ml-1">{pos.symbol}</span>
                <span className="ml-1 text-xs" style={{ opacity: 0.4 }}>x{pos.leverage}</span>
              </div>
              <span className="text-right" style={{ opacity: 0.85 }}>{pos.size}</span>
              <span className="text-right" style={{ opacity: 0.7 }}>{formatPrice(pos.entryPrice)}</span>
              <span className="text-right" style={{ opacity: 0.85 }}>{formatPrice(pos.markPrice)}</span>
              <div className="text-right" style={{ color: pos.pnl >= 0 ? "#00e5a0" : "#ff4757" }}>
                {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(0)}
                <div style={{ opacity: 0.7 }}>({pos.pnlPct >= 0 ? "+" : ""}{pos.pnlPct.toFixed(2)}%)</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-auto min-h-0">
          {allOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2" style={{ opacity: 0.3 }}>
              <span className="text-sm font-mono">No open orders</span>
              <span className="text-xs font-mono" style={{ opacity: 0.6 }}>Place an order to see it here</span>
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div
                className="flex items-center justify-between px-3 py-1"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
              >
                <span className="text-xs font-mono" style={{ opacity: 0.35, fontSize: 9 }}>
                  {allOrders.length} order{allOrders.length !== 1 ? "s" : ""} · {pendingCount} pending
                </span>
              </div>

              {allOrders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onCancel={() => removePlacedOrder(order.chartId, order.id)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
