// frontend/src/api/client.ts
import type { Conversation, AppSettings } from '../types'

const BASE = '/api'

export async function startConversation(topic: string): Promise<{ conversation_id: number }> {
  const res = await fetch(`${BASE}/conversations/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
  })
  return res.json()
}

export async function stopConversation(): Promise<void> {
  await fetch(`${BASE}/conversations/stop`, { method: 'POST' })
}

export async function pauseConversation(): Promise<void> {
  await fetch(`${BASE}/conversations/pause`, { method: 'POST' })
}

export async function resumeConversation(): Promise<void> {
  await fetch(`${BASE}/conversations/resume`, { method: 'POST' })
}

export async function injectMessage(text: string): Promise<void> {
  await fetch(`${BASE}/conversations/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await fetch(`${BASE}/conversations`)
  return res.json()
}

export async function getConversation(id: number): Promise<{ conversation: Conversation; messages: any[] }> {
  const res = await fetch(`${BASE}/conversations/${id}`)
  return res.json()
}

export async function deleteConversation(id: number): Promise<void> {
  await fetch(`${BASE}/conversations/${id}`, { method: 'DELETE' })
}

export async function getSettings(): Promise<AppSettings> {
  const res = await fetch(`${BASE}/settings`)
  return res.json()
}

export async function updateSetting(key: string, value: string): Promise<void> {
  await fetch(`${BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
}
