// frontend/src/components/SettingsPage.tsx
import { useEffect, useState } from 'react'
import type { AppSettings, Conversation } from '../types'
import * as api from '../api/client'
import { AGENTS } from '../types'

const agentColorMap = Object.fromEntries(AGENTS.map(a => [a.id, a.color]))
const agentNameMap = Object.fromEntries(AGENTS.map(a => [a.id, a.name]))

interface Props { onBack: () => void }

function ConversationDetail({ conv, onBack }: { conv: Conversation; onBack: () => void }) {
  const [messages, setMessages] = useState<any[]>([])

  useEffect(() => {
    api.getConversation(conv.id).then((r) => setMessages(r.messages))
  }, [conv.id])

  return (
    <div className="flex flex-col h-full">
      <button onClick={onBack} className="text-xs mb-4 self-start" style={{ color: '#f0c060' }}>← Back to history</button>
      <h3 className="font-bold mb-1" style={{ color: '#f0c060', fontFamily: 'monospace' }}>{conv.title}</h3>
      <p className="text-xs mb-4" style={{ color: '#888', fontFamily: 'monospace' }}>
        {new Date(conv.created_at).toLocaleString()} · {conv.llm_provider}
      </p>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3d1e00 #080200' }}>
        {messages.map((m) => (
          <div key={m.id} style={{ borderLeft: `2px solid ${agentColorMap[m.agent_id] ?? '#f0c060'}`, paddingLeft: '10px' }}>
            <div className="text-xs font-bold mb-1" style={{ color: agentColorMap[m.agent_id] ?? '#f0c060', fontFamily: 'monospace' }}>
              {agentNameMap[m.agent_id] ?? m.agent_id}
            </div>
            <div className="text-xs leading-relaxed" style={{ color: '#c8b898', fontFamily: 'monospace' }}>{m.text}</div>
          </div>
        ))}
        {messages.length === 0 && <p className="text-xs" style={{ color: '#666', fontFamily: 'monospace' }}>No messages.</p>}
      </div>
    </div>
  )
}

