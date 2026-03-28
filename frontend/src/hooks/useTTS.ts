// frontend/src/hooks/useTTS.ts
import { useCallback, useRef } from 'react'
import type { AgentId } from '../types'

interface VoiceProfile {
  pitch: number   // 0.0 – 2.0
  rate: number    // 0.1 – 10.0
  lang: string
}

const VOICE_PROFILES: Record<AgentId, VoiceProfile> = {
  prof_quark:        { pitch: 1.0, rate: 0.85, lang: 'en-US' }, // measured, deliberate
  bobby_ray:         { pitch: 0.7, rate: 1.05, lang: 'en-US' }, // low, drawling
  karl_rosso:        { pitch: 1.1, rate: 1.10, lang: 'en-US' }, // clipped, intense
  charles_pemberton: { pitch: 0.9, rate: 0.90, lang: 'en-GB' }, // british, unhurried
  gigi_bellavita:    { pitch: 1.2, rate: 1.00, lang: 'it-IT' }, // relaxed italian
  zoe_futura:        { pitch: 1.4, rate: 1.20, lang: 'en-US' }, // high energy, fast
}

export function useTTS(enabled: boolean) {
  const queueRef = useRef<SpeechSynthesisUtterance[]>([])
  const speakingRef = useRef(false)

  const processQueue = useCallback(() => {
    if (speakingRef.current || queueRef.current.length === 0) return
    const utterance = queueRef.current.shift()!
    speakingRef.current = true
    utterance.onend = () => {
      speakingRef.current = false
      processQueue()
    }
    utterance.onerror = () => {
      speakingRef.current = false
      processQueue()
    }
    window.speechSynthesis.speak(utterance)
  }, [])

  const speak = useCallback((text: string, agentId: AgentId) => {
    if (!enabled || !window.speechSynthesis) return
    const profile = VOICE_PROFILES[agentId]
    // Strip markdown bold (**text**) before speaking
    const clean = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.pitch = profile.pitch
    utterance.rate = profile.rate
    utterance.lang = profile.lang
    queueRef.current.push(utterance)
    processQueue()
  }, [enabled, processQueue])

  const stop = useCallback(() => {
    queueRef.current = []
    window.speechSynthesis.cancel()
    speakingRef.current = false
  }, [])

  return { speak, stop }
}
