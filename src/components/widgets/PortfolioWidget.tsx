import { useState } from "react"
import { generatePositions } from "@/lib/mock-data"
import { formatPrice } from "@/lib/mock-data"
import type { Widget } from "@/types/terminal"

const positions = generatePositions()

export function PortfolioWidget(_props: { widget: Widget }) {
  const [tab, setTab] = useState<"positions" | "orders">("positions")
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary */}
      <div className="flex items-center gap-4 px-3 py-1.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div>
          <div className="text-xs font-mono" style={{ opacity: 0.5 }}>Total P&L</div>
          <div className="text-sm font-mono font-bold" style={{ color: totalPnl >= 0 ? "#00d97e" : "#ff4757" }}>
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
              className="px-2 py-0.5 text-xs font-mono rounded capitalize"
              style={{
                background: tab === t ? "rgba(30,111,239,0.2)" : "transparent",
                border: `1px solid ${tab === t ? "#1e6fef" : "rgba(255,255,255,0.1)"}`,
                color: tab === t ? "#1e6fef" : "rgba(255,255,255,0.4)",
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === "positions" ? (
        <div className="flex-1 overflow-auto min-h-0">
          {/* Header */}
          <div className="grid px-3 py-1 text-xs font-mono flex-shrink-0" style={{ gridTemplateColumns: "1fr 60px 80px 80px 80px", opacity: 0.4, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
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
                <span style={{ color: pos.side === "long" ? "#00d97e" : "#ff4757" }}>
                  [{pos.side === "long" ? "L" : "S"}]
                </span>
                <span className="ml-1">{pos.symbol}</span>
                <span className="ml-1 text-xs" style={{ opacity: 0.4 }}>x{pos.leverage}</span>
              </div>
              <span className="text-right" style={{ opacity: 0.85 }}>{pos.size}</span>
              <span className="text-right" style={{ opacity: 0.7 }}>{formatPrice(pos.entryPrice)}</span>
              <span className="text-right" style={{ opacity: 0.85 }}>{formatPrice(pos.markPrice)}</span>
              <div className="text-right" style={{ color: pos.pnl >= 0 ? "#00d97e" : "#ff4757" }}>
                {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(0)}
                <div style={{ opacity: 0.7 }}>({pos.pnlPct >= 0 ? "+" : ""}{pos.pnlPct.toFixed(2)}%)</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center" style={{ opacity: 0.3 }}>
          <span className="text-sm font-mono">No open orders</span>
        </div>
      )}
    </div>
  )
}
