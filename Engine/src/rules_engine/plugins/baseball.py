"""
Baseball plugin: computes metrics matching SOPScoring hardcoded valX logic for parity.
"""
from typing import Dict
import numpy as np

from .base import BaseRulePlugin
from .registry import register_plugin
from ..metrics import base_metrics as bm


@register_plugin("baseball")
class BaseballPlugin(BaseRulePlugin):
    """
    Parity-focused plugin: expose metrics that mirror the original analyze_step1-4 valX values.
    """

    def compute_metrics(self, phase_id: str, student_data: np.ndarray, coach_data: np.ndarray) -> Dict[str, float]:
        metrics: Dict[str, float] = {}
        if phase_id == "step1":
            metrics["stance_angle_diff_ratio"] = bm.stance_angle_diff_ratio(student_data, coach_data)
            metrics["cg_z_avg_ratio_or_flag"] = bm.cg_z_avg_ratio_or_flag(student_data, coach_data)
        elif phase_id == "step2":
            metrics["head_move_diff_ratio"] = bm.head_move_diff_ratio(student_data, coach_data)
            metrics["stride_z_class"] = bm.stride_z_class(student_data, coach_data)
            metrics["cg_z_end_ratio_or_flag"] = bm.cg_z_end_ratio_or_flag(student_data, coach_data)
            metrics["shoulder_xz_angle_diff_ratio"] = bm.shoulder_xz_angle_diff_ratio(student_data, coach_data)
        elif phase_id == "step3":
            metrics["cg_z_end_diff_class"] = bm.cg_z_end_diff_class(student_data, coach_data)
            metrics["shoulder_height_diff_class"] = bm.shoulder_height_diff_class(student_data, coach_data)
        elif phase_id == "step4":
            metrics["cg_z_std_diff_ratio"] = bm.cg_z_std_diff_ratio(student_data, coach_data)
            metrics["hip_yaw_angle_diff_ratio_or_clamp"] = bm.hip_yaw_angle_diff_ratio_or_clamp(student_data, coach_data)
        else:
            raise ValueError(f"Unknown phase id: {phase_id}")
        return metrics

    def list_supported_metrics(self) -> Dict[str, list[str]]:
        return {
            "step1": [
                "stance_angle_diff_ratio",
                "cg_z_avg_ratio_or_flag",
            ],
            "step2": [
                "head_move_diff_ratio",
                "stride_z_class",
                "cg_z_end_ratio_or_flag",
                "shoulder_xz_angle_diff_ratio",
            ],
            "step3": [
                "cg_z_end_diff_class",
                "shoulder_height_diff_class",
            ],
            "step4": [
                "cg_z_std_diff_ratio",
                "hip_yaw_angle_diff_ratio_or_clamp",
            ],
        }

    def list_supported_condition_types(self) -> list[str]:
        # Keep this in sync with evaluator.evaluate_condition + composite handling in RuleEngine.
        return ["threshold", "range", "boolean", "composite"]
