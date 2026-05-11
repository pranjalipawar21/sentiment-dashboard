import axios from 'axios'

const http = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

// ── Auth Token Interceptor ──
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('sid_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Auth ──
export const loginUser = (username, password) =>
  http.post('/api/login', { username, password }).then(r => r.data)

export const registerUser = (username, password) =>
  http.post('/api/register', { username, password }).then(r => r.data)

// ── Analysis ──
export const analyzeText = (text) =>
  http.post('/api/analyze', { text }).then(r => r.data)

export const analyzeUrl = (url) =>
  http.post('/api/scrape', { url }).then(r => r.data)

export const compareTexts = (text_a, label_a, text_b, label_b) =>
  http.post('/api/compare', { text_a, label_a, text_b, label_b }).then(r => r.data)

export const uploadBatch = (file, onProgress) => {
  const form = new FormData()
  form.append('file', file)
  return http.post('/api/batch', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => onProgress && onProgress(Math.round(e.loaded / e.total * 100)),
  }).then(r => r.data)
}

// ── AI Features ──
export const summarizeText = (text) =>
  http.post('/api/summarize', { text }).then(r => r.data)

export const extractTopics = (text) =>
  http.post('/api/topics', { text }).then(r => r.data)

// ── History ──
export const getHistory  = (limit = 100, offset = 0) =>
  http.get('/api/history', { params: { limit, offset } }).then(r => r.data)

export const clearHistory = () =>
  http.delete('/api/history').then(r => r.data)

export const getTrends = () =>
  http.get('/api/trends').then(r => r.data)
