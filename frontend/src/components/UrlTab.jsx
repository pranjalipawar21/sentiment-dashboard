import { useState } from 'react'
import { analyzeUrl } from '../api'
import { EmotionDonut, VaderBar, SentenceTrend, KeywordBar } from './Charts'

function cls(label) {
  const l = (label||'').toLowerCase()
  return l.includes('pos') ? 'pos' : l.includes('neg') ? 'neg' : 'neu'
}

export default function UrlTab() {
  const [url, setUrl]         = useState('')
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function run() {
    if (!url.trim()) return
    setLoading(true); setError(null)
    try   { setResult(await analyzeUrl(url)) }
    catch (e) { setError(e?.response?.data?.detail || e.message || 'Scraping or analysis failed') }
    finally   { setLoading(false) }
  }

  return (
    <div className="g-split">

      {/* ── Left: input ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <label className="field-label">External URL</label>
          <input
            type="text"
            placeholder="https://example.com/product-review"
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
        </div>

        <button className="btn" onClick={run} disabled={loading || !url.trim()}>
          {loading ? <><span className="spinner" /> Scraping & Analyzing…</> : '🔗  Analyze URL'}
        </button>

        {error && <div className="error-box">{error}</div>}

        {result && result.title && (
          <div style={{ marginTop: 20 }}>
            <label className="field-label">Scraped Title</label>
            <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, fontSize: 14 }}>
              {result.title}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: results ── */}
      <div>
        {!result && !loading && (
          <div className="empty">
            <div className="icon">🌐</div>
            <span>Paste a URL to scrape and analyze</span>
          </div>
        )}

        {result && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Metrics row */}
            <div className="g3">
              <div className="mbox">
                <div className={`val ${cls(result.trans_label)}`} style={{ fontSize:16 }}>
                  {result.trans_label === 'Positive' ? '✅' : result.trans_label === 'Negative' ? '❌' : '➖'}{' '}
                  {result.trans_label}
                </div>
                <div className="lbl">Transformer</div>
              </div>
              <div className="mbox">
                <div className="val pur">{(result.trans_conf * 100).toFixed(1)}%</div>
                <div className="lbl">Confidence</div>
              </div>
              <div className="mbox">
                <div className={`val ${cls(result.vader_label)}`} style={{ fontSize:17 }}>
                  {result.compound >= 0 ? '+' : ''}{result.compound.toFixed(4)}
                </div>
                <div className="lbl">VADER Compound</div>
              </div>
            </div>

            <div className="g3" style={{ marginTop:-4 }}>
              <div className="mbox">
                <div className="val pos" style={{ fontSize:17 }}>{(result.pos*100).toFixed(1)}%</div>
                <div className="lbl">Positive</div>
              </div>
              <div className="mbox">
                <div className="val neg" style={{ fontSize:17 }}>{(result.neg*100).toFixed(1)}%</div>
                <div className="lbl">Negative</div>
              </div>
              <div className="mbox">
                <div className="val neu" style={{ fontSize:17 }}>{(result.neu*100).toFixed(1)}%</div>
                <div className="lbl">Neutral</div>
              </div>
            </div>

            <div className="divider" />

            {/* Charts */}
            <div className="g2">
              <div>
                <div className="sec-title">Emotion Distribution</div>
                <EmotionDonut emotions={result.emotions} />
              </div>
              <div>
                <div className="sec-title">VADER Scores</div>
                <VaderBar pos={result.pos} neg={result.neg} neu={result.neu} />
              </div>
            </div>

            {/* Sentence trend */}
            {result.sentences?.length >= 2 && (
              <div>
                <div className="sec-title">Sentiment Trend · Sentence-Level</div>
                <SentenceTrend sentences={result.sentences} />
              </div>
            )}

            {/* Sentence breakdown */}
            {result.sentences?.length > 0 && (
              <div>
                <div className="sec-title">Sentence Breakdown (First 20)</div>
                {result.sentences.slice(0, 20).map((s, i) => (
                  <div key={i} className={`sent ${s.label}`}>
                    {s.sentence}
                    <span className="sent-score">({s.compound >= 0 ? '+' : ''}{s.compound})</span>
                  </div>
                ))}
                {result.sentences.length > 20 && (
                  <div className="sent neutral" style={{ textAlign: 'center', opacity: 0.7 }}>
                    ... and {result.sentences.length - 20} more sentences.
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
