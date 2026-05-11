# System Architecture

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER / BROWSER                             │
│  React.js SPA · Plotly Charts · react-window Virtual Scroll         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS / REST API
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       FastAPI Backend (Python)                       │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────────────┐  │
│  │  JWT Auth      │  │  REST API     │  │  WebScraper (BS4)      │  │
│  │  (Register/    │  │  /analyze     │  │  URL → Text Extraction │  │
│  │   Login)       │  │  /compare     │  └────────────────────────┘  │
│  └───────────────┘  │  /batch       │                               │
│                      │  /summarize   │  ┌────────────────────────┐  │
│                      │  /topics      │  │  CSV Batch Processor   │  │
│                      │  /history     │  │  Multi-encoding Parser │  │
│                      └───────────────┘  └────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    NLP INFERENCE ENGINE                       │   │
│  │                                                              │   │
│  │  ┌──────────────────┐    ┌─────────────────────────────┐    │   │
│  │  │  VADER (Lexicon)  │    │  HuggingFace Transformers   │    │   │
│  │  │  Compound Score   │    │                             │    │   │
│  │  │  Pos/Neg/Neu      │    │  cardiffnlp/twitter-roberta │    │   │
│  │  │  Rule-based       │    │  -base-sentiment-latest     │    │   │
│  │  └──────────────────┘    │  (Deep Learning Sentiment)   │    │   │
│  │                          │                             │    │   │
│  │                          │  cardiffnlp/twitter-roberta │    │   │
│  │                          │  -base-emotion              │    │   │
│  │                          │  (Emotion Detection)        │    │   │
│  │                          │                             │    │   │
│  │                          │  sshleifer/distilbart-cnn   │    │   │
│  │                          │  -12-6 (Summarization)      │    │   │
│  │                          └─────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ SQLAlchemy ORM
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                              │
│                                                                     │
│  ┌─────────────┐  ┌──────────────────────────────────────────────┐  │
│  │  users       │  │  analyses                                    │  │
│  │  ─────       │  │  ────────                                    │  │
│  │  id          │  │  id, created_at, text_snippet, full_text     │  │
│  │  username    │  │  vader_label, trans_label, trans_conf         │  │
│  │  hashed_pw   │  │  compound, pos, neg, neu, emotions_json      │  │
│  │  created_at  │  │  source (single/csv/url/compare), user_id    │  │
│  └─────────────┘  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **User Upload** → CSV / Text / URL enters the React frontend
2. **API Gateway** → FastAPI validates JWT, routes to handler
3. **NLP Pipeline** → Dual-model inference (VADER + RoBERTa)
4. **Database** → Results persisted to PostgreSQL
5. **Visualization** → Plotly renders charts in the browser
6. **Summarization** → DistilBART generates abstractive summaries
