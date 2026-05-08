import { useState } from 'react'
import { analyzeText } from '../api'
import { EmotionDonut, VaderBar, SentenceTrend, KeywordBar } from './Charts'

const SAMPLES = [
  { label: '😊 Positive', text: "I absolutely love this product! It completely transformed my workflow and I couldn't be happier. Truly outstanding quality." },
  { label: '😢 Negative', text: "This is terrible. Deeply disappointed with the quality. Nothing works as expected and customer support was completely unhelpful." },
  { label: '📰 Mixed',    text: "The movie had stunning visuals and a brilliant soundtrack, but the plot was confusing and the ending left me deeply unsatisfied." },
  { label: '📊 Neutral',  text: "The government announced new economic policies today. Markets responded with mixed reactions as analysts debated the potential impact." },
]

function cls(label) {
  const l = (label||'').toLowerCase()
  return l.includes('pos') ? 'pos' : l.includes('neg') ? 'neg' : 'neu'
}

function badgeCls(label) {
  const l = (label||'').toLowerCase()
  return l.includes('pos') ? 'badge positive' : l.includes('neg') ? 'badge negative' : 'badge neutral'
}

export default function AnalyzeTab() {
  const [text, setText]       = useState('')
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function run() {
    if (!text.trim()) return
    setLoading(true); setError(null)
    try   { setResult(await analyzeText(text)) }
    catch (e) { setError(e?.response?.data?.detail || e.message || 'Analysis failed') }
    finally   { setLoading(false) }
  }

  return (
    <div className="g-split">

      {/* ── Left: input ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div>
          <label className="field-label">Quick Samples</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {SAMPLES.map(s => (
              <button key={s.label} className="btn-ghost btn-sm" onClick={() => setText(s.text)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="field-label">Input Text</label>
          <textarea
            rows={9}
            placeholder="Paste any text — news, reviews, tweets, social posts…"
            value={text}
            onChange={e => setText(e.target.value)}
          />
        </div>

        <button className="btn" onClick={run} disabled={loading || !text.trim()}>
          {loading ? <><span className="spinner" /> Analyzing…</> : '🔍  Analyze Sentiment'}
        </button>

        {error && <div className="error-box">{error}</div>}
      </div>

      {/* ── Right: results ── */}
      <div>
        {!result && !loading && (
          <div className="empty">
            <div className="icon">🧠</div>
            <span>Enter text and click Analyze</span>
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
                <div className="sec-title">Sentence Breakdown</div>
                {result.sentences.map((s, i) => (
                  <div key={i} className={`sent ${s.label}`}>
                    {s.sentence}
                    <span className="sent-score">({s.compound >= 0 ? '+' : ''}{s.compound})</span>
                  </div>
                ))}
              </div>
            )}

            {/* Keywords */}
            {result.keywords?.length > 0 && (
              <div>
                <div className="divider" />
                <div className="sec-title">Top Keywords</div>
                <KeywordBar keywords={result.keywords} />
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
