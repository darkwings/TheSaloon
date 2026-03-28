// frontend/src/store/saloonStore.ts
import { create } from 'zustand'
import type { ChatMessage, EngineStatus, AgentId } from '../types'

interface SaloonState {
  messages: ChatMessage[]
  status: EngineStatus
  thinkingAgent: AgentId | null
  topic: string | null

  addMessage: (msg: ChatMessage) => void
  setStatus: (status: EngineStatus) => void
  setThinkingAgent: (agent: AgentId | null) => void
  setTopic: (topic: string) => void
  clearMessages: () => void
}

export const useSaloonStore = create<SaloonState>((set) => ({
  messages: [],
  status: 'idle',
  thinkingAgent: null,
  topic: null,

  addMessage: (msg) =>
    set((state) => {
      if (state.messages.some((m) => m.id === msg.id)) return state
      return { messages: [...state.messages, msg], thinkingAgent: null }
    }),

  setStatus: (status) => set({ status }),

  setThinkingAgent: (agent) => set({ thinkingAgent: agent }),

  setTopic: (topic) => set({ topic, messages: [], status: 'running' }),

  clearMessages: () => set({ messages: [] }),
}))
