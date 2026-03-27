// frontend/src/components/SaloonPage.tsx
import { useWebSocket } from '../hooks/useWebSocket'
import SaloonScene from './SaloonScene'
import MessageLog from './MessageLog'
import ModeratorInput from './ModeratorInput'

interface Props {
  onOpenSettings: () => void
}

export default function SaloonPage({ onOpenSettings }: Props) {
  useWebSocket()

  return (
    <div className="flex flex-col h-screen" style={{ background: '#0d0500' }}>
      <div className="flex-1 relative overflow-hidden">
        <SaloonScene />
        <MessageLog />
      </div>
      <ModeratorInput onOpenSettings={onOpenSettings} />
    </div>
  )
}
