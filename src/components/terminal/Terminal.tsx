import { useState } from "react"
import { useTerminal } from "@/contexts/TerminalContext"
import { TabBar } from "./TabBar"
import { AddWidgetMenu } from "./AddWidgetMenu"
import { WidgetCanvas } from "./WidgetCanvas"
import { Sparkles, Monitor, Layers, Eye, Settings, X, User } from "lucide-react"
import type { TransparentBgPreset } from "@/types/terminal"

const BG_PRESETS: { id: TransparentBgPreset; label: string; color: string; tint: string; grad: string }[] = [
  { id: "midnight",  label: "Midnight",   color: "#06090f", tint: "#1e3c78", grad: "" },
  { id: "navy",      label: "Navy",       color: "#020d1f", tint: "#0a50c8", grad: "" },
  { id: "forest",    label: "Forest",     color: "#030e07", tint: "#0a7846", grad: "" },
  { id: "wine",      label: "Wine",       color: "#110409", tint: "#8a1020", grad: "" },
  { id: "slate",     label: "Slate",      color: "#080a10", tint: "#506488", grad: "" },
  { id: "grey",      label: "Grey",       color: "#141414", tint: "#4a4a4a", grad: "" },
  { id: "lightgrey", label: "Light Grey", color: "#1c1c1c", tint: "#787878", grad: "" },
  { id: "steelblue", label: "Steel Blue", color: "#0d1620", tint: "#3a5a78", grad: "" },
]



const THEMES = ["terminal", "cosmic", "slate", "transparent", "glass-graphite"] as const
type ThemeId = typeof THEMES[number]

const THEME_META: Record<ThemeId, { label: string; icon: React.ElementType }> = {
  terminal:        { label: "Terminal",    icon: Monitor    },
  cosmic:          { label: "Cosmic",      icon: Sparkles   },
  slate:           { label: "Slate",       icon: Layers     },
  transparent:     { label: "Transparent", icon: Eye        },
  "glass-graphite": { label: "Premium",   icon: Layers     },
}

