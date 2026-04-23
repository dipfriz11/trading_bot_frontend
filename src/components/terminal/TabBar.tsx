import { useState, useRef } from "react"
import { Plus, X } from "lucide-react"
import { useTerminal } from "@/contexts/TerminalContext"

export function TabBar() {
  const { state, addTab, removeTab, setActiveTab, renameTab } = useTerminal()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDoubleClick = (tabId: string, label: string) => {
    setEditingId(tabId)
    setEditValue(label)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleRenameCommit = () => {
    if (editingId && editValue.trim()) {
      renameTab(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  return (
    <div
      className="flex items-end gap-0.5 flex-shrink-0 overflow-x-auto"
      style={{ minHeight: 36, paddingLeft: 8, paddingRight: 4 }}
    >
      {state.tabs.map((tab) => {
        const isActive = tab.id === state.activeTabId
        return (
          <div
            key={tab.id}
            className={`terminal-tab flex items-center gap-1 px-3 h-8 cursor-pointer select-none flex-shrink-0 rounded-t ${isActive ? "active" : ""}`}
            style={{ minWidth: 90, maxWidth: 160 }}
            onClick={() => setActiveTab(tab.id)}
            onDoubleClick={() => handleDoubleClick(tab.id, tab.label)}
          >
            {editingId === tab.id ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleRenameCommit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameCommit()
                  if (e.key === "Escape") setEditingId(null)
                  e.stopPropagation()
                }}
                className="text-xs font-mono bg-transparent outline-none w-full"
                style={{ color: "inherit", minWidth: 0 }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-xs font-mono truncate flex-1">{tab.label}</span>
            )}
            {state.tabs.length > 1 && (
              <button
                className="flex-shrink-0 opacity-30 hover:opacity-100 transition-opacity rounded"
                style={{ width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
                onClick={(e) => {
                  e.stopPropagation()
                  removeTab(tab.id)
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <X size={9} />
              </button>
            )}
          </div>
        )
      })}

      {/* New tab button */}
      <button
        onClick={addTab}
        className="flex items-center justify-center h-7 w-7 rounded opacity-40 hover:opacity-100 transition-opacity flex-shrink-0"
        style={{ marginLeft: 2 }}
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
