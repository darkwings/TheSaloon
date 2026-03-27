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
    <div>
      <button onClick={onBack} className="text-xs mb-4" style={{ color: '#f0c060' }}>← Back to history</button>
      <h3 className="font-bold mb-1" style={{ color: '#f0c060' }}>{conv.title}</h3>
      <p className="text-xs mb-4" style={{ color: '#888' }}>
        {new Date(conv.created_at).toLocaleString()} · {conv.llm_provider}
      </p>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {messages.map((m) => (
          <div key={m.id} className="text-xs">
            <span style={{ color: agentColorMap[m.agent_id] ?? '#f0c060', fontWeight: 'bold' }}>
              {agentNameMap[m.agent_id] ?? m.agent_id}:
            </span>{' '}
            <span style={{ color: '#c8b898' }}>{m.text}</span>
          </div>
        ))}
        {messages.length === 0 && <p style={{ color: '#666' }}>No messages.</p>}
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
    <div>
      <h3 className="font-bold mb-3" style={{ color: '#f0c060' }}>Conversation History</h3>
      {conversations.length === 0 && <p className="text-xs" style={{ color: '#666' }}>No conversations yet.</p>}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className="w-full text-left px-3 py-2 rounded text-xs"
            style={{ background: '#1a0800', border: '1px solid #3d1e00' }}
          >
            <div style={{ color: '#e8d8b0', fontWeight: 'bold' }}>{c.title}</div>
            <div style={{ color: '#888' }}>{new Date(c.created_at).toLocaleDateString()} · {c.llm_provider}</div>
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
    background: '#1a0800',
    border: '1px solid #5d3000',
    color: '#e8d8b0',
    fontFamily: 'monospace',
    padding: '6px 10px',
    borderRadius: '4px',
    width: '100%',
    fontSize: '13px',
  } as const

  const labelStyle = { color: '#888', fontSize: '11px', marginBottom: '4px', display: 'block' } as const

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto" style={{ fontFamily: 'monospace' }}>
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} style={{ color: '#f0c060', fontSize: '13px' }}>← Back to Saloon</button>
        <h1 className="text-lg font-bold" style={{ color: '#f0c060' }}>⚙️ Settings</h1>
        {saved && <span style={{ color: '#88cc88', fontSize: '12px' }}>✓ Saved</span>}
      </div>

      <div className="flex gap-2 mb-6">
        {(['config', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1 rounded text-sm capitalize"
            style={{
              background: tab === t ? '#f0c060' : '#1a0800',
              color: tab === t ? '#000' : '#888',
              border: '1px solid #3d1e00',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'history' && <HistorySection />}

      {tab === 'config' && settings && (
        <div className="space-y-6">
          <section>
            <h3 className="font-bold mb-3" style={{ color: '#f0c060' }}>LLM Provider</h3>
            <div className="space-y-3">
              <div>
                <label style={labelStyle}>Provider (claude | gemini | ollama)</label>
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
            <h3 className="font-bold mb-3" style={{ color: '#f0c060' }}>Search Provider</h3>
            <div>
              <label style={labelStyle}>Provider (tavily | duckduckgo)</label>
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
            <h3 className="font-bold mb-3" style={{ color: '#f0c060' }}>Conversation Speed</h3>
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
              <div className="flex justify-between text-xs mt-1" style={{ color: '#666' }}>
                <span>5s (fast)</span><span>60s (slow)</span>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