export function Terminal() {
  const { state, setTheme, setTransparentBg, setGgBg } = useTerminal()
  const theme = state.theme as ThemeId
  const transparentBg = state.transparentBg ?? "midnight"
  const [tweaksOpen, setTweaksOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const themeClass =
    theme === "cosmic"           ? "cosmic-theme"          :
    theme === "slate"            ? "slate-theme"           :
    theme === "transparent"      ? "transparent-theme"     :
    theme === "glass-graphite"   ? "glass-graphite-theme"  :
    "terminal-theme"

  const isTransparent    = theme === "transparent"
  const isCosmicTheme    = theme === "cosmic"
  const isSlateTheme     = theme === "slate"
  const isGlassGraphite  = theme === "glass-graphite"

  const toolbarBg =
    isCosmicTheme    ? "rgba(8,3,20,0.92)"              :
    isSlateTheme     ? "#1e2636"                         :
    isTransparent    ? "rgba(10,14,26,0.85)"             :
    isGlassGraphite  ? "rgba(11,15,20,0.88)"             :
    "var(--terminal-header)"

  const toolbarBorder =
    isCosmicTheme    ? "1px solid rgba(150,80,255,0.2)"   :
    isSlateTheme     ? "1px solid rgba(255,255,255,0.10)" :
    isTransparent    ? "1px solid rgba(42,58,80,0.65)"    :
    isGlassGraphite  ? "1px solid rgba(255,255,255,0.10)" :
    "1px solid var(--terminal-border)"

  const logoBg =
    isCosmicTheme    ? "linear-gradient(135deg, rgba(150,60,255,0.6), rgba(80,20,180,0.5))" :
    isSlateTheme     ? "rgba(74,144,217,0.25)"         :
    isTransparent    ? "rgba(59,130,246,0.2)"           :
    isGlassGraphite  ? "rgba(58,124,165,0.18)"          :
    "rgba(30,111,239,0.2)"

  const logoBorder =
    isCosmicTheme    ? "1px solid rgba(180,100,255,0.4)"  :
    isSlateTheme     ? "1px solid rgba(74,144,217,0.45)"  :
    isTransparent    ? "1px solid rgba(59,130,246,0.35)"  :
    isGlassGraphite  ? "1px solid rgba(58,124,165,0.35)"  :
    "1px solid rgba(30,111,239,0.3)"

  const logoColor =
    isCosmicTheme    ? "rgba(200,160,255,0.9)" :
    isSlateTheme     ? "#4a90d9"               :
    isTransparent    ? "#3b82f6"               :
    isGlassGraphite  ? "#3A7CA5"               :
    "#1e6fef"

  const logoTextColor =
    isCosmicTheme    ? "rgba(200,160,255,0.85)"  :
    isSlateTheme     ? "rgba(220,230,245,0.85)"  :
    isTransparent    ? "rgba(203,213,225,0.9)"   :
    isGlassGraphite  ? "rgba(230,237,243,0.80)"  :
    "rgba(255,255,255,0.7)"

  const btnBg =
    isCosmicTheme    ? "rgba(120,50,220,0.2)"    :
    isSlateTheme     ? "rgba(255,255,255,0.10)"  :
    isTransparent    ? "rgba(255,255,255,0.06)"  :
    isGlassGraphite  ? "rgba(255,255,255,0.05)"  :
    "rgba(255,255,255,0.05)"

  const btnColor =
    isCosmicTheme    ? "rgba(200,160,255,0.85)"  :
    isSlateTheme     ? "rgba(220,230,245,0.8)"   :
    isTransparent    ? "rgba(203,213,225,0.85)"  :
    isGlassGraphite  ? "rgba(154,164,174,0.90)"  :
    "rgba(255,255,255,0.5)"

  const btnBorder =
    isCosmicTheme    ? "1px solid rgba(150,80,255,0.3)"   :
    isSlateTheme     ? "1px solid rgba(255,255,255,0.18)" :
    isTransparent    ? "1px solid rgba(42,58,80,0.65)"    :
    isGlassGraphite  ? "1px solid rgba(255,255,255,0.10)" :
    "1px solid rgba(255,255,255,0.08)"

  const ThemeIcon = THEME_META[theme].icon
  const nextTheme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]
  const NextIcon  = THEME_META[nextTheme].icon
  const nextLabel = THEME_META[nextTheme].label

  const preset = BG_PRESETS.find((p) => p.id === transparentBg) ?? BG_PRESETS[0]
  const rootBg = isTransparent ? preset.color : undefined

  const ggBg = state.ggBg ?? "graphite"

  return (
    <div
      className={`${themeClass} flex flex-col h-screen overflow-hidden relative`}
      data-bg={isTransparent ? transparentBg : isGlassGraphite ? ggBg : undefined}
      style={rootBg ? { background: rootBg } : undefined}
    >
      {/* Toolbar */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 z-10 relative"
        style={{
          borderBottom: toolbarBorder,
          background: toolbarBg,
          backdropFilter: (isCosmicTheme || isTransparent || isGlassGraphite) ? "blur(10px)" : undefined,
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mr-2">
          <div
            className="flex items-center justify-center rounded"
            style={{ width: 22, height: 22, background: logoBg, border: logoBorder }}
          >
            <ThemeIcon size={11} style={{ color: logoColor }} />
          </div>
          <span
            className="text-xs font-mono font-semibold tracking-wider select-none"
            style={{ color: logoTextColor, fontSize: 11 }}
          >
            CRYPTERM
          </span>
        </div>

        {/* Tabs */}
        <div
          className="flex-1 min-w-0 tab-bar flex items-end"
          style={{ background: "transparent", border: "none" }}
        >
          <TabBar />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <AddWidgetMenu />

          {/* Tweaks button */}
          <button
            onClick={() => setTweaksOpen((v) => !v)}
            className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded transition-all"
            style={{
              background: tweaksOpen ? (isTransparent ? "rgba(59,130,246,0.15)" : btnBg) : btnBg,
              color: tweaksOpen ? (isTransparent ? "#60a5fa" : btnColor) : btnColor,
              border: tweaksOpen ? (isTransparent ? "1px solid rgba(59,130,246,0.5)" : btnBorder) : btnBorder,
              fontSize: 10,
            }}
          >
            <Settings size={11} />
            Tweaks
          </button>

          {/* Theme cycle button */}
          <button
            onClick={() => setTheme(nextTheme)}
            className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded transition-all"
            style={{ background: btnBg, color: btnColor, border: btnBorder, fontSize: 10 }}
          >
            <NextIcon size={11} />
            {nextLabel}
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.10)", marginLeft: 2, marginRight: 2, flexShrink: 0 }} />

          {/* Account button */}
          <button
            onClick={() => { setAccountOpen((v) => !v); setSettingsOpen(false) }}
            className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded transition-all"
            style={{
              background: accountOpen ? (isTransparent ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.10)") : btnBg,
              color: accountOpen ? "#fff" : btnColor,
              border: accountOpen ? (isTransparent ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(255,255,255,0.22)") : btnBorder,
              fontSize: 10,
            }}
          >
            <User size={11} />
            Account
          </button>

          {/* Settings button */}
          <button
            onClick={() => { setSettingsOpen((v) => !v); setAccountOpen(false) }}
            className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded transition-all"
            style={{
              background: settingsOpen ? (isTransparent ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.10)") : btnBg,
              color: settingsOpen ? "#fff" : btnColor,
              border: settingsOpen ? (isTransparent ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(255,255,255,0.22)") : btnBorder,
              fontSize: 10,
            }}
          >
            <Settings size={11} />
            Settings
          </button>
        </div>
      </div>

      {/* Tweaks panel */}
      {tweaksOpen && (
        <div
          className="absolute right-3 z-50 flex flex-col gap-3 p-3 rounded-lg"
          style={{
            top: 42,
            minWidth: 220,
            background: isGlassGraphite ? "rgba(11,15,20,0.95)" : isTransparent ? "rgba(10,14,26,0.88)" : isCosmicTheme ? "rgba(8,3,20,0.95)" : isSlateTheme ? "#1e2636" : "var(--terminal-header)",
            border: isGlassGraphite ? "1px solid rgba(255,255,255,0.12)" : isTransparent ? "1px solid rgba(42,58,80,0.7)" : isCosmicTheme ? "1px solid rgba(150,80,255,0.25)" : isSlateTheme ? "1px solid rgba(255,255,255,0.12)" : "1px solid var(--terminal-border)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold" style={{ color: btnColor, letterSpacing: "0.06em" }}>TWEAKS</span>
            <button onClick={() => setTweaksOpen(false)} style={{ color: btnColor, opacity: 0.5 }} className="hover:opacity-100 transition-opacity">
              <X size={12} />
            </button>
          </div>

          {/* Theme row */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-mono" style={{ color: btnColor, opacity: 0.6, fontSize: 10 }}>Theme</span>
            <div className="flex gap-1 flex-wrap">
              {THEMES.map((t) => {
                const Icon = THEME_META[t].icon
                const active = theme === t
                return (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono transition-all"
                    style={{
                      fontSize: 10,
                      background: active ? (isCosmicTheme ? "rgba(150,80,255,0.25)" : isTransparent ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.12)") : "rgba(255,255,255,0.04)",
                      border: active ? (isCosmicTheme ? "1px solid rgba(150,80,255,0.5)" : isTransparent ? "1px solid rgba(59,130,246,0.45)" : "1px solid rgba(255,255,255,0.2)") : "1px solid rgba(255,255,255,0.06)",
                      color: active ? "#fff" : btnColor,
                    }}
                  >
                    <Icon size={10} />
                    {THEME_META[t].label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Background preset — glass-graphite */}
          {isGlassGraphite && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-mono" style={{ color: btnColor, opacity: 0.6, fontSize: 10 }}>Background</span>
              <div className="flex gap-1.5 flex-wrap">
                {([ { id: "graphite", label: "Graphite", color1: "#101823", color2: "#05080C" }, { id: "blue-mist", label: "Blue Mist", color1: "#0D1721", color2: "#060E18" } ] as const).map((p) => {
                  const active = ggBg === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setGgBg(p.id)}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono transition-all"
                      style={{
                        fontSize: 10,
                        background: active ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
                        border: active ? "1px solid rgba(58,124,165,0.55)" : "1px solid rgba(255,255,255,0.07)",
                        color: active ? "#fff" : "rgba(154,164,174,0.75)",
                      }}
                    >
                      <span className="rounded-sm inline-block flex-shrink-0" style={{ width: 12, height: 12, background: `linear-gradient(135deg, ${p.color1}, ${p.color2})`, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 3 }} />
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Background preset — only for transparent */}
          {isTransparent && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-mono" style={{ color: btnColor, opacity: 0.6, fontSize: 10 }}>Background</span>
              <div className="flex gap-1.5 flex-wrap">
                {BG_PRESETS.map((p) => {
                  const active = transparentBg === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => setTransparentBg(p.id)}
                      title={p.label}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono transition-all"
                      style={{
                        fontSize: 10,
                        background: active ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
                        border: active ? `1px solid ${p.tint}` : "1px solid rgba(255,255,255,0.07)",
                        color: active ? "#fff" : "rgba(148,163,184,0.7)",
                        boxShadow: active ? `0 0 8px ${p.tint}44` : "none",
                      }}
                    >
                      <span
                        className="rounded-sm inline-block flex-shrink-0"
                        style={{
                          width: 12, height: 12,
                          background: `linear-gradient(135deg, ${p.tint} 0%, ${p.color} 100%)`,
                          border: `1px solid ${p.tint}88`,
                          borderRadius: 3,
                        }}
                      />
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Canvas */}
      <WidgetCanvas />
    </div>
  )
}
