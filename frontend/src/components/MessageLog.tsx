// frontend/src/components/MessageLog.tsx
import { useSaloonStore } from '../store/saloonStore'
import { AGENTS } from '../types'

const agentColorMap = Object.fromEntries(AGENTS.map(a => [a.id, a.color]))

export default function MessageLog() {
  const { messages, topic, status } = useSaloonStore()
  const recent = messages.slice(-4)

  return (
    <div
      className="absolute bottom-0 left-0 right-0 px-4 py-3 z-20"
      style={{
        background: 'linear-gradient(0deg, rgba(5,2,0,0.95) 70%, transparent)',
        fontFamily: 'monospace',
        minHeight: '90px',
      }}
    >
      {topic && (
        <div className="text-xs mb-2" style={{ color: '#f0c060' }}>
          <span style={{ color: '#888' }}>Topic: </span>{topic}
          <span className="ml-3" style={{ color: status === 'running' ? '#88ff88' : '#ff8844' }}>
            ● {status}
          </span>
        </div>
      )}

      <div className="space-y-1">
        {recent.map((msg) => (
          <div key={msg.id} className="text-xs leading-snug">
            <span style={{ color: agentColorMap[msg.agentId] ?? '#f0c060', fontWeight: 'bold' }}>
              {msg.agentName}:
            </span>{' '}
            <span style={{ color: '#c8b898' }}>
              {msg.text.length > 120 ? msg.text.slice(0, 120) + '…' : msg.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
