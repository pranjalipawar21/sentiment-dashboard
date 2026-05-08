import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { FixedSizeList } from 'react-window'
import { uploadBatch } from '../api'
import { BatchPie } from './Charts'

function badge(label) {
  const l = (label||'').toLowerCase()
  return l.includes('pos') ? 'badge positive' : l.includes('neg') ? 'badge negative' : 'badge neutral'
}

function compoundColor(v) {
  return v >= 0.05 ? 'var(--green)' : v <= -0.05 ? 'var(--red)' : 'var(--amber)'
}

// react-window row — renders one CSV result row
function Row({ index, style, data }) {
  const item = data[index]
  return (
    <div style={{ ...style, paddingBottom: 5 }}>
      <div className="hrow" style={{ height: 'calc(100% - 5px)', alignItems:'flex-start' }}>
        <span className="num">{index + 1}</span>
        <span className={badge(item.trans_label)}>{item.trans_label}</span>
        <span className="compound" style={{ color: compoundColor(item.compound) }}>
          {item.compound >= 0 ? '+' : ''}{item.compound.toFixed(4)}
        </span>
        <span style={{ fontSize:11, color:'var(--muted)', minWidth:40 }}>
          {(item.trans_conf * 100).toFixed(0)}%
        </span>
        <span className="snippet">{item.text}</span>
      </div>
    </div>
  )
}

export default function BatchTab() {
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [progress, setProgress] = useState(0)
  const [error,    setError]    = useState(null)
  const [fileName, setFileName] = useState(null)

  const onDrop = useCallback(async (files) => {
    const file = files[0]
    if (!file) return
    setFileName(file.name)
    setLoading(true); setError(null); setResult(null); setProgress(0)
    try   { setResult(await uploadBatch(file, setProgress)) }
    catch (e) { setError(e?.response?.data?.detail || e.message || 'Upload failed') }
    finally   { setLoading(false); setProgress(0) }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/csv': ['.csv'] }, multiple: false,
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      <div>
        <div className="sec-title">Upload CSV Dataset</div>
        <p style={{ fontSize:13, color:'var(--muted)', marginBottom:12 }}>
          CSV must have a column named <code>text</code>, <code>review</code>, <code>tweet</code>,{' '}
          <code>comment</code>, or <code>content</code>. Designed for social media and product review datasets.
        </p>

        <div {...getRootProps()} className={`dropzone${isDragActive ? ' over' : ''}`}>
          <input {...getInputProps()} />
          <div className="dz-icon">📁</div>
          <p style={{ fontSize:14, fontWeight:600, color:'var(--text)' }}>
            {isDragActive ? 'Drop the CSV here…' : 'Drag & drop a CSV, or click to select'}
          </p>
          <p>{fileName && !loading ? `Selected: ${fileName}` : 'Supports .csv files'}</p>
        </div>
      </div>

      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div className="flex-row">
            <span className="spinner" />
            <span style={{ color:'var(--muted)', fontSize:13 }}>
              Processing…{progress > 0 ? ` ${progress}%` : ''}
            </span>
          </div>
          {progress > 0 && (
            <div className="progress-wrap">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div className="divider" />

          {/* Aggregate stats */}
          <div className="g3">
            <div className="mbox">
              <div className="val pur">{result.total}</div>
              <div className="lbl">Total Rows</div>
            </div>
            <div className="mbox">
              <div className="val" style={{ color: compoundColor(result.aggregate.avg_compound), fontSize:17 }}>
                {result.aggregate.avg_compound >= 0 ? '+' : ''}{result.aggregate.avg_compound.toFixed(4)}
              </div>
              <div className="lbl">Avg Compound</div>
            </div>
            <div className="mbox">
              <div className="val" style={{ fontSize:15 }}>
                <span style={{ color:'var(--red)' }}>{result.aggregate.min_compound.toFixed(3)}</span>
                {' / '}
                <span style={{ color:'var(--green)' }}>{result.aggregate.max_compound.toFixed(3)}</span>
              </div>
              <div className="lbl">Min / Max</div>
            </div>
          </div>

          <div className="g2">
            {/* Pie chart */}
            <div>
              <div className="sec-title">Label Distribution</div>
              <BatchPie aggregate={result.aggregate} />
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
                {Object.entries(result.aggregate.label_counts).map(([l, c]) => (
                  <span key={l} className={badge(l)} style={{ fontSize:12, padding:'4px 12px' }}>
                    {l}: {c}
                  </span>
                ))}
              </div>
            </div>

            {/* Virtual-scroll results list */}
            <div>
              <div className="sec-title">
                All Results — react-window Virtual Scroll ({result.results.length} rows)
              </div>
              <p style={{ fontSize:12, color:'var(--muted)', marginBottom:8 }}>
                Powered by <code>react-window</code> for production-scale dataset performance
              </p>
              {result.results.length > 0 && (
                <FixedSizeList
                  height={300}
                  itemCount={result.results.length}
                  itemSize={50}
                  itemData={result.results}
                  style={{ border:'1px solid var(--border)', borderRadius:10 }}
                >
                  {Row}
                </FixedSizeList>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
