// frontend/src/components/SaloonScene.tsx
import { useMemo } from 'react'
import { useSaloonStore } from '../store/saloonStore'
import { AGENTS } from '../types'
import Background from './Background'
import Character from './Character'

const CHAR_POSITIONS = [6, 18, 32, 50, 64, 78]

export default function SaloonScene() {
  const { messages, thinkingAgent } = useSaloonStore()

  const lastMessagePerAgent = useMemo(() => {
    const map = new Map<string, typeof messages[0]>()
    for (const msg of messages) {
      map.set(msg.agentId, msg)
    }
    return map
  }, [messages])

  return (
    <div className="relative w-full" style={{ aspectRatio: '16/10', maxHeight: '70vh' }}>
      <Background />

      {AGENTS.map((agent, idx) => {
        const left = CHAR_POSITIONS[idx]
        const isTalking = messages[messages.length - 1]?.agentId === agent.id
        const isThinking = thinkingAgent === agent.id
        const lastMsg = lastMessagePerAgent.get(agent.id) ?? null

        return (
          <div
            key={agent.id}
            className="absolute"
            style={{
              left: `${left}%`,
              bottom: '28%',
              transform: 'translateX(-50%)',
              zIndex: 10,
            }}
          >
            <Character
              agent={agent}
              isTalking={isTalking}
              isThinking={isThinking}
              lastMessage={lastMsg}
            />
          </div>
        )
      })}
    </div>
  )
}
