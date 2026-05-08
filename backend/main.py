"""
Sentiment Intelligence Dashboard — FastAPI Backend
Dual-model NLP: HuggingFace Transformers + VADER
"""

import io
import json
import logging
import os
import re
from collections import Counter
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

import nltk
import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Float, Integer, String, Text, create_engine, func
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://sentiment:sentiment@localhost:5432/sentiment_db",
)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


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


def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        log.info("DB tables ready.")
    except Exception as e:
        log.warning(f"DB init skipped: {e}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Models ────────────────────────────────────────────────────────────────────
_vader: Optional[SentimentIntensityAnalyzer] = None
_emotion_pipe = None
_sentiment_pipe = None


def load_models():
    global _vader, _emotion_pipe, _sentiment_pipe
    nltk.download("punkt", quiet=True)
    nltk.download("punkt_tab", quiet=True)
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
        log.info("Transformer models loaded.")
    except Exception as e:
        log.warning(f"Transformers unavailable, VADER-only: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    load_models()
    yield


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Sentiment Intelligence API", version="1.0.0", lifespan=lifespan)
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
            r = _sentiment_pipe(text[:512])[0]
            trans_label = r["label"].capitalize()
            trans_conf  = round(r["score"], 4)
        except Exception:
            pass

    emotions: Dict[str, float] = {}
    if _emotion_pipe:
        try:
            emotions = {
                i["label"].capitalize(): round(i["score"] * 100, 1)
                for i in _emotion_pipe(text[:512])[0]
            }
        except Exception:
            pass

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


def _save(db: Session, text: str, r: Dict, source: str = "single"):
    try:
        rec = AnalysisRecord(
            text_snippet=text[:120] + ("…" if len(text)>120 else ""),
            full_text=text,
            vader_label=r["vader_label"], trans_label=r["trans_label"],
            trans_conf=r["trans_conf"], compound=r["compound"],
            pos=r["pos"], neg=r["neg"], neu=r["neu"],
            emotions_json=json.dumps(r["emotions"]), source=source,
        )
        db.add(rec); db.commit(); db.refresh(rec)
        return rec.id
    except Exception as e:
        log.warning(f"Save failed: {e}"); db.rollback(); return None


# ── Schemas ───────────────────────────────────────────────────────────────────
class AnalyzeReq(BaseModel):
    text: str

class CompareReq(BaseModel):
    text_a: str; label_a: str = "Text A"
    text_b: str; label_b: str = "Text B"


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "vader": _vader is not None,
            "transformers": _emotion_pipe is not None}


@app.post("/api/analyze")
def analyze(req: AnalyzeReq, db: Session = Depends(get_db)):
    if not req.text.strip():
        raise HTTPException(400, "Text required")
    if _vader is None:
        raise HTTPException(503, "Models loading")
    r = _analyze(req.text)
    rid = _save(db, req.text, r, "single")
    return {**r, "sentences": _sentences(req.text),
            "keywords": _keywords(req.text), "record_id": rid}


@app.post("/api/compare")
def compare(req: CompareReq, db: Session = Depends(get_db)):
    if not req.text_a.strip() or not req.text_b.strip():
        raise HTTPException(400, "Both texts required")
    if _vader is None:
        raise HTTPException(503, "Models loading")
    a = _analyze(req.text_a); b = _analyze(req.text_b)
    _save(db, req.text_a, a, "compare"); _save(db, req.text_b, b, "compare")
    return {
        "a": {**a, "label": req.label_a},
        "b": {**b, "label": req.label_b},
        "diff": round(abs(a["compound"] - b["compound"]), 4),
    }


@app.post("/api/batch")
async def batch(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if _vader is None:
        raise HTTPException(503, "Models loading")
    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode("utf-8", errors="replace")))
    except Exception as e:
        raise HTTPException(400, f"CSV parse error: {e}")

    col = next(
        (c for c in ["text","review","tweet","comment","content","body","message"]
         if c in df.columns), df.columns[0]
    )
    df = df[df[col].notna()].reset_index(drop=True)

    results = []
    for _, row in df.iterrows():
        t = str(row[col]).strip()
        if not t: continue
        r = _analyze(t)
        _save(db, t, r, "csv_batch")
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
