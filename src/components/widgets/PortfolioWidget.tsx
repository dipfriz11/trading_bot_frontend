import { useState } from "react"
import { generatePositions, formatPrice, ACCOUNTS, EXCHANGES } from "@/lib/mock-data"
import type { Widget, Position } from "@/types/terminal"
import { useTerminal } from "@/contexts/TerminalContext"
import type { ChartPlacedOrder, OrderSource } from "@/contexts/TerminalContext"
import { X, ChevronDown, ChevronRight } from "lucide-react"

const positions = generatePositions()

interface FlatOrder extends ChartPlacedOrder {
  positionKey: string
}

function fmtPrice(n: number) {
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(6)
}

function fmtUSDT(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Position row ─────────────────────────────────────────────────────────────

function PositionRow({ pos }: { pos: Position }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = pos.side === "long"
  const isPnlPos = pos.pnl >= 0
  const sideColor = isLong ? "#00e5a0" : "#ff4757"
  const pnlColor = isPnlPos ? "#00e5a0" : "#ff4757"
  const notional = pos.size * pos.entryPrice

  return (
    <>
      {/* Collapsed row */}
      <div
        className="group grid px-3 py-1.5 font-mono text-xs cursor-pointer transition-colors hover:bg-white/[0.03]"
        style={{
          gridTemplateColumns: "1fr 70px 80px 80px 90px",
          borderBottom: expanded ? "none" : "1px solid rgba(255,255,255,0.04)",
        }}
        onClick={() => setExpanded((v) => !v)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Symbol + side + leverage */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </span>
          <span style={{ color: sideColor, fontSize: 10, fontWeight: 700, letterSpacing: "0.02em" }}>
            [{isLong ? "L" : "S"}]
          </span>
          <span style={{ color: "rgba(200,214,229,0.9)", fontWeight: 600, fontSize: 11 }}>
            {pos.symbol}
          </span>
          <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 10 }}>
            ×{pos.leverage}
          </span>
        </div>

        {/* Size */}
        <div className="text-right" style={{ color: "rgba(200,214,229,0.8)", fontSize: 11 }}>
          {pos.size}
        </div>

        {/* Entry */}
        <div className="text-right" style={{ color: "rgba(200,214,229,0.6)", fontSize: 11 }}>
          {formatPrice(pos.entryPrice)}
        </div>

        {/* Mark */}
        <div className="text-right" style={{ color: "rgba(200,214,229,0.85)", fontSize: 11 }}>
          {formatPrice(pos.markPrice)}
        </div>

        {/* P&L */}
        <div className="text-right" style={{ color: pnlColor }}>
          <div style={{ fontSize: 11, fontWeight: 600 }}>
            {isPnlPos ? "+" : ""}${Math.abs(pos.pnl).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: 9, opacity: 0.75 }}>
            ({isPnlPos ? "+" : ""}{pos.pnlPct.toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          className="px-3 pb-2.5"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            background: "rgba(0,0,0,0.12)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Detail grid */}
          <div className="grid gap-x-4 gap-y-1.5 mt-1.5" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <DetailCell label="Side" value={isLong ? "Long" : "Short"} valueColor={sideColor} />
            <DetailCell label="Leverage" value={`×${pos.leverage}`} />
            <DetailCell label="Notional" value={`$${fmtUSDT(notional)}`} />
            <DetailCell label="Entry Price" value={formatPrice(pos.entryPrice)} />
            <DetailCell label="Mark Price" value={formatPrice(pos.markPrice)} />
            <DetailCell
              label="Unrealized P&L"
              value={`${isPnlPos ? "+" : ""}$${Math.abs(pos.pnl).toFixed(2)}`}
              valueColor={pnlColor}
            />
            <DetailCell
              label="ROE"
              value={`${isPnlPos ? "+" : ""}${pos.pnlPct.toFixed(2)}%`}
              valueColor={pnlColor}
            />
            <DetailCell label="Size" value={`${pos.size} ${pos.symbol.split("/")[0]}`} />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 mt-2">
            <button
              className="px-2 py-0.5 rounded font-mono transition-colors hover:bg-white/10"
              style={{
                fontSize: 9,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(200,214,229,0.6)",
              }}
            >
              Close 25%
            </button>
            <button
              className="px-2 py-0.5 rounded font-mono transition-colors hover:bg-white/10"
              style={{
                fontSize: 9,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(200,214,229,0.6)",
              }}
            >
              Close 50%
            </button>
            <button
              className="px-2 py-0.5 rounded font-mono transition-colors"
              style={{
                fontSize: 9,
                background: "rgba(255,71,87,0.1)",
                border: "1px solid rgba(255,71,87,0.25)",
                color: "#ff4757",
              }}
            >
              Close All
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function DetailCell({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono" style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <span className="font-mono" style={{ fontSize: 10, color: valueColor ?? "rgba(200,214,229,0.85)", fontWeight: 500 }}>
        {value}
      </span>
    </div>
  )
}

// ─── Order row ────────────────────────────────────────────────────────────────

const SOURCE_BADGE_STYLES: Record<OrderSource, { bg: string; color: string; border: string }> = {
  manual: { bg: "transparent", color: "transparent", border: "transparent" },
  grid:    { bg: "rgba(77,159,255,0.1)",  color: "#4d9fff",  border: "rgba(77,159,255,0.25)" },
  dca:     { bg: "rgba(0,229,160,0.08)",  color: "#00e5a0",  border: "rgba(0,229,160,0.2)" },
  bot:     { bg: "rgba(255,171,0,0.1)",   color: "#ffab00",  border: "rgba(255,171,0,0.25)" },
  webhook: { bg: "rgba(255,211,42,0.08)", color: "#ffd32a",  border: "rgba(255,211,42,0.2)" },
}

function SourceBadge({ order }: { order: FlatOrder }) {
  const source = order.source ?? "manual"
  if (source === "manual") return null
  const style = SOURCE_BADGE_STYLES[source]

  let label = source.toUpperCase()
  if (source === "grid" && order.gridIndex != null) label = `GRID #${order.gridIndex}`
  if (source === "bot" && order.botName) label = `BOT · ${order.botName}`
  if (source === "webhook" && order.webhookName) label = order.webhookName

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
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Row 1: Symbol + badges + status + cancel */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="px-1.5 py-0.5 font-mono font-bold rounded"
            style={{
              fontSize: 9,
              background: isBuy ? "rgba(0,229,160,0.12)" : "rgba(255,71,87,0.12)",
              color: isBuy ? "#00e5a0" : "#ff4757",
              border: `1px solid ${isBuy ? "rgba(0,229,160,0.25)" : "rgba(255,71,87,0.25)"}`,
            }}
          >
            {isBuy ? "BUY" : "SELL"}
          </span>
          <span className="font-mono font-semibold" style={{ color: "rgba(200,214,229,0.9)", fontSize: 11 }}>
            {order.symbol ?? "—"}
          </span>
          <span
            className="px-1 font-mono rounded"
            style={{
              fontSize: 8,
              background: isFutures ? "rgba(255,165,0,0.1)" : "rgba(30,111,239,0.08)",
              color: isFutures ? "#ffa500" : "#4d9fff",
              border: `1px solid ${isFutures ? "rgba(255,165,0,0.2)" : "rgba(30,111,239,0.18)"}`,
            }}
          >
            {isFutures ? "PERP" : "SPOT"}
          </span>
          <span className="font-mono" style={{ color: "rgba(255,255,255,0.25)", fontSize: 9 }}>
            {order.orderType.toUpperCase()}
          </span>
          {isFutures && order.leverage && (
            <span className="font-mono" style={{ color: "#4d9fff", fontSize: 9 }}>
              ×{order.leverage}
            </span>
          )}
          <SourceBadge order={order} />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="font-mono rounded px-1.5 py-0.5"
            style={{
              fontSize: 9,
              background: isPending
                ? "rgba(255,211,42,0.08)"
                : order.status === "filled"
                  ? "rgba(0,229,160,0.08)"
                  : "rgba(255,71,87,0.08)",
              color: isPending ? "#ffd32a" : order.status === "filled" ? "#00e5a0" : "#ff4757",
              border: `1px solid ${isPending ? "rgba(255,211,42,0.18)" : order.status === "filled" ? "rgba(0,229,160,0.18)" : "rgba(255,71,87,0.18)"}`,
            }}
          >
            {order.status?.toUpperCase() ?? "PENDING"}
          </span>
          {isPending && (
            <button
              onClick={onCancel}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
              style={{ color: "rgba(255,71,87,0.65)" }}
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
          <span className="font-mono" style={{ color: "rgba(255,255,255,0.28)", fontSize: 8 }}>Price</span>
          <span className="font-mono" style={{ color: "rgba(200,214,229,0.8)", fontSize: 10 }}>
            {fmtPrice(order.price)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono" style={{ color: "rgba(255,255,255,0.28)", fontSize: 8 }}>Qty</span>
          <span className="font-mono" style={{ color: "rgba(200,214,229,0.8)", fontSize: 10 }}>
            {order.qty.toFixed(order.qty < 1 ? 6 : 4)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono" style={{ color: "rgba(255,255,255,0.28)", fontSize: 8 }}>Notional</span>
          <span className="font-mono" style={{ color: "rgba(200,214,229,0.8)", fontSize: 10 }}>
            {fmtUSDT(notional)}
          </span>
        </div>
        {isFutures && order.margin != null && (
          <div className="flex flex-col">
            <span className="font-mono" style={{ color: "rgba(255,255,255,0.28)", fontSize: 8 }}>Margin</span>
            <span className="font-mono" style={{ color: "#4d9fff", fontSize: 10 }}>
              {fmtUSDT(order.margin)}
            </span>
          </div>
        )}
        {order.time && (
          <div className="flex flex-col ml-auto">
            <span className="font-mono" style={{ color: "rgba(255,255,255,0.28)", fontSize: 8 }}>Time</span>
            <span className="font-mono" style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>
              {order.time}
            </span>
          </div>
        )}
      </div>

      {/* Row 3: Account + Exchange */}
      <div className="flex items-center gap-2">
        <span className="font-mono" style={{ color: "rgba(255,255,255,0.22)", fontSize: 9 }}>{accLabel}</span>
        <span style={{ color: "rgba(255,255,255,0.1)", fontSize: 9 }}>·</span>
        <span className="font-mono" style={{ color: "rgba(255,255,255,0.22)", fontSize: 9 }}>{exLabel}</span>
      </div>
    </div>
  )
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export function PortfolioWidget(_props: { widget: Widget }) {
  const [tab, setTab] = useState<"positions" | "orders">("positions")
  const { placedOrders, removePlacedOrder } = useTerminal()

  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0)
  const isPnlPos = totalPnl >= 0

  // Collect all placed orders (non-draft) across all positions
  const allOrders: FlatOrder[] = []
  for (const [pk, orders] of Object.entries(placedOrders)) {
    for (const o of orders) {
      if (!o.isDraft) allOrders.push({ ...o, positionKey: pk })
    }
  }
  const pendingCount = allOrders.filter((o) => o.status === "pending" || o.status == null).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div
        className="flex items-center gap-5 px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Total P&L */}
        <div>
          <div className="font-mono" style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total P&L</div>
          <div className="font-mono font-bold" style={{ fontSize: 13, color: isPnlPos ? "#00e5a0" : "#ff4757" }}>
            {isPnlPos ? "+" : ""}${totalPnl.toFixed(2)}
          </div>
        </div>

        {/* Position count */}
        <div>
          <div className="font-mono" style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Positions</div>
          <div className="font-mono font-bold" style={{ fontSize: 13, color: "rgba(200,214,229,0.9)" }}>
            {positions.length}
          </div>
        </div>

        {/* Tabs */}
        <div className="ml-auto flex gap-1">
          {(["positions", "orders"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="relative px-2.5 py-0.5 font-mono rounded capitalize transition-colors"
              style={{
                fontSize: 11,
                background: tab === t ? "rgba(30,111,239,0.18)" : "transparent",
                border: `1px solid ${tab === t ? "rgba(30,111,239,0.6)" : "rgba(255,255,255,0.1)"}`,
                color: tab === t ? "#4d9fff" : "rgba(255,255,255,0.35)",
              }}
            >
              {t === "positions" ? "Positions" : "Orders"}
              {t === "orders" && pendingCount > 0 && (
                <span
                  className="ml-1.5 rounded-full px-1 font-mono font-bold"
                  style={{
                    fontSize: 8,
                    background: "rgba(255,211,42,0.15)",
                    color: "#ffd32a",
                    border: "1px solid rgba(255,211,42,0.25)",
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === "positions" ? (
        <div className="flex-1 overflow-auto min-h-0">
          {/* Column headers */}
          <div
            className="grid px-3 py-1 font-mono flex-shrink-0"
            style={{
              gridTemplateColumns: "1fr 70px 80px 80px 90px",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Symbol</span>
            <span className="text-right" style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Size</span>
            <span className="text-right" style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Entry</span>
            <span className="text-right" style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Mark</span>
            <span className="text-right" style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>P&L</span>
          </div>

          {positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-1.5" style={{ opacity: 0.25 }}>
              <span className="font-mono text-sm">No open positions</span>
            </div>
          ) : (
            positions.map((pos, i) => <PositionRow key={i} pos={pos} />)
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto min-h-0">
          {allOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-1.5" style={{ opacity: 0.25 }}>
              <span className="font-mono text-sm">No open orders</span>
              <span className="font-mono text-xs" style={{ opacity: 0.6 }}>Place an order to see it here</span>
            </div>
          ) : (
            <>
              <div
                className="flex items-center justify-between px-3 py-1"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
              >
                <span className="font-mono" style={{ color: "rgba(255,255,255,0.28)", fontSize: 9 }}>
                  {allOrders.length} order{allOrders.length !== 1 ? "s" : ""} · {pendingCount} pending
                </span>
              </div>
              {allOrders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onCancel={() => removePlacedOrder(order.positionKey, order.id)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
