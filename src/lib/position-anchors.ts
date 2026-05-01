import type { ChartPlacedOrder } from "@/types/terminal"

export interface PositionAnchors {
  firstOrder: number   // closest order to TP direction (long = highest, short = lowest)
  extremeOrder: number // furthest order from entry (long = lowest, short = highest)
  avgEntry: number     // volume-weighted average entry price across all orders
}

// slMode: null = "first order" (default), "extreme_order" = furthest, "avg_entry" = VWAP
export type SlMode = "extreme_order" | "avg_entry" | null

/**
 * Returns the anchor price for SL calculation based on the selected mode.
 * - null (default): firstOrder — same anchor as TP, relative to the first/best entry
 * - "extreme_order": extremeOrder — relative to the furthest order (worst entry)
 * - "avg_entry": avgEntry — volume-weighted average entry price
 */
export function getSlBase(anchors: PositionAnchors, slMode: SlMode): number {
  if (slMode === "avg_entry") return anchors.avgEntry
  if (slMode === "extreme_order") return anchors.extremeOrder
  return anchors.firstOrder
}

/**
 * Computes TP/SL anchor prices from ALL orders in a virtual position.
 * This includes both grid orders and single orders — whatever is in the position.
 * Used in Phase 2 when placing/updating TP/SL relative to the full virtual position.
 */
export function getPositionAnchors(
  orders: Pick<ChartPlacedOrder, "price" | "qty">[],
  side: "long" | "short",
): PositionAnchors | null {
  const active = orders.filter((o) => o.price > 0 && o.qty > 0)
  if (active.length === 0) return null

  const isLong = side === "long"
  const prices = active.map((o) => o.price)

  const firstOrder = isLong ? Math.max(...prices) : Math.min(...prices)
  const extremeOrder = isLong ? Math.min(...prices) : Math.max(...prices)

  const totalQty = active.reduce((s, o) => s + o.qty, 0)
  const avgEntry = active.reduce((s, o) => s + o.price * o.qty, 0) / totalQty

  const result = { firstOrder, extremeOrder, avgEntry }
  console.log("[GET_POSITION_ANCHORS] side:", side, "inputOrders:", active.length, "prices:", prices, "→", result)
  return result
}
