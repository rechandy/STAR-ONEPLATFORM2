# Prediction Service

Serves IEP goal-attainment probabilities for the prototype's color-coded risk
display. A scikit-learn **LogisticRegression** predicts the probability that a
student meets each IEP goal by annual review; goals are banded:

| Band | Probability | Meaning |
| --- | --- | --- |
| 🟢 Green | ≥ 0.75 | On Track |
| 🟡 Yellow | 0.50–0.74 | Monitor — flag for review |
| 🔴 Red | < 0.50 | At Risk — immediate attention |

## Layout
- `features.py` — shared feature contract + domain normalization + band logic
  (used by both training and serving so columns always align).
- `train.py` — trains on `packages/database/data/star_iep_dataset.csv`, writes
  `model/model.joblib` and an interpretable `model/model_card.json`.
- `main.py` — FastAPI service that loads the model and scores goals using
  features read from PostgreSQL.

## Run
```bash
pip install -r requirements.txt
python train.py                       # train + persist the model
cp .env.example .env                  # DATABASE_URL -> Postgres on :5433
uvicorn main:app --port 3005
```

## Endpoints (identity via x-tenant-id / x-user-id headers, injected by the BFF)
- `GET /api/healthz` · `GET /api/readyz`
- `GET /api/students/{studentId}/predictions` — per-goal risk for one student
- `GET /api/roster/predictions` — the staff member's caseload with risk summary
- `GET /api/insights/at-risk` — tenant-wide roll-up (admin / leadership)
- `GET /api/model-card` — metrics + coefficients

## Notes
- Dev reads the co-located Postgres directly (mirrors the other services' dev
  read path). In production this consumes a service-owned read model fed by the
  `student.metric.v1` event backbone, and retrains on a schedule.
- Authorization: the web BFF injects verified identity; production would enforce
  the same Cedar policies as the other services.
