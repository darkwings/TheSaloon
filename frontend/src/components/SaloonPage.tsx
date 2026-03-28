// frontend/src/components/SaloonPage.tsx
import { useWebSocket } from '../hooks/useWebSocket'
import { useSaloonStore } from '../store/saloonStore'
import SaloonScene from './SaloonScene'
import MessageLog from './MessageLog'
import ModeratorInput from './ModeratorInput'

interface Props {
  onOpenSettings: () => void
}

export default function SaloonPage({ onOpenSettings }: Props) {
  useWebSocket()
  const { topic, status } = useSaloonStore()

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#0d0500' }}>
      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-4 py-2 shrink-0 z-30"
        style={{ borderBottom: '2px solid #3d1e00', background: '#0d0500' }}
      >
        {topic ? (
          <>
            <span className="text-xs shrink-0" style={{ color: '#888', fontFamily: 'monospace' }}>Topic:</span>
            <span className="text-xs font-bold flex-1 truncate" style={{ color: '#f0c060', fontFamily: 'monospace' }}>{topic}</span>
            <span
              className="text-xs shrink-0"
              style={{
                color: status === 'running' ? '#88ff88' : status === 'paused' ? '#ffaa44' : '#888',
                fontFamily: 'monospace',
              }}
            >
              ● {status}
            </span>
          </>
        ) : (
          <span className="text-xs" style={{ color: '#555', fontFamily: 'monospace' }}>
            ★ THE SALOON ★ — enter a topic to start the debate
          </span>
        )}
      </div>

      {/* Main area: scene + message panel */}
      <div className="flex flex-1 min-h-0">
        {/* Saloon scene */}
        <div className="flex-1 min-w-0 relative">
          <SaloonScene />
        </div>

        {/* Message log panel */}
        <div
          className="shrink-0 flex flex-col"
          style={{
            width: '320px',
            borderLeft: '2px solid #3d1e00',
            background: '#080200',
          }}
        >
          {/* Panel header */}
          <div
            className="shrink-0 px-3 py-2 text-center"
            style={{
              borderBottom: '1px solid #3d1e00',
              background: '#0d0500',
              fontFamily: 'monospace',
              fontSize: '10px',
              color: '#5d3a00',
              letterSpacing: '0.15em',
            }}
          >
            ══ DISPATCH ══
          </div>
          <MessageLog />
        </div>
      </div>

      {/* Moderator input */}
      <ModeratorInput onOpenSettings={onOpenSettings} />
    </div>
  )
}
