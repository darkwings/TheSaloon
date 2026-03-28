// frontend/src/components/MessageLog.tsx
import { useEffect, useRef } from 'react'
import { useSaloonStore } from '../store/saloonStore'
import { AGENTS } from '../types'

const agentColorMap = Object.fromEntries(AGENTS.map(a => [a.id, a.color]))

export default function MessageLog() {
  const { messages, status } = useSaloonStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ fontFamily: 'monospace' }}>
        {status === 'idle' || status === 'stopped' ? (
          <span style={{ color: '#3d1e00', fontSize: '11px', textAlign: 'center', padding: '1rem' }}>
            No debate yet.<br />Enter a topic below.
          </span>
        ) : (
          <span style={{ color: '#5d3a00', fontSize: '11px' }}>Waiting for agents…</span>
        )}
      </div>
    )
  }

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#3d1e00 #080200',
      }}
    >
      <div className="flex flex-col gap-3 p-3">
        {messages.map((msg) => {
          const color = agentColorMap[msg.agentId] ?? '#f0c060'
          return (
            <div
              key={msg.id}
              style={{
                borderLeft: `2px solid ${color}`,
                paddingLeft: '8px',
              }}
            >
              <div
                className="font-bold mb-1"
                style={{ color, fontFamily: 'monospace', fontSize: '13px' }}
              >
                {msg.agentName}
              </div>
              <div
                className="leading-relaxed"
                style={{
                  fontSize: '13px',
                  color: '#c8b898',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.text}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
