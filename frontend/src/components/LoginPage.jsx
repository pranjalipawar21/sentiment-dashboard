import { useState } from 'react'
import { loginUser, registerUser } from '../api'

export default function LoginPage({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername]     = useState('')
  const [password, setPassword]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    setLoading(true); setError(null)
    try {
      const fn = isRegister ? registerUser : loginUser
      const data = await fn(username.trim(), password)
      localStorage.setItem('sid_token', data.token)
      localStorage.setItem('sid_user', data.username)
      onLogin(data)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', background: 'var(--bg-base)',
    }}>
      {/* Background orbs */}
      <div style={{
        position: 'absolute', top: '-15%', left: '-10%', width: '55vw', height: '55vw',
        background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)',
        filter: 'blur(80px)', zIndex: 0, animation: 'float 20s infinite alternate',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-10%', width: '60vw', height: '60vw',
        background: 'radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)',
        filter: 'blur(100px)', zIndex: 0, animation: 'float 25s infinite alternate-reverse',
      }} />

      <div style={{
        position: 'relative', zIndex: 10, width: '100%', maxWidth: 420, padding: '0 20px',
      }}>
        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 56, marginBottom: 12, filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.5))' }}>🧠</div>
          <h1 style={{
            fontFamily: 'var(--sans)', fontSize: 28, fontWeight: 800,
            background: 'linear-gradient(135deg, #A78BFA 0%, #EC4899 50%, #FBBF24 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: 6,
          }}>
            Sentiment Intelligence
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Dual-model NLP · HuggingFace + VADER
          </p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} style={{
          background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
          backdropFilter: 'blur(20px)', borderRadius: 24, padding: 36,
          boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.02)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
              {isRegister ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {isRegister ? 'Register to start analyzing' : 'Sign in to continue'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">Username</label>
              <input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                style={{ fontFamily: 'var(--sans)' }}
              />
            </div>

            {error && <div className="error-box">{error}</div>}

            <button className="btn" type="submit" disabled={loading || !username.trim() || !password.trim()}>
              {loading
                ? <><span className="spinner" /> {isRegister ? 'Creating…' : 'Signing in…'}</>
                : isRegister ? '🚀  Create Account' : '🔐  Sign In'}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(null) }}
              style={{
                background: 'none', border: 'none', color: 'var(--purple)',
                fontFamily: 'var(--sans)', fontSize: 14, cursor: 'pointer',
                textDecoration: 'underline', fontWeight: 500,
              }}
            >
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
            </button>
          </div>

          <div style={{
            marginTop: 20, padding: '10px 14px', borderRadius: 10,
            background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)',
            fontSize: 12, color: 'var(--text-muted)', textAlign: 'center',
          }}>
            Demo: <strong style={{ color: 'var(--text-main)' }}>admin</strong> / <strong style={{ color: 'var(--text-main)' }}>admin123</strong>
          </div>
        </form>
      </div>
    </div>
  )
}
