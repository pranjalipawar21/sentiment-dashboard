import Plot from 'react-plotly.js'

const PALETTE = ['#7c3aed','#ec4899','#f59e0b','#10b981','#14b8a6','#6366f1','#f97316','#ef4444']

const BASE = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor:  'rgba(0,0,0,0)',
  font: { color: '#ede9ff', family: 'DM Sans, sans-serif', size: 12 },
  margin: { t: 20, b: 30, l: 40, r: 20 },
}

const CFG = { displayModeBar: false, responsive: true }

const GRID = { gridcolor: 'rgba(255,255,255,0.06)', tickfont: { color: '#7c6fa0' } }

// ── Emotion donut ─────────────────────────────────────────────────────────────
export function EmotionDonut({ emotions }) {
  if (!emotions || !Object.keys(emotions).length) return null
  const labels = Object.keys(emotions)
  const values = Object.values(emotions)
  return (
    <Plot
      data={[{
        type: 'pie', labels, values, hole: 0.62,
        marker: { colors: PALETTE.slice(0, labels.length), line: { color: '#07050f', width: 2 } },
        textinfo: 'label+percent',
        textfont: { color: '#ede9ff', size: 11 },
      }]}
      layout={{ ...BASE, showlegend: false, height: 250, margin: { t: 8, b: 8, l: 8, r: 8 } }}
      config={CFG}
      style={{ width: '100%' }}
    />
  )
}

// ── VADER bar ─────────────────────────────────────────────────────────────────
export function VaderBar({ pos, neg, neu }) {
  return (
    <Plot
      data={[
        { type:'bar', x:['Positive'], y:[pos], marker:{color:'#10b981'}, text:[pos.toFixed(3)], textposition:'outside' },
        { type:'bar', x:['Negative'], y:[neg], marker:{color:'#ef4444'}, text:[neg.toFixed(3)], textposition:'outside' },
        { type:'bar', x:['Neutral'],  y:[neu], marker:{color:'#f59e0b'}, text:[neu.toFixed(3)], textposition:'outside' },
      ]}
      layout={{
        ...BASE, showlegend: false, height: 210, bargap: 0.38,
        yaxis: { range: [0, 1.25], ...GRID },
        xaxis: { ...GRID },
      }}
      config={CFG}
      style={{ width: '100%' }}
    />
  )
}

// ── Sentence trend ────────────────────────────────────────────────────────────
export function SentenceTrend({ sentences }) {
  if (!sentences || sentences.length < 2) return null
  const x = sentences.map((_, i) => i + 1)
  const y = sentences.map(s => s.compound)
  const colors = y.map(v => v >= 0.05 ? '#10b981' : v <= -0.05 ? '#ef4444' : '#f59e0b')
  return (
    <Plot
      data={[{
        type: 'scatter', mode: 'lines+markers', x, y,
        line: { color: '#7c3aed', width: 2 },
        marker: { color: colors, size: 9, line: { color: '#ede9ff', width: 1 } },
        fill: 'tozeroy', fillcolor: 'rgba(124,58,237,0.1)',
      }]}
      layout={{
        ...BASE, height: 190,
        shapes: [{ type:'line', x0:0, x1:sentences.length+1, y0:0, y1:0,
                   line:{ color:'rgba(255,255,255,0.15)', dash:'dash', width:1 } }],
        xaxis: { title:'Sentence #', ...GRID },
        yaxis: { title:'Score', range:[-1,1], ...GRID },
      }}
      config={CFG}
      style={{ width: '100%' }}
    />
  )
}

// ── Keyword bar ───────────────────────────────────────────────────────────────
export function KeywordBar({ keywords }) {
  if (!keywords || !keywords.length) return null
  const top = keywords.slice(0, 12)
  return (
    <Plot
      data={[{
        type: 'bar', orientation: 'h',
        x: top.map(k => k.count),
        y: top.map(k => k.word),
        marker: {
          color: top.map(k => k.count),
          colorscale: [[0,'#4f46e5'],[0.5,'#7c3aed'],[1,'#ec4899']],
          showscale: false,
        },
        text: top.map(k => k.count), textposition: 'outside',
        textfont: { color: '#ede9ff' },
      }]}
      layout={{
        ...BASE, height: 300,
        yaxis: { autorange: 'reversed', ...GRID },
        xaxis: { ...GRID },
      }}
      config={CFG}
      style={{ width: '100%' }}
    />
  )
}

