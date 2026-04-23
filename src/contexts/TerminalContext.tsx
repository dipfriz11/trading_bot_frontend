import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import type { TerminalState, Tab, Widget, WidgetType, Theme, WidgetRect, TransparentBgPreset } from "@/types/terminal"
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
    theme: "terminal",
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
}

// keyed by chartWidgetId
type DraftOrderMap = Record<string, ChartDraftOrder | undefined>
type PlacedOrderMap = Record<string, ChartPlacedOrder[]>

interface TerminalContextValue {
  state: TerminalState
  activeTab: Tab | undefined
  setTheme: (theme: Theme) => void
  setTransparentBg: (bg: TransparentBgPreset) => void
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
      return { ...prev, [k]: { walletBalance: cur.walletBalance - amount, inOrders: cur.inOrders + amount } }
    })
  }, [])

  const refundOrderBalance = useCallback((accountId: string, exchangeId: string, marketType: "spot" | "futures", amount: number) => {
    const k = balKey(accountId, exchangeId, marketType)
    setBalances((prev) => {
      const cur = prev[k] ?? { walletBalance: 0, inOrders: 0 }
      return { ...prev, [k]: { walletBalance: cur.walletBalance + amount, inOrders: Math.max(0, cur.inOrders - amount) } }
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
    setPlacedOrdersMap((prev) => ({
      ...prev,
      [chartId]: (prev[chartId] ?? []).map((o) => o.id === orderId ? { ...o, price } : o),
    }))
  }, [])

  const updatePlacedOrder = useCallback((chartId: string, orderId: string, updates: Partial<ChartPlacedOrder>) => {
    setPlacedOrdersMap((prev) => ({
      ...prev,
      [chartId]: (prev[chartId] ?? []).map((o) => o.id === orderId ? { ...o, ...updates } : o),
    }))
  }, [])

  return (
    <TerminalContext.Provider
      value={{
        state,
        activeTab,
        setTheme,
        setTransparentBg,
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
