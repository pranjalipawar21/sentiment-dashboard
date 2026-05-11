"""
===========================================================================
  Sentiment Intelligence Dashboard — Model Training & Evaluation Pipeline
  Dataset: Sentiment140 (1.6M tweets) — Kaggle
  URL: https://www.kaggle.com/datasets/kazanova/sentiment140
===========================================================================

This script performs:
  1. Data loading & exploratory data analysis (EDA)
  2. Text preprocessing (clean @mentions, URLs, HTML entities, etc.)
  3. Train / Test split (80/20)
  4. VADER baseline evaluation
  5. HuggingFace RoBERTa transformer evaluation
  6. Side-by-side comparison: VADER vs Transformer
  7. Classification report, confusion matrix, per-class metrics
  8. Export a sample CSV for dashboard demo uploads

Prerequisites:
  pip install pandas numpy matplotlib seaborn scikit-learn nltk
  pip install vaderSentiment transformers torch wordcloud

Dataset Setup:
  1. Download training.1600000.processed.noemoticon.csv from Kaggle
  2. Place it in ../datasets/sentiment140_raw.csv  (or update RAW_PATH below)
"""

# ─── Imports ──────────────────────────────────────────────────────────────────
import os
import re
import time
import html
import warnings
from collections import Counter

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

import nltk
from nltk.tokenize import word_tokenize
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

warnings.filterwarnings("ignore")
nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)
nltk.download("stopwords", quiet=True)

# ─── Configuration ────────────────────────────────────────────────────────────
RAW_PATH = os.path.join(os.path.dirname(__file__), "..", "datasets", "sentiment140_raw.csv")
SAMPLE_OUT = os.path.join(os.path.dirname(__file__), "..", "datasets", "sentiment140_sample.csv")
PLOTS_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "plots")
os.makedirs(os.path.dirname(SAMPLE_OUT), exist_ok=True)
os.makedirs(PLOTS_DIR, exist_ok=True)

COLUMNS = ["target", "id", "date", "flag", "user", "text"]
LABEL_MAP = {0: "Negative", 2: "Neutral", 4: "Positive"}
SAMPLE_SIZE = 50_000  # rows to use for transformer eval (GPU-constrained)
BATCH_EVAL_SIZE = 32  # transformer batch size
RANDOM_STATE = 42

print("=" * 70)
print("  SENTIMENT INTELLIGENCE DASHBOARD — Training & Evaluation Pipeline")
print("=" * 70)


# ===========================================================================
# SECTION 1: Data Loading
# ===========================================================================
print("\n📂 STEP 1: Loading Sentiment140 Dataset...")

if not os.path.exists(RAW_PATH):
    print(f"\n⚠️  Dataset not found at: {RAW_PATH}")
    print("   Please download from: https://www.kaggle.com/datasets/kazanova/sentiment140")
    print("   Save as: datasets/sentiment140_raw.csv")
    print("\n   Generating synthetic sample for demonstration...\n")

    # Generate a small synthetic dataset for demonstration
    np.random.seed(RANDOM_STATE)
    pos_samples = [
        "I love this product so much!", "Amazing experience today!",
        "Best day ever, feeling great!", "This movie was absolutely fantastic!",
        "So happy with my purchase!", "Great customer service experience!",
        "Wonderful weather today!", "Love spending time with friends!",
        "This restaurant is incredible!", "Best decision I ever made!",
        "Such a beautiful day outside!", "I'm thrilled with the results!",
        "Excellent quality product!", "Fantastic news, so excited!",
        "Perfect gift for my birthday!", "Outstanding performance!",
        "I adore this new design!", "Brilliant work by the team!",
        "What a wonderful surprise!", "Absolutely delighted with this!",
    ]
    neg_samples = [
        "This is terrible quality.", "Worst experience ever, so disappointed.",
        "Absolutely hate this product!", "Customer service was awful.",
        "Complete waste of money!", "The movie was boring and terrible.",
        "Very frustrated with the delivery.", "This broke after one day!",
        "Never buying from them again!", "Disappointed with the poor quality.",
        "Such a horrible experience.", "Worst purchase I've ever made.",
        "The food was disgusting!", "Terrible service, will not return.",
        "So angry about this situation!", "Pathetic excuse for a product.",
        "Extremely disappointed today.", "This company is a total scam!",
        "Awful quality, breaks easily.", "Regret buying this immediately!",
    ]
    texts = pos_samples * 250 + neg_samples * 250
    targets = [4] * 5000 + [0] * 5000
    df_raw = pd.DataFrame({
        "target": targets,
        "id": range(10000),
        "date": ["Mon Apr 06 22:19:45 PDT 2009"] * 10000,
        "flag": ["NO_QUERY"] * 10000,
        "user": ["demo_user"] * 10000,
        "text": texts,
    })
    SAMPLE_SIZE = min(SAMPLE_SIZE, len(df_raw))
