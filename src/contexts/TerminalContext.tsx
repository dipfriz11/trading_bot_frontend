import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react"
import type { TerminalState, Tab, Widget, WidgetType, Theme, WidgetRect, TransparentBgPreset, GlassGraphiteBg, LivePosition, ChartPlacedOrder, ChartDraftOrder } from "@/types/terminal"
import { WIDGET_LABELS, WIDGET_MIN_SIZE } from "@/types/terminal"
import { nanoid } from "@/lib/nanoid"
import { ACCOUNTS } from "@/lib/mock-data"
import { loadPositions, upsertPosition, deletePosition } from "@/lib/persistence"

// ---- Account balance store ----
// key: `${accountId}:${exchangeId}:${marketType}`
type BalanceKey = string
interface BalanceEntry { walletBalance: number; inOrders: number }
type BalanceStore = Record<BalanceKey, BalanceEntry>

function balKey(accountId: string, exchangeId: string, marketType: "spot" | "futures"): BalanceKey {
  return `${accountId}:${exchangeId}:${marketType}`
}

function buildInitialBalances(): BalanceStore {
  const store: BalanceStore = {}
  for (const acc of ACCOUNTS) {
    for (const [exId, markets] of Object.entries(acc.balances)) {
      store[balKey(acc.id, exId, "spot")]    = { ...markets.spot }
      store[balKey(acc.id, exId, "futures")] = { ...markets.futures }
    }
  }
  return store
}

const STORAGE_KEY = "crypto-terminal-v1"
const GRID_ORDERS_KEY = "crypto-terminal-grid-orders-v1"

function loadGridOrders(): GridOrderMap {
  try {
    const raw = localStorage.getItem(GRID_ORDERS_KEY)
    if (raw) return JSON.parse(raw) as GridOrderMap
  } catch {}
  return {}
}

function createDefaultTab(id: string, label: string): Tab {
  return {
    id,
    label,
    widgets: [],
    nextZIndex: 10,
  }
}

function getDefaultState(): TerminalState {
  return {
    tabs: [
      createDefaultTab("tab-1", "Workspace 1"),
      createDefaultTab("tab-2", "Workspace 2"),
    ],
    activeTabId: "tab-1",
    theme: "glass-graphite",
  }
}

function loadState(): TerminalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as TerminalState
      if (parsed.tabs && parsed.activeTabId) return parsed
    }
  } catch {
  }
  return getDefaultState()
}

// ---- Position key — stable identity independent of UI widgets ----
// key: `${accountId}:${exchangeId}:${marketType}:${symbol}`
export type PositionKey = string

export function posKey(
  accountId: string,
  exchangeId: string,
  marketType: "spot" | "futures",
  symbol: string,
  side: "long" | "short",
): PositionKey {
  return `${accountId}:${exchangeId}:${marketType}:${symbol}:${side}`
}

// ---- Grid order bridge types ----

// Preview: visual-only lines, not yet placed. No balance impact.
export interface ChartGridPreview {
  chartId: string
  consoleId: string
  side: "long" | "short"
  orders: Array<{ id: string; price: number; qty: number }>
  tpPrice: number | null
  slPrice: number | null
  tpLevels: number[]
  symbol: string
  leverage: number
  entryPrice?: number
  accountId?: string
  exchangeId?: string
  marketType?: "spot" | "futures"
}

// Placed grid: real orders sent to exchange. Balance locked.
export interface ChartGridOrders {
  chartId: string
  consoleId: string
  side: "long" | "short"
  orders: Array<{ id: string; price: number; qty: number; gridIndex: number }>
  tpPrice: number | null
  slPrice: number | null
  tpLevels: number[]
  symbol: string
  leverage: number
  pendingUpdate: boolean     // config changed after placement — show "Apply" button
  accountId?: string
  exchangeId?: string
  marketType?: "spot" | "futures"
}

// keyed by consoleWidgetId
type PreviewOrderMap = Record<string, ChartGridPreview | undefined>
type GridOrderMap = Record<string, ChartGridOrders | undefined>

// ---- Order bridge types — defined in types/terminal.ts, re-exported here for consumers ----
export type { ChartDraftOrder, ChartPlacedOrder, OrderSource, PositionStatus } from "@/types/terminal"

// draftOrders keyed by chartWidgetId (UI-scoped, intentional)
type DraftOrderMap = Record<string, ChartDraftOrder | undefined>
// livePositions keyed by PositionKey — orders live inside each LivePosition
type PositionsMap = Record<PositionKey, LivePosition>

export interface ChartTpSl {
  tp: number | null
  sl: number | null
}
type TpSlMap = Record<string, ChartTpSl>

