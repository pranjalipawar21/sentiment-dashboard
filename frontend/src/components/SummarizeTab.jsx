import { useState } from 'react'
import { summarizeText, extractTopics } from '../api'

export default function SummarizeTab() {
  const [text, setText]           = useState('')
  const [summary, setSummary]     = useState(null)
  const [topics, setTopics]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [topicLoad, setTopicLoad] = useState(false)
  const [error, setError]         = useState(null)

  async function runSummarize() {
    if (!text.trim()) return
    setLoading(true); setError(null)
    try { setSummary(await summarizeText(text)) }
    catch (e) { setError(e?.response?.data?.detail || e.message || 'Summarization failed') }
    finally { setLoading(false) }
  }

  async function runTopics() {
    if (!text.trim()) return
    setTopicLoad(true); setError(null)
    try { setTopics(await extractTopics(text)) }
    catch (e) { setError(e?.response?.data?.detail || e.message || 'Topic extraction failed') }
    finally { setTopicLoad(false) }
  }

  async function runBoth() {
    if (!text.trim()) return
    setLoading(true); setTopicLoad(true); setError(null)
    try {
      const [s, t] = await Promise.all([summarizeText(text), extractTopics(text)])
      setSummary(s); setTopics(t)
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Analysis failed')
    } finally {
      setLoading(false); setTopicLoad(false)
    }
  }

  const SAMPLES = [
    { label: '📱 Product Reviews', text: "I bought this phone last week and the camera quality is absolutely stunning. The night mode captures incredible detail. However, the battery life is disappointing - it barely lasts through the day with moderate use. The screen is beautiful with vivid colors and smooth scrolling. Customer support was helpful when I had setup issues. The price feels a bit high compared to competitors offering similar specs. The fingerprint sensor works flawlessly. Overall, it's a solid phone with a few areas that need improvement in future updates." },
    { label: '🏨 Hotel Feedback', text: "Our stay at this hotel was a mixed experience. The room was spacious and clean with a lovely ocean view. The breakfast buffet had excellent variety and fresh options. However, the WiFi was extremely slow and unreliable. The pool area was crowded and poorly maintained. The front desk staff were friendly and accommodating. Check-in took over 30 minutes due to system issues. The spa services were outstanding and reasonably priced. Parking was overpriced at $35 per night. We would consider returning if they address the connectivity issues." },
  ]

  return (
    <div className="g-split">
      {/* Left: Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="field-label">Quick Samples</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SAMPLES.map(s => (
              <button key={s.label} className="btn-ghost btn-sm" onClick={() => setText(s.text)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="field-label">Input Text (min 50 characters)</label>
          <textarea
            rows={10}
            placeholder="Paste a long text — product reviews, articles, social media posts — to summarize and extract topics…"
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
            {text.length} characters · {text.split(/\s+/).filter(Boolean).length} words
          </div>
        </div>

        <button className="btn" onClick={runBoth} disabled={loading || topicLoad || text.trim().length < 50}>
          {loading || topicLoad
            ? <><span className="spinner" /> Processing…</>
            : '🤖  Summarize & Extract Topics'}
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={runSummarize} disabled={loading || text.trim().length < 50}>
            📝 Summarize Only
          </button>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={runTopics} disabled={topicLoad || text.trim().length < 50}>
            🏷️ Topics Only
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}
      </div>

      {/* Right: Results */}
      <div>
        {!summary && !topics && !loading && !topicLoad && (
          <div className="empty">
            <div className="icon">🤖</div>
            <span>Paste text to generate an AI summary and extract key topics</span>
          </div>
        )}

        {(summary || topics) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Summary */}
            {summary && (
              <div>
                <div className="sec-title">AI Summary</div>
                <div style={{
                  padding: '20px 24px', borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(236,72,153,0.05))',
                  border: '1px solid rgba(139,92,246,0.2)',
                  fontSize: 15, lineHeight: 1.7, color: 'var(--text-main)',
                }}>
                  {summary.summary}
                </div>
                <div className="g3" style={{ marginTop: 12 }}>
                  <div className="mbox">
                    <div className="val pur" style={{ fontSize: 16 }}>
                      {summary.method === 'distilbart' ? 'DistilBART' : 'Extractive'}
                    </div>
                    <div className="lbl">Model</div>
                  </div>
                  <div className="mbox">
                    <div className="val" style={{ fontSize: 16, color: 'var(--green)' }}>
                      {summary.original_length}
                    </div>
                    <div className="lbl">Original Chars</div>
                  </div>
                  <div className="mbox">
                    <div className="val pnk" style={{ fontSize: 16 }}>
                      {summary.summary.length}
                    </div>
                    <div className="lbl">Summary Chars</div>
                  </div>
                </div>
              </div>
            )}

            {/* Topics */}
            {topics && topics.topics && topics.topics.length > 0 && (
              <div>
                <div className="divider" />
                <div className="sec-title">Extracted Topics</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {topics.topics.map((t, i) => (
                    <div key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '8px 16px', borderRadius: 12,
                      background: `rgba(${124 + i * 12}, ${58 + i * 15}, ${237 - i * 10}, 0.15)`,
                      border: '1px solid rgba(139,92,246,0.2)',
                      fontSize: 13, fontWeight: 600, color: 'var(--text-main)',
                    }}>
                      <span style={{ textTransform: 'capitalize' }}>{t.topic}</span>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)',
                      }}>
                        {t.frequency}× · {t.relevance}%
                      </span>
                    </div>
                  ))}
                </div>

                {/* Topic bar chart */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {topics.topics.slice(0, 8).map((t, i) => {
                    const maxRel = topics.topics[0]?.relevance || 1
                    const pct = (t.relevance / maxRel) * 100
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 80, textAlign: 'right', color: 'var(--text-muted)' }}>
                          {t.topic}
                        </span>
                        <div style={{ flex: 1, height: 20, borderRadius: 6, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', width: `${pct}%`, borderRadius: 6,
                            background: `linear-gradient(90deg, #7c3aed, #EC4899)`,
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 45 }}>
                          {t.relevance}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
