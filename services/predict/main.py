"""
STAR OnePlatform — Prediction Service (FastAPI + scikit-learn).

Serves IEP goal-attainment probabilities for the prototype's color-coded risk
display. Loads the model trained by train.py and scores goals using features
read live from PostgreSQL (the co-located dev DB; in production this reads a
service-owned read model fed by the event backbone — same pattern as the other
services' authz/read paths).

Endpoints (all under /api, identity via x-tenant-id + x-user-id headers,
injected server-side by the web BFF):
  GET /api/healthz, /api/readyz
  GET /api/students/{studentId}/predictions   per-goal risk for one student
  GET /api/roster/predictions                  staff's caseload with risk summary
  GET /api/insights/at-risk                    tenant-wide roll-up (admin/leadership)
  GET /api/model-card                          model metrics & coefficients
"""
import json
import os
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

import joblib
import pandas as pd
import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException

from features import FEATURES, NUMERIC, canon_domain, band

load_dotenv()
HERE = os.path.dirname(os.path.abspath(__file__))


def _clean_db_url(u: str) -> str:
    """Drop Prisma-only query params (e.g. ?schema=public) that libpq rejects."""
    if not u:
        return u
    p = urlsplit(u)
    q = urlencode([(k, v) for k, v in parse_qsl(p.query) if k != "schema"])
    return urlunsplit((p.scheme, p.netloc, p.path, q, p.fragment))


DATABASE_URL = _clean_db_url(os.environ.get("DATABASE_URL", ""))
MODEL_PATH = os.path.join(HERE, "model", "model.joblib")
CARD_PATH = os.path.join(HERE, "model", "model_card.json")

DOMAIN_LABEL = {
    "ACADEMIC_READINESS": "Academic Readiness",
    "BEHAVIOR_SELF_REGULATION": "Behavior / Self-Regulation",
    "COMMUNICATION": "Communication",
    "DAILY_LIVING": "Daily Living",
    "SOCIAL_SKILLS": "Social Skills",
}

app = FastAPI(title="STAR OnePlatform Prediction Service", version="1.0")
_model = joblib.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else None

# Columns pulled from the DB, in feature order, plus identity/context columns.
GOAL_SELECT = """
  g.id            AS goal_id,
  g.student_id    AS profile_id,
  sp.user_id      AS student_id,
  g.domain        AS domain,
  g.description   AS description,
  sp.age          AS age,
  g.days_remaining_to_review AS days_remaining_to_review,
  gp.total_sessions, gp.weeks_in_program, gp.sessions_per_week,
  gp.baseline_prompt_level, gp.current_prompt_level, gp.prompt_level_change,
  gp.baseline_accuracy, gp.current_accuracy, gp.accuracy_trend_per_week,
  gp.consecutive_progress_sessions
"""


def _conn():
    if not DATABASE_URL:
        raise HTTPException(500, "DATABASE_URL not configured")
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def _score(rows: list[dict]) -> list[dict]:
    """Score DB rows; returns each goal with probability + risk band."""
    if not rows:
        return []
    if _model is None:
        raise HTTPException(503, "model not loaded — run train.py")
    feat = pd.DataFrame([
        {**{c: r.get(c) for c in NUMERIC}, "goal_domain": canon_domain(r["domain"])}
        for r in rows
    ])[FEATURES]
    probs = _model.predict_proba(feat)[:, 1]
    out = []
    for r, p in zip(rows, probs):
        p = float(p)
        out.append({
            "goalId": r["goal_id"],
            "studentId": r["student_id"],
            "domain": DOMAIN_LABEL.get(r["domain"], r["domain"]),
            "description": r["description"],
            "currentAccuracy": r.get("current_accuracy"),
            "currentPromptLevel": r.get("current_prompt_level"),
            "probability": round(p, 4),
            **band(p),
        })
    return out


def _summary(goals: list[dict]) -> dict:
    counts = {"green": 0, "yellow": 0, "red": 0}
    for g in goals:
        counts[g["band"]] += 1
    worst = "green"
    if counts["red"]:
        worst = "red"
    elif counts["yellow"]:
        worst = "yellow"
    return {"total": len(goals), "counts": counts, "worstBand": worst}


@app.get("/api/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/api/readyz")
def readyz():
    ok_model = _model is not None
    ok_db = False
    try:
        with _conn() as c:
            c.execute("SELECT 1")
        ok_db = True
    except Exception:
        ok_db = False
    status = "ok" if (ok_model and ok_db) else "degraded"
    return {"status": status, "model": ok_model, "db": ok_db}


@app.get("/api/model-card")
def model_card():
    if os.path.exists(CARD_PATH):
        with open(CARD_PATH, encoding="utf-8") as f:
            return json.load(f)
    raise HTTPException(404, "model card not found")


