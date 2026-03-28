// frontend/src/components/SpeechBubble.tsx
import { useEffect, useState } from 'react'

interface Props {
  text: string
  color: string
  align?: 'left' | 'center' | 'right'
  onDismiss: () => void
}

export default function SpeechBubble({ text, color, align = 'center', onDismiss }: Props) {
  const [displayed, setDisplayed] = useState('')
  const [visible, setVisible] = useState(true)

  // Typewriter effect — then dismiss 4s after completion
  useEffect(() => {
    setDisplayed('')
    setVisible(true)
    let i = 0
    let dismissTimer: ReturnType<typeof setTimeout>
    let fadeTimer: ReturnType<typeof setTimeout>

    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        // Start dismiss timer only after typewriting is done
        dismissTimer = setTimeout(() => {
          setVisible(false)
          fadeTimer = setTimeout(onDismiss, 300)
        }, 4000)
      }
    }, 20)

    return () => {
      clearInterval(interval)
      clearTimeout(dismissTimer)
      clearTimeout(fadeTimer)
    }
  }, [text, onDismiss])

  const alignClass =
    align === 'left' ? 'left-0' :
    align === 'right' ? 'right-0' :
    'left-1/2 -translate-x-1/2'

  return (
    <div
      className={`absolute bottom-full mb-2 z-20 ${alignClass}`}
      style={{
        width: '220px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s',
        pointerEvents: 'none',
      }}
    >
      <div
        className="relative px-3 py-2 rounded text-center"
        style={{
          fontSize: '13px',
          background: 'rgba(5, 2, 0, 0.92)',
          border: `2px solid ${color}`,
          color: '#e8d8b0',
          fontFamily: 'monospace',
          lineHeight: '1.5',
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
