import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import type { TerminalState, Tab, Widget, WidgetType, Theme, WidgetRect, TransparentBgPreset, GlassGraphiteBg } from "@/types/terminal"
import { WIDGET_LABELS, WIDGET_MIN_SIZE } from "@/types/terminal"
import { nanoid } from "@/lib/nanoid"
import { ACCOUNTS } from "@/lib/mock-data"

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

// ---- Grid order bridge types ----

export type GridOrderState = "preview" | "placed"

export interface ChartGridOrders {
  chartId: string
  consoleId: string          // which order-console widget owns this
  state: GridOrderState
  side: "long" | "short"
  orders: Array<{ id: string; price: number; qty: number }>
  tpPrice: number | null
  slPrice: number | null
  tpLevels: number[]
  symbol: string
  leverage: number
  pendingUpdate: boolean     // config changed after placement — show "Apply" button
}

// keyed by consoleWidgetId
type GridOrderMap = Record<string, ChartGridOrders | undefined>

// ---- Order bridge types ----

export interface ChartDraftOrder {
  side: "buy" | "sell"
  price: number
  qty: number
  orderType: "limit" | "market"
}

export interface ChartPlacedOrder {
  id: string
  side: "buy" | "sell"
  price: number
  qty: number
  orderType: "limit" | "market"
  isDraft?: boolean
  // Order metadata for display
  symbol?: string
  accountId?: string
  exchangeId?: string
  marketType?: "spot" | "futures"
  leverage?: number
  margin?: number   // actual margin locked (notional / leverage)
  time?: string
  status?: "pending" | "filled" | "cancelled"
}

// keyed by chartWidgetId
type DraftOrderMap = Record<string, ChartDraftOrder | undefined>
type PlacedOrderMap = Record<string, ChartPlacedOrder[]>

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

  // Order bridge — order-console writes here; ChartWidget reads
  draftOrders: DraftOrderMap
  placedOrders: PlacedOrderMap
  setDraftOrder: (chartId: string, draft: ChartDraftOrder | undefined) => void
  addPlacedOrder: (chartId: string, order: ChartPlacedOrder) => void
  removePlacedOrder: (chartId: string, orderId: string) => void
  updatePlacedOrderPrice: (chartId: string, orderId: string, price: number) => void
  updatePlacedOrder: (chartId: string, orderId: string, updates: Partial<ChartPlacedOrder>) => void

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

  // Grid orders bridge
  gridOrders: GridOrderMap
  setGridPreview: (consoleId: string, data: Omit<ChartGridOrders, "state" | "pendingUpdate"> | null) => void
  placeGridOrders: (consoleId: string) => void
  cancelGridOrders: (consoleId: string) => void
  cancelGridPreview: (consoleId: string) => void
  applyGridTpSl: (consoleId: string, patch: { tpPrice?: number | null; slPrice?: number | null; tpLevels?: number[] }) => void
  updateGridPreviewPrice: (consoleId: string, orderId: string, newPrice: number) => void
  markGridPendingUpdate: (consoleId: string) => void
  removeGridTpSl: (consoleId: string, target: "tp" | "sl", tpIndex?: number) => void
  removeGridEntry: (consoleId: string, orderId: string) => void
}

const TerminalContext = createContext<TerminalContextValue | null>(null)

