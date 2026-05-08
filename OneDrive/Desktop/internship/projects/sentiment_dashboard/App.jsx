import { useState } from 'react'
import AnalyzeTab from './components/AnalyzeTab'
import CompareTab from './components/CompareTab'
import BatchTab   from './components/BatchTab'
import HistoryTab from './components/HistoryTab'

const TABS = [
  { id: 'analyze', label: '📊 Analyze' },
  { id: 'compare', label: '⚖️ Compare' },
  { id: 'batch',   label: '📁 Batch CSV' },
  { id: 'history', label: '📈 History' },
]

export default function App() {
  const [tab, setTab] = useState('analyze')

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 20% 10%, rgba(124,58,237,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(79,70,229,0.1) 0%, transparent 60%), var(--bg-deep)' }}>

      {/* Header */}
      <header style={{ padding: '28px 36px 0', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{
            fontFamily: 'var(--mono)',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #a78bfa, #ec4899, #f59e0b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 6,
          }}>
            🧠 Sentiment Intelligence Dashboard
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Dual-model NLP · HuggingFace Transformers + VADER · FastAPI + PostgreSQL
          </p>
        </div>

        <div className="tab-bar">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main style={{ padding: '28px 36px 60px', maxWidth: 1200, margin: '0 auto' }}>
        <div className="card">
          {tab === 'analyze' && <AnalyzeTab />}
          {tab === 'compare' && <CompareTab />}
          {tab === 'batch'   && <BatchTab />}
          {tab === 'history' && <HistoryTab />}
        </div>
      </main>
    </div>
  )
}
