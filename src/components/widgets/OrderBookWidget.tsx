import { useState, useEffect } from "react"
import { generateOrderBook, formatPrice } from "@/lib/mock-data"
import { SYMBOLS } from "@/lib/mock-data"
import type { Widget } from "@/types/terminal"
import { useTerminal } from "@/contexts/TerminalContext"

interface OrderBookWidgetProps {
  widget: Widget
}

export function OrderBookWidget({ widget }: OrderBookWidgetProps) {
  const { updateWidget } = useTerminal()
  const symbol = widget.symbol ?? "BTC/USDT"
  const [data, setData] = useState({ asks: [] as any[], bids: [] as any[] })

  useEffect(() => {
    const update = () => setData(generateOrderBook(symbol))
    update()
    const t = setInterval(update, 800)
    return () => clearInterval(t)
  }, [symbol])

  const maxTotal = Math.max(
    ...(data.asks.map((a) => a.total) || [1]),
    ...(data.bids.map((b) => b.total) || [1]),
    1
  )

  const mid = data.asks[0] && data.bids[0]
    ? ((data.asks[0].price + data.bids[0].price) / 2)
    : null

  const spread = data.asks[0] && data.bids[0]
    ? (data.asks[0].price - data.bids[0].price)
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Symbol selector */}
      <div className="flex items-center gap-2 px-2 py-1 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <select
          value={symbol}
          onChange={(e) => updateWidget(widget.id, { symbol: e.target.value })}
          className="font-mono text-xs bg-transparent border-0 outline-none cursor-pointer"
          style={{ color: "inherit", opacity: 0.8 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {SYMBOLS.map((s) => (
            <option key={s} value={s} style={{ background: "#0d1526" }}>{s}</option>
          ))}
        </select>
        {mid && (
          <span className="text-xs font-mono ml-auto" style={{ opacity: 0.6 }}>
            Mid: {formatPrice(mid)}
          </span>
        )}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 px-2 py-0.5 text-xs font-mono flex-shrink-0" style={{ opacity: 0.4, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (sell side, reversed) */}
      <div className="flex-1 overflow-auto min-h-0">
        {data.asks.slice(0, 15).reverse().map((ask, i) => (
          <div key={i} className="relative grid grid-cols-3 px-2 text-xs font-mono" style={{ height: 20 }}>
            <div
              className="absolute right-0 top-0 bottom-0"
              style={{ background: "rgba(255,71,87,0.08)", width: `${(ask.total / maxTotal) * 100}%` }}
            />
            <span style={{ color: "#ff4757", position: "relative" }}>{formatPrice(ask.price)}</span>
            <span className="text-right" style={{ position: "relative", opacity: 0.8 }}>{ask.size.toFixed(4)}</span>
            <span className="text-right" style={{ position: "relative", opacity: 0.5 }}>{ask.total.toFixed(3)}</span>
          </div>
        ))}

        {/* Spread */}
        {spread !== null && (
          <div className="px-2 py-1 text-xs font-mono text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", opacity: 0.5 }}>
            Spread: {formatPrice(spread)} ({spread && data.asks[0] ? ((spread / data.asks[0].price) * 100).toFixed(3) : 0}%)
          </div>
        )}

        {/* Bids (buy side) */}
        {data.bids.slice(0, 15).map((bid, i) => (
          <div key={i} className="relative grid grid-cols-3 px-2 text-xs font-mono" style={{ height: 20 }}>
            <div
              className="absolute left-0 top-0 bottom-0"
              style={{ background: "rgba(0,217,126,0.08)", width: `${(bid.total / maxTotal) * 100}%` }}
            />
            <span style={{ color: "#00d97e", position: "relative" }}>{formatPrice(bid.price)}</span>
            <span className="text-right" style={{ position: "relative", opacity: 0.8 }}>{bid.size.toFixed(4)}</span>
            <span className="text-right" style={{ position: "relative", opacity: 0.5 }}>{bid.total.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
