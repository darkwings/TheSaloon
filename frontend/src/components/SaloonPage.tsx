// frontend/src/components/SaloonPage.tsx
import { useWebSocket } from '../hooks/useWebSocket'
import { useSaloonStore } from '../store/saloonStore'
import SaloonScene from './SaloonScene'
import ModeratorInput from './ModeratorInput'

interface Props {
  onOpenSettings: () => void
}

export default function SaloonPage({ onOpenSettings }: Props) {
  useWebSocket()
  const { topic, status } = useSaloonStore()

  return (
    <div className="flex flex-col h-screen" style={{ background: '#0d0500', borderBottom: '3px solid #3d1e00' }}>
      {/* Top bar: topic + status */}
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

      {/* Scene fills remaining space */}
      <div className="flex-1 min-h-0 relative">
        <SaloonScene />
      </div>

      <ModeratorInput onOpenSettings={onOpenSettings} />
    </div>
  )
}
