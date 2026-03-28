// frontend/src/components/ModeratorInput.tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSaloonStore } from '../store/saloonStore'
import * as api from '../api/client'

interface Props {
  onOpenSettings: () => void
}

export default function ModeratorInput({ onOpenSettings }: Props) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const { status } = useSaloonStore()

  const isIdle = status === 'idle' || status === 'stopped'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim() || loading) return
    setLoading(true)
    try {
      if (isIdle) {
        await api.startConversation(value.trim())
      } else {
        await api.injectMessage(value.trim())
      }
      setValue('')
    } finally {
      setLoading(false)
    }
  }

  async function handlePauseResume() {
    if (status === 'running') await api.pauseConversation()
    else if (status === 'paused') await api.resumeConversation()
  }

  return (
    <div className="relative z-30 shrink-0 px-8 pt-3" style={{ background: '#0d0500', paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 2rem))' }}>
      <div className="px-4 py-3 rounded" style={{ border: '2px solid #3d1e00', background: '#0a0300' }}>
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={isIdle ? 'Enter a topic to start the debate…' : 'Intervene as moderator…'}
            disabled={loading}
            className="flex-1 px-3 py-2 rounded text-sm outline-none"
            style={{
              background: '#1a0800',
              border: '2px solid #f0c060',
              color: '#e8d8b0',
              fontFamily: 'monospace',
            }}
          />
          <button
            type="submit"
            disabled={loading || !value.trim()}
            className="px-4 py-2 rounded text-sm font-bold"
            style={{
              background: value.trim() ? '#f0c060' : '#5d4020',
              color: '#000',
              fontFamily: 'monospace',
              cursor: value.trim() ? 'pointer' : 'default',
            }}
          >
            {isIdle ? 'START' : 'INJECT'}
          </button>

          {(status === 'running' || status === 'paused') && (
            <button
              type="button"
              onClick={handlePauseResume}
              className="px-3 py-2 rounded text-sm"
              style={{
                background: status === 'running' ? '#442200' : '#224400',
                border: '1px solid #f0c060',
                color: '#f0c060',
                fontFamily: 'monospace',
              }}
            >
              {status === 'running' ? '⏸' : '▶'}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            className="px-3 py-2 rounded text-sm"
            style={{ background: '#1a0800', border: '1px solid #5d3000', color: '#888' }}
            title="Settings"
          >
            ⚙️
          </button>
        </form>
      </div>
    </div>
  )
}