else:
    df_raw = pd.read_csv(
        RAW_PATH,
        encoding="latin-1",
        header=None,
        names=COLUMNS,
    )

print(f"   Loaded {len(df_raw):,} rows")
print(f"   Columns: {list(df_raw.columns)}")
print(f"   Label distribution:\n{df_raw['target'].value_counts().to_string()}")


# ===========================================================================
# SECTION 2: Exploratory Data Analysis (EDA)
# ===========================================================================
print("\n📊 STEP 2: Exploratory Data Analysis...")

# Label distribution
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Plot 1: Label counts
label_counts = df_raw["target"].map(LABEL_MAP).value_counts()
colors = {"Positive": "#10B981", "Negative": "#EF4444", "Neutral": "#F59E0B"}
bars = axes[0].bar(label_counts.index, label_counts.values,
                   color=[colors.get(l, "#7c3aed") for l in label_counts.index],
                   edgecolor="white", linewidth=0.5)
axes[0].set_title("Sentiment140 — Label Distribution", fontsize=14, fontweight="bold")
axes[0].set_ylabel("Count")
for bar, val in zip(bars, label_counts.values):
    axes[0].text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 500,
                 f"{val:,}", ha="center", va="bottom", fontsize=10)

# Plot 2: Text length distribution
df_raw["text_length"] = df_raw["text"].astype(str).apply(len)
axes[1].hist(df_raw["text_length"], bins=80, color="#7c3aed", alpha=0.7, edgecolor="white")
axes[1].set_title("Text Length Distribution", fontsize=14, fontweight="bold")
axes[1].set_xlabel("Character Count")
axes[1].set_ylabel("Frequency")
axes[1].axvline(df_raw["text_length"].mean(), color="#EC4899", linestyle="--",
                label=f"Mean: {df_raw['text_length'].mean():.0f}")
axes[1].legend()

plt.tight_layout()
plt.savefig(os.path.join(PLOTS_DIR, "eda_distribution.png"), dpi=150, bbox_inches="tight")
plt.close()
print("   Saved: docs/plots/eda_distribution.png")

# Word count stats
df_raw["word_count"] = df_raw["text"].astype(str).apply(lambda x: len(x.split()))
print(f"   Avg text length: {df_raw['text_length'].mean():.1f} characters")
print(f"   Avg word count:  {df_raw['word_count'].mean():.1f} words")
print(f"   Max text length: {df_raw['text_length'].max()} characters")


# ===========================================================================
# SECTION 3: Text Preprocessing
# ===========================================================================
print("\n🧹 STEP 3: Text Preprocessing Pipeline...")


