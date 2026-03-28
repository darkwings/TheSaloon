// frontend/src/types.ts

export type AgentId =
  | 'prof_quark'
  | 'bobby_ray'
  | 'karl_rosso'
  | 'charles_pemberton'
  | 'gigi_bellavita'
  | 'zoe_futura'

export interface AgentMeta {
  id: AgentId
  name: string
  color: string
  archetype: string
  description: string
}

export const AGENTS: AgentMeta[] = [
  { id: 'prof_quark',      name: 'Prof. Isacco Quark', color: '#88aaff', archetype: 'The Scientist',    description: 'Rational, evidence-based. Cites sources, corrects others gently with data.' },
  { id: 'bobby_ray',       name: 'Bobby Ray Buster',   color: '#ff6644', archetype: 'The Redneck',      description: 'Ultra-right American. Beer, BBQ, anti-establishment. 🍺' },
  { id: 'karl_rosso',      name: 'Comrade Karl Rosso', color: '#ff4444', archetype: 'The Communist',    description: 'Every topic leads back to capitalism as the root cause.' },
  { id: 'charles_pemberton', name: 'Charles Pemberton',  color: '#88cc88', archetype: 'The Center-Right', description: 'Moderate conservative. Seeks compromise, dislikes extremism.' },
  { id: 'gigi_bellavita',  name: 'Gigi Bellavita',     color: '#ffcc44', archetype: 'The Simple One',   description: 'Hedonistic and distracted. Only cares about food, friends, and fun.' },
  { id: 'zoe_futura',      name: 'Zoe Futura',         color: '#ff88cc', archetype: 'The Young Idealist', description: "Angry, well-educated. Wants to change the world before it's too late." },
]

export type EngineStatus = 'idle' | 'running' | 'paused' | 'stopped'

export interface ChatMessage {
  id: string
  agentId: AgentId
  agentName: string
  text: string
  timestamp: string
}

export interface WsEvent {
  type: 'message' | 'agent_thinking' | 'status' | 'topic_set'
  agent?: AgentId
  agent_name?: string
  text?: string
  timestamp?: string
  value?: EngineStatus
  topic?: string
  conversation_id?: number
}

export interface Conversation {
  id: number
  title: string
  topic: string
  llm_provider: string
  created_at: string
  ended_at: string | null
}

export interface AppSettings {
  llm_provider: string
  search_provider: string
  conversation_delay_seconds: string
  ollama_base_url: string
  ollama_model: string
}
