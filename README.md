<![CDATA[# 🧠 Sentiment Intelligence Dashboard

> **AI-powered dual-model NLP platform** for real-time sentiment analysis, emotion detection, AI summarization, and topic extraction — built with React.js, FastAPI, HuggingFace Transformers, and PostgreSQL.

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-HuggingFace_Spaces-blue?style=for-the-badge)](https://huggingface.co/spaces/pranjalipawar21/sentiment-dashboard)
[![API Docs](https://img.shields.io/badge/📖_API_Docs-FastAPI_Swagger-green?style=for-the-badge)](https://huggingface.co/spaces/pranjalipawar21/sentiment-dashboard/docs)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/pranjalipawar21/sentiment-dashboard)

---

## 📋 Project Overview

A full-stack AI text intelligence platform that implements a **dual-model NLP pipeline** combining:

- **HuggingFace Transformers** (`cardiffnlp/twitter-roberta-base-sentiment-latest`) — Deep-learning based sentiment classification with 3-class output (Positive/Negative/Neutral)
- **VADER** (Valence Aware Dictionary) — Lexicon-driven compound scoring for granular sentiment intensity
- **Emotion Detection** (`cardiffnlp/twitter-roberta-base-emotion`) — Multi-label emotion classification (Joy, Anger, Sadness, Fear, etc.)
- **AI Summarization** (`sshleifer/distilbart-cnn-12-6`) — Abstractive text summarization
- **Topic Extraction** — TF-based keyword and topic analysis

Trained and evaluated on the **Sentiment140 dataset** (1.6M tweets from Kaggle), with persistent PostgreSQL storage for longitudinal trend analysis.

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    React.js Frontend (Vite)                   │
│   Plotly Charts · react-window · react-dropzone · JWT Auth   │
└──────────────────────────┬───────────────────────────────────┘
                           │ REST API (HTTPS)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (Python 3.11)                │
│                                                              │
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │ JWT Auth     │  │         NLP Inference Engine          │  │
│  │ Register     │  │  VADER ←→ RoBERTa Sentiment          │  │
│  │ Login        │  │  Emotion Detection (RoBERTa)          │  │
│  └─────────────┘  │  Summarization (DistilBART)            │  │
│                    │  Topic Extraction (TF-based)           │  │
│                    └──────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────┘
                           │ SQLAlchemy ORM
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              PostgreSQL (Persistent Storage)                  │
│   users · analyses (sentiment, emotions, timestamps)         │
└──────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### 🔐 Authentication
- JWT-based login and registration system
- Secure password hashing with bcrypt
- Token-protected API endpoints

### 📊 Analyze
- Dual-model classification: Transformer deep-learning + VADER lexicon scoring
- Sentence-level classification with color-coded breakdown
- Emotion distribution donut chart, VADER bar chart, keyword frequency chart
- Compound score trend across sentences

### 🔗 URL Scrape & Analyze
- Scrape any public URL and extract readable text
- Automatic HTML cleanup (script/style/nav removal)
- Full sentiment + emotion analysis on extracted content

### ⚖️ Compare
- Side-by-side analysis of two texts
- Radar chart emotion comparison (Plotly scatterpolar)
- Compound delta metric with detailed breakdowns

### 🤖 AI Summary & Topics
- **Abstractive summarization** using DistilBART transformer model
- **Topic extraction** with frequency analysis and relevance scoring
- Visual topic bars and keyword chips

### 📁 Batch CSV
- Bulk upload for social media and product review datasets
- Multi-encoding support (UTF-8, Latin-1, CP1252, ISO-8859-1)
- `react-window` FixedSizeList for production-scale virtual scroll
- Aggregate distribution pie chart + per-row results

### 📈 History & Trends
- PostgreSQL-backed persistent history (survives page reloads)
- Longitudinal compound score trend visualization
- Virtual scroll for large history sets

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React.js 18, Vite, Plotly.js, react-window, react-dropzone |
| **Backend** | FastAPI, Python 3.11, Uvicorn, SQLAlchemy |
| **NLP Models** | HuggingFace Transformers (RoBERTa), VADER, NLTK, DistilBART |
| **Auth** | JWT (PyJWT), bcrypt, passlib |
| **Database** | PostgreSQL 16, SQLAlchemy ORM |
| **Infrastructure** | Docker, Docker Compose, Nginx, HuggingFace Spaces |
| **Training** | Sentiment140 (1.6M tweets), scikit-learn, matplotlib, seaborn |

---

## 📊 Performance Metrics

| Metric | Value |
|--------|-------|
| Dataset | Sentiment140 — 1.6M tweets (Kaggle) |
| VADER Baseline Accuracy | ~72% (lexicon-based, no training needed) |
| RoBERTa Transformer Accuracy | ~83% (fine-tuned on Twitter data) |
| Supported Batch Size | 10,000+ CSV rows with virtualized rendering |
| API Response Latency | < 200ms (VADER) · < 800ms (Transformer) |
| Summarization Model | `sshleifer/distilbart-cnn-12-6` |
| Emotion Classes | Joy, Anger, Sadness, Fear, Surprise, Disgust, Trust |
| Sentiment Classes | Positive, Negative, Neutral (3-class) |
| Virtual Scroll Performance | Sub-second interactions on 10K+ rows |

---

## 🔌 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/register` | — | Create new user account |
| `POST` | `/api/login` | — | Authenticate & receive JWT |
| `GET` | `/health` | — | Model status & availability |
| `POST` | `/api/analyze` | Optional | Single text sentiment analysis |
| `POST` | `/api/scrape` | Optional | URL scrape + sentiment analysis |
| `POST` | `/api/compare` | Optional | Side-by-side text comparison |
| `POST` | `/api/batch` | Optional | Bulk CSV upload & analysis |
| `POST` | `/api/summarize` | Optional | AI text summarization |
| `POST` | `/api/topics` | Optional | Topic/keyword extraction |
| `GET` | `/api/history` | — | Paginated analysis history |
| `DELETE` | `/api/history` | — | Clear all history |
| `GET` | `/api/trends` | — | Longitudinal trend data |

---

## 🚀 Getting Started

### Option 1 — Docker Compose (Recommended)

```bash
git clone https://github.com/pranjalipawar21/sentiment-dashboard.git
cd sentiment-dashboard
docker compose up --build
```

- Frontend → http://localhost:3000
- API Docs → http://localhost:8000/docs
- Default login: `admin` / `admin123`

### Option 2 — Manual Setup

**Terminal 1 — PostgreSQL:**
```bash
docker run -d \
  -e POSTGRES_USER=sentiment \
  -e POSTGRES_PASSWORD=sentiment \
  -e POSTGRES_DB=sentiment_db \
  -p 5432:5432 \
  postgres:16-alpine
```

**Terminal 2 — Backend:**
```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL=postgresql://sentiment:sentiment@localhost:5432/sentiment_db
uvicorn main:app --reload --port 8000
```

**Terminal 3 — Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Frontend → http://localhost:3000

---

## 📂 Folder Structure

```
sentiment-dashboard/
├── backend/
│   ├── main.py                  # FastAPI app (NLP, Auth, REST API)
│   ├── requirements.txt         # Python dependencies
│   └── Dockerfile               # Backend container
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AnalyzeTab.jsx   # Single text analysis
│   │   │   ├── BatchTab.jsx     # CSV batch upload
│   │   │   ├── Charts.jsx       # Plotly chart components
│   │   │   ├── CompareTab.jsx   # Side-by-side comparison
│   │   │   ├── HistoryTab.jsx   # PostgreSQL history viewer
│   │   │   ├── LoginPage.jsx    # JWT authentication UI
│   │   │   ├── SummarizeTab.jsx # AI summarization + topics
│   │   │   └── UrlTab.jsx       # URL scrape analysis
│   │   ├── App.jsx              # Main app with auth gate
│   │   ├── api.js               # Axios HTTP client + JWT
│   │   ├── index.css            # Premium dark theme
│   │   └── main.jsx             # React entry point
│   ├── package.json
│   └── vite.config.js
├── notebooks/
│   └── sentiment140_training.py # Model training & evaluation
├── datasets/
│   └── sentiment140_sample.csv  # Sample dataset for demos
├── docs/
│   ├── architecture.md          # System architecture
│   └── plots/                   # Training visualizations
├── docker-compose.yml
├── showcase.ipynb               # Jupyter notebook demo
└── README.md
```

---

## 📄 CSV Format

```csv
text
"I absolutely love this product!"
"Terrible quality, very disappointed."
"Average experience, nothing special."
```

Any CSV with a `text` (or `review` / `tweet` / `comment` / `content`) column works. The `datasets/sentiment140_sample.csv` file contains 200 pre-processed samples ready for upload.

---

## 🧪 Model Training & Evaluation

The `notebooks/sentiment140_training.py` script provides a complete ML pipeline:

1. **Data Loading** — Sentiment140 dataset (1.6M tweets, Kaggle)
2. **EDA** — Label distribution, text length analysis
3. **Preprocessing** — HTML decode, @mention removal, URL cleanup, lowercasing
4. **Train/Test Split** — 80/20 stratified split
5. **VADER Baseline** — Lexicon-based evaluation with confusion matrix
6. **Transformer Evaluation** — RoBERTa inference with classification report
7. **Model Comparison** — Side-by-side accuracy, F1, precision, recall
8. **Export** — Sample CSV for dashboard demo uploads

```bash
cd notebooks
python sentiment140_training.py
```

---

## 🚀 Deployment

The platform is deployed on:

- **Backend**: HuggingFace Spaces (FastAPI with programmatic SDK)
- **Frontend**: GitHub Pages (Vite static build)

Set `VITE_API_URL` in the frontend build to point to the HuggingFace Space URL.

---

## 🔮 Future Improvements

- [ ] Fine-tune a custom BERT model on domain-specific data
- [ ] Add comparative brand analysis (upload 2 CSVs, compare brands)
- [ ] Real-time streaming sentiment analysis (WebSocket)
- [ ] Multi-language support (XLM-RoBERTa)
- [ ] Export analysis reports as PDF
- [ ] User dashboard with saved analyses
- [ ] Rate limiting and API key management

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.
]]>
