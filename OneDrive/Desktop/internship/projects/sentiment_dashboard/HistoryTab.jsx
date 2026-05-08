import { useState, useEffect } from 'react'
import { FixedSizeList } from 'react-window'
import { getHistory, clearHistory } from '../api'
import { TrendLine } from './Charts'

function badgeClass(label) {
  const l = (label || '').toLowerCase()
  return l.includes('pos') ? 'badge-positive' : l.includes('neg') ? 'badge-negative' : 'badge-neutral'
}

function HistoryRow({ index, style, data }) {
  const item = data[index]
  const date = item.created_at ? new Date(item.created_at).toLocaleString() : ''
  return (
    <div style={{ ...style, paddingBottom: 6 }}>
      <div className="history-row" style={{ height: 'calc(100% - 6px)', flexWrap: 'nowrap', gap: 10 }}>
        <span style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11, minWidth: 28 }}>
          #{item.id}
        </span>
        <span className={`history-badge ${badgeClass(item.trans_label)}`}>{item.trans_label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, minWidth: 64,
          color: item.compound >= 0.05 ? 'var(--green)' : item.compound <= -0.05 ? 'var(--red)' : 'var(--amber)' }}>
          {item.compound >= 0 ? '+' : ''}{item.compound?.toFixed(4)}
        </span>
        <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)' }}>
          {item.text_snippet}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 120, textAlign: 'right', whiteSpace: 'nowrap' }}>
          {date}
        </span>
        <span style={{ fontSize: 10, color: 'var(--muted)', background: 'rgba(124,58,237,0.1)', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
          {item.source}
        </span>
      </div>
    </div>
  )
}

export default function HistoryTab() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await getHistory(200, 0)
      setData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleClear() {
    if (!window.confirm('Clear all history from the database?')) return
    await clearHistory()
    setData(null)
    load()
  }

  useEffect(() => { load() }, [])

  const items = data?.items ?? []
  const trendSeries = [...items].reverse().map(i => ({ compound: i.compound, trans_label: i.trans_label }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="section-title" style={{ marginBottom: 2 }}>
            Persistent Analysis History — PostgreSQL
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            {data ? `${data.total} analyses stored` : 'Loading…'} · Survives page reloads
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={load} disabled={loading}>
            {loading ? '…' : '↻ Refresh'}
          </button>
          {items.length > 0 && (
            <button className="btn-ghost" onClick={handleClear} style={{ color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' }}>
              🗑 Clear All
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}

      {!loading && items.length === 0 && (
        <div className="empty-state">
          <div className="icon">📊</div>
          <span>No history yet. Run analyses in the Analyze or Batch tabs.</span>
        </div>
      )}

      {trendSeries.length >= 2 && (
        <>
          <div>
            <div className="section-title">Longitudinal Compound Score Trend</div>
            <TrendLine series={trendSeries} />
          </div>
          <div className="divider" />
        </>
      )}

      {items.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {['Positive','Negative','Neutral'].map(l => {
              const count = items.filter(i => i.trans_label === l).length
              return (
                <div key={l} className="metric-box" style={{ flex: '1 1 120px', minWidth: 100 }}>
                  <div className={`val ${l.toLowerCase()}`} style={{ fontSize: 28 }}>{count}</div>
                  <div className="lbl">{l}</div>
                </div>
              )
            })}
            <div className="metric-box" style={{ flex: '1 1 120px', minWidth: 100 }}>
              <div className="val" style={{ fontFamily: 'var(--mono)', fontSize: 18, color: 'var(--purple)' }}>
                {items.length > 0
                  ? (items.reduce((s, i) => s + i.compound, 0) / items.length >= 0 ? '+' : '')
                    + (items.reduce((s, i) => s + i.compound, 0) / items.length).toFixed(3)
                  : '—'}
              </div>
              <div className="lbl">Avg Compound</div>
            </div>
          </div>

          <div>
            <div className="section-title" style={{ marginBottom: 8 }}>All Entries ({items.length})</div>
            <FixedSizeList
              height={360}
              itemCount={items.length}
              itemSize={52}
              itemData={items}
              style={{ border: '1px solid var(--border)', borderRadius: 10 }}
            >
              {HistoryRow}
            </FixedSizeList>
          </div>
        </>
      )}
    </div>
  )
}
