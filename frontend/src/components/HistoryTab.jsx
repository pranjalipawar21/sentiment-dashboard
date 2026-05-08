import { useState, useEffect } from 'react'
import { FixedSizeList } from 'react-window'
import { getHistory, clearHistory } from '../api'
import { TrendLine } from './Charts'

function badge(label) {
  const l = (label||'').toLowerCase()
  return l.includes('pos') ? 'badge positive' : l.includes('neg') ? 'badge negative' : 'badge neutral'
}

function HistRow({ index, style, data }) {
  const item = data[index]
  const color = item.compound >= 0.05 ? 'var(--green)' : item.compound <= -0.05 ? 'var(--red)' : 'var(--amber)'
  const date  = item.created_at ? new Date(item.created_at).toLocaleString() : ''
  return (
    <div style={{ ...style, paddingBottom:5 }}>
      <div className="hrow" style={{ height:'calc(100% - 5px)' }}>
        <span className="num">#{item.id}</span>
        <span className={badge(item.trans_label)}>{item.trans_label}</span>
        <span className="compound" style={{ color }}>
          {item.compound >= 0 ? '+' : ''}{item.compound?.toFixed(4)}
        </span>
        <span className="snippet">{item.text_snippet}</span>
        <span className="ts">{date}</span>
        <span className="src">{item.source}</span>
      </div>
    </div>
  )
}

export default function HistoryTab() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function load() {
    setLoading(true); setError(null)
    try   { setData(await getHistory(200, 0)) }
    catch (e) { setError(e.message) }
    finally   { setLoading(false) }
  }

  async function handleClear() {
    if (!window.confirm('Clear all history from the database?')) return
    await clearHistory()
    load()
  }

  useEffect(() => { load() }, [])

  const items = data?.items ?? []
  const trend = [...items].reverse()

  const posCount = items.filter(i => (i.trans_label||'').toLowerCase().includes('pos')).length
  const negCount = items.filter(i => (i.trans_label||'').toLowerCase().includes('neg')).length
  const neuCount = items.filter(i => (i.trans_label||'').toLowerCase().includes('neu')).length
  const avgCmp   = items.length
    ? items.reduce((s, i) => s + (i.compound || 0), 0) / items.length
    : 0

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Header */}
      <div className="flex-between">
        <div>
          <div className="sec-title" style={{ marginBottom:2 }}>
            Persistent History — PostgreSQL
          </div>
          <p style={{ fontSize:12, color:'var(--muted)' }}>
            {data ? `${data.total} analyses stored` : 'Loading…'} · Survives page reloads (no in-memory data loss)
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn-ghost" onClick={load} disabled={loading}>
            {loading ? <span className="spinner" /> : '↻ Refresh'}
          </button>
          {items.length > 0 && (
            <button className="btn-ghost btn-danger" onClick={handleClear}>
              🗑 Clear All
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {!loading && items.length === 0 && (
        <div className="empty">
          <div className="icon">📊</div>
          <span>No history yet — run analyses in the Analyze or Batch tabs</span>
        </div>
      )}

      {/* Longitudinal trend */}
      {trend.length >= 2 && (
        <div>
          <div className="sec-title">Longitudinal Compound Score Trend</div>
          <TrendLine series={trend} />
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="divider" />

          {/* Stats */}
          <div className="g3" style={{ gridTemplateColumns:'1fr 1fr 1fr 1fr' }}>
            <div className="mbox">
              <div className="val pos">{posCount}</div>
              <div className="lbl">Positive</div>
            </div>
            <div className="mbox">
              <div className="val neg">{negCount}</div>
              <div className="lbl">Negative</div>
            </div>
            <div className="mbox">
              <div className="val neu">{neuCount}</div>
              <div className="lbl">Neutral</div>
            </div>
            <div className="mbox">
              <div className="val pur" style={{ fontSize:17 }}>
                {avgCmp >= 0 ? '+' : ''}{avgCmp.toFixed(3)}
              </div>
              <div className="lbl">Avg Compound</div>
            </div>
          </div>

          {/* Virtual-scroll list */}
          <div>
            <div className="sec-title">All Entries ({items.length})</div>
            <FixedSizeList
              height={360}
              itemCount={items.length}
              itemSize={50}
              itemData={items}
              style={{ border:'1px solid var(--border)', borderRadius:10 }}
            >
              {HistRow}
            </FixedSizeList>
          </div>
        </>
      )}
    </div>
  )
}