def preprocess_tweet(text: str) -> str:
    """
    Clean raw tweet text for NLP analysis.

    Steps:
      1. Decode HTML entities (&amp; &lt; etc.)
      2. Remove @mentions
      3. Remove URLs
      4. Remove retweet markers (RT)
      5. Remove hashtag symbols (keep the word)
      6. Remove special characters & extra whitespace
      7. Lowercase
      8. Strip leading/trailing whitespace
    """
    if not isinstance(text, str):
        return ""
    # Decode HTML entities
    text = html.unescape(text)
    # Remove @mentions
    text = re.sub(r"@\w+", "", text)
    # Remove URLs
    text = re.sub(r"https?://\S+|www\.\S+", "", text)
    # Remove RT markers
    text = re.sub(r"\bRT\b", "", text, flags=re.IGNORECASE)
    # Remove hashtag symbols (keep text)
    text = re.sub(r"#", "", text)
    # Remove special characters but keep basic punctuation
    text = re.sub(r"[^a-zA-Z0-9\s!?.,']", "", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    # Lowercase
    text = text.lower()
    return text


# Apply preprocessing
df_raw["clean_text"] = df_raw["text"].apply(preprocess_tweet)

# Remove empty rows
before = len(df_raw)
df_raw = df_raw[df_raw["clean_text"].str.len() > 5].reset_index(drop=True)
after = len(df_raw)
print(f"   Preprocessed {before:,} rows → {after:,} rows ({before - after} empty/short removed)")

# Show samples
print("\n   Sample preprocessed texts:")
for i in range(min(5, len(df_raw))):
    print(f"   [{LABEL_MAP.get(df_raw.loc[i, 'target'], '?')}] {df_raw.loc[i, 'clean_text'][:100]}")


# ===========================================================================
# SECTION 4: Train/Test Split
# ===========================================================================
print("\n✂️  STEP 4: Train/Test Split (80/20)...")

# Map labels to binary: 0 → Negative, 4 → Positive (drop Neutral=2 if present)
df_model = df_raw[df_raw["target"].isin([0, 4])].copy()
df_model["label"] = df_model["target"].map({0: "Negative", 4: "Positive"})
df_model["label_binary"] = df_model["target"].map({0: 0, 4: 1})

X_train, X_test, y_train, y_test = train_test_split(
    df_model["clean_text"],
    df_model["label"],
    test_size=0.2,
    random_state=RANDOM_STATE,
    stratify=df_model["label"],
)

print(f"   Training set: {len(X_train):,} rows")
print(f"   Test set:     {len(X_test):,} rows")
print(f"   Train label distribution:\n{y_train.value_counts().to_string()}")
print(f"   Test label distribution:\n{y_test.value_counts().to_string()}")


# ===========================================================================
# SECTION 5: VADER Baseline Evaluation
# ===========================================================================
print("\n📏 STEP 5: VADER Baseline Evaluation...")

vader = SentimentIntensityAnalyzer()


def vader_predict(text: str) -> str:
    """Classify text using VADER compound score."""
    score = vader.polarity_scores(text)["compound"]
    if score >= 0.05:
        return "Positive"
    elif score <= -0.05:
        return "Negative"
    else:
        return "Neutral"


t0 = time.time()
vader_preds = X_test.apply(vader_predict)
vader_time = time.time() - t0

# For binary comparison, map Neutral → Negative (conservative)
vader_binary = vader_preds.map({"Positive": "Positive", "Negative": "Negative", "Neutral": "Negative"})

vader_acc = accuracy_score(y_test, vader_binary)
vader_f1 = f1_score(y_test, vader_binary, pos_label="Positive")
vader_prec = precision_score(y_test, vader_binary, pos_label="Positive")
vader_rec = recall_score(y_test, vader_binary, pos_label="Positive")

print(f"\n   VADER Results (on {len(X_test):,} test samples):")
print(f"   ─────────────────────────────────")
print(f"   Accuracy:   {vader_acc:.4f} ({vader_acc*100:.2f}%)")
print(f"   Precision:  {vader_prec:.4f}")
print(f"   Recall:     {vader_rec:.4f}")
print(f"   F1-Score:   {vader_f1:.4f}")
print(f"   Inference:  {vader_time:.2f}s ({len(X_test)/vader_time:.0f} texts/sec)")
print(f"\n   Classification Report:\n")
print(classification_report(y_test, vader_binary, digits=4))

# VADER Confusion Matrix
cm_vader = confusion_matrix(y_test, vader_binary, labels=["Positive", "Negative"])
fig, ax = plt.subplots(figsize=(6, 5))
sns.heatmap(cm_vader, annot=True, fmt="d", cmap="Purples",
            xticklabels=["Positive", "Negative"],
            yticklabels=["Positive", "Negative"], ax=ax)
ax.set_title("VADER — Confusion Matrix", fontsize=14, fontweight="bold")
ax.set_xlabel("Predicted")
ax.set_ylabel("Actual")
plt.tight_layout()
plt.savefig(os.path.join(PLOTS_DIR, "vader_confusion_matrix.png"), dpi=150, bbox_inches="tight")
plt.close()
print("   Saved: docs/plots/vader_confusion_matrix.png")


# ===========================================================================
# SECTION 6: HuggingFace Transformer Evaluation (RoBERTa)
# ===========================================================================
print("\n🤖 STEP 6: HuggingFace Transformer Evaluation...")
print(f"   Model: cardiffnlp/twitter-roberta-base-sentiment-latest")

try:
    from transformers import pipeline as hf_pipeline

    sentiment_pipe = hf_pipeline(
        "text-classification",
        model="cardiffnlp/twitter-roberta-base-sentiment-latest",
        truncation=True,
        max_length=512,
        batch_size=BATCH_EVAL_SIZE,
    )

    # Subsample for speed
    eval_size = min(SAMPLE_SIZE, len(X_test))
    X_eval = X_test.head(eval_size).reset_index(drop=True)
    y_eval = y_test.head(eval_size).reset_index(drop=True)

    print(f"   Evaluating on {eval_size:,} samples (subsampled for speed)...")

    # Map transformer output labels to our labels
    TRANS_MAP = {
        "positive": "Positive",
        "negative": "Negative",
        "neutral": "Negative",  # conservative: treat neutral as negative for binary
    }

    t0 = time.time()
    trans_results = []
    batch_texts = X_eval.tolist()

    # Process in batches
    for i in range(0, len(batch_texts), BATCH_EVAL_SIZE):
        batch = batch_texts[i : i + BATCH_EVAL_SIZE]
        preds = sentiment_pipe(batch)
        for p in preds:
            label = p["label"].lower()
            trans_results.append(TRANS_MAP.get(label, "Negative"))

        if (i // BATCH_EVAL_SIZE) % 50 == 0 and i > 0:
            pct = i / len(batch_texts) * 100
            print(f"   Progress: {pct:.1f}% ({i:,}/{len(batch_texts):,})")

    trans_time = time.time() - t0
    trans_preds = pd.Series(trans_results, index=y_eval.index)

    trans_acc = accuracy_score(y_eval, trans_preds)
    trans_f1 = f1_score(y_eval, trans_preds, pos_label="Positive")
    trans_prec = precision_score(y_eval, trans_preds, pos_label="Positive")
    trans_rec = recall_score(y_eval, trans_preds, pos_label="Positive")

    print(f"\n   Transformer Results (on {eval_size:,} test samples):")
    print(f"   ─────────────────────────────────")
    print(f"   Accuracy:   {trans_acc:.4f} ({trans_acc*100:.2f}%)")
    print(f"   Precision:  {trans_prec:.4f}")
    print(f"   Recall:     {trans_rec:.4f}")
    print(f"   F1-Score:   {trans_f1:.4f}")
    print(f"   Inference:  {trans_time:.2f}s ({eval_size/trans_time:.0f} texts/sec)")
    print(f"\n   Classification Report:\n")
    print(classification_report(y_eval, trans_preds, digits=4))

    # Transformer Confusion Matrix
    cm_trans = confusion_matrix(y_eval, trans_preds, labels=["Positive", "Negative"])
    fig, ax = plt.subplots(figsize=(6, 5))
    sns.heatmap(cm_trans, annot=True, fmt="d", cmap="RdPu",
                xticklabels=["Positive", "Negative"],
                yticklabels=["Positive", "Negative"], ax=ax)
    ax.set_title("RoBERTa Transformer — Confusion Matrix", fontsize=14, fontweight="bold")
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "transformer_confusion_matrix.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print("   Saved: docs/plots/transformer_confusion_matrix.png")

    # ── Side-by-Side Comparison ──
    print("\n" + "=" * 70)
    print("  MODEL COMPARISON — VADER vs RoBERTa Transformer")
    print("=" * 70)

    comparison = pd.DataFrame({
        "Metric": ["Accuracy", "Precision", "Recall", "F1-Score", "Inference Time", "Throughput"],
        "VADER (Lexicon)": [
            f"{vader_acc:.4f}",
            f"{vader_prec:.4f}",
            f"{vader_rec:.4f}",
            f"{vader_f1:.4f}",
            f"{vader_time:.2f}s",
            f"{len(X_test)/vader_time:.0f} texts/sec",
        ],
        "RoBERTa (Transformer)": [
            f"{trans_acc:.4f}",
            f"{trans_prec:.4f}",
            f"{trans_rec:.4f}",
            f"{trans_f1:.4f}",
            f"{trans_time:.2f}s",
            f"{eval_size/trans_time:.0f} texts/sec",
        ],
    })
    print(f"\n{comparison.to_string(index=False)}")

    # Save comparison chart
    fig, ax = plt.subplots(figsize=(10, 5))
    metrics = ["Accuracy", "Precision", "Recall", "F1-Score"]
    vader_vals = [vader_acc, vader_prec, vader_rec, vader_f1]
    trans_vals = [trans_acc, trans_prec, trans_rec, trans_f1]
    x = np.arange(len(metrics))
    width = 0.35
    bars1 = ax.bar(x - width / 2, vader_vals, width, label="VADER (Lexicon)",
                   color="#F59E0B", edgecolor="white")
    bars2 = ax.bar(x + width / 2, trans_vals, width, label="RoBERTa (Transformer)",
                   color="#7c3aed", edgecolor="white")
    ax.set_ylabel("Score")
    ax.set_title("Model Comparison — VADER vs RoBERTa", fontsize=14, fontweight="bold")
    ax.set_xticks(x)
    ax.set_xticklabels(metrics)
    ax.legend()
    ax.set_ylim(0, 1.1)
    for bar in bars1:
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.02,
                f"{bar.get_height():.3f}", ha="center", fontsize=9)
    for bar in bars2:
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.02,
                f"{bar.get_height():.3f}", ha="center", fontsize=9)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "model_comparison.png"), dpi=150, bbox_inches="tight")
    plt.close()
    print("\n   Saved: docs/plots/model_comparison.png")

    HAS_TRANSFORMER = True

