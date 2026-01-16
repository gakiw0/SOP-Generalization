"""
Runner for RuleEngine with optional legacy artifact generation.
"""
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Dict

import numpy as np

from jc_utils import scoring_utils as su
from .engine import RuleEngine
from .plugins.baseball import BaseballPlugin
from .legacy_adapter import build_step_ranges, to_legacy_results
from . import artifacts


@dataclass
class RunnerOptions:
    data_root: Path
    data_name: str
    rule_path: Path
    plugin_name: str = "baseball"
    save_new: bool = True
    save_legacy: bool = True
    save_step_ranges: bool = True
    split_videos: bool = False
    split_data: bool = False
    visualize: bool = False
    vis_output_dir: Optional[Path] = None
    profile: bool = False


def _get_plugin(plugin_name: str):
    if plugin_name == "baseball":
        return BaseballPlugin()
    raise ValueError(f"Unknown plugin: {plugin_name}")


def _load_skeletons(data_root: Path, data_name: str) -> Dict[str, np.ndarray]:
    data_dir = data_root / data_name / "aligned" / "data"
    student_path = data_dir / "student_aligned_skeleton.json"
    coach_path = data_dir / "coach_aligned_skeleton.json"
    student = np.array(su.load_json(student_path))
    coach = np.array(su.load_json(coach_path))
    return {"student": student, "coach": coach}


def run(options: RunnerOptions) -> Dict[str, Path]:
    plugin = _get_plugin(options.plugin_name)
    engine = RuleEngine.from_file(options.rule_path, plugin=plugin)
    rule_set = engine.rule_set

    skel = _load_skeletons(options.data_root, options.data_name)
    student = skel["student"]
    coach = skel["coach"]

    results = engine.analyze(student, coach, context={"profile_timings": options.profile})

    step_ranges, phase_id_to_step = build_step_ranges(rule_set)
    legacy_results = None
    if options.save_legacy:
        legacy_results = to_legacy_results(results, rule_set, phase_id_to_step)

    output_paths: Dict[str, Path] = {}
    if options.save_step_ranges:
        artifacts.save_step_frame_ranges(options.data_root, options.data_name, step_ranges)

    output_paths.update(
        artifacts.save_analysis_results(
            options.data_root,
            options.data_name,
            legacy_results=legacy_results if options.save_legacy else None,
            new_results=results if options.save_new else None,
        )
    )

    if options.split_videos:
        artifacts.split_all_videos_by_steps(options.data_root, options.data_name, step_ranges)
    if options.split_data:
        artifacts.split_all_data_by_steps(options.data_root, options.data_name, step_ranges)
    if options.visualize:
        vis_dir = options.vis_output_dir or (options.data_root / options.data_name / "aligned" / "vis")
        student_p, coach_p = engine.preprocess(student, coach)
        artifacts.visualize_first_frame_with_axes(student_p, coach_p, options.data_name, vis_dir)

    return output_paths
