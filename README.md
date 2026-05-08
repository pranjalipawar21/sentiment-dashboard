# Sentiment Intelligence Dashboard

A full-stack AI text intelligence platform with a **React.js** frontend and **FastAPI** backend. Implements a dual-model NLP pipeline combining HuggingFace Transformers for deep-learning emotion detection with VADER for lexicon-driven sentiment scoring.

## Tech Stack

- **Frontend** — React.js, Plotly, react-window, react-dropzone, Vite
- **Backend** — FastAPI, Python 3.11, Uvicorn
- **NLP** — HuggingFace Transformers (`cardiffnlp/twitter-roberta-base-emotion` + `sentiment-latest`), VADER, NLTK
- **Database** — PostgreSQL (persistent session history, longitudinal trend visualization)
- **Infrastructure** — Docker, Docker Compose, Nginx

## Features

### Analyze
- Dual-model classification: Transformer deep-learning + VADER lexicon scoring
- Sentence-level classification with color-coded breakdown
- Emotion distribution donut chart, VADER bar chart, keyword frequency chart
- Compound score trend across sentences

### Compare
- Side-by-side analysis of two texts
- Radar chart emotion comparison (Plotly scatterpolar)
- Compound delta metric

### Batch CSV
- Bulk upload for social media and product review datasets
- Supports `text`, `review`, `tweet`, `comment`, `content` columns
- `react-window` FixedSizeList for production-scale virtual scroll
- Aggregate distribution pie chart + per-row results

### History
- PostgreSQL-backed — survives page reloads (eliminates stateless in-memory data loss)
- Longitudinal compound score trend visualization
- `react-window` virtual scroll for large history sets

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Model status |
| POST | `/api/analyze` | Single text analysis |
| POST | `/api/compare` | Side-by-side comparison |
| POST | `/api/batch` | Bulk CSV upload |
| GET | `/api/history` | Paginated PostgreSQL history |
| DELETE | `/api/history` | Clear history |
| GET | `/api/trends` | Longitudinal trend series |

## Running the Project

### Option 1 — Docker Compose (easiest)

```bash
git clone https://github.com/pranjalipawar21/sentiment-dashboard.git
cd sentiment-dashboard
docker compose up --build
```

- Frontend → http://localhost:3000  
- API docs → http://localhost:8000/docs

### Option 2 — Manual

**Terminal 1 — PostgreSQL** (skip if using an existing instance):
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

## CSV Format

```csv
text
"I absolutely love this product!"
"Terrible quality, very disappointed."
"Average experience, nothing special."
```

Any CSV with a `text` (or `review` / `tweet` / `comment` / `content`) column works.

## Deployment on HuggingFace Spaces

The FastAPI backend is deployed as a programmatic RESTful layer on HuggingFace Spaces, enabling seamless external service integration. Set `VITE_API_URL` in the frontend build to point to the Space URL.
