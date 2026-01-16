import argparse
from pathlib import Path
import json
import sys
import numpy as np
import os

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from jc_utils import scoring_utils as su  # noqa: E402
from src.rules_engine.engine import RuleEngine  # noqa: E402
from src.rules_engine.plugins.baseball import BaseballPlugin  # noqa: E402


def load_skeleton(path: Path) -> np.ndarray:
    return np.array(su.load_json(path))


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
    parser = argparse.ArgumentParser(description="Run new rule engine and optionally compare with existing analysis_results.json.")
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
    args = parser.parse_args()

    data_root = args.data_root or _default_data_root()
    student_path = data_root / args.data_name / "aligned" / "data" / "student_aligned_skeleton.json"
    coach_path = data_root / args.data_name / "aligned" / "data" / "coach_aligned_skeleton.json"

    student = load_skeleton(student_path)
    coach = load_skeleton(coach_path)

    engine = RuleEngine.from_file(_resolve_path(args.rule_path), plugin=BaseballPlugin())
    results = engine.analyze(student, coach)

    print(f"New engine results for {args.data_name}:")
    print(json.dumps(results, indent=2, ensure_ascii=False))

    # Save new engine results (raw) next to legacy outputs
    out_path = data_root / args.data_name / "analysis_results_new.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nSaved new engine results to: {out_path}")

    old_result_path = data_root / args.data_name / "analysis_results.json"
    if old_result_path.exists():
        old_results = su.load_json(old_result_path)
        print("\nExisting analysis_results.json found. Running parity check...")

        # Mapping from legacy English checkpoint labels (after SOPScoring English-ification)
        # to new rule_ids.
        legacy_to_new = {
            "Step1": {
                "Upper body angle aligned": "step1_stance_angle",
                "Center of gravity stays back (avg)": "step1_cg_offset_avg",
            },
            "Step2": {
                "Head stability": "step2_head_move",
                "Stride length appropriate": "step2_stride",
                "Center of gravity stays back (end)": "step2_cg_offset_end",
                "Shoulders level": "step2_shoulder_angle",
            },
            "Step3": {
                "CG shifts forward": "step3_cg_offset_end",
                "Bat head does not drop": "step3_shoulder_height",
            },
            "Step4": {
                "CG stability": "step4_cg_std",
                "Hip rotation to front": "step4_hip_yaw",
            },
        }

        def legacy_value_to_pass(val) -> bool:
            s = str(val)
            if "Correct" in s:
                return True
            return False

        mismatches = []
        # Compare per-step checkpoints
        for legacy_step, mapping in legacy_to_new.items():
            new_step = legacy_step.lower()
            if legacy_step not in old_results or new_step not in results:
                mismatches.append((legacy_step, "missing_step", None, None))
                continue
            old_step_vals = old_results[legacy_step]
            new_step_vals = results[new_step]["Rules"]
            for legacy_label, new_rule_id in mapping.items():
                if legacy_label not in old_step_vals:
                    mismatches.append((legacy_step, legacy_label, "missing_legacy_label", None))
                    continue
                if new_rule_id not in new_step_vals:
                    mismatches.append((legacy_step, legacy_label, None, "missing_new_rule"))
                    continue
                old_pass = legacy_value_to_pass(old_step_vals[legacy_label])
                new_pass = bool(new_step_vals[new_rule_id]["passed"])
                if old_pass != new_pass:
                    mismatches.append((legacy_step, legacy_label, old_pass, new_pass))

            # Step-level parity (score/classification)
            old_score = old_step_vals.get("Score")
            new_score = results[new_step].get("Score")
            if isinstance(old_score, (int, float)) and isinstance(new_score, (int, float)):
                if int(old_score) != int(new_score):
                    mismatches.append((legacy_step, "Score", int(old_score), int(new_score)))
            old_cls = old_step_vals.get("StepClassification")
            new_cls = results[new_step].get("StepClassification")
            if old_cls and new_cls and str(old_cls) != str(new_cls):
                mismatches.append((legacy_step, "StepClassification", old_cls, new_cls))

        if not mismatches:
            print("Parity check passed: all mapped checkpoints and step scores match legacy.")
        else:
            print("Parity mismatches:")
            for step, item, old_v, new_v in mismatches:
                print(f"- {step} / {item}: legacy={old_v} new={new_v}")
    else:
        print("\nNo existing analysis_results.json found to compare.")


if __name__ == "__main__":
    main()
