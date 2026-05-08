import { useState } from 'react'
import { compareTexts } from '../api'
import { RadarChart, EmotionDonut } from './Charts'

function cls(label) {
  const l = (label||'').toLowerCase()
  return l.includes('pos') ? 'pos' : l.includes('neg') ? 'neg' : 'neu'
}

export default function CompareTab() {
  const [textA, setTextA]   = useState('')
  const [textB, setTextB]   = useState('')
  const [labelA, setLabelA] = useState('Text A')
  const [labelB, setLabelB] = useState('Text B')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  async function run() {
    if (!textA.trim() || !textB.trim()) return
    setLoading(true); setError(null)
    try   { setResult(await compareTexts(textA, labelA, textB, labelB)) }
    catch (e) { setError(e?.response?.data?.detail || e.message || 'Comparison failed') }
    finally   { setLoading(false) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Input row */}
      <div className="g2">
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <label className="field-label">Label A</label>
          <input type="text" value={labelA} onChange={e => setLabelA(e.target.value)} />
          <label className="field-label" style={{ marginTop:6 }}>Text A</label>
          <textarea rows={6} placeholder="Paste first text…" value={textA} onChange={e => setTextA(e.target.value)} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <label className="field-label">Label B</label>
          <input type="text" value={labelB} onChange={e => setLabelB(e.target.value)} />
          <label className="field-label" style={{ marginTop:6 }}>Text B</label>
          <textarea rows={6} placeholder="Paste second text…" value={textB} onChange={e => setTextB(e.target.value)} />
        </div>
      </div>

      <button className="btn" onClick={run} disabled={loading || !textA.trim() || !textB.trim()}>
        {loading ? <><span className="spinner" /> Comparing…</> : '⚖️  Compare Side-by-Side'}
      </button>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div className="divider" />

          {/* Metrics */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div className="mbox">
              <div className={`val ${cls(result.a?.trans_label)}`} style={{ fontSize:15 }}>{result.a?.trans_label}</div>
              <div className="lbl">{labelA} Sentiment</div>
            </div>
            <div className="mbox">
              <div className={`val ${cls(result.b?.trans_label)}`} style={{ fontSize:15 }}>{result.b?.trans_label}</div>
              <div className="lbl">{labelB} Sentiment</div>
            </div>
            <div className="mbox">
              <div className="val pnk" style={{ fontSize:17 }}>{result.diff?.toFixed(4)}</div>
              <div className="lbl">Sentiment Δ</div>
            </div>

            <div className="mbox">
              <div className="val pur" style={{ fontSize:17 }}>
                {result.a?.compound >= 0 ? '+' : ''}{result.a?.compound?.toFixed(4)}
              </div>
              <div className="lbl">{labelA} Compound</div>
            </div>
            <div className="mbox">
              <div className="val" style={{ fontSize:17, color:'var(--indigo)' }}>
                {result.b?.compound >= 0 ? '+' : ''}{result.b?.compound?.toFixed(4)}
              </div>
              <div className="lbl">{labelB} Compound</div>
            </div>
            <div className="mbox">
              <div className="val" style={{ fontSize:13 }}>
                {Object.entries(result.a?.emotions||{}).sort((x,y)=>y[1]-x[1])[0]?.[0] || '—'}
                {' vs '}
                {Object.entries(result.b?.emotions||{}).sort((x,y)=>y[1]-x[1])[0]?.[0] || '—'}
              </div>
              <div className="lbl">Top Emotions</div>
            </div>
          </div>

          {/* Radar chart */}
          <div>
            <div className="sec-title">Emotion Radar Comparison</div>
            <RadarChart a={result.a} b={result.b} labelA={labelA} labelB={labelB} />
          </div>

          {/* Donut side-by-side */}
          <div className="g2">
            <div>
              <div className="sec-title">{labelA} — Emotions</div>
              <EmotionDonut emotions={result.a?.emotions} />
            </div>
            <div>
              <div className="sec-title">{labelB} — Emotions</div>
              <EmotionDonut emotions={result.b?.emotions} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
