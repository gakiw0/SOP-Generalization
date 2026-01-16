"""
Base metric implementations.

This module hosts metric functions that were originally implemented inside
specific plugins (e.g. baseball parity logic) but are better shared as a common
library.

Notes:
- Assumes OpenPose BODY_25 joint indexing where applicable.
- Functions are kept pure: (student, coach) -> float.
"""

from __future__ import annotations

import numpy as np

from jc_utils import scoring_utils as su


def stance_angle_diff_ratio(student: np.ndarray, coach: np.ndarray) -> float:
    student_vec = np.mean(student[:, 1], axis=0) - np.mean(student[:, 8], axis=0)
    coach_vec = np.mean(coach[:, 1], axis=0) - np.mean(coach[:, 8], axis=0)
    y_axis = np.array([0.0, -1.0, 0.0])
    stu_angle = su.angle_between(student_vec, y_axis)
    coach_angle = su.angle_between(coach_vec, y_axis)
    return abs(coach_angle - stu_angle) / max(abs(coach_angle), 1e-8)


def cg_z_avg_ratio_or_flag(student: np.ndarray, coach: np.ndarray) -> float:
    stu_offset = su.get_relative_cg_position(student, frame="avg", axis="z")
    coach_offset = su.get_relative_cg_position(coach, frame="avg", axis="z")
    if stu_offset < 0:
        if abs(stu_offset) < abs(coach_offset):
            return abs(stu_offset) / abs(coach_offset) if coach_offset != 0 else 1.0
        return 0.0
    return -50.0


def head_move_diff_ratio(student: np.ndarray, coach: np.ndarray) -> float:
    stu_head = student[[0, -1], 1]
    coach_head = coach[[0, -1], 1]
    stu_move = np.linalg.norm(stu_head[1] - stu_head[0])
    coach_move = np.linalg.norm(coach_head[1] - coach_head[0])
    return abs(stu_move - coach_move) / max(coach_move, 1e-5)


def stride_z_class(student: np.ndarray, coach: np.ndarray) -> float:
    stu_stride = student[-1][14][2] - student[0][14][2]
    coach_stride = coach[-1][14][2] - coach[0][14][2]
    stride_diff = abs(stu_stride - coach_stride)
    if stu_stride <= coach_stride:
        return 0.0
    if stride_diff <= 0.2 * abs(coach_stride):
        return 0.5
    return 5.0


def cg_z_end_ratio_or_flag(student: np.ndarray, coach: np.ndarray) -> float:
    stu_offset = su.get_relative_cg_position(student, frame=-1, axis="z")
    coach_offset = su.get_relative_cg_position(coach, frame=-1, axis="z")
    tolerance = 0.04
    if stu_offset > tolerance:
        return -50.0
    if abs(stu_offset) < abs(coach_offset):
        return abs(stu_offset) / abs(coach_offset) if coach_offset != 0 else 1.0
    return 0.0


def shoulder_xz_angle_diff_ratio(student: np.ndarray, coach: np.ndarray) -> float:
    shoulder_vec_stu = student[-1][2] - student[-1][5]
    shoulder_vec_coach = coach[-1][2] - coach[-1][5]
    angle_stu = su.get_angle_with_xz_plane(shoulder_vec_stu)
    angle_coach = su.get_angle_with_xz_plane(shoulder_vec_coach)
    return abs(angle_stu - angle_coach) / max(abs(angle_coach), 1e-5)


def cg_z_end_diff_class(student: np.ndarray, coach: np.ndarray) -> float:
    stu_offset = su.get_relative_cg_position(student, frame=-1, axis="z")
    coach_offset = su.get_relative_cg_position(coach, frame=-1, axis="z")
    if stu_offset >= coach_offset:
        return 0.0
    if (coach_offset - stu_offset) <= 0.08:
        return 0.5
    return 5.0


def shoulder_height_diff_class(student: np.ndarray, coach: np.ndarray) -> float:
    stu_diff = np.mean(student[:, 4, 1]) - np.mean(student[:, 7, 1])
    coach_diff = np.mean(coach[:, 4, 1]) - np.mean(coach[:, 7, 1])
    if stu_diff < 0:
        return abs(stu_diff)
    if stu_diff < coach_diff:
        return 0.5
    return 0.0


def cg_z_std_diff_ratio(student: np.ndarray, coach: np.ndarray) -> float:
    stu_cg_z = [su.get_center_of_gravity(student, frame=i)[2] for i in range(len(student))]
    coach_cg_z = [su.get_center_of_gravity(coach, frame=i)[2] for i in range(len(coach))]
    std_stu = np.std(stu_cg_z)
    std_coach = np.std(coach_cg_z)
    return abs(std_stu - std_coach) / max(std_coach, 1e-5)


def hip_yaw_angle_diff_ratio_or_clamp(student: np.ndarray, coach: np.ndarray) -> float:
    stu_hip_vec = student[-1][12] - student[-1][9]
    coach_hip_vec = coach[-1][12] - coach[-1][9]
    stu_angle = su.angle_between(stu_hip_vec, [0, 0, 1])
    coach_angle = su.angle_between(coach_hip_vec, [0, 0, 1])
    val = abs(stu_angle - coach_angle) / max(abs(coach_angle), 1e-5)
    if stu_angle > 90:
        val = 0.0
    return val

