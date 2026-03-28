// frontend/src/hooks/useWebSocket.ts
import { useEffect, useRef } from 'react'
import { useSaloonStore } from '../store/saloonStore'
import type { WsEvent } from '../types'

const WS_URL = `ws://${window.location.hostname}:8000/ws`

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { addMessage, setStatus, setThinkingAgent, setTopic } = useSaloonStore()

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onmessage = (e) => {
        try {
          const event: WsEvent = JSON.parse(e.data)
          switch (event.type) {
            case 'message':
              if (event.agent && event.agent_name && event.text && event.timestamp) {
                addMessage({
                  id: `${event.timestamp}-${event.agent}`,
                  agentId: event.agent,
                  agentName: event.agent_name,
                  text: event.text,
                  timestamp: event.timestamp,
                })
              }
              break
            case 'agent_thinking':
              setThinkingAgent(event.agent ?? null)
              break
            case 'status':
              if (event.value) setStatus(event.value)
              break
            case 'topic_set':
              if (event.topic) setTopic(event.topic)
              break
          }
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        reconnectRef.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [])
}
