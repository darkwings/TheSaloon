// frontend/src/components/Character.tsx
import { useState, useCallback, useEffect, useRef } from 'react'
import type { AgentMeta, ChatMessage, AgentId } from '../types'
import SpeechBubble from './SpeechBubble'

interface Props {
  agent: AgentMeta
  isTalking: boolean
  isThinking: boolean
  lastMessage: ChatMessage | null
  bubbleAlign?: 'left' | 'center' | 'right'
}

// ── Per-character pixel-art accessories ─────────────────────────────────────

function ProfQuarkAccessories() {
  return (
    <>
      {/* White side-hair */}
      <rect x="9" y="0" width="3" height="4" fill="#cccccc" />
      <rect x="20" y="0" width="3" height="4" fill="#cccccc" />
      {/* Glasses frames */}
      <rect x="11" y="2" width="5" height="4" fill="none" stroke="#88aaff" strokeWidth="0.8" />
      <rect x="17" y="2" width="5" height="4" fill="none" stroke="#88aaff" strokeWidth="0.8" />
      {/* Bridge */}
      <rect x="16" y="3" width="1" height="1" fill="#88aaff" />
      {/* Temples */}
      <rect x="8"  y="3" width="3" height="1" fill="#88aaff" />
      <rect x="22" y="3" width="3" height="1" fill="#88aaff" />
    </>
  )
}

function BobbyRayAccessories() {
  return (
    <>
      {/* Cowboy hat crown */}
      <rect x="9"  y="-8" width="14" height="10" fill="#7a4a10" />
      {/* Crown dent */}
      <rect x="11" y="-8" width="4"  height="3"  fill="#5a3008" />
      <rect x="17" y="-8" width="4"  height="3"  fill="#5a3008" />
      {/* Hat band */}
      <rect x="9"  y="1"  width="14" height="2"  fill="#3d1a00" />
      {/* Brim */}
      <rect x="3"  y="2"  width="26" height="3"  fill="#7a4a10" />
      {/* Sideburns */}
      <rect x="9"  y="9"  width="2"  height="4"  fill="#5a3008" />
      <rect x="21" y="9"  width="2"  height="4"  fill="#5a3008" />
    </>
  )
}

function KarlRossoAccessories() {
  return (
    <>
      {/* Beret body */}
      <ellipse cx="16" cy="1" rx="11" ry="7" fill="#cc1111" />
      {/* Beret flat base */}
      <rect x="8" y="0" width="16" height="3" fill="#cc1111" />
      {/* Beret top knob */}
      <rect x="15" y="-6" width="2" height="7" fill="#aa0000" />
      {/* Stubble */}
      <rect x="12" y="9"  width="2"  height="2" fill="#442222" opacity="0.7" />
      <rect x="15" y="10" width="3"  height="2" fill="#442222" opacity="0.7" />
      <rect x="19" y="9"  width="2"  height="2" fill="#442222" opacity="0.7" />
    </>
  )
}

function CharlesPembertonAccessories({ color }: { color: string }) {
  return (
    <>
      {/* Bowler hat crown */}
      <rect x="10" y="-7" width="12" height="10" fill="#1a1a1a" />
      {/* Crown rounded top */}
      <rect x="11" y="-8" width="10" height="3"  fill="#1a1a1a" />
      {/* Brim */}
      <rect x="5"  y="2"  width="22" height="3"  fill="#1a1a1a" />
      {/* Tie knot */}
      <rect x="13" y="12" width="6"  height="3"  fill="#aa2222" />
      {/* Tie body */}
      <rect x="14" y="15" width="4"  height="12" fill="#aa2222" />
      {/* Tie tip */}
      <rect x="15" y="27" width="2"  height="2"  fill="#aa2222" />
      {/* Pocket square */}
      <rect x="22" y="13" width="3"  height="3"  fill="#fff" opacity="0.8" />
    </>
  )
}

function GigiBellavitaAccessories({ color }: { color: string }) {
  return (
    <>
      {/* Messy hair */}
      <rect x="9"  y="-2" width="14" height="4" fill="#cc8833" />
      <rect x="8"  y="0"  width="3"  height="6" fill="#cc8833" />
      <rect x="21" y="0"  width="3"  height="5" fill="#cc8833" />
      <rect x="11" y="-3" width="3"  height="2" fill="#cc8833" />
      <rect x="17" y="-4" width="4"  height="3" fill="#cc8833" />
      {/* Beer belly (wider body override) */}
      <rect x="6" y="18" width="20" height="10" fill={color} />
      {/* Beer mug in right hand */}
      <rect x="28" y="17" width="5"  height="7"  fill="#f0c060" />
      <rect x="33" y="19" width="2"  height="4"  fill="#f0c060" />
      {/* Foam */}
      <rect x="28" y="15" width="5"  height="3"  fill="#fff" opacity="0.9" />
    </>
  )
}

function ZoeFuturaAccessories({ color }: { color: string }) {
  return (
    <>
      {/* Hair mass */}
      <rect x="9"  y="-8" width="14" height="10" fill={color} />
      <rect x="8"  y="-3" width="3"  height="14" fill={color} />
      {/* Ponytail */}
      <rect x="22" y="-2" width="3"  height="18" fill={color} />
      <rect x="23" y="14" width="2"  height="6"  fill={color} />
      {/* Phone in left hand */}
      <rect x="0"  y="18" width="4"  height="6"  fill="#222" />
      <rect x="1"  y="19" width="2"  height="4"  fill="#66aaff" opacity="0.8" />
    </>
  )
}

