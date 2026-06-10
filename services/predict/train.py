"""
Train the IEP goal-attainment model.

Reads the supplied dataset (packages/database/data/star_iep_dataset.csv), trains
a scikit-learn LogisticRegression inside a preprocessing pipeline (imputation +
scaling + one-hot domain), evaluates on a held-out split, and persists:
  - model/model.joblib   the fitted pipeline (used by the serving API)
  - model/model_card.json metrics, feature list, and coefficients

Run:  python train.py
"""
import json
import os
from datetime import datetime, timezone

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix, roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from features import NUMERIC, CATEGORICAL, FEATURES, LABEL, canon_domain

HERE = os.path.dirname(os.path.abspath(__file__))
CSV = os.path.normpath(os.path.join(HERE, "..", "..", "packages", "database", "data", "star_iep_dataset.csv"))
MODEL_DIR = os.path.join(HERE, "model")


def load_frame() -> pd.DataFrame:
    df = pd.read_csv(CSV)
    # Normalize domain to the canonical key shared with the serving layer.
    df["goal_domain"] = df["goal_domain"].map(canon_domain)
    # Coerce numerics; coerce label to int.
    for col in NUMERIC:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df[LABEL] = pd.to_numeric(df[LABEL], errors="coerce").astype(int)
    return df


def build_pipeline() -> Pipeline:
    numeric = Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
    ])
    categorical = Pipeline([
        ("impute", SimpleImputer(strategy="most_frequent")),
        ("ohe", OneHotEncoder(handle_unknown="ignore")),
    ])
    pre = ColumnTransformer([
        ("num", numeric, NUMERIC),
        ("cat", categorical, CATEGORICAL),
    ])
    return Pipeline([
        ("pre", pre),
        ("lr", LogisticRegression(max_iter=2000, class_weight="balanced")),
    ])


def main() -> None:
    print(f"Loading {CSV}")
    df = load_frame()
    X, y = df[FEATURES], df[LABEL]
    print(f"  {len(df)} goals · label balance: met={int(y.sum())} not-met={int((1 - y).sum())}")

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
    pipe = build_pipeline()
    pipe.fit(X_tr, y_tr)

    proba = pipe.predict_proba(X_te)[:, 1]
    pred = (proba >= 0.5).astype(int)
    acc = accuracy_score(y_te, pred)
    auc = roc_auc_score(y_te, proba)
    cm = confusion_matrix(y_te, pred).tolist()
    print(f"\nHold-out accuracy: {acc:.3f}   ROC-AUC: {auc:.3f}")
    print(classification_report(y_te, pred, target_names=["not-met", "met"]))

    # Feature names + coefficients (interpretability).
    ohe = pipe.named_steps["pre"].named_transformers_["cat"].named_steps["ohe"]
    cat_names = list(ohe.get_feature_names_out(CATEGORICAL))
    feat_names = NUMERIC + cat_names
    coefs = pipe.named_steps["lr"].coef_[0].tolist()
    coef_map = dict(sorted(zip(feat_names, coefs), key=lambda kv: abs(kv[1]), reverse=True))

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(pipe, os.path.join(MODEL_DIR, "model.joblib"))

    card = {
        "model": "LogisticRegression (scikit-learn)",
        "task": "Predict probability a student meets an IEP goal by annual review",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "n_total": int(len(df)),
        "n_train": int(len(X_tr)),
        "n_test": int(len(X_te)),
        "label_balance": {"met": int(y.sum()), "not_met": int((1 - y).sum())},
        "metrics": {"accuracy": round(acc, 4), "roc_auc": round(auc, 4), "confusion_matrix": cm},
        "features": {"numeric": NUMERIC, "categorical": CATEGORICAL},
        "bands": {"green": ">= 0.75 On Track", "yellow": "0.50-0.74 Monitor", "red": "< 0.50 At Risk"},
        "coefficients_by_impact": {k: round(v, 4) for k, v in coef_map.items()},
    }
    with open(os.path.join(MODEL_DIR, "model_card.json"), "w", encoding="utf-8") as f:
        json.dump(card, f, indent=2)
    print(f"\nSaved model + model_card.json to {MODEL_DIR}")
    print("Top signals:", list(coef_map.items())[:5])


if __name__ == "__main__":
    main()
