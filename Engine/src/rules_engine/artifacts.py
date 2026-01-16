"""
Artifacts helpers: save outputs, split videos/data, and visualization.
"""
from pathlib import Path
from typing import Dict, Iterable, List, Optional
import json

import numpy as np
import cv2

from jc_utils import scoring_utils as su


def save_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def save_step_frame_ranges(data_root: Path, data_name: str, step_ranges: Dict[str, List[int]]) -> Path:
    out_path = data_root / data_name / "aligned" / "step_frame_ranges.json"
    save_json(out_path, step_ranges)
    return out_path


def save_analysis_results(
    data_root: Path,
    data_name: str,
    legacy_results: Optional[Dict] = None,
    new_results: Optional[Dict] = None,
) -> Dict[str, Path]:
    out_paths: Dict[str, Path] = {}
    if legacy_results is not None:
        legacy_path = data_root / data_name / "analysis_results.json"
        save_json(legacy_path, legacy_results)
        out_paths["legacy"] = legacy_path
    if new_results is not None:
        new_path = data_root / data_name / "analysis_results_new.json"
        save_json(new_path, new_results)
        out_paths["new"] = new_path
    return out_paths


def split_video_by_steps(video_path: Path, output_folder: Path, steps: Dict[str, List[int]], cam_id: int) -> None:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"Warning: failed to open video {video_path}")
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))

    output_folder.mkdir(parents=True, exist_ok=True)

    for step_idx, (_, frame_range) in enumerate(steps.items(), start=1):
        if not frame_range:
            continue
        output_path = output_folder / f"step{step_idx}_cam{cam_id}.mp4"
        out = cv2.VideoWriter(str(output_path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
        start_f, end_f = frame_range[0], frame_range[-1]
        for frame_idx in range(start_f, end_f + 1):
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                print(f"Warning: failed to read frame {frame_idx} from {video_path}")
                continue
            out.write(frame)
        out.release()

    cap.release()


def split_all_videos_by_steps(
    data_root: Path,
    data_name: str,
    steps: Dict[str, List[int]],
    roles: Iterable[str] = ("student", "coach"),
    cam_ids: Iterable[int] = (1, 2, 3, 4),
) -> None:
    for cam_id in cam_ids:
        for role in roles:
            video_path = data_root / data_name / "aligned" / f"{role}_video" / f"cam{cam_id}_aligned.mp4"
            if not video_path.exists():
                continue
            output_folder = data_root / data_name / "aligned" / f"{role}_video"
            split_video_by_steps(video_path, output_folder, steps, cam_id)


def split_data_by_steps(
    data: np.ndarray,
    steps: Dict[str, List[int]],
    output_name: str,
    output_folder: Path,
) -> None:
    output_folder.mkdir(parents=True, exist_ok=True)
    for idx, (_, frame_range) in enumerate(steps.items(), start=1):
        if not frame_range:
            continue
        step_frames = data[frame_range[0]:frame_range[-1] + 1]
        output_path = output_folder / f"step{idx}_{output_name}.json"
        with output_path.open("w", encoding="utf-8") as f:
            json.dump(step_frames.tolist(), f, indent=2)


def split_all_data_by_steps(
    data_root: Path,
    data_name: str,
    steps: Dict[str, List[int]],
    data_files: Optional[Dict[str, Path]] = None,
) -> None:
    data_output_folder = data_root / data_name / "aligned" / "data"
    if data_files is None:
        data_files = {
            "student_aligned_skeleton": data_output_folder / "student_aligned_skeleton.json",
            "coach_aligned_skeleton": data_output_folder / "coach_aligned_skeleton.json",
            "student_aligned_bat": data_output_folder / "student_aligned_bat.json",
            "coach_aligned_bat": data_output_folder / "coach_aligned_bat.json",
        }

    for name, path in data_files.items():
        if not path.exists():
            continue
        data = np.array(su.load_json(path))
        split_data_by_steps(data, steps, name, data_output_folder)


def visualize_first_frame_with_axes(
    student_data: np.ndarray,
    coach_data: np.ndarray,
    data_name: str,
    output_dir: Path,
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    su.visualize_first_frame_with_axes(student_data, coach_data, data_name, output_dir=str(output_dir))
    return output_dir / f"{data_name}_first_frame_skeleton.png"
