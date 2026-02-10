"""
Rule evaluation utilities: condition evaluation, score aggregation, and feedback selection.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np


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


def _as_series(values) -> np.ndarray:
    if values is None:
        raise ValueError("Missing metric series.")
    if isinstance(values, np.ndarray):
        arr = values.astype(float)
    else:
        arr = np.array(values, dtype=float)
    if arr.ndim != 1:
        raise ValueError(f"Metric series must be 1D, got shape {arr.shape}.")
    return arr


def _representative(values: np.ndarray) -> float:
    if values.size == 0:
        raise ValueError("Representative value requires non-empty series.")
    return float(np.mean(values))


def _windowed_series(series: np.ndarray, cond: Dict, context: Dict) -> np.ndarray:
    result = series
    window_frames = cond.get("window_frames")
    if window_frames is not None:
        wf = int(window_frames)
        if wf < 1:
            raise ValueError("window_frames must be >= 1")
        result = result[-wf:]

    window_ms = cond.get("window_ms")
    if window_ms is not None:
        if not isinstance(window_ms, list) or len(window_ms) != 2:
            raise ValueError("window_ms must be [pre, post].")
        fps = (context or {}).get("expected_fps")
        if fps is None:
            raise ValueError("expected_fps is required to evaluate trend.window_ms.")
        duration_ms = abs(float(window_ms[1]) - float(window_ms[0]))
        count = max(2, int(round(duration_ms * float(fps) / 1000.0)))
        result = result[-count:]

    if result.size < 2:
        raise ValueError("Trend condition requires at least 2 samples.")
    return result


def _angle_between(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    if norm_a == 0.0 or norm_b == 0.0:
        raise ValueError("Cannot compute angle with zero-length vector.")
    cos_theta = float(np.dot(vec_a, vec_b) / (norm_a * norm_b))
    cos_theta = max(-1.0, min(1.0, cos_theta))
    return float(np.degrees(np.arccos(cos_theta)))


def _angle_series(data: np.ndarray, joints: List[int]) -> np.ndarray:
    if data is None or data.size == 0:
        raise ValueError("Angle condition requires rule frame skeleton data.")
    if len(joints) == 2:
        v = data[:, joints[0], :] - data[:, joints[1], :]
        ref = np.tile(np.array([1.0, 0.0, 0.0]), (len(v), 1))
        return np.array([_angle_between(vv, rr) for vv, rr in zip(v, ref)], dtype=float)
    if len(joints) == 3:
        va = data[:, joints[0], :] - data[:, joints[1], :]
        vb = data[:, joints[2], :] - data[:, joints[1], :]
        return np.array([_angle_between(a, b) for a, b in zip(va, vb)], dtype=float)
    raise ValueError("Angle condition requires 2 or 3 joints.")


def _distance_series(data: np.ndarray, pair: List[int]) -> np.ndarray:
    if data is None or data.size == 0:
        raise ValueError("Distance condition requires rule frame skeleton data.")
    if len(pair) != 2:
        raise ValueError("Distance condition requires exactly 2 joints in pair.")
    delta = data[:, pair[0], :] - data[:, pair[1], :]
    return np.linalg.norm(delta, axis=1).astype(float)


def _evaluate_numeric_condition(lhs: float, cond: Dict) -> bool:
    abs_val = bool(cond.get("abs_val", False))
    tol = cond.get("tolerance", 0.0)
    tol = float(tol) if tol is not None else 0.0

    if abs_val:
        lhs = abs(lhs)
    op = cond["op"]

    if cond["type"] == "range":
        lower, upper = cond["value"]
        lower_n = _as_number(lower) - tol
        upper_n = _as_number(upper) + tol
        return bool(lower_n <= lhs <= upper_n)

    target = _as_number(cond["value"])
    if op in ("gte", "gt"):
        return bool(_cmp(op, lhs, target - tol))
    if op in ("lte", "lt"):
        return bool(_cmp(op, lhs, target + tol))
    if op == "eq":
        return bool(abs(lhs - target) <= tol)
    if op == "neq":
        return bool(abs(lhs - target) > tol)
    if op == "between":
        lower_n = _as_number(cond["value"][0]) - tol
        upper_n = _as_number(cond["value"][1]) + tol
        return bool(lower_n <= lhs <= upper_n)
    return bool(_cmp(op, lhs, target))


def evaluate_condition(
    cond: Dict,
    metrics: Dict[str, float],
    *,
    metric_series: Optional[Dict[str, list[float]]] = None,
    context: Optional[Dict] = None,
    student_data: Optional[np.ndarray] = None,
    coach_data: Optional[np.ndarray] = None,
) -> ConditionResult:
    ctype = cond.get("type")
    cond_id = cond.get("id")
    context = context or {}
    metric_series = metric_series or {}

    if ctype in ("threshold", "range", "boolean"):
        metric_name = cond.get("metric")
        if metric_name not in metrics:
            raise KeyError(f"Metric '{metric_name}' not computed for condition '{cond_id}'")
        val = metrics[metric_name]

    if ctype == "threshold":
        lhs = _as_number(val)
        passed = _evaluate_numeric_condition(lhs, cond)
        return ConditionResult(cond_id, bool(passed), float(lhs))

    if ctype == "range":
        lhs = _as_number(val)
        passed = _evaluate_numeric_condition(lhs, cond)
        return ConditionResult(cond_id, bool(passed), float(lhs))

    if ctype == "boolean":
        op = cond["op"]
        passed = bool(val) if op == "is_true" else (not bool(val))
        return ConditionResult(cond_id, bool(passed), bool(val))

    if ctype == "event_exists":
        event_name = str(cond.get("event", "")).strip()
        if not event_name:
            raise ValueError(f"Condition '{cond_id}' requires a non-empty event.")
        events = (context or {}).get("events") or {}
        if event_name not in events:
            raise KeyError(f"Condition '{cond_id}' requires missing event '{event_name}'.")
        return ConditionResult(cond_id, True, {"event": event_name})

    if ctype == "trend":
        metric_name = cond.get("metric")
        if not metric_name:
            raise ValueError(f"Condition '{cond_id}' requires metric.")
        if metric_name not in metric_series:
            raise KeyError(f"Metric series '{metric_name}' not computed for condition '{cond_id}'.")
        series = _as_series(metric_series[metric_name])
        windowed = _windowed_series(series, cond, context)
        delta = float(windowed[-1] - windowed[0])
        op = cond.get("op")
        if op == "increasing":
            passed = delta > 0.0
        elif op == "decreasing":
            passed = delta < 0.0
        else:
            raise ValueError(f"Unsupported trend op '{op}' for condition '{cond_id}'.")
        return ConditionResult(cond_id, bool(passed), delta)

    if ctype == "angle":
        joints = [int(j) for j in (cond.get("joints") or [])]
        stu_series = _angle_series(student_data, joints)
        if coach_data is not None and coach_data.size > 0:
            coa_series = _angle_series(coach_data, joints)
            lhs = _representative(np.abs(stu_series - coa_series))
        else:
            lhs = _representative(stu_series)
        passed = _evaluate_numeric_condition(lhs, cond)
        return ConditionResult(cond_id, bool(passed), float(lhs))

    if ctype == "distance":
        pair = [int(j) for j in (cond.get("pair") or [])]
        stu_series = _distance_series(student_data, pair)
        if coach_data is not None and coach_data.size > 0:
            coa_series = _distance_series(coach_data, pair)
            lhs = _representative(np.abs(stu_series - coa_series))
        else:
            lhs = _representative(stu_series)
        passed = _evaluate_numeric_condition(lhs, cond)
        return ConditionResult(cond_id, bool(passed), float(lhs))

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