// ── Radar comparison ──────────────────────────────────────────────────────────
export function RadarChart({ a, b, labelA, labelB }) {
  if (!a || !b) return null
  const cats = [...new Set([...Object.keys(a.emotions||{}), ...Object.keys(b.emotions||{})])].sort()
  const va = cats.map(c => a.emotions?.[c] ?? 0)
  const vb = cats.map(c => b.emotions?.[c] ?? 0)
  const theta = [...cats, cats[0]]
  return (
    <Plot
      data={[
        {
          type:'scatterpolar', fill:'toself', name: labelA,
          r:[...va, va[0]], theta,
          line:{ color:'#7c3aed' }, fillcolor:'rgba(124,58,237,0.2)',
        },
        {
          type:'scatterpolar', fill:'toself', name: labelB,
          r:[...vb, vb[0]], theta,
          line:{ color:'#ec4899' }, fillcolor:'rgba(236,72,153,0.2)',
        },
      ]}
      layout={{
        ...BASE, height: 360,
        polar: {
          bgcolor: 'rgba(0,0,0,0)',
          radialaxis: { visible:true, range:[0,100], gridcolor:'rgba(255,255,255,0.07)', tickfont:{ color:'#7c6fa0', size:10 } },
          angularaxis: { gridcolor:'rgba(255,255,255,0.07)', tickfont:{ color:'#ede9ff', size:11 } },
        },
        legend: { bgcolor:'rgba(0,0,0,0)', font:{ color:'#ede9ff' } },
        margin: { t:36, b:36, l:60, r:60 },
      }}
      config={CFG}
      style={{ width: '100%' }}
    />
  )
}

// ── Trend line (history) ──────────────────────────────────────────────────────
export function TrendLine({ series }) {
  if (!series || series.length < 2) return null
  const y = series.map(s => s.compound)
  const x = series.map((_, i) => i + 1)
  const colors = y.map(v => v >= 0.05 ? '#10b981' : v <= -0.05 ? '#ef4444' : '#f59e0b')
  return (
    <Plot
      data={[{
        type:'scatter', mode:'lines+markers', x, y,
        line:{ color:'#7c3aed', width:2 },
        marker:{ color:colors, size:9, line:{ color:'#ede9ff', width:1 } },
        fill:'tozeroy', fillcolor:'rgba(124,58,237,0.1)',
        text: series.map(s => s.trans_label),
        hovertemplate: '<b>%{text}</b><br>Compound: %{y:.4f}<extra></extra>',
      }]}
      layout={{
        ...BASE, height: 220,
        shapes: [{ type:'line', x0:0, x1:series.length+1, y0:0, y1:0,
                   line:{ color:'rgba(255,255,255,0.12)', dash:'dash', width:1 } }],
        xaxis: { title:'Analysis #', ...GRID },
        yaxis: { title:'Compound', range:[-1,1], ...GRID },
      }}
      config={CFG}
      style={{ width: '100%' }}
    />
  )
}

// ── Batch pie ─────────────────────────────────────────────────────────────────
export function BatchPie({ aggregate }) {
  if (!aggregate) return null
  const labels = Object.keys(aggregate.label_counts)
  const values = Object.values(aggregate.label_counts)
  const cmap   = { Positive:'#10b981', Negative:'#ef4444', Neutral:'#f59e0b' }
  return (
    <Plot
      data={[{
        type:'pie', labels, values, hole:0.52,
        marker:{ colors: labels.map(l => cmap[l]||'#7c3aed'), line:{ color:'#07050f', width:2 } },
        textinfo:'label+percent+value',
        textfont:{ color:'#ede9ff', size:12 },
      }]}
      layout={{ ...BASE, showlegend:false, height:240, margin:{ t:8, b:8, l:8, r:8 } }}
      config={CFG}
      style={{ width:'100%' }}
    />
  )
}
