GOOD_TERMS = {"good", "thumbs_up", "thumbs up", "up", "positive", "liked", "like", "yes", "true"}
BAD_TERMS  = {"bad", "thumbs_down", "thumbs down", "down", "negative", "disliked", "dislike", "no", "false"}


def normalize_score(score_raw, scale=10.0):
    if score_raw is None:
        return None


    if isinstance(score_raw, bool):
        return 0.8 * scale if score_raw else 0.3 * scale


    if isinstance(score_raw, str):
        s = score_raw.strip().lower()
        if s == "":
            return None
        if s in GOOD_TERMS:
            return 0.8 * scale
        if s in BAD_TERMS:
            return 0.3 * scale
        try:
            score_raw = float(s)
        except ValueError:
            return None


    try:
        val = float(score_raw)
    except (TypeError, ValueError):
        return None


    if val < 0:
        val = 0.0
    elif val <= 10:
        val = val
    elif val <= 100:
        val = val / 10.0
    else:
        val = 10.0


    return round(min(max(val, 0.0), 10.0), 1)
