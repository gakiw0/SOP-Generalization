"""
Generic runtime plugin for cross-sport 1v1 motion comparison on OpenPose BODY_25 data.
"""

from __future__ import annotations

from typing import Dict, List

import numpy as np

from .base import BaseRulePlugin
from .registry import register_plugin


EPS = 1e-8
CORE_METRICS: List[str] = [
    "cg_z_delta_mean",
    "cg_z_delta_series",
    "head_displacement_delta_mean",
    "head_displacement_delta_series",
    "shoulder_tilt_delta_mean",
    "hip_yaw_delta_mean",
    "root_speed_delta_mean",
    "root_speed_delta_series",
]


def _as_series(values: np.ndarray) -> np.ndarray:
    if values.ndim == 0:
        return np.array([float(values)], dtype=float)
    return values.astype(float)


def _safe_ratio_delta(student: np.ndarray, coach: np.ndarray) -> np.ndarray:
    denom = np.maximum(np.abs(coach), EPS)
    return np.abs(student - coach) / denom


def _series_mean(values: np.ndarray) -> float:
    if values.size == 0:
        return 0.0
    return float(np.mean(values))


def _axis_angle_xz(vectors: np.ndarray) -> np.ndarray:
    # returns angle against +X axis on XZ plane in degrees
    return np.degrees(np.arctan2(vectors[:, 2], vectors[:, 0]))


def _displacement_series(points: np.ndarray) -> np.ndarray:
    if len(points) == 0:
        return np.array([], dtype=float)
    origin = points[0]
    return np.linalg.norm(points - origin, axis=1)


def _speed_series(points: np.ndarray) -> np.ndarray:
    if len(points) <= 1:
        return np.zeros(len(points), dtype=float)
    deltas = np.linalg.norm(np.diff(points, axis=0), axis=1)
    return np.concatenate([np.array([0.0]), deltas])


@register_plugin("generic_core")
class GenericCorePlugin(BaseRulePlugin):
    def compute_metric_series(
        self, phase_id: str, student_data: np.ndarray, coach_data: np.ndarray
    ) -> Dict[str, list[float]]:
        if student_data.size == 0 or coach_data.size == 0:
            return {metric: [] for metric in CORE_METRICS if metric.endswith("_series")}

        stu_cg_z = _as_series(np.mean(student_data[:, :, 2], axis=1))
        coa_cg_z = _as_series(np.mean(coach_data[:, :, 2], axis=1))
        cg_z_delta = _safe_ratio_delta(stu_cg_z, coa_cg_z)

        stu_head = student_data[:, 1, :]
        coa_head = coach_data[:, 1, :]
        stu_head_disp = _displacement_series(stu_head)
        coa_head_disp = _displacement_series(coa_head)
        head_disp_delta = _safe_ratio_delta(stu_head_disp, coa_head_disp)

        stu_root = student_data[:, 8, :]
        coa_root = coach_data[:, 8, :]
        stu_speed = _speed_series(stu_root)
        coa_speed = _speed_series(coa_root)
        root_speed_delta = np.abs(stu_speed - coa_speed)

        return {
            "cg_z_delta_series": cg_z_delta.tolist(),
            "head_displacement_delta_series": head_disp_delta.tolist(),
            "root_speed_delta_series": root_speed_delta.tolist(),
        }

    def compute_metrics(
        self, phase_id: str, student_data: np.ndarray, coach_data: np.ndarray
    ) -> Dict[str, float]:
        series = self.compute_metric_series(phase_id, student_data, coach_data)

        stu_shoulder_vec = student_data[:, 2, :] - student_data[:, 5, :]
        coa_shoulder_vec = coach_data[:, 2, :] - coach_data[:, 5, :]
        shoulder_delta = np.abs(
            _axis_angle_xz(stu_shoulder_vec) - _axis_angle_xz(coa_shoulder_vec)
        )

        stu_hip_vec = student_data[:, 12, :] - student_data[:, 9, :]
        coa_hip_vec = coach_data[:, 12, :] - coach_data[:, 9, :]
        hip_delta = np.abs(_axis_angle_xz(stu_hip_vec) - _axis_angle_xz(coa_hip_vec))

        return {
            "cg_z_delta_mean": _series_mean(np.array(series["cg_z_delta_series"], dtype=float)),
            "head_displacement_delta_mean": _series_mean(
                np.array(series["head_displacement_delta_series"], dtype=float)
            ),
            "shoulder_tilt_delta_mean": _series_mean(shoulder_delta),
            "hip_yaw_delta_mean": _series_mean(hip_delta),
            "root_speed_delta_mean": _series_mean(
                np.array(series["root_speed_delta_series"], dtype=float)
            ),
            "cg_z_delta_series": _series_mean(np.array(series["cg_z_delta_series"], dtype=float)),
            "head_displacement_delta_series": _series_mean(
                np.array(series["head_displacement_delta_series"], dtype=float)
            ),
            "root_speed_delta_series": _series_mean(
                np.array(series["root_speed_delta_series"], dtype=float)
            ),
        }

    def list_supported_metrics(self) -> Dict[str, list[str]]:
        return {"*": CORE_METRICS}

    def list_supported_condition_types(self) -> list[str]:
        return [
            "threshold",
            "range",
            "boolean",
            "event_exists",
            "composite",
            "trend",
            "angle",
            "distance",
        ]
