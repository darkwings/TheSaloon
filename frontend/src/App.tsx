import { useState } from 'react'
import SaloonPage from './components/SaloonPage'
import SettingsPage from './components/SettingsPage'

export default function App() {
  const [page, setPage] = useState<'saloon' | 'settings'>('saloon')

  return (
    <div className="min-h-screen" style={{ background: '#0d0500', color: '#e8d8b0' }}>
      {page === 'saloon'
        ? <SaloonPage onOpenSettings={() => setPage('settings')} />
        : <SettingsPage onBack={() => setPage('saloon')} />
      }
    </div>
  )
}
