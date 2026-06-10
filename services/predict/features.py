"""
Shared feature contract for the IEP goal-attainment model.

Training (train.py) reads these features from the supplied CSV; serving
(main.py) reads the same semantic features from PostgreSQL. Keeping the feature
list and the domain normalization in one place guarantees the columns the model
was trained on exactly match the columns it is scored on.
"""

# Numeric features (progress-monitoring signals).
NUMERIC = [
    "age",
    "days_remaining_to_review",
    "total_sessions",
    "weeks_in_program",
    "sessions_per_week",
    "baseline_prompt_level",
    "current_prompt_level",
    "prompt_level_change",
    "baseline_accuracy",
    "current_accuracy",
    "accuracy_trend_per_week",
    "consecutive_progress_sessions",
]
# Categorical features.
CATEGORICAL = ["goal_domain"]
FEATURES = NUMERIC + CATEGORICAL
LABEL = "goal_met"

# Canonical instructional domain — maps BOTH the CSV labels and the DB enum
# values onto one key so one-hot features align between training and serving.
DOMAIN_CANON = {
    # CSV labels
    "Academic Readiness": "academic_readiness",
    "Behavior / Self-Regulation": "behavior_self_regulation",
    "Communication": "communication",
    "Daily Living": "daily_living",
    "Social Skills": "social_skills",
    # DB enum values (GoalDomain)
    "ACADEMIC_READINESS": "academic_readiness",
    "BEHAVIOR_SELF_REGULATION": "behavior_self_regulation",
    "COMMUNICATION": "communication",
    "DAILY_LIVING": "daily_living",
    "SOCIAL_SKILLS": "social_skills",
}


def canon_domain(value: str) -> str:
    return DOMAIN_CANON.get((value or "").strip(), "other")


# Risk bands per the exercise spec.
def band(probability: float) -> dict:
    """Map a meet-the-goal probability to the color-coded risk band."""
    if probability >= 0.75:
        return {"band": "green", "label": "On Track", "action": ""}
    if probability >= 0.50:
        return {"band": "yellow", "label": "Monitor", "action": "Flag for review"}
    return {"band": "red", "label": "At Risk", "action": "Immediate attention"}
