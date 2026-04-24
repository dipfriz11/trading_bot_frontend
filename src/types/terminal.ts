export type Theme = "terminal" | "cosmic" | "slate" | "transparent"

export type TransparentBgPreset = "midnight" | "navy" | "forest" | "wine" | "slate" | "grey" | "lightgrey" | "steelblue"

export type WidgetType =
  | "chart"
  | "orderbook"
  | "trades"
  | "portfolio"
  | "screener"
  | "pnl"
  | "alerts"
  | "order-console"
  | "news"

export interface WidgetRect {
  x: number
  y: number
  width: number
  height: number
}

export interface Widget {
  id: string
  type: WidgetType
  title: string
  rect: WidgetRect
  prevRect?: WidgetRect
  zIndex: number
  symbol?: string
  chartType?: "candlestick" | "line"
  showOrderBook?: boolean
  showOrderForm?: boolean
  marketType?: "spot" | "futures"
  futuresSide?: "long" | "short"
  accountId?: string
  exchangeId?: string
}

export interface Tab {
  id: string
  label: string
  widgets: Widget[]
  nextZIndex: number
}

export interface TerminalState {
  tabs: Tab[]
  activeTabId: string
  theme: Theme
  transparentBg?: TransparentBgPreset
}

export type ResizeHandle =
  | "n" | "s" | "e" | "w"
  | "ne" | "nw" | "se" | "sw"

export interface DragState {
  widgetId: string
  startX: number
  startY: number
  startRect: WidgetRect
  type: "move" | "resize"
  handle?: ResizeHandle
}

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface OrderBookEntry {
  price: number
  size: number
  total: number
}

export interface Trade {
  id: string
  price: number
  size: number
  side: "buy" | "sell"
  time: string
}

export interface Position {
  symbol: string
  side: "long" | "short"
  size: number
  entryPrice: number
  markPrice: number
  pnl: number
  pnlPct: number
  leverage: number
}

export interface Alert {
  id: string
  symbol: string
  condition: "above" | "below"
  price: number
  active: boolean
  triggered: boolean
  createdAt: string
}

export interface NewsItem {
  id: string
  headline: string
  source: string
  sentiment: "positive" | "negative" | "neutral"
  time: string
  symbols: string[]
}

export interface ScreenerRow {
  symbol: string
  price: number
  change: number
  changePct: number
  volume: number
  marketCap: number
  high24h: number
  low24h: number
}

// ---- Grid Order Types ----

export type GridMode = "arithmetic" | "geometric" | "custom"
export type QtyMode = "fixed" | "multiplier" | "custom"
export type TpUpdateMode = "fixed" | "reprice"

export interface GridLevel {
  index: number
  price: number
  qty: number
  useResetTp: boolean
  resetTpPercent: number
  resetTpClosePercent: number
}

export interface GridConfig {
  // General
  enabled: boolean
  symbol: string
  side: "long" | "short"
  ordersCount: number
  entryPrice: number
  topPrice: number
  bottomPrice: number
  totalQuote: number
  leverage: number
  qtyMode: QtyMode

  // Level logic
  gridMode: GridMode
  stepPercent: number
  multiplier: number

  // TP/SL
  tpPercent: number
  slPercent: number
  tpUpdateMode: TpUpdateMode
  trailingEnabled: boolean
  trailingStepPercent: number

  // Reset TP
  resetTpEnabled: boolean
  defaultResetTpPercent: number
  defaultResetTpClosePercent: number

  // Generated levels
  levels: GridLevel[]
}

export const DEFAULT_GRID_CONFIG: GridConfig = {
  enabled: false,
  symbol: "BTC/USDT",
  side: "long",
  ordersCount: 5,
  entryPrice: 67500,
  topPrice: 70000,
  bottomPrice: 65000,
  totalQuote: 1000,
  leverage: 5,
  qtyMode: "fixed",
  gridMode: "arithmetic",
  stepPercent: 1,
  multiplier: 1.1,
  tpPercent: 3,
  slPercent: 5,
  tpUpdateMode: "fixed",
  trailingEnabled: false,
  trailingStepPercent: 0.5,
  resetTpEnabled: false,
  defaultResetTpPercent: 1.5,
  defaultResetTpClosePercent: 50,
  levels: [],
}

export const WIDGET_LABELS: Record<WidgetType, string> = {
  chart: "Price Chart",
  orderbook: "Order Book",
  trades: "Trades Feed",
  portfolio: "Portfolio / Positions",
  screener: "Asset Screener",
  pnl: "P&L Statistics",
  alerts: "Alerts",
  "order-console": "Order Console",
  news: "News",
}

export const WIDGET_MIN_SIZE: Record<WidgetType, { width: number; height: number }> = {
  chart: { width: 280, height: 200 },
  orderbook: { width: 200, height: 200 },
  trades: { width: 200, height: 150 },
  portfolio: { width: 300, height: 150 },
  screener: { width: 340, height: 200 },
  pnl: { width: 240, height: 150 },
  alerts: { width: 220, height: 150 },
  "order-console": { width: 240, height: 250 },
  news: { width: 260, height: 150 },
}
