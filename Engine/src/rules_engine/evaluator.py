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


def _as_number(val):
    if isinstance(val, (int, float)):
        return float(val)
    raise TypeError(f"Expected number, got {type(val).__name__}")


def evaluate_condition(cond: Dict, metrics: Dict[str, float]) -> ConditionResult:
    ctype = cond.get("type")
    cond_id = cond.get("id")

    if ctype in ("threshold", "range", "boolean"):
        metric_name = cond.get("metric")
        if metric_name not in metrics:
            raise KeyError(f"Metric '{metric_name}' not computed for condition '{cond_id}'")
        val = metrics[metric_name]

    abs_val = bool(cond.get("abs_val", False))
    tol = cond.get("tolerance", 0.0)
    tol = float(tol) if tol is not None else 0.0

    if ctype == "threshold":
        op = cond["op"]
        target = _as_number(cond["value"])
        lhs = _as_number(val)
        if abs_val:
            lhs = abs(lhs)

        if op in ("gte", "gt"):
            passed = bool(_cmp(op, lhs, target - tol))
        elif op in ("lte", "lt"):
            passed = bool(_cmp(op, lhs, target + tol))
        elif op == "eq":
            passed = bool(abs(lhs - target) <= tol)
        elif op == "neq":
            passed = bool(abs(lhs - target) > tol)
        else:
            passed = bool(_cmp(op, lhs, target))

        return ConditionResult(cond_id, bool(passed), float(lhs))

    if ctype == "range":
        lower, upper = cond["value"]
        lhs = _as_number(val)
        if abs_val:
            lhs = abs(lhs)
        lower_n = _as_number(lower) - tol
        upper_n = _as_number(upper) + tol
        passed = bool((lhs >= lower_n) and (lhs <= upper_n))
        return ConditionResult(cond_id, bool(passed), float(lhs))

    if ctype == "boolean":
        op = cond["op"]
        passed = bool(val) if op == "is_true" else (not bool(val))
        return ConditionResult(cond_id, bool(passed), bool(val))

    if ctype == "composite":
        raise NotImplementedError("Composite condition should be handled at rule level.")

    raise NotImplementedError(f"Condition type '{ctype}' not implemented.")


def evaluate_composite_condition(cond: Dict, cond_results_by_id: Dict[str, ConditionResult]) -> ConditionResult:
    """
    Evaluate a composite condition using previously evaluated condition results.

    Schema:
      { type: "composite", logic: "all|any|none", conditions: ["condA","condB",...] }
    """
    cond_id = cond.get("id")
    logic = cond.get("logic")
    refs = cond.get("conditions") or []
    if not refs:
        raise ValueError(f"Composite condition '{cond_id}' requires non-empty 'conditions'.")

    results = []
    missing = []
    for rid in refs:
        if rid not in cond_results_by_id:
            missing.append(rid)
            continue
        results.append(bool(cond_results_by_id[rid].passed))

    if missing:
        raise KeyError(f"Composite condition '{cond_id}' references missing condition(s): {missing}")

    if logic == "all":
        passed = all(results)
    elif logic == "any":
        passed = any(results)
    elif logic == "none":
        passed = not any(results)
    else:
        raise ValueError(f"Composite condition '{cond_id}' has unsupported logic '{logic}'")

    return ConditionResult(cond_id, bool(passed), {rid: cond_results_by_id[rid].passed for rid in refs})


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