except Exception as e:
    print(f"\n   ⚠️  Transformer evaluation skipped: {e}")
    print("   Install with: pip install transformers torch")
    HAS_TRANSFORMER = False


# ===========================================================================
# SECTION 7: Export Sample Dataset for Dashboard Demo
# ===========================================================================
print("\n💾 STEP 7: Exporting Sample Dataset for Dashboard Demo...")

# Create a balanced sample of 500 rows (250 pos + 250 neg)
pos_sample = df_model[df_model["label"] == "Positive"].sample(
    n=min(250, len(df_model[df_model["label"] == "Positive"])),
    random_state=RANDOM_STATE,
)
neg_sample = df_model[df_model["label"] == "Negative"].sample(
    n=min(250, len(df_model[df_model["label"] == "Negative"])),
    random_state=RANDOM_STATE,
)
df_sample = pd.concat([pos_sample, neg_sample]).sample(frac=1, random_state=RANDOM_STATE)

# Export with 'text' column (compatible with dashboard batch upload)
df_sample[["clean_text"]].rename(columns={"clean_text": "text"}).to_csv(
    SAMPLE_OUT, index=False
)
print(f"   Exported {len(df_sample)} rows → {SAMPLE_OUT}")
print(f"   Format: CSV with 'text' column (dashboard-compatible)")


