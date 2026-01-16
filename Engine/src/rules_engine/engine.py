"""
Rule-based scoring engine that evaluates skeleton data against JSON rule sets.
Parity-first: aims to reproduce current SOPScoring hardcoded behavior when used with
configs/rules/baseball_swing_v1.json and the baseball plugin.
"""
from typing import Dict, List, Tuple
import json
from pathlib import Path
import time

import numpy as np

from jc_utils import scoring_utils as su
from .registry import MetricRegistry, default_registry
from . import evaluator


class RuleEngine:
    def __init__(self, rule_set: Dict, plugin, registry: MetricRegistry = None):
        self.rule_set = rule_set
        self.plugin = plugin
        self.registry = registry or default_registry

    @classmethod
    def from_file(cls, rule_path: Path, plugin, registry: MetricRegistry = None):
        with Path(rule_path).open("r", encoding="utf-8") as f:
            rule_set = json.load(f)
        return cls(rule_set=rule_set, plugin=plugin, registry=registry)

    def _apply_preprocess(self, student: np.ndarray, coach: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        preprocess_steps = self.rule_set.get("inputs", {}).get("preprocess", [])
        out_student, out_coach = student.copy(), coach.copy()
        for step in preprocess_steps:
            if step == "align_orientation":
                out_student = su.align_skeleton_orientation(out_student)
                out_coach = su.align_skeleton_orientation(out_coach)
            elif step == "normalize_lengths":
                out_student = su.normalize_student_to_coach_lengths(
                    out_student,
                    out_coach,
                    keep_root_xyz=True,
                    use_avg_lengths=False,
                )
            else:
                # Unknown preprocess; skip silently for now
                pass
        return out_student, out_coach

    def preprocess(self, student: np.ndarray, coach: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        return self._apply_preprocess(student, coach)

    def _ms_to_frame_offset(self, ms: float, fps: float) -> int:
        return int(round(float(ms) * float(fps) / 1000.0))

    def _resolve_event_frame(self, event_name: str, context: Dict, fps: float) -> int:
        events = (context or {}).get("events") or {}
        if event_name not in events:
            raise KeyError(f"Event '{event_name}' not found in context['events'].")

        value = events[event_name]
        if isinstance(value, dict):
            if "frame" in value:
                return int(value["frame"])
            if "ts_ms" in value:
                return int(round(float(value["ts_ms"]) * float(fps) / 1000.0))
            raise ValueError(
                f"Unsupported event payload for '{event_name}': expected keys 'frame' or 'ts_ms'."
            )
        return int(value)

    def _phase_frame_range(self, phase: Dict, *, context: Dict, max_frame: int) -> List[int]:
        if "frame_range" in phase:
            start, end = phase["frame_range"]
            return list(range(start, end + 1))

        if "event_window" in phase:
            event_window = phase["event_window"] or {}
            event_name = event_window.get("event")
            window_ms = event_window.get("window_ms")
            fps = (self.rule_set.get("inputs", {}) or {}).get("expected_fps")
            if not event_name:
                raise ValueError("phase.event_window.event is required.")
            if not window_ms or len(window_ms) != 2:
                raise ValueError("phase.event_window.window_ms must be a 2-item array.")
            if fps is None:
                raise ValueError("inputs.expected_fps is required to resolve event_window.")

            try:
                event_frame = self._resolve_event_frame(str(event_name), context, float(fps))
            except KeyError as e:
                raise ValueError(str(e)) from e
            start = event_frame + self._ms_to_frame_offset(window_ms[0], float(fps))
            end = event_frame + self._ms_to_frame_offset(window_ms[1], float(fps))
            if start > end:
                start, end = end, start
            start = max(0, int(start))
            end = min(int(end), int(max_frame))
            return list(range(start, end + 1))

        raise ValueError("Phase must define either frame_range or event_window.")

    def _evaluate_rule(self, rule: Dict, metrics: Dict[str, float]) -> Dict:
        cond_results = []
        for cond in rule.get("conditions", []):
            cr = evaluator.evaluate_condition(cond, metrics)
            cond_results.append(cr)

        rule_score = float(evaluator.aggregate_score(rule.get("score", {}), cond_results))
        fb = evaluator.select_feedback(rule, cond_results)
        passed = bool(all(c.passed for c in cond_results)) if cond_results else True

        return {
            "rule_id": rule.get("id"),
            "label": rule.get("label"),
            "passed": bool(passed),
            "score": float(rule_score),
            "conditions": [
                {
                    "id": c.id,
                    "passed": bool(c.passed),
                    "value": float(c.value) if isinstance(c.value, (int, float)) else c.value,
                }
                for c in cond_results
            ],
            "feedback": fb,
        }

    def analyze(self, student: np.ndarray, coach: np.ndarray, context: Dict = None) -> Dict:
        context = context or {}
        profile = bool(context.get("profile_timings", False))

        overall_start = time.perf_counter() if profile else None
        preprocess_start = time.perf_counter() if profile else None
        student_p, coach_p = self._apply_preprocess(student, coach)
        preprocess_sec = (time.perf_counter() - preprocess_start) if profile else None

        phases = self.rule_set.get("phases", [])
        rules = self.rule_set.get("rules", [])
        phase_map = {p["id"]: p for p in phases}

        all_results = {}

        for phase in phases:
            phase_start = time.perf_counter() if profile else None
            phase_id = phase["id"]
            max_frame = min(int(len(student_p) - 1), int(len(coach_p) - 1))
            frame_range = self._phase_frame_range(phase, context=context, max_frame=max_frame)

            extract_start = time.perf_counter() if profile else None
            coach_data = su.extract_skeleton_data(coach_p, frame_range)
            student_data = su.extract_skeleton_data(student_p, frame_range)
            extract_sec = (time.perf_counter() - extract_start) if profile else None

            # Calculate metrics via plugin (parity with analyze_step* logic)
            metrics_start = time.perf_counter() if profile else None
            metrics = self.plugin.compute_metrics(phase_id, student_data, coach_data)
            metrics_sec = (time.perf_counter() - metrics_start) if profile else None

            # Evaluate applicable rules
            phase_rules = [r for r in rules if r.get("phase") == phase_id]
            rules_eval_start = time.perf_counter() if profile else None
            rule_results = [self._evaluate_rule(r, metrics) for r in phase_rules]
            rules_eval_sec = (time.perf_counter() - rules_eval_start) if profile else None

            # Step-level score/classification aggregation
            # Parity-first scoring:
            # legacy SOPScoring.parse_score maps green->100, yellow->60, red->30.
            # Current parity rules only emit pass/fail, so map pass->100, fail->30 and average.
            legacy_rule_scores = [100 if rr["passed"] else 30 for rr in rule_results]
            step_score_pct = int(sum(legacy_rule_scores) / len(legacy_rule_scores)) if legacy_rule_scores else 100

            classification = evaluator.classify_step([(rr["rule_id"], rr["passed"]) for rr in rule_results])

            phase_dict = {
                "Rules": {rr["rule_id"]: rr for rr in rule_results},
                "Score": step_score_pct,
                "StepClassification": classification,
                "Metrics": metrics,
                "FrameRange": frame_range,
            }

            if profile:
                phase_total_sec = time.perf_counter() - phase_start
                phase_dict["TimingsSec"] = {
                    "extract_data": round(float(extract_sec), 6),
                    "compute_metrics": round(float(metrics_sec), 6),
                    "evaluate_rules": round(float(rules_eval_sec), 6),
                    "total": round(float(phase_total_sec), 6),
                }

            all_results[phase_id] = phase_dict

        if profile:
            overall_total_sec = time.perf_counter() - overall_start
            all_results["_meta"] = {
                "TimingsSec": {
                    "preprocess": round(float(preprocess_sec), 6),
                    "total": round(float(overall_total_sec), 6),
                }
            }

        return all_results
