import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { FixedSizeList } from 'react-window'
import { uploadBatch } from '../api'
import { BatchDistribution } from './Charts'

function labelClass(label) {
  if (!label) return ''
  const l = (label || '').toLowerCase()
  return l.includes('pos') ? 'positive' : l.includes('neg') ? 'negative' : 'neutral'
}

function badgeClass(label) {
  const l = (label || '').toLowerCase()
  return l.includes('pos') ? 'badge-positive' : l.includes('neg') ? 'badge-negative' : 'badge-neutral'
}

// react-window row renderer — production-scale virtual scroll
function ResultRow({ index, style, data }) {
  const item = data[index]
  return (
    <div style={{ ...style, paddingBottom: 6 }}>
      <div className="history-row" style={{ height: 'calc(100% - 6px)', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11, minWidth: 28 }}>
          {index + 1}
        </span>
        <span className={`history-badge ${badgeClass(item.trans_label)}`}>{item.trans_label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: labelClass(item.trans_label) === 'positive' ? 'var(--green)' : labelClass(item.trans_label) === 'negative' ? 'var(--red)' : 'var(--amber)', minWidth: 60 }}>
          {item.compound >= 0 ? '+' : ''}{item.compound.toFixed(4)}
        </span>
        <span style={{ fontSize: 13, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.text}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 40, textAlign: 'right' }}>
          {(item.trans_conf * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  )
}

export default function BatchTab() {
  const [result, setResult]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError]       = useState(null)
  const [fileName, setFileName] = useState(null)

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return
    setFileName(file.name)
    setLoading(true); setError(null); setResult(null)
    try {
      const data = await uploadBatch(file, setProgress)
      setResult(data)
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Upload failed')
    } finally {
      setLoading(false); setProgress(0)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/csv': ['.csv'] }, multiple: false,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div className="section-title">Upload CSV Dataset</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          CSV must contain a column named <code style={{ background: 'rgba(124,58,237,0.15)', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--mono)' }}>text</code> (or <code style={{ background: 'rgba(124,58,237,0.15)', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--mono)' }}>review</code> / <code style={{ background: 'rgba(124,58,237,0.15)', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--mono)' }}>tweet</code> / <code style={{ background: 'rgba(124,58,237,0.15)', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--mono)' }}>comment</code>).
          Suitable for social media and product review datasets.
        </p>
        <div {...getRootProps()} className={`dropzone${isDragActive ? ' active' : ''}`}>
          <input {...getInputProps()} />
          <div style={{ fontSize: 32 }}>📁</div>
          <p>
            {isDragActive
              ? 'Drop the CSV here…'
              : 'Drag & drop a CSV file, or click to select'}
          </p>
          {fileName && !loading && <p style={{ color: 'var(--purple)', marginTop: 6 }}>Selected: {fileName}</p>}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="spinner" />
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>
            Processing…{progress > 0 && ` ${progress}%`}
          </span>
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="divider" />

          {/* Aggregate stats */}
          <div className="metric-grid">
            <div className="metric-box">
              <div className="val" style={{ color: 'var(--purple)' }}>{result.total}</div>
              <div className="lbl">Total Rows</div>
            </div>
            <div className="metric-box">
              <div className="val" style={{ fontFamily: 'var(--mono)', fontSize: 18, color: result.aggregate.avg_compound >= 0.05 ? 'var(--green)' : result.aggregate.avg_compound <= -0.05 ? 'var(--red)' : 'var(--amber)' }}>
                {result.aggregate.avg_compound >= 0 ? '+' : ''}{result.aggregate.avg_compound.toFixed(4)}
              </div>
              <div className="lbl">Avg Compound</div>
            </div>
            <div className="metric-box">
              <div className="val" style={{ fontFamily: 'var(--mono)', fontSize: 16 }}>
                <span style={{ color: 'var(--red)' }}>{result.aggregate.min_compound.toFixed(2)}</span>
                {' / '}
                <span style={{ color: 'var(--green)' }}>{result.aggregate.max_compound.toFixed(2)}</span>
              </div>
              <div className="lbl">Min / Max</div>
            </div>
          </div>

          <div className="grid-1-1">
            <div>
              <div className="section-title">Label Distribution</div>
              <BatchDistribution aggregate={result.aggregate} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {Object.entries(result.aggregate.label_counts).map(([label, count]) => (
                  <span key={label} className={`history-badge ${badgeClass(label)}`} style={{ fontSize: 12, padding: '4px 12px' }}>
                    {label}: {count}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="section-title">All Results — Virtual Scroll ({result.results.length} rows)</div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                Using <code style={{ background: 'rgba(124,58,237,0.12)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--mono)' }}>react-window</code> for production-scale performance
              </p>
              {result.results.length > 0 && (
                <FixedSizeList
                  height={320}
                  itemCount={result.results.length}
                  itemSize={52}
                  itemData={result.results}
                  style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}
                >
                  {ResultRow}
                </FixedSizeList>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
