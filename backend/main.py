"""
Sentiment Intelligence Dashboard — FastAPI Backend
Dual-model NLP: HuggingFace Transformers + VADER
Features: JWT Auth, AI Summarization, Topic Extraction
"""

import io
import json
import logging
import os
import re
from collections import Counter
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import jwt
import nltk
import numpy as np
import pandas as pd
import requests
from bs4 import BeautifulSoup
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, Header
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Float, Integer, String, Text, create_engine, func
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# ── Auth Config ───────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "sentiment-intelligence-secret-key-2024")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://sentiment:sentiment@localhost:5432/sentiment_db",
)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    hashed_pw = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AnalysisRecord(Base):
    __tablename__ = "analyses"
    id            = Column(Integer, primary_key=True, index=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    text_snippet  = Column(Text)
    full_text     = Column(Text)
    vader_label   = Column(String(16))
    trans_label   = Column(String(32))
    trans_conf    = Column(Float)
    compound      = Column(Float)
    pos           = Column(Float)
    neg           = Column(Float)
    neu           = Column(Float)
    emotions_json = Column(Text)
    source        = Column(String(32), default="single")
    user_id       = Column(Integer, nullable=True)


def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        log.info("DB tables ready.")
        # Create default admin user
        db = SessionLocal()
        if not db.query(User).filter(User.username == "admin").first():
            db.add(User(username="admin", hashed_pw=pwd_ctx.hash("admin123")))
            db.commit()
            log.info("Default admin user created (admin / admin123)")
        db.close()
    except Exception as e:
        log.warning(f"DB init skipped: {e}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Auth Helpers ──────────────────────────────────────────────────────────────
def create_token(user_id: int, username: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Optional auth — returns user dict or None."""
    if not authorization:
        return None
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = db.query(User).filter(User.id == payload["sub"]).first()
        if user:
            return {"id": user.id, "username": user.username}
    except Exception:
        pass
    return None


# ── Models ────────────────────────────────────────────────────────────────────
_vader: Optional[SentimentIntensityAnalyzer] = None
_emotion_pipe = None
_sentiment_pipe = None
_summarizer = None


def load_models():
    global _vader, _emotion_pipe, _sentiment_pipe, _summarizer
    nltk.download("punkt", quiet=True)
    nltk.download("punkt_tab", quiet=True)
    nltk.download("stopwords", quiet=True)
    _vader = SentimentIntensityAnalyzer()
    try:
        from transformers import pipeline
        _sentiment_pipe = pipeline(
            "text-classification",
            model="cardiffnlp/twitter-roberta-base-sentiment-latest",
            truncation=True, max_length=512,
        )
        _emotion_pipe = pipeline(
            "text-classification",
            model="cardiffnlp/twitter-roberta-base-emotion",
            top_k=None, truncation=True, max_length=512,
        )
        log.info("Transformer sentiment/emotion models loaded.")
    except Exception as e:
        log.warning(f"Transformers unavailable, VADER-only: {e}")

    # Load summarizer
    try:
        from transformers import pipeline
        _summarizer = pipeline(
            "summarization",
            model="sshleifer/distilbart-cnn-12-6",
            truncation=True, max_length=150, min_length=30,
        )
        log.info("Summarization model loaded.")
    except Exception as e:
        log.warning(f"Summarizer unavailable: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    load_models()
    yield


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Sentiment Intelligence API", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


# ── Core NLP ──────────────────────────────────────────────────────────────────
def _label(compound: float) -> str:
    if compound >= 0.05:  return "Positive"
    if compound <= -0.05: return "Negative"
    return "Neutral"


def _analyze(text: str) -> Dict[str, Any]:
    scores   = _vader.polarity_scores(text)
    compound = scores["compound"]
    vader_lbl = _label(compound)

    trans_label, trans_conf = vader_lbl, abs(compound)
    if _sentiment_pipe:
        try:
            chunk = text[:512]
            r = _sentiment_pipe(chunk)[0]
            trans_label = r["label"].capitalize()
            trans_conf  = round(r["score"], 4)
        except Exception as e:
            log.warning(f"Sentiment pipe error: {e}")

    emotions: Dict[str, float] = {}
    if _emotion_pipe:
        try:
            chunk = text[:512]
            emotions = {
                i["label"].capitalize(): round(i["score"] * 100, 1)
                for i in _emotion_pipe(chunk)[0]
            }
        except Exception as e:
            log.warning(f"Emotion pipe error: {e}")

    if not emotions:
        p, n, u = scores["pos"]*100, scores["neg"]*100, scores["neu"]*100
        emotions = {
            "Joy": round(p*0.6,1), "Trust": round(p*0.4,1),
            "Sadness": round(n*0.5,1), "Anger": round(n*0.3,1),
            "Fear": round(n*0.2,1), "Neutral": round(u*0.5,1),
        }

    return {
        "vader_label": vader_lbl,
        "trans_label": trans_label,
        "trans_conf":  round(trans_conf, 4),
        "compound":    round(compound, 4),
        "pos": round(scores["pos"], 4),
        "neg": round(scores["neg"], 4),
        "neu": round(scores["neu"], 4),
        "emotions": emotions,
    }


def _sentences(text: str) -> List[Dict]:
    try:
        sents = nltk.sent_tokenize(text)
    except Exception:
        sents = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    out = []
    for s in sents:
        if not s.strip(): continue
        c = _vader.polarity_scores(s)["compound"]
        out.append({"sentence": s.strip(), "label": _label(c).lower(), "compound": round(c,3)})
    return out


def _keywords(text: str, n: int = 20) -> List[Dict]:
    STOP = {"this","that","with","have","from","they","will","been","were","their",
            "what","when","your","there","about","which","would","could","should",
            "just","like","more","also","than","then","some","into","over","after"}
    words = [w for w in re.findall(r"\b[a-zA-Z]{4,}\b", text.lower()) if w not in STOP]
    return [{"word": w, "count": c} for w, c in Counter(words).most_common(n)]


def _extract_topics(text: str, n: int = 10) -> List[Dict]:
    """Extract key topics using TF-based frequency analysis."""
    try:
        from nltk.corpus import stopwords
        stop = set(stopwords.words("english"))
    except Exception:
        stop = set()
    EXTRA_STOP = {"would","could","really","much","very","also","even","well","just",
                  "like","good","great","make","made","know","want","need","think",
                  "going","thing","still","said","dont","doesnt","didnt","cant","wont"}
    stop.update(EXTRA_STOP)
    words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
    filtered = [w for w in words if w not in stop]
    counts = Counter(filtered)
    total = len(filtered) or 1
    topics = []
    for word, count in counts.most_common(n):
        topics.append({
            "topic": word,
            "frequency": count,
            "relevance": round(count / total * 100, 2),
        })
    return topics


def _save(db: Session, text: str, r: Dict, source: str = "single", user_id: int = None):
    try:
        rec = AnalysisRecord(
            text_snippet=text[:120] + ("…" if len(text)>120 else ""),
            full_text=text,
            vader_label=r["vader_label"], trans_label=r["trans_label"],
            trans_conf=r["trans_conf"], compound=r["compound"],
            pos=r["pos"], neg=r["neg"], neu=r["neu"],
            emotions_json=json.dumps(r["emotions"]), source=source,
            user_id=user_id,
        )
        db.add(rec); db.commit(); db.refresh(rec)
        return rec.id
    except Exception as e:
        log.warning(f"Save failed: {e}"); db.rollback(); return None


# ── Schemas ───────────────────────────────────────────────────────────────────
class RegisterReq(BaseModel):
    username: str
    password: str

class LoginReq(BaseModel):
    username: str
    password: str

class AnalyzeReq(BaseModel):
    text: str

class CompareReq(BaseModel):
    text_a: str; label_a: str = "Text A"
    text_b: str; label_b: str = "Text B"

class ScrapeReq(BaseModel):
    url: str

class SummarizeReq(BaseModel):
    text: str

class TopicReq(BaseModel):
    text: str


# ── Auth Routes ───────────────────────────────────────────────────────────────
@app.post("/api/register")
def register(req: RegisterReq, db: Session = Depends(get_db)):
    if len(req.username) < 3:
        raise HTTPException(400, "Username must be at least 3 characters")
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(409, "Username already exists")
    user = User(username=req.username, hashed_pw=pwd_ctx.hash(req.password))
    db.add(user); db.commit(); db.refresh(user)
    token = create_token(user.id, user.username)
    return {"token": token, "username": user.username, "user_id": user.id}


@app.post("/api/login")
def login(req: LoginReq, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not pwd_ctx.verify(req.password, user.hashed_pw):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user.id, user.username)
    return {"token": token, "username": user.username, "user_id": user.id}


# ── Core Routes ───────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "vader": _vader is not None,
        "transformers": _sentiment_pipe is not None,
        "emotion": _emotion_pipe is not None,
        "summarizer": _summarizer is not None,
    }


@app.post("/api/analyze")
def analyze(req: AnalyzeReq, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not req.text.strip():
        raise HTTPException(400, "Text required")
    if _vader is None:
        raise HTTPException(503, "Models loading")
    r = _analyze(req.text)
    uid = user["id"] if user else None
    rid = _save(db, req.text, r, "single", uid)
    return {**r, "sentences": _sentences(req.text),
            "keywords": _keywords(req.text), "record_id": rid}


@app.post("/api/scrape")
def scrape(req: ScrapeReq, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not req.url.strip():
        raise HTTPException(400, "URL required")
    if _vader is None:
        raise HTTPException(503, "Models loading")

    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        response = requests.get(req.url, headers=headers, timeout=15, verify=True)
        response.raise_for_status()
        response.encoding = response.apparent_encoding or "utf-8"
        soup = BeautifulSoup(response.text, 'html.parser')

        # Remove script/style elements
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()

        paragraphs = soup.find_all(['p', 'h1', 'h2', 'h3', 'article'])
        text_content = " ".join([p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)])

        if not text_content or len(text_content) < 20:
            # Fallback: get all text
            text_content = soup.get_text(separator=" ", strip=True)

        if not text_content or len(text_content) < 10:
            raise HTTPException(400, "Could not extract readable text from the URL")

        text_content = text_content[:5000]

        r = _analyze(text_content)
        uid = user["id"] if user else None
        rid = _save(db, text_content, r, "url_scrape", uid)
        title = soup.title.string if soup.title else req.url

        return {**r, "sentences": _sentences(text_content),
                "keywords": _keywords(text_content), "record_id": rid,
                "title": title, "text": text_content[:2000]}
    except requests.RequestException as e:
        raise HTTPException(400, f"Failed to fetch URL: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Scrape error: {e}")
        raise HTTPException(500, f"Error processing URL: {str(e)}")


@app.post("/api/compare")
def compare(req: CompareReq, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not req.text_a.strip() or not req.text_b.strip():
        raise HTTPException(400, "Both texts required")
    if _vader is None:
        raise HTTPException(503, "Models loading")
    a = _analyze(req.text_a); b = _analyze(req.text_b)
    uid = user["id"] if user else None
    _save(db, req.text_a, a, "compare", uid); _save(db, req.text_b, b, "compare", uid)
    return {
        "a": {**a, "label": req.label_a},
        "b": {**b, "label": req.label_b},
        "diff": round(abs(a["compound"] - b["compound"]), 4),
    }


@app.post("/api/batch")
async def batch(file: UploadFile = File(...), db: Session = Depends(get_db), user=Depends(get_current_user)):
    if _vader is None:
        raise HTTPException(503, "Models loading")
    content = await file.read()

    # Try multiple encodings
    text_content = None
    for enc in ["utf-8", "latin-1", "cp1252", "iso-8859-1"]:
        try:
            text_content = content.decode(enc)
            break
        except (UnicodeDecodeError, LookupError):
            continue
    if text_content is None:
        text_content = content.decode("utf-8", errors="replace")

    try:
        df = pd.read_csv(io.StringIO(text_content))
    except Exception as e:
        raise HTTPException(400, f"CSV parse error: {e}")

    if df.empty:
        raise HTTPException(400, "CSV file is empty")

    # Find text column (case-insensitive)
    col = None
    for candidate in ["text","review","tweet","comment","content","body","message","sentence"]:
        for c in df.columns:
            if c.lower().strip() == candidate:
                col = c
                break
        if col:
            break
    if not col:
        col = df.columns[0]

    df = df[df[col].notna()].reset_index(drop=True)
    uid = user["id"] if user else None

    results = []
    for _, row in df.iterrows():
        t = str(row[col]).strip()
        if not t or t.lower() == "nan": continue
        r = _analyze(t)
        _save(db, t, r, "csv_batch", uid)
        results.append({**r, "text": t[:200]})

    compounds = [r["compound"] for r in results]
    return {
        "total": len(results),
        "results": results,
        "aggregate": {
            "label_counts": dict(Counter(r["trans_label"] for r in results)),
            "avg_compound": round(float(np.mean(compounds)), 4) if compounds else 0,
            "min_compound": round(float(np.min(compounds)), 4) if compounds else 0,
            "max_compound": round(float(np.max(compounds)), 4) if compounds else 0,
        },
    }


# ── AI Summarization ─────────────────────────────────────────────────────────
@app.post("/api/summarize")
def summarize(req: SummarizeReq, user=Depends(get_current_user)):
    if not req.text.strip():
        raise HTTPException(400, "Text required")
    if _summarizer is None:
        # Fallback: extractive summary using sentences
        sentences = _sentences(req.text)
        if not sentences:
            raise HTTPException(503, "Summarizer not available")
        sorted_sents = sorted(sentences, key=lambda s: abs(s["compound"]), reverse=True)
        top = sorted_sents[:3]
        summary = " ".join(s["sentence"] for s in top)
        return {"summary": summary, "method": "extractive_fallback", "original_length": len(req.text)}

    try:
        chunk = req.text[:1024]
        result = _summarizer(chunk, max_length=150, min_length=30, do_sample=False)
        summary = result[0]["summary_text"]
        return {"summary": summary, "method": "distilbart", "original_length": len(req.text)}
    except Exception as e:
        raise HTTPException(500, f"Summarization failed: {str(e)}")


# ── Topic Extraction ─────────────────────────────────────────────────────────
@app.post("/api/topics")
def topics(req: TopicReq, user=Depends(get_current_user)):
    if not req.text.strip():
        raise HTTPException(400, "Text required")
    extracted = _extract_topics(req.text, n=10)
    return {"topics": extracted, "total_words": len(req.text.split())}


# ── History & Trends ──────────────────────────────────────────────────────────
@app.get("/api/history")
def history(limit: int = 100, offset: int = 0, db: Session = Depends(get_db)):
    try:
        total = db.query(func.count(AnalysisRecord.id)).scalar()
        rows  = (db.query(AnalysisRecord)
                 .order_by(AnalysisRecord.created_at.desc())
                 .offset(offset).limit(limit).all())
        items = []
        for r in rows:
            try: em = json.loads(r.emotions_json or "{}")
            except: em = {}
            items.append({
                "id": r.id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "text_snippet": r.text_snippet,
                "trans_label": r.trans_label,
                "compound": r.compound,
                "pos": r.pos, "neg": r.neg, "neu": r.neu,
                "emotions": em, "source": r.source,
            })
        return {"total": total, "items": items}
    except Exception as e:
        log.warning(f"History error: {e}"); return {"total": 0, "items": []}


@app.delete("/api/history")
def clear(db: Session = Depends(get_db)):
    try:
        db.query(AnalysisRecord).delete(); db.commit()
        return {"cleared": True}
    except Exception as e:
        db.rollback(); raise HTTPException(500, str(e))


@app.get("/api/trends")
def trends(db: Session = Depends(get_db)):
    try:
        rows = (db.query(AnalysisRecord)
                .order_by(AnalysisRecord.created_at.asc()).all())
        return {"series": [{"id": r.id, "compound": r.compound,
                "trans_label": r.trans_label, "source": r.source,
                "created_at": r.created_at.isoformat() if r.created_at else None}
                for r in rows]}
    except Exception as e:
        log.warning(f"Trends error: {e}"); return {"series": []}
