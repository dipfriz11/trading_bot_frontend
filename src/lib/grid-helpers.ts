import type { GridConfig, GridLevel } from "@/types/terminal"

export function generateLevels(cfg: GridConfig): GridLevel[] {
  const { ordersCount, topPrice, bottomPrice, qtyMode, totalQuote, leverage, gridMode, multiplier, defaultResetTpPercent, defaultResetTpClosePercent } = cfg
  if (ordersCount < 1 || topPrice <= bottomPrice) return []

  const count = Math.max(1, Math.round(ordersCount))
  const prices: number[] = []

  if (gridMode === "arithmetic" || gridMode === "custom") {
    const step = (topPrice - bottomPrice) / Math.max(count - 1, 1)
    for (let i = 0; i < count; i++) {
      prices.push(bottomPrice + step * i)
    }
  } else {
    // geometric
    const ratio = Math.pow(topPrice / bottomPrice, 1 / Math.max(count - 1, 1))
    for (let i = 0; i < count; i++) {
      prices.push(bottomPrice * Math.pow(ratio, i))
    }
  }

  // Base qty per level
  const avgPrice = (topPrice + bottomPrice) / 2
  const baseQty = avgPrice > 0 ? (totalQuote * leverage) / (avgPrice * count) : 0

  return prices.map((price, i) => {
    let qty = baseQty
    if (qtyMode === "multiplier") {
      qty = baseQty * Math.pow(multiplier, i)
    } else if (qtyMode === "fixed") {
      const perLevelAmount = totalQuote * leverage / count
      qty = price > 0 ? perLevelAmount / price : 0
    }

    return {
      index: i + 1,
      price: parseFloat(price.toFixed(2)),
      qty: parseFloat(qty.toFixed(6)),
      useResetTp: false,
      resetTpPercent: defaultResetTpPercent,
      resetTpClosePercent: defaultResetTpClosePercent,
    }
  })
}

export interface GridDerivedStats {
  totalLevels: number
  totalQty: number
  totalGridAmount: number
  resetEnabledCount: number
  baseOrderSize: number
}

export function calcDerivedStats(cfg: GridConfig): GridDerivedStats {
  const { levels, totalQuote, leverage, entryPrice } = cfg
  const totalLevels = levels.length
  const totalQty = levels.reduce((s, l) => s + l.qty, 0)
  const totalGridAmount = levels.reduce((s, l) => s + l.qty * l.price, 0)
  const resetEnabledCount = levels.filter((l) => l.useResetTp).length
  const avgPrice = entryPrice > 0 ? entryPrice : (cfg.topPrice + cfg.bottomPrice) / 2
  const baseOrderSize = avgPrice > 0 && totalLevels > 0
    ? (totalQuote * leverage) / (avgPrice * totalLevels)
    : 0

  return { totalLevels, totalQty, totalGridAmount, resetEnabledCount, baseOrderSize }
}

export function exportGridConfig(cfg: GridConfig): string {
  return JSON.stringify(cfg, null, 2)
}
