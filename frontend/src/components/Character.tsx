// frontend/src/components/Character.tsx
import { useState, useCallback, useEffect } from 'react'
import type { AgentMeta, ChatMessage } from '../types'
import SpeechBubble from './SpeechBubble'

interface Props {
  agent: AgentMeta
  isTalking: boolean
  isThinking: boolean
  lastMessage: ChatMessage | null
  bubbleAlign?: 'left' | 'center' | 'right'
}

function CharacterSprite({ color, isTalking, isThinking }: { color: string; isTalking: boolean; isThinking: boolean }) {
  const skinTone = '#f4c884'
  const bounce = isTalking ? 'animate-bounce' : ''

  return (
    <svg
      viewBox="0 0 32 48"
      width="48"
      height="72"
      style={{ imageRendering: 'pixelated' }}
      className={bounce}
    >
      {/* Head */}
      <rect x="10" y="0" width="12" height="12" fill={skinTone} />
      {/* Eyes */}
      <rect x="12" y="3" width="2" height="2" fill="#333" />
      <rect x="18" y="3" width="2" height="2" fill="#333" />
      {/* Mouth */}
      {isTalking
        ? <rect x="13" y="8" width="6" height="2" fill="#333" />
        : <rect x="13" y="8" width="6" height="1" fill="#555" />
      }
      {/* Body */}
      <rect x="8" y="12" width="16" height="18" fill={color} />
      {/* Arms */}
      <rect x="2" y="13" width="6" height="12" fill={color} />
      <rect x="24" y="13" width="6" height="12" fill={color} />
      {/* Legs */}
      <rect x="9" y="30" width="5" height="14" fill="#333" />
      <rect x="18" y="30" width="5" height="14" fill="#333" />
      {/* Feet */}
      <rect x="7" y="42" width="8" height="4" fill="#222" />
      <rect x="17" y="42" width="8" height="4" fill="#222" />
      {/* Thinking dots */}
      {isThinking && (
        <>
          <circle cx="22" cy="2" r="1.5" fill="#f0c060" opacity="0.9" />
          <circle cx="26" cy="0" r="1" fill="#f0c060" opacity="0.7" />
          <circle cx="29" cy="-1" r="0.7" fill="#f0c060" opacity="0.5" />
        </>
      )}
    </svg>
  )
}

function ProfileModal({ agent, onClose }: { agent: AgentMeta; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="p-6 rounded max-w-sm w-full mx-4"
        style={{ background: '#1a0800', border: `2px solid ${agent.color}`, fontFamily: 'monospace' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-1" style={{ color: agent.color }}>{agent.name}</h2>
        <p className="text-xs mb-2" style={{ color: '#f0c060' }}>{agent.archetype}</p>
        <p className="text-sm" style={{ color: '#e8d8b0' }}>{agent.description}</p>
        <button
          className="mt-4 text-xs px-3 py-1 rounded"
          style={{ background: agent.color, color: '#000' }}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default function Character({ agent, isTalking, isThinking, lastMessage, bubbleAlign = 'center' }: Props) {
  const [showProfile, setShowProfile] = useState(false)
  const [bubble, setBubble] = useState<ChatMessage | null>(lastMessage)

  const dismiss = useCallback(() => setBubble(null), [])

  // Sync bubble with lastMessage prop
  useEffect(() => {
    if (lastMessage && bubble?.id !== lastMessage.id) {
      setBubble(lastMessage)
    }
  }, [lastMessage])

  return (
    <>
      <div
        className="relative flex flex-col items-center cursor-pointer select-none"
        onClick={() => setShowProfile(true)}
        title={`${agent.name} — click for profile`}
      >
        {bubble && (
          <SpeechBubble
            text={bubble.text}
            color={agent.color}
            align={bubbleAlign}
            onDismiss={dismiss}
          />
        )}
        <CharacterSprite
          color={agent.color}
          isTalking={isTalking}
          isThinking={isThinking}
        />
        <span
          className="text-xs mt-1 font-bold"
          style={{ color: agent.color, fontFamily: 'monospace', textShadow: '1px 1px 0 #000' }}
        >
          {agent.name.split(' ')[0]}
        </span>
      </div>
      {showProfile && <ProfileModal agent={agent} onClose={() => setShowProfile(false)} />}
    </>
  )
}