interface TerminalContextValue {
  state: TerminalState
  activeTab: Tab | undefined
  setTheme: (theme: Theme) => void
  setTransparentBg: (bg: TransparentBgPreset) => void
  setGgBg: (bg: GlassGraphiteBg) => void
  setCustomBgColor: (color: string | undefined) => void
  addTab: () => void
  removeTab: (tabId: string) => void
  renameTab: (tabId: string, label: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  setActiveTab: (tabId: string) => void
  addWidget: (type: WidgetType, x?: number, y?: number) => void
  removeWidget: (widgetId: string) => void
  updateWidget: (widgetId: string, updates: Partial<Widget>) => void
  bringToFront: (widgetId: string) => void
  updateWidgetRect: (widgetId: string, rect: WidgetRect) => void

  // Chart focus — which chart the order-console is bound to
  activeChartId: string | null
  setActiveChartId: (id: string | null) => void

  // Order bridge — order-console writes here; ChartWidget reads via positions[pk].orders
  draftOrders: DraftOrderMap
  setDraftOrder: (chartId: string, draft: ChartDraftOrder | undefined) => void
  addPlacedOrder: (positionKey: PositionKey, order: ChartPlacedOrder) => void
  removePlacedOrder: (positionKey: PositionKey, orderId: string) => void
  updatePlacedOrderPrice: (positionKey: PositionKey, orderId: string, price: number) => void
  updatePlacedOrder: (positionKey: PositionKey, orderId: string, updates: Partial<ChartPlacedOrder>) => void

  // True while user is dragging an order line on a chart
  isDraggingOrder: boolean
  setIsDraggingOrder: (v: boolean) => void

  // ID of the placed order currently being edited (via drag or form); null = new-order mode
  editingOrderId: string | null
  setEditingOrderId: (id: string | null) => void

  // Live account balances (updated when orders are placed/cancelled)
  getBalance: (accountId: string, exchangeId: string, marketType: "spot" | "futures") => BalanceEntry
  deductOrderBalance: (accountId: string, exchangeId: string, marketType: "spot" | "futures", amount: number) => void
  refundOrderBalance: (accountId: string, exchangeId: string, marketType: "spot" | "futures", amount: number) => void

  // TP/SL per chart
  tpSlOrders: TpSlMap
  setTpSl: (chartId: string, tpSl: Partial<ChartTpSl>) => void
  clearTpSl: (chartId: string) => void

  // Live positions (position manager) — orders live inside each position
  positions: PositionsMap
  openPosition: (pos: Omit<LivePosition, "unrealizedPnl" | "unrealizedPnlPct" | "notional" | "orders" | "status" | "realizedPnl">) => void
  closePosition: (posKey: PositionKey) => void
  partialClosePosition: (posKey: PositionKey, closeSize: number) => void
  updatePositionMark: (posKey: PositionKey, markPrice: number) => void
  // Simulate order fill: marks order as filled, adds qty to realSize, sets position active
  fillOrder: (posKey: PositionKey, orderId: string, fillPrice?: number) => void

  // Grid orders bridge
  previewOrders: PreviewOrderMap
  previewOrdersRef: React.RefObject<PreviewOrderMap>
  gridOrders: GridOrderMap
  gridOrdersRef: React.RefObject<GridOrderMap>
  setGridPreview: (consoleId: string, data: Omit<ChartGridPreview, "consoleId"> | null) => void
  placeGridOrders: (consoleId: string) => void
  cancelGridOrders: (consoleId: string) => void
  cancelGridPreview: (consoleId: string) => void
  applyGridTpSl: (consoleId: string, patch: { tpPrice?: number | null; slPrice?: number | null; tpLevels?: number[] }) => void
  updateGridPreviewPrice: (consoleId: string, orderId: string, newPrice: number) => void
  updateGridPlacedPrice: (consoleId: string, orderId: string, newPrice: number) => void
  markGridPendingUpdate: (consoleId: string) => void
  clearGridPendingUpdate: (consoleId: string) => void
  removeGridTpSl: (consoleId: string, target: "tp" | "sl", tpIndex?: number) => void
  removeGridEntry: (consoleId: string, orderId: string) => void

  // Live prices published by chart widgets (symbol → last close price)
  livePrices: Record<string, number>
  setLivePrice: (symbol: string, price: number) => void
}

const TerminalContext = createContext<TerminalContextValue | null>(null)

export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TerminalState>(loadState)
  const [activeChartId, _setActiveChartId] = useState<string | null>(null)
  const setActiveChartId = _setActiveChartId
  const [draftOrders, setDraftOrders] = useState<DraftOrderMap>({})
  const [isDraggingOrder, setIsDraggingOrder] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [balances, setBalances] = useState<BalanceStore>(buildInitialBalances)
  const [previewOrders, setPreviewOrdersMap] = useState<PreviewOrderMap>({})
  const [gridOrders, setGridOrdersMap] = useState<GridOrderMap>(loadGridOrders)
  const [positions, setPositionsMap] = useState<PositionsMap>({})
  // Stable refs for reading latest state in callbacks without triggering re-renders
  const previewOrdersRef = React.useRef<PreviewOrderMap>({})
  const gridOrdersRef = React.useRef<GridOrderMap>({})
  const positionsRef = React.useRef<PositionsMap>({})
  const balancesRef = React.useRef<BalanceStore>(buildInitialBalances())
  previewOrdersRef.current = previewOrders
  gridOrdersRef.current = gridOrders
  positionsRef.current = positions
  balancesRef.current = balances

