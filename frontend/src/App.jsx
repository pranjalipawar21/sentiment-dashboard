import { useState, useEffect } from 'react'
import LoginPage    from './components/LoginPage'
import AnalyzeTab   from './components/AnalyzeTab'
import CompareTab   from './components/CompareTab'
import BatchTab     from './components/BatchTab'
import HistoryTab   from './components/HistoryTab'
import UrlTab       from './components/UrlTab'
import SummarizeTab from './components/SummarizeTab'

const TABS = [
  { id: 'analyze',    label: '📊 Analyze'    },
  { id: 'url',        label: '🔗 URL Scrape' },
  { id: 'compare',    label: '⚖️ Compare'   },
  { id: 'summarize',  label: '🤖 AI Summary' },
  { id: 'batch',      label: '📁 Batch CSV'  },
  { id: 'history',    label: '📈 History'    },
]

export default function App() {
  const [tab, setTab]   = useState('analyze')
  const [user, setUser] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('sid_token')
    const name  = localStorage.getItem('sid_user')
    if (token && name) setUser({ token, username: name })
  }, [])

  function handleLogin(data) {
    setUser({ token: data.token, username: data.username })
  }

  function handleLogout() {
    localStorage.removeItem('sid_token')
    localStorage.removeItem('sid_user')
    setUser(null)
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--bg-base)'
    }}>
      {/* Dynamic Background Orbs */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
        filter: 'blur(60px)', zIndex: 0, animation: 'float 20s infinite alternate'
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-10%', width: '60vw', height: '60vw',
        background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)',
        filter: 'blur(80px)', zIndex: 0, animation: 'float 25s infinite alternate-reverse'
      }} />

      <style>{`
        @keyframes float {
          0% { transform: translate(0, 0) rotate(0deg); }
          100% { transform: translate(50px, 50px) rotate(10deg); }
        }
      `}</style>
      <div className="app-shell">

        {/* Header */}
        <div className="header">
          <h1>🧠 Sentiment Intelligence Dashboard</h1>
          <p>
            Dual-model NLP &nbsp;·&nbsp; HuggingFace Transformers + VADER &nbsp;·&nbsp;
            FastAPI + PostgreSQL &nbsp;·&nbsp; React.js
          </p>
          {/* User bar */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            marginTop: 14, padding: '6px 16px', borderRadius: 10,
            background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
            fontSize: 13,
          }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Signed in as <strong style={{ color: 'var(--text-main)' }}>{user.username}</strong>
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: 'none', border: 'none', color: '#FCA5A5',
                fontFamily: 'var(--sans)', fontSize: 12, cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="card">
          {tab === 'analyze'   && <AnalyzeTab />}
          {tab === 'url'       && <UrlTab />}
          {tab === 'compare'   && <CompareTab />}
          {tab === 'summarize' && <SummarizeTab />}
          {tab === 'batch'     && <BatchTab />}
          {tab === 'history'   && <HistoryTab />}
        </div>

      </div>
    </div>
  )
}