# ===========================================================================
# SECTION 8: Summary & Metrics
# ===========================================================================
print("\n" + "=" * 70)
print("  PIPELINE SUMMARY")
print("=" * 70)
print(f"""
  Dataset:           Sentiment140 (Kaggle)
  Total Samples:     {len(df_raw):,}
  Training Set:      {len(X_train):,} (80%)
  Test Set:          {len(X_test):,} (20%)
  Preprocessing:     HTML decode → @mention removal → URL removal →
                     RT removal → lowercase → special char cleanup

  VADER Baseline:
    Accuracy:        {vader_acc*100:.2f}%
    F1-Score:        {vader_f1:.4f}
    Throughput:      {len(X_test)/vader_time:.0f} texts/sec
""")

if HAS_TRANSFORMER:
    print(f"""  RoBERTa Transformer:
    Model:           cardiffnlp/twitter-roberta-base-sentiment-latest
    Accuracy:        {trans_acc*100:.2f}%
    F1-Score:        {trans_f1:.4f}
    Throughput:      {eval_size/trans_time:.0f} texts/sec
    Eval Samples:    {eval_size:,}
""")

print(f"""  Exported Files:
    Sample CSV:      datasets/sentiment140_sample.csv ({len(df_sample)} rows)
    EDA Plot:        docs/plots/eda_distribution.png
    VADER CM:        docs/plots/vader_confusion_matrix.png""")

if HAS_TRANSFORMER:
    print(f"""    Transformer CM:  docs/plots/transformer_confusion_matrix.png
    Comparison:      docs/plots/model_comparison.png""")

print(f"""
  Dashboard Integration:
    • Upload sentiment140_sample.csv via the Batch CSV tab
    • The dual-model pipeline processes each row with VADER + RoBERTa
    • Results are stored in PostgreSQL for longitudinal trend analysis
""")
print("=" * 70)
print("  ✅ Pipeline complete!")
print("=" * 70)