  const [tpSlOrders, setTpSlOrders] = useState<TpSlMap>({})
  const [livePrices, setLivePricesMap] = useState<Record<string, number>>({})
  const setLivePrice = useCallback((symbol: string, price: number) => {
    setLivePricesMap((prev) => prev[symbol] === price ? prev : { ...prev, [symbol]: price })
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
    }
  }, [state])

  // Persist gridOrders to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(GRID_ORDERS_KEY, JSON.stringify(gridOrders))
    } catch {}
  }, [gridOrders])

  // Load positions from Supabase on mount
  useEffect(() => {
    loadPositions().then((loaded) => {
      if (Object.keys(loaded).length > 0) {
        setPositionsMap(loaded)
      }
    })
  }, [])

  // Sync positions to Supabase whenever they change
  const prevPositionsRef = useRef<PositionsMap>({})
  useEffect(() => {
    const prev = prevPositionsRef.current
    const curr = positions

    // Upsert changed or new positions
    for (const [pk, pos] of Object.entries(curr)) {
      if (prev[pk] !== pos) {
        upsertPosition(pk, pos)
      }
    }

    // Delete removed positions
    for (const pk of Object.keys(prev)) {
      if (!curr[pk]) {
        deletePosition(pk)
      }
    }

    prevPositionsRef.current = curr
  }, [positions])

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)

  // Auto-select first chart when tab changes or widgets change
  useEffect(() => {
    if (!activeTab) return
    const charts = activeTab.widgets.filter((w) => w.type === "chart")

    if (charts.length === 0) {
      setActiveChartId(null)
      return
    }
    // If current activeChartId is not in this tab, reset to first chart
    if (!charts.find((w) => w.id === activeChartId)) {
      setActiveChartId(charts[0].id)
    }
  }, [activeTab?.id, activeTab?.widgets.length])

  const setTheme = useCallback((theme: Theme) => {
    setState((s) => ({ ...s, theme }))
  }, [])

  const setTransparentBg = useCallback((bg: TransparentBgPreset) => {
    setState((s) => ({ ...s, transparentBg: bg }))
  }, [])

  const setGgBg = useCallback((bg: GlassGraphiteBg) => {
    setState((s) => ({ ...s, ggBg: bg, customBgColor: undefined }))
  }, [])

  const setCustomBgColor = useCallback((color: string | undefined) => {
    setState((s) => ({ ...s, customBgColor: color }))
  }, [])

  const addTab = useCallback(() => {
    const id = nanoid()
    const label = `Workspace ${Date.now().toString().slice(-3)}`
    setState((s) => ({
      ...s,
      tabs: [...s.tabs, createDefaultTab(id, label)],
      activeTabId: id,
    }))
  }, [])

  const removeTab = useCallback((tabId: string) => {
    setState((s) => {
      if (s.tabs.length <= 1) return s
      const newTabs = s.tabs.filter((t) => t.id !== tabId)
      const newActive = s.activeTabId === tabId ? (newTabs[0]?.id ?? "") : s.activeTabId
      return { ...s, tabs: newTabs, activeTabId: newActive }
    })
  }, [])

  const renameTab = useCallback((tabId: string, label: string) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, label } : t)),
    }))
  }, [])

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setState((s) => {
      const tabs = [...s.tabs]
      const [moved] = tabs.splice(fromIndex, 1)
      tabs.splice(toIndex, 0, moved)
      return { ...s, tabs }
    })
  }, [])

  const setActiveTab = useCallback((tabId: string) => {
    setState((s) => ({ ...s, activeTabId: tabId }))
  }, [])

  const addWidget = useCallback((type: WidgetType, x = 40, y = 40) => {
    setState((s) => {
      const tab = s.tabs.find((t) => t.id === s.activeTabId)
      if (!tab) return s
      const minSize = WIDGET_MIN_SIZE[type]
      const widget: Widget = {
        id: nanoid(),
        type,
        title: WIDGET_LABELS[type],
        rect: { x, y, width: Math.max(minSize.width + 80, 380), height: Math.max(minSize.height + 80, 280) },
        zIndex: tab.nextZIndex,
        symbol: "BTC/USDT",
        chartType: "candlestick",
        showOrderBook: false,
        showOrderForm: false,
      }
      return {
        ...s,
        tabs: s.tabs.map((t) =>
          t.id === s.activeTabId
            ? { ...t, widgets: [...t.widgets, widget], nextZIndex: t.nextZIndex + 1 }
            : t
        ),
      }
    })
  }, [])

  const removeWidget = useCallback((widgetId: string) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) =>
        t.id === s.activeTabId
          ? { ...t, widgets: t.widgets.filter((w) => w.id !== widgetId) }
          : t
      ),
    }))
    // Only clean up UI-scoped draft; placed orders are keyed by positionKey and survive widget removal
    setDraftOrders((d) => { const n = { ...d }; delete n[widgetId]; return n })
  }, [])

  const updateWidget = useCallback((widgetId: string, updates: Partial<Widget>) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) =>
        t.id === s.activeTabId
          ? { ...t, widgets: t.widgets.map((w) => (w.id === widgetId ? { ...w, ...updates } : w)) }
          : t
      ),
    }))
  }, [])

  const bringToFront = useCallback((widgetId: string) => {
    setState((s) => {
      const tab = s.tabs.find((t) => t.id === s.activeTabId)
      if (!tab) return s
      const newZ = tab.nextZIndex
      return {
        ...s,
        tabs: s.tabs.map((t) =>
          t.id === s.activeTabId
            ? {
                ...t,
                nextZIndex: t.nextZIndex + 1,
                widgets: t.widgets.map((w) => (w.id === widgetId ? { ...w, zIndex: newZ } : w)),
              }
            : t
        ),
      }
    })
  }, [])

  const updateWidgetRect = useCallback((widgetId: string, rect: WidgetRect) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((t) =>
        t.id === s.activeTabId
          ? { ...t, widgets: t.widgets.map((w) => (w.id === widgetId ? { ...w, rect } : w)) }
          : t
      ),
    }))
  }, [])

  // Balance helpers
  const getBalance = useCallback((accountId: string, exchangeId: string, marketType: "spot" | "futures"): BalanceEntry => {
    return balances[balKey(accountId, exchangeId, marketType)] ?? { walletBalance: 0, inOrders: 0 }
  }, [balances])

  const deductOrderBalance = useCallback((accountId: string, exchangeId: string, marketType: "spot" | "futures", amount: number) => {
    const k = balKey(accountId, exchangeId, marketType)
    setBalances((prev) => {
      const cur = prev[k] ?? { walletBalance: 0, inOrders: 0 }
      return { ...prev, [k]: { walletBalance: cur.walletBalance, inOrders: Math.round((cur.inOrders + amount) * 100) / 100 } }
    })
  }, [])

  const refundOrderBalance = useCallback((accountId: string, exchangeId: string, marketType: "spot" | "futures", amount: number) => {
    const k = balKey(accountId, exchangeId, marketType)
    setBalances((prev) => {
      const cur = prev[k] ?? { walletBalance: 0, inOrders: 0 }
      return { ...prev, [k]: { walletBalance: cur.walletBalance, inOrders: Math.max(0, Math.round((cur.inOrders - amount) * 100) / 100) } }
    })
  }, [])

  // Order bridge setters — orders live inside positions[pk].orders
  const setDraftOrder = useCallback((chartId: string, draft: ChartDraftOrder | undefined) => {
    setDraftOrders((prev) => ({ ...prev, [chartId]: draft }))
  }, [])

  const addPlacedOrder = useCallback((positionKey: PositionKey, order: ChartPlacedOrder) => {
    setPositionsMap((prev) => {
      const pos = prev[positionKey]
      if (!pos) return prev
      return { ...prev, [positionKey]: { ...pos, orders: [...pos.orders, order] } }
    })
  }, [])

  const removePlacedOrder = useCallback((positionKey: PositionKey, orderId: string) => {
    const pos = positionsRef.current[positionKey]
    if (!pos) return
    const removed = pos.orders.find((o) => o.id === orderId)

    setPositionsMap((prev) => {
      const p = prev[positionKey]
      if (!p) return prev
      return { ...prev, [positionKey]: { ...p, orders: p.orders.filter((o) => o.id !== orderId) } }
    })

    // Sync grid overlay when a grid order is cancelled individually
    if (removed?.source === "grid" && removed.gridConsoleId) {
      const consoleId = removed.gridConsoleId
      const prevGrid = gridOrdersRef.current
      const entry = prevGrid[consoleId]
      if (entry) {
        const orders = entry.orders.filter((o) => o.id !== orderId)
        if (orders.length === 0) {
          const n = { ...prevGrid }
          delete n[consoleId]
          setGridOrdersMap(n)
        } else {
          setGridOrdersMap({ ...prevGrid, [consoleId]: { ...entry, orders } })
        }
      }

      if (removed.accountId && removed.exchangeId && removed.marketType && removed.margin != null) {
        const k = balKey(removed.accountId, removed.exchangeId, removed.marketType)
        const b = balancesRef.current
        const cur = b[k] ?? { walletBalance: 0, inOrders: 0 }
        const newInOrders = Math.max(0, Math.round((cur.inOrders - removed.margin) * 100) / 100)
        setBalances({ ...b, [k]: { walletBalance: cur.walletBalance, inOrders: newInOrders } })
      }
    }
  }, [])

  const updatePlacedOrderPrice = useCallback((positionKey: PositionKey, orderId: string, price: number) => {
    const pos = positionsRef.current[positionKey]
    if (!pos) return
    const order = pos.orders.find((o) => o.id === orderId)
    if (!order) return

    const newNotional = order.qty * price
    const newMargin = order.marketType === "futures" && order.leverage
      ? newNotional / order.leverage
      : newNotional

    setPositionsMap((prev) => {
      const p = prev[positionKey]
      if (!p) return prev
      const updatedOrders = p.orders.map((o) => o.id === orderId ? { ...o, price, margin: newMargin } : o)
      return { ...prev, [positionKey]: { ...p, orders: updatedOrders } }
    })

    if (order.accountId && order.exchangeId && order.marketType) {
      const k = balKey(order.accountId, order.exchangeId, order.marketType)
      // Recalculate total inOrders from all positions
      setPositionsMap((prev) => {
        const totalInOrders = Object.values(prev)
          .flatMap((p) => p.orders)
          .filter((o) => o.accountId === order.accountId && o.exchangeId === order.exchangeId && o.marketType === order.marketType && o.margin != null)
          .reduce((sum, o) => sum + (o.margin ?? 0), 0)
        const b = balancesRef.current
        const cur = b[k] ?? { walletBalance: 0, inOrders: 0 }
        setBalances({ ...b, [k]: { walletBalance: cur.walletBalance, inOrders: Math.round(totalInOrders * 100) / 100 } })
        return prev
      })
    }
  }, [])

  const updatePlacedOrder = useCallback((positionKey: PositionKey, orderId: string, updates: Partial<ChartPlacedOrder>) => {
    setPositionsMap((prev) => {
      const p = prev[positionKey]
      if (!p) return prev
      return { ...prev, [positionKey]: { ...p, orders: p.orders.map((o) => o.id === orderId ? { ...o, ...updates } : o) } }
    })
  }, [])

  // ── Position Manager ─────────────────────────────────────────────────────────

  const openPosition = useCallback((pos: Omit<LivePosition, "unrealizedPnl" | "unrealizedPnlPct" | "notional" | "orders" | "status" | "realizedPnl">) => {
    const pk = posKey(pos.accountId, pos.exchangeId, pos.marketType, pos.symbol, pos.side)
    setPositionsMap((prev) => {
      const existing = prev[pk]
      if (existing) {
        // Merge into existing position (add to size, recalculate avg entry)
        const totalSize = existing.size + pos.size
        const newAvgEntry = (existing.avgEntry * existing.size + pos.avgEntry * pos.size) / totalSize
        const notional = totalSize * newAvgEntry
        const rawPnl = pos.side === "long"
          ? (pos.markPrice - newAvgEntry) * totalSize
          : (newAvgEntry - pos.markPrice) * totalSize
        const pnlPct = (rawPnl / notional) * pos.leverage * 100
        return {
          ...prev,
          [pk]: {
            ...existing,
            size: totalSize,
            avgEntry: newAvgEntry,
            notional,
            unrealizedPnl: rawPnl,
            unrealizedPnlPct: pnlPct,
            markPrice: pos.markPrice,
          },
        }
      }
      const notional = pos.size * pos.avgEntry
      const rawPnl = pos.side === "long"
        ? (pos.markPrice - pos.avgEntry) * pos.size
        : (pos.avgEntry - pos.markPrice) * pos.size
      const pnlPct = (rawPnl / notional) * pos.leverage * 100
      const now = new Date()
      const dd = String(now.getDate()).padStart(2, "0")
      const mm = String(now.getMonth() + 1).padStart(2, "0")
      return {
        ...prev,
        [pk]: {
          ...pos,
          notional,
          unrealizedPnl: rawPnl,
          unrealizedPnlPct: pnlPct,
          orders: [],
          status: "pending",
          realizedPnl: 0,
          realSize: pos.realSize ?? 0,
          marginMode: pos.marginMode ?? "cross",
          shortId: pos.shortId || String(Math.floor(Math.random() * 9000000) + 1000000),
          openedDate: pos.openedDate || `${dd}.${mm}`,
        },
      }
    })
  }, [])

  const closePosition = useCallback((pk: PositionKey) => {
    // Clean up any grid entries (including empty ones left by fillOrder) for this position
    const pos = positionsRef.current[pk]
    if (pos) {
      const consoleIds = new Set(pos.orders.map((o) => o.gridConsoleId).filter(Boolean) as string[])
      if (pos.sourceConsoleId) consoleIds.add(pos.sourceConsoleId)
      if (consoleIds.size > 0) {
        setGridOrdersMap((prev) => {
          const n = { ...prev }
          for (const cid of consoleIds) delete n[cid]
          return n
        })
      }
    }
    setPositionsMap((prev) => {
      const n = { ...prev }
      delete n[pk]
      return n
    })
  }, [])

  const partialClosePosition = useCallback((pk: PositionKey, closeSize: number) => {
    setPositionsMap((prev) => {
      const pos = prev[pk]
      if (!pos) return prev
      const newSize = Math.max(0, pos.size - closeSize)
      if (newSize === 0) {
        const n = { ...prev }
        delete n[pk]
        return n
      }
      const notional = newSize * pos.avgEntry
      const rawPnl = pos.side === "long"
        ? (pos.markPrice - pos.avgEntry) * newSize
        : (pos.avgEntry - pos.markPrice) * newSize
      const pnlPct = (rawPnl / notional) * pos.leverage * 100
      return { ...prev, [pk]: { ...pos, size: newSize, notional, unrealizedPnl: rawPnl, unrealizedPnlPct: pnlPct } }
    })
  }, [])

  const updatePositionMark = useCallback((pk: PositionKey, markPrice: number) => {
    setPositionsMap((prev) => {
      const pos = prev[pk]
      if (!pos) return prev
      const rawPnl = pos.side === "long"
        ? (markPrice - pos.avgEntry) * pos.size
        : (pos.avgEntry - markPrice) * pos.size
      const pnlPct = (rawPnl / pos.notional) * pos.leverage * 100
      return { ...prev, [pk]: { ...pos, markPrice, unrealizedPnl: rawPnl, unrealizedPnlPct: pnlPct } }
    })
  }, [])

  const fillOrder = useCallback((pk: PositionKey, orderId: string, fillPrice?: number) => {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, "0")
    const min = String(now.getMinutes()).padStart(2, "0")
    const ss = String(now.getSeconds()).padStart(2, "0")
    const dd = String(now.getDate()).padStart(2, "0")
    const mm = String(now.getMonth() + 1).padStart(2, "0")
    const filledAt = `${hh}:${min}:${ss} ${dd}.${mm}`

    // Find order first to remove from gridOrders outside the positions updater
    const currentPos = positionsRef.current[pk]
    const targetOrder = currentPos?.orders.find((o) => o.id === orderId)
    if (targetOrder?.gridConsoleId && targetOrder.status !== "filled") {
      const cid = targetOrder.gridConsoleId
      setGridOrdersMap((gPrev) => {
        const grid = gPrev[cid]
        if (!grid) return gPrev
        const remaining = grid.orders.filter((o) => o.id !== orderId)
        // Keep the grid entry even with empty orders so cancelGridOrders can still find it
        return { ...gPrev, [cid]: { ...grid, orders: remaining } }
      })
    }

    setPositionsMap((prev) => {
      const pos = prev[pk]
      if (!pos) return prev

      const order = pos.orders.find((o) => o.id === orderId)
      if (!order || order.status === "filled") return prev

      const price = fillPrice ?? order.price
      const qty = order.qty

      // Recalculate avg entry with this fill
      const prevRealSize = pos.realSize ?? 0
      const newRealSize = prevRealSize + qty
      const newAvgEntry = prevRealSize > 0
        ? (pos.avgEntry * prevRealSize + price * qty) / newRealSize
        : price

      const notional = pos.size * newAvgEntry
      const rawPnl = pos.side === "long"
        ? (pos.markPrice - newAvgEntry) * pos.size
        : (newAvgEntry - pos.markPrice) * pos.size
      const pnlPct = notional > 0 ? (rawPnl / notional) * pos.leverage * 100 : 0

      const updatedOrders = pos.orders.map((o) =>
        o.id === orderId
          ? { ...o, status: "filled" as const, filledAt, filledPct: 100, price }
          : o
      )

      return {
        ...prev,
        [pk]: {
          ...pos,
          realSize: newRealSize,
          avgEntry: newAvgEntry,
          notional,
          unrealizedPnl: rawPnl,
          unrealizedPnlPct: pnlPct,
          status: "active",
          orders: updatedOrders,
        },
      }
    })
  }, [])

  const setGridPreview = useCallback((consoleId: string, data: Omit<ChartGridPreview, "consoleId"> | null) => {
    // If grid is already placed, just mark it as pending update — don't overwrite preview
    const placedEntry = gridOrdersRef.current[consoleId]
    if (placedEntry) {
      if (!placedEntry.pendingUpdate) {
        setGridOrdersMap((prev) => {
          const entry = prev[consoleId]
          if (!entry || entry.pendingUpdate) return prev
          return { ...prev, [consoleId]: { ...entry, pendingUpdate: true } }
        })
      }
      // Still update previewOrders so the form reflects new config
    }

    setPreviewOrdersMap((prev) => {
      if (data === null) {
        if (!prev[consoleId]) return prev
        const n = { ...prev }
        delete n[consoleId]
        return n
      }
      const existing = prev[consoleId]
      // Stable check: avoid re-render if nothing meaningful changed
      if (existing) {
        const ordersMatch = existing.orders.length === data.orders.length &&
          existing.orders.every((o, i) => o.id === data.orders[i].id && o.price === data.orders[i].price && o.qty === data.orders[i].qty)
        const tpLevelsMatch = (existing.tpLevels?.length ?? 0) === (data.tpLevels?.length ?? 0) &&
          (existing.tpLevels ?? []).every((v, i) => v === (data.tpLevels ?? [])[i])
        if (
          ordersMatch &&
          tpLevelsMatch &&
          existing.chartId === data.chartId &&
          existing.tpPrice === data.tpPrice &&
          existing.slPrice === data.slPrice &&
          existing.symbol === data.symbol &&
          existing.side === data.side &&
          existing.leverage === data.leverage
        ) {
          return prev
        }
      }
      return { ...prev, [consoleId]: { ...data, consoleId } }
    })
  }, [])

  const placeGridOrders = useCallback((consoleId: string) => {
    const preview = previewOrdersRef.current[consoleId]
    if (!preview) return

    const ordersWithIndex = preview.orders.map((o, i) => ({ ...o, gridIndex: i + 1 }))
    // Move from preview → placed grid
    setGridOrdersMap((prev) => ({
      ...prev,
      [consoleId]: { ...preview, orders: ordersWithIndex, pendingUpdate: false },
    }))
    // Clear preview now that it's been placed
    setPreviewOrdersMap((prev) => {
      const n = { ...prev }
      delete n[consoleId]
      return n
    })

    const entry = preview

    if (entry.accountId && entry.exchangeId && entry.marketType) {
      const now = new Date()
      const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
        .map((n) => String(n).padStart(2, "0")).join(":")
      const side: "buy" | "sell" = entry.side === "long" ? "buy" : "sell"

      const newOrders: ChartPlacedOrder[] = entry.orders.map((o, i) => {
        const notional = o.price * o.qty
        const margin = entry.marketType === "futures" && entry.leverage
          ? notional / entry.leverage
          : notional
        return {
          id: o.id,
          side,
          price: o.price,
          qty: o.qty,
          orderType: "limit" as const,
          isDraft: false,
          symbol: entry.symbol,
          accountId: entry.accountId,
          exchangeId: entry.exchangeId,
          marketType: entry.marketType,
          leverage: entry.leverage,
          margin,
          time,
          status: "pending" as const,
          source: "grid" as const,
          gridIndex: i + 1,
          gridConsoleId: consoleId,
        }
      })

      const k = balKey(entry.accountId, entry.exchangeId, entry.marketType as "spot" | "futures")
      const posPk = posKey(entry.accountId, entry.exchangeId, entry.marketType as "spot" | "futures", entry.symbol, entry.side)

      // Virtual position — exists as soon as grid orders are placed, before any fill
      const totalQty = entry.orders.reduce((s, o) => s + o.qty, 0)
      const weightedAvg = totalQty > 0
        ? entry.orders.reduce((s, o) => s + o.price * o.qty, 0) / totalQty
        : (entry.orders[0]?.price ?? 0)

      setPositionsMap((prevPos) => {
        const existing = prevPos[posPk]
        if (existing) {
          // Merge — replace grid orders for this console, keep rest
          const withoutOld = existing.orders.filter((o) => o.gridConsoleId !== consoleId)
          const mergedOrders = [...withoutOld, ...newOrders]
          const newSize = totalQty
          const newAvg = weightedAvg
          const notional = newSize * newAvg
          const markPx = existing.markPrice
          const rawPnl = entry.side === "long"
            ? (markPx - newAvg) * newSize
            : (newAvg - markPx) * newSize
          const pnlPct = notional > 0 ? (rawPnl / notional) * entry.leverage * 100 : 0
          return {
            ...prevPos,
            [posPk]: { ...existing, size: newSize, avgEntry: newAvg, notional, unrealizedPnl: rawPnl, unrealizedPnlPct: pnlPct, orders: mergedOrders },
          }
        }
        const notional = totalQty * weightedAvg
        const nowD = new Date()
        const dd = String(nowD.getDate()).padStart(2, "0")
        const mmD = String(nowD.getMonth() + 1).padStart(2, "0")
        return {
          ...prevPos,
          [posPk]: {
            accountId: entry.accountId!,
            exchangeId: entry.exchangeId!,
            marketType: entry.marketType as "spot" | "futures",
            symbol: entry.symbol,
            side: entry.side,
            size: totalQty,
            realSize: 0,
            avgEntry: weightedAvg,
            leverage: entry.leverage,
            marginMode: "cross" as const,
            markPrice: weightedAvg,
            notional,
            unrealizedPnl: 0,
            unrealizedPnlPct: 0,
            openedAt: time,
            openedDate: `${dd}.${mmD}`,
            shortId: String(Math.floor(Math.random() * 9000000) + 1000000),
            orders: newOrders,
            status: "pending",
            realizedPnl: 0,
            sourceConsoleId: consoleId,
          },
        }
      })

      // Auto-fill orders that cross the market price (negative first offset scenario)
      // For LONG (buy): order placed at or above current price → fills immediately
      // For SHORT (sell): order placed at or below current price → fills immediately
      const marketPrice = entry.entryPrice ?? weightedAvg
      const autoFillOrders = newOrders.filter((o) =>
        entry.side === "long" ? o.price >= marketPrice : o.price <= marketPrice,
      )
      if (autoFillOrders.length > 0) {
        setTimeout(() => {
          for (const o of autoFillOrders) {
            fillOrder(posPk, o.id, o.price)
          }
        }, 0)
      }

      // Update balance inOrders from positions
      setPositionsMap((prev) => {
        const totalInOrders = Object.values(prev)
          .flatMap((p) => p.orders)
          .filter((o) => o.accountId === entry.accountId && o.exchangeId === entry.exchangeId && o.marketType === entry.marketType && o.margin != null)
          .reduce((sum, o) => sum + (o.margin ?? 0), 0)
        const b = balancesRef.current
        const cur = b[k] ?? { walletBalance: 0, inOrders: 0 }
        setBalances({ ...b, [k]: { walletBalance: cur.walletBalance, inOrders: Math.round(totalInOrders * 100) / 100 } })
        return prev
      })
    }
  }, [])

  const cancelGridOrders = useCallback((consoleId: string) => {
    const prev = gridOrdersRef.current
    const entry = prev[consoleId]
    const n = { ...prev }
    delete n[consoleId]
    setGridOrdersMap(n)

    if (entry && entry.accountId && entry.exchangeId && entry.marketType) {
      const k = balKey(entry.accountId, entry.exchangeId, entry.marketType as "spot" | "futures")
      const cancelPk = posKey(entry.accountId, entry.exchangeId, entry.marketType as "spot" | "futures", entry.symbol, entry.side)

      // Remove grid orders from position, then recalc balance
      setPositionsMap((prev) => {
        const pos = prev[cancelPk]
        if (!pos) return prev
        const remainingOrders = pos.orders.filter((o) => o.gridConsoleId !== consoleId)
        // If no orders remain, delete the position entirely
        if (remainingOrders.length === 0) {
          const n = { ...prev }
          delete n[cancelPk]
          return n
        }
        return { ...prev, [cancelPk]: { ...pos, orders: remainingOrders } }
      })

      // Recalc inOrders from remaining positions
      setPositionsMap((prev) => {
        const totalInOrders = Object.values(prev)
          .flatMap((p) => p.orders)
          .filter((o) => o.accountId === entry.accountId && o.exchangeId === entry.exchangeId && o.marketType === entry.marketType && o.margin != null)
          .reduce((sum, o) => sum + (o.margin ?? 0), 0)
        const b = balancesRef.current
        const cur = b[k] ?? { walletBalance: 0, inOrders: 0 }
        setBalances({ ...b, [k]: { walletBalance: cur.walletBalance, inOrders: Math.max(0, Math.round(totalInOrders * 100) / 100) } })
        return prev
      })
    }
  }, [])

  const cancelGridPreview = useCallback((consoleId: string) => {
    setPreviewOrdersMap((prev) => {
      if (!prev[consoleId]) return prev
      const n = { ...prev }
      delete n[consoleId]
      return n
    })
  }, [])

  const updateGridPreviewPrice = useCallback((consoleId: string, orderId: string, newPrice: number) => {
    setPreviewOrdersMap((prev) => {
      const entry = prev[consoleId]
      if (!entry) return prev
      const orders = entry.orders.map((o) => o.id === orderId ? { ...o, price: newPrice } : o)
      return { ...prev, [consoleId]: { ...entry, orders } }
    })
  }, [])

  const updateGridPlacedPrice = useCallback((consoleId: string, orderId: string, newPrice: number) => {
    setGridOrdersMap((prev) => {
      const entry = prev[consoleId]
      if (!entry) return prev
      const orders = entry.orders.map((o) => o.id === orderId ? { ...o, price: newPrice } : o)
      return { ...prev, [consoleId]: { ...entry, orders } }
    })
    setPositionsMap((prev) => {
      const result: PositionsMap = {}
      for (const [pk, pos] of Object.entries(prev)) {
        result[pk] = {
          ...pos,
          orders: pos.orders.map((o) =>
            o.id === orderId && o.source === "grid" && o.gridConsoleId === consoleId
              ? { ...o, price: newPrice }
              : o
          ),
        }
      }
      return result
    })
  }, [])

  const removeGridEntry = useCallback((consoleId: string, orderId: string) => {
    // Remove from positions[pk].orders and refund balance
    setPositionsMap((prev) => {
      let removedOrder: ChartPlacedOrder | undefined
      const result: PositionsMap = {}
      for (const [pk, pos] of Object.entries(prev)) {
        if (!removedOrder) removedOrder = pos.orders.find((o) => o.id === orderId && o.source === "grid")
        result[pk] = { ...pos, orders: pos.orders.filter((o) => o.id !== orderId) }
      }
      if (removedOrder?.accountId && removedOrder.exchangeId && removedOrder.marketType && removedOrder.margin != null) {
        const k = balKey(removedOrder.accountId, removedOrder.exchangeId, removedOrder.marketType)
        setBalances((b) => {
          const cur = b[k] ?? { walletBalance: 0, inOrders: 0 }
          const newInOrders = Math.max(0, Math.round((cur.inOrders - removedOrder!.margin!) * 100) / 100)
          return { ...b, [k]: { walletBalance: cur.walletBalance, inOrders: newInOrders } }
        })
      }
      return result
    })

    // Remove from grid overlay
    setGridOrdersMap((prev) => {
      const entry = prev[consoleId]
      if (!entry) return prev
      const orders = entry.orders.filter((o) => o.id !== orderId)
      if (orders.length === 0) {
        const n = { ...prev }
        delete n[consoleId]
        return n
      }
      return { ...prev, [consoleId]: { ...entry, orders } }
    })
  }, [setBalances])

  const removeGridTpSl = useCallback((consoleId: string, target: "tp" | "sl", tpIndex?: number) => {
    setGridOrdersMap((prev) => {
      const entry = prev[consoleId]
      if (!entry) return prev
      if (target === "tp") {
        if (tpIndex !== undefined) {
          // Remove a single TP level by index
          const newLevels = entry.tpLevels.filter((_, i) => i !== tpIndex)
          const newTpPrice = newLevels.length > 0 ? newLevels[0] : null
          return { ...prev, [consoleId]: { ...entry, tpPrice: newTpPrice, tpLevels: newLevels } }
        }
        return { ...prev, [consoleId]: { ...entry, tpPrice: null, tpLevels: [] } }
      }
      return { ...prev, [consoleId]: { ...entry, slPrice: null } }
    })
  }, [])

  // Directly patch TP/SL on a placed grid without marking pendingUpdate
  const applyGridTpSl = useCallback((consoleId: string, patch: { tpPrice?: number | null; slPrice?: number | null; tpLevels?: number[] }) => {
    setGridOrdersMap((prev) => {
      const entry = prev[consoleId]
      if (!entry) return prev
      return { ...prev, [consoleId]: { ...entry, ...patch } }
    })
    // Also update preview so drag-sync works when grid is not yet placed
    setPreviewOrdersMap((prev) => {
      const entry = prev[consoleId]
      if (!entry) return prev
      return { ...prev, [consoleId]: { ...entry, ...patch } }
    })
  }, [])

  const setTpSl = useCallback((chartId: string, patch: Partial<ChartTpSl>) => {
    setTpSlOrders((prev) => {
      const existing: ChartTpSl = prev[chartId] ?? { tp: null, sl: null }
      return { ...prev, [chartId]: { ...existing, ...patch } }
    })
  }, [])

  const clearTpSl = useCallback((chartId: string) => {
    setTpSlOrders((prev) => {
      const n = { ...prev }
      delete n[chartId]
      return n
    })
  }, [])

  const markGridPendingUpdate = useCallback((consoleId: string) => {
    if (import.meta.env.DEV) console.warn("[markGridPendingUpdate]", consoleId, new Error().stack?.split("\n").slice(1, 5).join(" | "))
    setGridOrdersMap((prev) => {
      const entry = prev[consoleId]
      if (!entry || entry.pendingUpdate) return prev
      return { ...prev, [consoleId]: { ...entry, pendingUpdate: true } }
    })
  }, [])

  const clearGridPendingUpdate = useCallback((consoleId: string) => {
    setGridOrdersMap((prev) => {
      const entry = prev[consoleId]
      if (!entry || !entry.pendingUpdate) return prev
      return { ...prev, [consoleId]: { ...entry, pendingUpdate: false } }
    })
  }, [])

  return (
    <TerminalContext.Provider
      value={{
        state,
        activeTab,
        setTheme,
        setTransparentBg,
        setGgBg,
        setCustomBgColor,
        addTab,
        removeTab,
        renameTab,
        reorderTabs,
        setActiveTab,
        addWidget,
        removeWidget,
        updateWidget,
        bringToFront,
        updateWidgetRect,
        activeChartId,
        setActiveChartId,
        draftOrders,
        setDraftOrder,
        addPlacedOrder,
        removePlacedOrder,
        updatePlacedOrderPrice,
        updatePlacedOrder,
        isDraggingOrder,
        setIsDraggingOrder,
        editingOrderId,
        setEditingOrderId,
        getBalance,
        deductOrderBalance,
        refundOrderBalance,
        tpSlOrders,
        setTpSl,
        clearTpSl,
        positions,
        openPosition,
        closePosition,
        partialClosePosition,
        updatePositionMark,
        fillOrder,
        previewOrders,
        previewOrdersRef,
        gridOrders,
        gridOrdersRef,
        setGridPreview,
        placeGridOrders,
        cancelGridOrders,
        cancelGridPreview,
        applyGridTpSl,
        updateGridPreviewPrice,
        updateGridPlacedPrice,
        markGridPendingUpdate,
        clearGridPendingUpdate,
        removeGridTpSl,
        removeGridEntry,
        livePrices,
        setLivePrice,
      }}
    >
      {children}
    </TerminalContext.Provider>
  )
}

export function useTerminal() {
  const ctx = useContext(TerminalContext)
  if (!ctx) throw new Error("useTerminal must be used within TerminalProvider")
  return ctx
}

// Subscribe to a single grid entry — returns placed grid or undefined
export function useGridOrderEntry(consoleId: string): ChartGridOrders | undefined {
  const ctx = useContext(TerminalContext)
  if (!ctx) throw new Error("useGridOrderEntry must be used within TerminalProvider")
  return ctx.gridOrders[consoleId]
}

// Subscribe to a single preview entry — returns preview or undefined
export function useGridPreviewEntry(consoleId: string): ChartGridPreview | undefined {
  const ctx = useContext(TerminalContext)
  if (!ctx) throw new Error("useGridPreviewEntry must be used within TerminalProvider")
  return ctx.previewOrders[consoleId]
}