export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TerminalState>(loadState)
  const [activeChartId, setActiveChartId] = useState<string | null>(null)
  const [draftOrders, setDraftOrders] = useState<DraftOrderMap>({})
  const [placedOrders, setPlacedOrdersMap] = useState<PlacedOrderMap>({})
  const [isDraggingOrder, setIsDraggingOrder] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [balances, setBalances] = useState<BalanceStore>(buildInitialBalances)
  const [gridOrders, setGridOrdersMap] = useState<GridOrderMap>({})

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
    }
  }, [state])

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
    // Clean up order data
    setDraftOrders((d) => { const n = { ...d }; delete n[widgetId]; return n })
    setPlacedOrdersMap((p) => { const n = { ...p }; delete n[widgetId]; return n })
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

  // Order bridge setters
  const setDraftOrder = useCallback((chartId: string, draft: ChartDraftOrder | undefined) => {
    setDraftOrders((prev) => ({ ...prev, [chartId]: draft }))
  }, [])

  const addPlacedOrder = useCallback((chartId: string, order: ChartPlacedOrder) => {
    setPlacedOrdersMap((prev) => ({
      ...prev,
      [chartId]: [...(prev[chartId] ?? []), order],
    }))
  }, [])

  const removePlacedOrder = useCallback((chartId: string, orderId: string) => {
    setPlacedOrdersMap((prev) => ({
      ...prev,
      [chartId]: (prev[chartId] ?? []).filter((o) => o.id !== orderId),
    }))
  }, [])

  const updatePlacedOrderPrice = useCallback((chartId: string, orderId: string, price: number) => {
    setPlacedOrdersMap((prev) => {
      const orders = prev[chartId] ?? []
      const order = orders.find((o) => o.id === orderId)
      if (!order) return prev

      const newNotional = order.qty * price
      const newMargin = order.marketType === "futures" && order.leverage
        ? newNotional / order.leverage
        : newNotional

      const updatedOrders = orders.map((o) => o.id === orderId ? { ...o, price, margin: newMargin } : o)
      const newMap = { ...prev, [chartId]: updatedOrders }

      // Recompute inOrders as sum of all order margins for this account/exchange/marketType
      if (order.accountId && order.exchangeId && order.marketType) {
        const k = balKey(order.accountId, order.exchangeId, order.marketType)
        const totalInOrders = Object.values(newMap)
          .flat()
          .filter((o) => o.accountId === order.accountId && o.exchangeId === order.exchangeId && o.marketType === order.marketType && o.margin != null)
          .reduce((sum, o) => sum + (o.margin ?? 0), 0)

        setBalances((b) => {
          const cur = b[k] ?? { walletBalance: 0, inOrders: 0 }
          return { ...b, [k]: { walletBalance: cur.walletBalance, inOrders: Math.round(totalInOrders * 100) / 100 } }
        })
      }

      return newMap
    })
  }, [setBalances])

  const updatePlacedOrder = useCallback((chartId: string, orderId: string, updates: Partial<ChartPlacedOrder>) => {
    setPlacedOrdersMap((prev) => ({
      ...prev,
      [chartId]: (prev[chartId] ?? []).map((o) => o.id === orderId ? { ...o, ...updates } : o),
    }))
  }, [])

  const setGridPreview = useCallback((consoleId: string, data: Omit<ChartGridOrders, "state" | "pendingUpdate"> | null) => {
    setGridOrdersMap((prev) => {
      if (data === null) {
        const n = { ...prev }
        delete n[consoleId]
        return n
      }
      const existing = prev[consoleId]
      // If already placed, mark as pending update instead of overwriting
      if (existing?.state === "placed") {
        return { ...prev, [consoleId]: { ...existing, pendingUpdate: true } }
      }
      return { ...prev, [consoleId]: { ...data, state: "preview", pendingUpdate: false } }
    })
  }, [])

  const placeGridOrders = useCallback((consoleId: string) => {
    setGridOrdersMap((prev) => {
      const entry = prev[consoleId]
      if (!entry) return prev
      return { ...prev, [consoleId]: { ...entry, state: "placed", pendingUpdate: false } }
    })
  }, [])

  const cancelGridOrders = useCallback((consoleId: string) => {
    setGridOrdersMap((prev) => {
      const n = { ...prev }
      delete n[consoleId]
      return n
    })
  }, [])

  // Cancel only if still in preview state — placed grids survive side switching
  const cancelGridPreview = useCallback((consoleId: string) => {
    setGridOrdersMap((prev) => {
      const entry = prev[consoleId]
      if (!entry || entry.state === "placed") return prev
      const n = { ...prev }
      delete n[consoleId]
      return n
    })
  }, [])

  const updateGridPreviewPrice = useCallback((consoleId: string, orderId: string, newPrice: number) => {
    setGridOrdersMap((prev) => {
      const entry = prev[consoleId]
      if (!entry || entry.state !== "preview") return prev
      const orders = entry.orders.map((o) => o.id === orderId ? { ...o, price: newPrice } : o)
      return { ...prev, [consoleId]: { ...entry, orders } }
    })
  }, [])

  const removeGridEntry = useCallback((consoleId: string, orderId: string) => {
    setGridOrdersMap((prev) => {
      const entry = prev[consoleId]
      if (!entry) return prev
      const orders = entry.orders.filter((o) => o.id !== orderId)
      return { ...prev, [consoleId]: { ...entry, orders } }
    })
  }, [])

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
  }, [])

  const markGridPendingUpdate = useCallback((consoleId: string) => {
    setGridOrdersMap((prev) => {
      const entry = prev[consoleId]
      if (!entry || entry.state !== "placed") return prev
      return { ...prev, [consoleId]: { ...entry, pendingUpdate: true } }
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
        placedOrders,
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
        gridOrders,
        setGridPreview,
        placeGridOrders,
        cancelGridOrders,
        cancelGridPreview,
        applyGridTpSl,
        updateGridPreviewPrice,
        markGridPendingUpdate,
        removeGridTpSl,
        removeGridEntry,
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
