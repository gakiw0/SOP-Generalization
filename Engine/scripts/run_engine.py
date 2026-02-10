import argparse
import os
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from jc_utils import scoring_utils as su
from src.rules_engine.runner import RunnerOptions, run


def _resolve_path(path: Path) -> Path:
    if path.is_absolute():
        return path
    cwd_candidate = Path.cwd() / path
    if cwd_candidate.exists():
        return cwd_candidate
    repo_candidate = REPO_ROOT / path
    if repo_candidate.exists():
        return repo_candidate
    return path


def _default_data_root() -> Path:
    env_root = os.environ.get("SOP_DATA_ROOT")
    if env_root:
        return Path(env_root)
    sibling = REPO_ROOT.parent / "Data" / "datasets" / "EZmocap" / "CASA_outputs"
    if sibling.exists():
        return sibling
    return su.DATA_ROOT


def main():
    parser = argparse.ArgumentParser(description="Run RuleEngine with optional legacy artifact generation.")
    parser.add_argument("data_name", type=str, help="Dataset name under data root.")
    parser.add_argument(
        "--rule_path",
        type=Path,
        default=REPO_ROOT / "configs" / "rules" / "baseball_swing_v1.json",
        help="Path to rule JSON.",
    )
    parser.add_argument(
        "--data_root",
        type=Path,
        default=None,
        help="Root data folder (default: $env:SOP_DATA_ROOT, or SOP/Data, or jc_utils.scoring_utils.DATA_ROOT).",
    )
    parser.add_argument(
        "--plugin",
        type=str,
        default="auto",
        help="Plugin name (default: auto -> v1 uses sport, v2 uses metric_profile.id with generic_core fallback).",
    )
    parser.add_argument("--no-save-new", action="store_true", help="Do not save analysis_results_new.json.")
    parser.add_argument("--no-save-legacy", action="store_true", help="Do not save analysis_results.json.")
    parser.add_argument("--no-save-step-ranges", action="store_true", help="Do not save step_frame_ranges.json.")
    parser.add_argument("--split-videos", action="store_true", help="Split aligned videos by steps.")
    parser.add_argument("--split-data", action="store_true", help="Split aligned data by steps.")
    parser.add_argument("--visualize", action="store_true", help="Save first-frame visualization.")
    parser.add_argument("--profile", action="store_true", help="Include per-phase timing information in results.")
    parser.add_argument(
        "--vis-output-dir",
        type=Path,
        default=None,
        help="Visualization output directory (default: <data_root>/<data_name>/aligned/vis).",
    )
    args = parser.parse_args()
    data_root = args.data_root or _default_data_root()

    options = RunnerOptions(
        data_root=data_root,
        data_name=args.data_name,
        rule_path=_resolve_path(args.rule_path),
        plugin_name=args.plugin,
        save_new=not args.no_save_new,
        save_legacy=not args.no_save_legacy,
        save_step_ranges=not args.no_save_step_ranges,
        split_videos=args.split_videos,
        split_data=args.split_data,
        visualize=args.visualize,
        vis_output_dir=args.vis_output_dir,
        profile=args.profile,
    )
    run(options)


if __name__ == "__main__":
    main()