function HistorySection() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)

  useEffect(() => { api.listConversations().then(setConversations) }, [])

  if (selected) return <ConversationDetail conv={selected} onBack={() => setSelected(null)} />

  return (
    <div className="flex flex-col h-full">
      {conversations.length === 0 && (
        <p className="text-xs" style={{ color: '#666', fontFamily: 'monospace' }}>No conversations yet.</p>
      )}
      <div className="flex-1 overflow-y-auto space-y-2 pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3d1e00 #080200' }}>
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className="w-full text-left px-4 py-3 rounded"
            style={{ background: '#110500', border: '1px solid #3d1e00', transition: 'border-color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#f0c060')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#3d1e00')}
          >
            <div className="text-sm font-bold mb-1" style={{ color: '#e8d8b0', fontFamily: 'monospace' }}>{c.title}</div>
            <div className="text-xs" style={{ color: '#666', fontFamily: 'monospace' }}>
              {new Date(c.created_at).toLocaleDateString()} · {c.llm_provider}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function SettingsPage({ onBack }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'config' | 'history'>('config')

  useEffect(() => { api.getSettings().then(setSettings) }, [])

  async function save(key: string, value: string) {
    await api.updateSetting(key, value)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputStyle = {
    background: '#110500',
    border: '1px solid #5d3000',
    color: '#e8d8b0',
    fontFamily: 'monospace',
    padding: '8px 12px',
    borderRadius: '4px',
    width: '100%',
    fontSize: '13px',
  } as const

  const labelStyle = {
    color: '#888',
    fontSize: '11px',
    marginBottom: '6px',
    display: 'block',
    fontFamily: 'monospace',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  }

  const TABS = [
    { id: 'config' as const, label: '⚙ Config' },
    { id: 'history' as const, label: '📜 History' },
  ]

  return (
    <div style={{ height: '100dvh', background: '#0d0500', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div
        className="shrink-0 flex items-center justify-between px-6 py-3"
        style={{ borderBottom: '2px solid #3d1e00', background: '#0d0500' }}
      >
        <button onClick={onBack} style={{ color: '#f0c060', fontSize: '13px', fontFamily: 'monospace' }}>
          ← Back to Saloon
        </button>
        <span style={{ color: '#5d3a00', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.2em' }}>
          ★ THE SALOON ★
        </span>
        {saved
          ? <span style={{ color: '#88cc88', fontSize: '12px', fontFamily: 'monospace' }}>✓ Saved</span>
          : <span style={{ width: '60px' }} />
        }
      </div>

      {/* Centered panel */}
      <div className="flex-1 flex justify-center min-h-0 px-4 py-6">
        <div
          className="flex flex-col w-full"
          style={{ maxWidth: '680px' }}
        >
          {/* Tab bar */}
          <div
            className="shrink-0 flex mb-6"
            style={{ borderBottom: '2px solid #3d1e00' }}
          >
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '10px 28px',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: tab === t.id ? 'bold' : 'normal',
                  color: tab === t.id ? '#0d0500' : '#888',
                  background: tab === t.id ? '#f0c060' : 'transparent',
                  borderTop: tab === t.id ? '2px solid #f0c060' : '2px solid transparent',
                  borderLeft: tab === t.id ? '2px solid #f0c060' : '2px solid transparent',
                  borderRight: tab === t.id ? '2px solid #f0c060' : '2px solid transparent',
                  borderBottom: tab === t.id ? '2px solid #0d0500' : 'none',
                  marginBottom: tab === t.id ? '-2px' : '0',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0">
            {tab === 'history' && <HistorySection />}

            {tab === 'config' && settings && (
              <div className="overflow-y-auto h-full space-y-8 pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3d1e00 #080200' }}>
                <section>
                  <h3 className="font-bold mb-4" style={{ color: '#f0c060', fontFamily: 'monospace', borderBottom: '1px solid #2a1000', paddingBottom: '8px' }}>
                    LLM Provider
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label style={labelStyle}>Provider</label>
                      <select
                        value={settings.llm_provider}
                        onChange={(e) => { setSettings({ ...settings, llm_provider: e.target.value }); save('LLM_PROVIDER', e.target.value) }}
                        style={inputStyle}
                      >
                        <option value="claude">Claude (Anthropic)</option>
                        <option value="gemini">Gemini (Google)</option>
                        <option value="ollama">Ollama (local)</option>
                      </select>
                    </div>
                    {settings.llm_provider === 'ollama' && (
                      <>
                        <div>
                          <label style={labelStyle}>Ollama base URL</label>
                          <input
                            style={inputStyle}
                            value={settings.ollama_base_url}
                            onChange={(e) => setSettings({ ...settings, ollama_base_url: e.target.value })}
                            onBlur={(e) => save('OLLAMA_BASE_URL', e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Ollama model</label>
                          <input
                            style={inputStyle}
                            value={settings.ollama_model}
                            onChange={(e) => setSettings({ ...settings, ollama_model: e.target.value })}
                            onBlur={(e) => save('OLLAMA_MODEL', e.target.value)}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="font-bold mb-4" style={{ color: '#f0c060', fontFamily: 'monospace', borderBottom: '1px solid #2a1000', paddingBottom: '8px' }}>
                    Search Provider
                  </h3>
                  <div>
                    <label style={labelStyle}>Provider</label>
                    <select
                      value={settings.search_provider}
                      onChange={(e) => { setSettings({ ...settings, search_provider: e.target.value }); save('SEARCH_PROVIDER', e.target.value) }}
                      style={inputStyle}
                    >
                      <option value="tavily">Tavily (recommended)</option>
                      <option value="duckduckgo">DuckDuckGo (no API key)</option>
                    </select>
                  </div>
                </section>

                <section>
                  <h3 className="font-bold mb-4" style={{ color: '#f0c060', fontFamily: 'monospace', borderBottom: '1px solid #2a1000', paddingBottom: '8px' }}>
                    Conversation Speed
                  </h3>
                  <div>
                    <label style={labelStyle}>
                      Delay between agents: {settings.conversation_delay_seconds}s
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={60}
                      step={5}
                      value={parseInt(settings.conversation_delay_seconds) || 20}
                      onChange={(e) => setSettings({ ...settings, conversation_delay_seconds: e.target.value })}
                      onMouseUp={(e) => save('CONVERSATION_DELAY_SECONDS', (e.target as HTMLInputElement).value)}
                      style={{ width: '100%', accentColor: '#f0c060' }}
                    />
                    <div className="flex justify-between text-xs mt-1" style={{ color: '#555', fontFamily: 'monospace' }}>
                      <span>5s — fast</span><span>60s — slow</span>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
