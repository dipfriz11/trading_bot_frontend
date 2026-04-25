import type { GridConfig } from "@/types/terminal"

export interface GridOrderLevel {
  index: number        // 0-based order index
  price: number        // limit price for this order
  qty: number          // order quantity in base asset
  side: "buy" | "sell"
  type: "entry"        // grid entry order
}

export interface GridVisualization {
  orders: GridOrderLevel[]
  tpPrice: number | null    // single TP level (null if not set)
  slPrice: number | null    // SL level (null if not set)
  tpLevels: number[]        // multi-TP prices
  avgEntryEstimate: number  // estimated avg entry price
}

// Calculates grid order prices from config.
// Uses step_percent placement mode logic (dominant mode in UI).
export function calcGridVisualization(cfg: GridConfig): GridVisualization {
  const n = Math.max(1, cfg.ordersCount)
  const entryPrice = cfg.entryPrice > 0 ? cfg.entryPrice : 67000
  const isLong = cfg.side === "long"

  // Build price levels
  const prices: number[] = []
  const step = Math.max(0.01, cfg.stepPercent) / 100

  if (cfg.placementMode === "step_percent") {
    // First order is firstOffsetPercent away from entry
    const firstOffset = Math.max(0, cfg.firstOffsetPercent) / 100
    const firstPrice = isLong
      ? entryPrice * (1 - firstOffset)
      : entryPrice * (1 + firstOffset)

    for (let i = 0; i < n; i++) {
      const p = isLong
        ? firstPrice * Math.pow(1 - step, i)
        : firstPrice * Math.pow(1 + step, i)
      prices.push(p)
    }
  } else {
    // top/bottom range mode
    const top = cfg.topPrice > 0 ? cfg.topPrice : entryPrice * 1.05
    const bottom = cfg.bottomPrice > 0 ? cfg.bottomPrice : entryPrice * 0.95
    const rangeStep = (top - bottom) / Math.max(1, n - 1)
    for (let i = 0; i < n; i++) {
      prices.push(isLong ? bottom + rangeStep * i : top - rangeStep * i)
    }
  }

  // Build qty levels
  const totalQuote = cfg.totalQuote > 0 ? cfg.totalQuote : 1000
  const qtys: number[] = []

  if (cfg.multiplierEnabled && cfg.multiplier > 1) {
    // Geometric distribution: each order is multiplier × previous
    const m = cfg.multiplier
    // sum of geometric series: q0 * (1 + m + m^2 + ... + m^(n-1)) = totalQuote / avgPrice
    // Use avg of all prices as rough estimate for quote-to-base conversion
    const avgP = prices.reduce((s, p) => s + p, 0) / prices.length
    const geoSum = m === 1 ? n : (Math.pow(m, n) - 1) / (m - 1)
    const q0 = (totalQuote / avgP) / geoSum
    for (let i = 0; i < n; i++) {
      qtys.push(q0 * Math.pow(m, i))
    }
  } else {
    // Uniform distribution
    const avgP = prices.reduce((s, p) => s + p, 0) / prices.length
    const qEach = totalQuote / avgP / n
    for (let i = 0; i < n; i++) {
      qtys.push(qEach)
    }
  }

  const orders: GridOrderLevel[] = prices.map((price, i) => ({
    index: i,
    price,
    qty: qtys[i],
    side: isLong ? "buy" : "sell",
    type: "entry",
  }))

  // Estimate avg entry (assume all orders fill at their prices)
  const totalCost = orders.reduce((s, o) => s + o.price * o.qty, 0)
  const totalQty = orders.reduce((s, o) => s + o.qty, 0)
  const avgEntryEstimate = totalQty > 0 ? totalCost / totalQty : entryPrice

  // TP price
  let tpPrice: number | null = null
  let tpLevels: number[] = []
  if (cfg.tpEnabled) {
    const tpPct = Math.max(0.01, cfg.tpPercent) / 100
    const base = cfg.tpMode === "avg_entry" ? avgEntryEstimate : entryPrice
    tpPrice = isLong ? base * (1 + tpPct) : base * (1 - tpPct)

    if (cfg.multiTpEnabled && cfg.multiTpLevels.length > 0) {
      tpLevels = cfg.multiTpLevels.map((lvl) => {
        const pct = Math.max(0.01, lvl.tpPercent) / 100
        return isLong ? base * (1 + pct) : base * (1 - pct)
      })
      tpPrice = tpLevels[0] ?? tpPrice
    }
  }

  // SL price
  let slPrice: number | null = null
  if (cfg.slEnabled) {
    const slPct = Math.max(0.01, cfg.slPercent) / 100
    const extremePrice = isLong
      ? Math.min(...prices)
      : Math.max(...prices)
    if (cfg.slMode === "extreme_order") {
      slPrice = isLong ? extremePrice * (1 - slPct) : extremePrice * (1 + slPct)
    } else if (cfg.slMode === "avg_entry") {
      slPrice = isLong
        ? avgEntryEstimate * (1 - slPct)
        : avgEntryEstimate * (1 + slPct)
    } else {
      // first order
      const firstOrderPrice = prices[0] ?? entryPrice
      slPrice = isLong ? firstOrderPrice * (1 - slPct) : firstOrderPrice * (1 + slPct)
    }
  }

  return { orders, tpPrice, slPrice, tpLevels, avgEntryEstimate }
}