function CharacterSprite({ agentId, color, isTalking, isThinking }: {
  agentId: AgentId
  color: string
  isTalking: boolean
  isThinking: boolean
}) {
  const skinTone = '#f4c884'
  const bounce = isTalking ? 'animate-bounce' : ''

  return (
    <svg
      viewBox="0 0 36 56"
      width="54"
      height="81"
      style={{ imageRendering: 'pixelated', overflow: 'visible' }}
      className={bounce}
    >
      <g transform="translate(2, 10)">
        {/* Accessories rendered behind head */}
        {agentId === 'prof_quark'        && <ProfQuarkAccessories />}
        {agentId === 'bobby_ray'         && <BobbyRayAccessories />}
        {agentId === 'karl_rosso'        && <KarlRossoAccessories />}
        {agentId === 'charles_pemberton' && <CharlesPembertonAccessories color={color} />}
        {agentId === 'gigi_bellavita'    && <GigiBellavitaAccessories color={color} />}
        {agentId === 'zoe_futura'        && <ZoeFuturaAccessories color={color} />}

        {/* Head */}
        <rect x="10" y="0"  width="12" height="12" fill={skinTone} />
        {/* Eyes */}
        <rect x="12" y="3"  width="2"  height="2"  fill="#333" />
        <rect x="18" y="3"  width="2"  height="2"  fill="#333" />
        {/* Mouth */}
        {isTalking
          ? <rect x="13" y="8" width="6" height="2" fill="#333" />
          : <rect x="13" y="8" width="6" height="1" fill="#555" />
        }
        {/* Body */}
        <rect x="8"  y="12" width="16" height="18" fill={color} />
        {/* Arms */}
        <rect x="2"  y="13" width="6"  height="12" fill={color} />
        <rect x="24" y="13" width="6"  height="12" fill={color} />
        {/* Legs */}
        <rect x="9"  y="30" width="5"  height="14" fill="#333" />
        <rect x="18" y="30" width="5"  height="14" fill="#333" />
        {/* Feet */}
        <rect x="7"  y="42" width="8"  height="4"  fill="#222" />
        <rect x="17" y="42" width="8"  height="4"  fill="#222" />

        {/* Thinking dots */}
        {isThinking && (
          <>
            <circle cx="24" cy="1"  r="1.5" fill="#f0c060" opacity="0.9" />
            <circle cx="28" cy="-1" r="1.0" fill="#f0c060" opacity="0.7" />
            <circle cx="31" cy="-3" r="0.7" fill="#f0c060" opacity="0.5" />
          </>
        )}
      </g>
    </svg>
  )
}

// ── Profile modal ────────────────────────────────────────────────────────────

function ProfileModal({ agent, onClose }: { agent: AgentMeta; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="p-6 rounded w-full mx-4"
        style={{ background: '#0d0300', border: `2px solid ${agent.color}`, fontFamily: 'monospace', boxShadow: `0 0 24px ${agent.color}44`, maxWidth: '480px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div style={{ width: 10, height: 10, background: agent.color, borderRadius: 2 }} />
          <h2 className="text-lg font-bold" style={{ color: agent.color }}>{agent.name}</h2>
        </div>
        <p className="text-xs mb-3 uppercase tracking-widest" style={{ color: '#5d3a00' }}>{agent.archetype}</p>
        <p className="text-sm leading-relaxed" style={{ color: '#c8b898' }}>{agent.description}</p>
        <button
          className="mt-5 text-xs px-4 py-2 rounded font-bold"
          style={{ background: agent.color, color: '#000', fontFamily: 'monospace' }}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ── Character ────────────────────────────────────────────────────────────────

export default function Character({ agent, isTalking, isThinking, lastMessage, bubbleAlign = 'center' }: Props) {
  const [showProfile, setShowProfile] = useState(false)
  const [bubble, setBubble] = useState<ChatMessage | null>(null)
  const mountedIdRef = useRef<string | null>(lastMessage?.id ?? null)

  const dismiss = useCallback(() => setBubble(null), [])

  useEffect(() => {
    if (lastMessage && lastMessage.id !== mountedIdRef.current) {
      mountedIdRef.current = lastMessage.id
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
          agentId={agent.id}
          color={agent.color}
          isTalking={isTalking}
          isThinking={isThinking}
        />
        {/* Name tag */}
        <div className="mt-1 flex flex-col items-center gap-0.5">
          <span
            className="text-xs font-bold px-1"
            style={{
              color: agent.color,
              fontFamily: 'monospace',
              textShadow: '1px 1px 0 #000',
              letterSpacing: '0.03em',
            }}
          >
            {agent.name.split(' ')[0]}
          </span>
          <span
            className="text-center"
            style={{
              color: '#3d1e00',
              fontFamily: 'monospace',
              fontSize: '9px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {agent.archetype}
          </span>
        </div>
      </div>
      {showProfile && <ProfileModal agent={agent} onClose={() => setShowProfile(false)} />}
    </>
  )
}
