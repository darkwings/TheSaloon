// frontend/src/components/SpeechBubble.tsx
import { useEffect, useState } from 'react'

interface Props {
  text: string
  color: string
  onDismiss: () => void
}

export default function SpeechBubble({ text, color, onDismiss }: Props) {
  const [displayed, setDisplayed] = useState('')
  const [visible, setVisible] = useState(true)

  // Typewriter effect
  useEffect(() => {
    setDisplayed('')
    setVisible(true)
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(interval)
    }, 20)
    return () => clearInterval(interval)
  }, [text])

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout>
    const timeout = setTimeout(() => {
      setVisible(false)
      fadeTimer = setTimeout(onDismiss, 300)
    }, 5000)
    return () => {
      clearTimeout(timeout)
      clearTimeout(fadeTimer)
    }
  }, [text, onDismiss])

  return (
    <div
      className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s',
        pointerEvents: 'none',
      }}
    >
      <div
        className="relative px-3 py-2 rounded text-xs max-w-[180px] text-center"
        style={{
          background: 'rgba(5, 2, 0, 0.92)',
          border: `2px solid ${color}`,
          color: '#e8d8b0',
          fontFamily: 'monospace',
          lineHeight: '1.4',
          boxShadow: `0 0 8px ${color}40`,
          wordBreak: 'break-word',
        }}
      >
        {displayed}
        {/* tail */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full"
          style={{
            width: 0, height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: `6px solid ${color}`,
          }}
        />
      </div>
    </div>
  )
}