@app.get("/api/students/{student_id}/predictions")
def student_predictions(student_id: str, x_tenant_id: str = Header(...), x_user_id: str = Header(None)):
    with _conn() as c:
        prof = c.execute(
            """SELECT u.given_name, u.family_name, sp.grade, sp.age, sp.primary_diagnosis
               FROM student_profile sp JOIN app_user u ON u.id = sp.user_id
               WHERE sp.tenant_id = %s AND sp.user_id = %s""",
            (x_tenant_id, student_id),
        ).fetchone()
        rows = c.execute(
            f"""SELECT {GOAL_SELECT}
                FROM iep_goal g
                JOIN goal_progress gp ON gp.goal_id = g.id
                JOIN student_profile sp ON sp.id = g.student_id
                WHERE g.tenant_id = %s AND sp.user_id = %s
                ORDER BY g.domain""",
            (x_tenant_id, student_id),
        ).fetchall()
    if not prof:
        raise HTTPException(404, f"Unknown student {student_id}")
    goals = _score(rows)
    return {
        "studentId": student_id,
        "name": f"{prof['given_name']} {prof['family_name']}",
        "grade": prof["grade"],
        "age": prof["age"],
        "diagnosis": prof["primary_diagnosis"],
        "summary": _summary(goals),
        "goals": goals,
    }


@app.get("/api/roster/predictions")
def roster_predictions(x_tenant_id: str = Header(...), x_user_id: str = Header(...)):
    """The acting staff member's caseload (class-reachable students) with a per-student risk summary."""
    with _conn() as c:
        students = c.execute(
            """WITH staff_classes AS (
                   SELECT DISTINCT class_id FROM enrollment
                   WHERE tenant_id=%s AND user_id=%s AND role <> 'STUDENT'),
                 reachable AS (
                   SELECT DISTINCT user_id FROM enrollment
                   WHERE tenant_id=%s AND role='STUDENT' AND class_id IN (SELECT class_id FROM staff_classes))
               SELECT sp.user_id AS student_id, u.given_name, u.family_name, sp.grade
               FROM student_profile sp JOIN app_user u ON u.id = sp.user_id
               WHERE sp.tenant_id=%s AND sp.user_id IN (SELECT user_id FROM reachable)
               ORDER BY u.family_name, u.given_name""",
            (x_tenant_id, x_user_id, x_tenant_id, x_tenant_id),
        ).fetchall()
        ids = [s["student_id"] for s in students]
        rows = []
        if ids:
            rows = c.execute(
                f"""SELECT {GOAL_SELECT}
                    FROM iep_goal g
                    JOIN goal_progress gp ON gp.goal_id = g.id
                    JOIN student_profile sp ON sp.id = g.student_id
                    WHERE g.tenant_id = %s AND sp.user_id = ANY(%s)""",
                (x_tenant_id, ids),
            ).fetchall()
    scored = _score(rows)
    by_student: dict[str, list] = {}
    for g in scored:
        by_student.setdefault(g["studentId"], []).append(g)
    out = []
    for s in students:
        goals = by_student.get(s["student_id"], [])
        out.append({
            "studentId": s["student_id"],
            "name": f"{s['given_name']} {s['family_name']}",
            "grade": s["grade"],
            "summary": _summary(goals),
        })
    # Surface highest-risk students first.
    out.sort(key=lambda x: (x["summary"]["counts"]["red"], x["summary"]["counts"]["yellow"]), reverse=True)
    return {"count": len(out), "students": out}


@app.get("/api/insights/at-risk")
def insights_at_risk(x_tenant_id: str = Header(...), x_user_id: str = Header(None), limit: int = 10):
    """Tenant-wide leadership roll-up: band distribution + the top at-risk students."""
    with _conn() as c:
        rows = c.execute(
            f"""SELECT {GOAL_SELECT}
                FROM iep_goal g
                JOIN goal_progress gp ON gp.goal_id = g.id
                JOIN student_profile sp ON sp.id = g.student_id
                WHERE g.tenant_id = %s""",
            (x_tenant_id,),
        ).fetchall()
        names = {
            r["student_id"]: f"{r['given_name']} {r['family_name']}"
            for r in c.execute(
                "SELECT sp.user_id AS student_id, u.given_name, u.family_name "
                "FROM student_profile sp JOIN app_user u ON u.id=sp.user_id WHERE sp.tenant_id=%s",
                (x_tenant_id,),
            ).fetchall()
        }
    scored = _score(rows)
    counts = {"green": 0, "yellow": 0, "red": 0}
    per_student: dict[str, dict] = {}
    for g in scored:
        counts[g["band"]] += 1
        ps = per_student.setdefault(g["studentId"], {"red": 0, "yellow": 0, "green": 0, "n": 0})
        ps[g["band"]] += 1
        ps["n"] += 1
    total = len(scored)
    at_risk = sorted(
        ({"studentId": sid, "name": names.get(sid, sid), **v} for sid, v in per_student.items()),
        key=lambda x: (x["red"], x["yellow"]), reverse=True,
    )[:limit]
    return {
        "totalGoals": total,
        "students": len(per_student),
        "distribution": counts,
        "pct": {k: (round(100 * v / total, 1) if total else 0) for k, v in counts.items()},
        "topAtRisk": at_risk,
    }
