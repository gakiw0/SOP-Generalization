"""
Rule evaluation utilities: condition evaluation, score aggregation, and feedback selection.
"""
from typing import Dict, List, Tuple


class ConditionResult:
    def __init__(self, cond_id: str, passed: bool, value):
        self.id = cond_id
        self.passed = passed
        self.value = value


def _cmp(op: str, lhs, rhs) -> bool:
    if op == "gte":
        return lhs >= rhs
    if op == "gt":
        return lhs > rhs
    if op == "lte":
        return lhs <= rhs
    if op == "lt":
        return lhs < rhs
    if op == "eq":
        return lhs == rhs
    if op == "neq":
        return lhs != rhs
    raise ValueError(f"Unsupported op: {op}")


def evaluate_condition(cond: Dict, metrics: Dict[str, float]) -> ConditionResult:
    ctype = cond.get("type")
    cond_id = cond.get("id")

    if ctype in ("threshold", "range", "boolean"):
        metric_name = cond.get("metric")
        if metric_name not in metrics:
            raise KeyError(f"Metric '{metric_name}' not computed for condition '{cond_id}'")
        val = metrics[metric_name]

    if ctype == "threshold":
        op = cond["op"]
        target = cond["value"]
        passed = bool(_cmp(op, val, target))
        return ConditionResult(cond_id, passed, float(val))

    if ctype == "range":
        lower, upper = cond["value"]
        passed = bool((val >= lower) and (val <= upper))
        return ConditionResult(cond_id, passed, float(val))

    if ctype == "boolean":
        op = cond["op"]
        passed = bool(val) if op == "is_true" else (not bool(val))
        return ConditionResult(cond_id, bool(passed), bool(val))

    if ctype == "composite":
        # composite uses referenced condition IDs; evaluation should be done after base conditions
        # The caller is expected to provide the referenced condition results.
        raise NotImplementedError("Composite condition should be handled at rule level.")

    raise NotImplementedError(f"Condition type '{ctype}' not implemented.")


def aggregate_score(score_cfg: Dict, cond_results: List[ConditionResult]) -> float:
    mode = score_cfg.get("mode", "all-or-nothing")
    pass_score = score_cfg.get("pass_score", 1.0)
    max_score = score_cfg.get("max_score", 1.0)

    if not cond_results:
        return max_score

    if mode == "all-or-nothing":
        return max_score if all(c.passed for c in cond_results) else 0.0

    if mode == "average":
        passed = sum(1 for c in cond_results if c.passed)
        return max_score * passed / len(cond_results)

    if mode == "weighted":
        weights = score_cfg.get("weights", {})
        total_w = sum(weights.values()) or 1.0
        passed_w = sum(weights.get(c.id, 0.0) for c in cond_results if c.passed)
        return max_score * passed_w / total_w

    # fallback
    return pass_score if all(c.passed for c in cond_results) else 0.0


def select_feedback(rule: Dict, cond_results: List[ConditionResult]) -> List[Dict]:
    """
    Return feedback entries whose condition_ids all failed (strict) or any failed (loose).
    Here we use a simple heuristic: include feedback if any referenced condition failed.
    """
    failed_ids = {c.id for c in cond_results if not c.passed}
    selected = []
    for fb in rule.get("feedback", []):
        cids = set(fb.get("condition_ids", []))
        if failed_ids & cids:
            selected.append(fb)
    return selected


def classify_step(rule_results: List[Tuple[str, bool]]) -> str:
    """
    Rough classification similar to original classify_step: correct if all pass,
    wrong if all fail, otherwise mid.
    """
    if not rule_results:
        return "mid"
    if all(passed for _, passed in rule_results):
        return "correct"
    if all(not passed for _, passed in rule_results):
        return "wrong"
    return "mid"
