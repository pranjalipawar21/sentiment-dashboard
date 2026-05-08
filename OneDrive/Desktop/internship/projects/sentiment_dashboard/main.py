"""
Sentiment Intelligence Dashboard — FastAPI Backend
Dual-model NLP pipeline: HuggingFace Transformers + VADER
"""

from __future__ import annotations

import io
import os
import re
import csv
import logging
from collections import Counter
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

import nltk
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import (
    Column, DateTime, Float, Integer, String, Text,
    create_engine, func,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── DB setup ──────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sentiment:sentiment@localhost:5432/sentiment_db")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class AnalysisRecord(Base):
    __tablename__ = "analyses"

    id           = Column(Integer, primary_key=True, index=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    text_snippet = Column(Text, nullable=False)
    full_text    = Column(Text, nullable=False)
    vader_label  = Column(String(16))
    trans_label  = Column(String(32))
    trans_conf   = Column(Float)
    compound     = Column(Float)
    pos          = Column(Float)
    neg          = Column(Float)
    neu          = Column(Float)
    emotions_json= Column(Text)          # JSON string
    source       = Column(String(64), default="single")   # single | csv_batch


def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created / verified.")
    except Exception as exc:
        logger.warning(f"DB init skipped (no DB available): {exc}")


# ── Global model holders ──────────────────────────────────────────────────────
_vader: Optional[SentimentIntensityAnalyzer] = None
_emotion_model = None
_sentiment_model = None


def _load_models():
    global _vader, _emotion_model, _sentiment_model

    nltk.download("punkt",     quiet=True)
    nltk.download("punkt_tab", quiet=True)

    _vader = SentimentIntensityAnalyzer()

    try:
        from transformers import pipeline as hf_pipeline

        _sentiment_model = hf_pipeline(
            "text-classification",
            model="cardiffnlp/twitter-roberta-base-sentiment-latest",
            truncation=True,
            max_length=512,
        )
        _emotion_model = hf_pipeline(
            "text-classification",
            model="cardiffnlp/twitter-roberta-base-emotion",
            top_k=None,
            truncation=True,
            max_length=512,
        )
        logger.info("Transformer models loaded.")
    except Exception as exc:
        logger.warning(f"Transformer load failed, VADER-only mode: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _load_models()
    yield


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Sentiment Intelligence API",
    description="Dual-model NLP pipeline: HuggingFace Transformers + VADER",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Core analysis logic ───────────────────────────────────────────────────────

def _vader_label(compound: float) -> str:
    if compound >= 0.05:
        return "Positive"
    if compound <= -0.05:
        return "Negative"
    return "Neutral"


def _analyze_text(text: str) -> Dict[str, Any]:
    scores   = _vader.polarity_scores(text)
    compound = scores["compound"]
    vader_lbl = _vader_label(compound)

    # Transformer sentiment
    trans_label = vader_lbl
    trans_conf  = abs(compound)
    if _sentiment_model:
        try:
            r = _sentiment_model(text[:512])[0]
            trans_label = r["label"].capitalize()
            trans_conf  = round(r["score"], 4)
        except Exception:
            pass

    # Emotions via HuggingFace
    emotions: Dict[str, float] = {}
    if _emotion_model:
        try:
            raw = _emotion_model(text[:512])
            emotions = {
                item["label"].capitalize(): round(item["score"] * 100, 1)
                for item in raw[0]
            }
        except Exception:
            pass

    if not emotions:
        pos = max(scores["pos"] * 100, 0.1)
        neg = max(scores["neg"] * 100, 0.1)
        neu = max(scores["neu"] * 100, 0.1)
        emotions = {
            "Joy":     round(pos * 0.6, 1),
            "Trust":   round(pos * 0.4, 1),
            "Sadness": round(neg * 0.5, 1),
            "Anger":   round(neg * 0.3, 1),
            "Fear":    round(neg * 0.2, 1),
            "Neutral": round(neu * 0.5, 1),
        }

    return {
        "vader_label":  vader_lbl,
        "trans_label":  trans_label,
        "trans_conf":   round(trans_conf, 4),
        "compound":     round(compound, 4),
        "pos":          round(scores["pos"], 4),
        "neg":          round(scores["neg"], 4),
        "neu":          round(scores["neu"], 4),
        "emotions":     emotions,
    }


def _analyze_sentences(text: str) -> List[Dict[str, Any]]:
    try:
        sentences = nltk.sent_tokenize(text)
    except Exception:
        sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]

    results = []
    for sent in sentences:
        if not sent.strip():
            continue
        sc = _vader.polarity_scores(sent)
        c  = sc["compound"]
        results.append({
            "sentence": sent.strip(),
            "label":    _vader_label(c).lower(),
            "compound": round(c, 3),
        })
    return results


def _extract_keywords(text: str, top_n: int = 20) -> List[Dict[str, Any]]:
    words = re.findall(r"\b[a-zA-Z]{4,}\b", text.lower())
    stopwords = {
        "this","that","with","have","from","they","will","been","were","their",
        "what","when","your","there","about","which","would","could","should",
        "just","like","more","also","than","then","some","into","over","after",
    }
    words = [w for w in words if w not in stopwords]
    return [{"word": w, "count": c} for w, c in Counter(words).most_common(top_n)]


def _persist(db: Session, text: str, result: Dict[str, Any], source: str = "single"):
    import json
    try:
        rec = AnalysisRecord(
            text_snippet = text[:120] + ("…" if len(text) > 120 else ""),
            full_text    = text,
            vader_label  = result["vader_label"],
            trans_label  = result["trans_label"],
            trans_conf   = result["trans_conf"],
            compound     = result["compound"],
            pos          = result["pos"],
            neg          = result["neg"],
            neu          = result["neu"],
            emotions_json= json.dumps(result["emotions"]),
            source       = source,
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        return rec.id
    except Exception as exc:
        logger.warning(f"DB persist failed: {exc}")
        db.rollback()
        return None


# ── Pydantic models ───────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    text: str


class CompareRequest(BaseModel):
    text_a: str
    label_a: str = "Text A"
    text_b: str
    label_b: str = "Text B"


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "models": {
        "vader":     _vader is not None,
        "emotion":   _emotion_model is not None,
        "sentiment": _sentiment_model is not None,
    }}


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest, db: Session = Depends(get_db)):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is required.")
    if _vader is None:
        raise HTTPException(status_code=503, detail="Models not loaded yet.")

    result    = _analyze_text(req.text)
    sentences = _analyze_sentences(req.text)
    keywords  = _extract_keywords(req.text)
    record_id = _persist(db, req.text, result, "single")

    return {
        **result,
        "sentences": sentences,
        "keywords":  keywords,
        "record_id": record_id,
    }


@app.post("/api/compare")
def compare(req: CompareRequest, db: Session = Depends(get_db)):
    if not req.text_a.strip() or not req.text_b.strip():
        raise HTTPException(status_code=400, detail="Both texts are required.")
    if _vader is None:
        raise HTTPException(status_code=503, detail="Models not loaded yet.")

    res_a = _analyze_text(req.text_a)
    res_b = _analyze_text(req.text_b)
    _persist(db, req.text_a, res_a, "compare")
    _persist(db, req.text_b, res_b, "compare")

    return {
        "a": {**res_a, "label": req.label_a},
        "b": {**res_b, "label": req.label_b},
        "diff": round(abs(res_a["compound"] - res_b["compound"]), 4),
    }


@app.post("/api/batch")
async def batch_upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Bulk CSV batch upload.
    Expects a CSV with at least one column named 'text' (or first column is used).
    Returns per-row analysis results — handles large datasets efficiently.
    """
    if _vader is None:
        raise HTTPException(status_code=503, detail="Models not loaded yet.")

    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode("utf-8", errors="replace")))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    # Identify text column
    text_col = None
    for candidate in ["text", "review", "content", "comment", "tweet", "body", "message"]:
        if candidate in df.columns:
            text_col = candidate
            break
    if text_col is None:
        text_col = df.columns[0]

    df = df[df[text_col].notna()].reset_index(drop=True)

    results = []
    for _, row in df.iterrows():
        text = str(row[text_col]).strip()
        if not text:
            continue
        r = _analyze_text(text)
        _persist(db, text, r, "csv_batch")
        results.append({
            "text":        text[:200],
            "trans_label": r["trans_label"],
            "trans_conf":  r["trans_conf"],
            "compound":    r["compound"],
            "pos":         r["pos"],
            "neg":         r["neg"],
            "neu":         r["neu"],
            "emotions":    r["emotions"],
        })

    # Aggregate stats
    compounds = [r["compound"] for r in results]
    label_counts = Counter(r["trans_label"] for r in results)

    return {
        "total":        len(results),
        "results":      results,
        "aggregate": {
            "label_counts": dict(label_counts),
            "avg_compound": round(float(np.mean(compounds)), 4) if compounds else 0,
            "min_compound": round(float(np.min(compounds)), 4) if compounds else 0,
            "max_compound": round(float(np.max(compounds)), 4) if compounds else 0,
        },
    }


@app.get("/api/history")
def get_history(
    limit:  int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """
    Persistent session history from PostgreSQL.
    Supports longitudinal trend visualization.
    """
    import json
    try:
        total   = db.query(func.count(AnalysisRecord.id)).scalar()
        records = (
            db.query(AnalysisRecord)
            .order_by(AnalysisRecord.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        items = []
        for rec in records:
            emotions = {}
            try:
                emotions = json.loads(rec.emotions_json or "{}")
            except Exception:
                pass
            items.append({
                "id":           rec.id,
                "created_at":   rec.created_at.isoformat() if rec.created_at else None,
                "text_snippet": rec.text_snippet,
                "trans_label":  rec.trans_label,
                "compound":     rec.compound,
                "pos":          rec.pos,
                "neg":          rec.neg,
                "neu":          rec.neu,
                "emotions":     emotions,
                "source":       rec.source,
            })
        return {"total": total, "items": items}
    except Exception as exc:
        logger.warning(f"History query failed: {exc}")
        return {"total": 0, "items": []}


@app.delete("/api/history")
def clear_history(db: Session = Depends(get_db)):
    try:
        db.query(AnalysisRecord).delete()
        db.commit()
        return {"cleared": True}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/trends")
def get_trends(db: Session = Depends(get_db)):
    """
    Longitudinal trend data for visualization — aggregated daily.
    """
    import json
    try:
        records = (
            db.query(AnalysisRecord)
            .order_by(AnalysisRecord.created_at.asc())
            .all()
        )
        series = []
        for rec in records:
            series.append({
                "id":          rec.id,
                "created_at":  rec.created_at.isoformat() if rec.created_at else None,
                "compound":    rec.compound,
                "trans_label": rec.trans_label,
                "source":      rec.source,
            })
        return {"series": series}
    except Exception as exc:
        logger.warning(f"Trends query failed: {exc}")
        return {"series": []}
