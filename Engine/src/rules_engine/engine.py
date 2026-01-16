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

    def _phase_frame_range(self, phase: Dict) -> List[int]:
        if "frame_range" in phase:
            start, end = phase["frame_range"]
            return list(range(start, end + 1))
        # event_window handling can be added later
        raise ValueError("Phase frame_range is required for current engine.")

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
            frame_range = self._phase_frame_range(phase)

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
