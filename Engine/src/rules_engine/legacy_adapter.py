"""
Legacy adapter to produce SOPScoring-compatible outputs from RuleEngine results.
"""
from typing import Dict, List, Tuple


def _legacy_step_name(phase: Dict, index: int) -> str:
    return phase.get("legacy_step_name") or f"Step{index}"


def build_step_ranges(rule_set: Dict) -> Tuple[Dict[str, List[int]], Dict[str, str]]:
    step_ranges: Dict[str, List[int]] = {}
    phase_id_to_step: Dict[str, str] = {}
    phases = rule_set.get("phases", [])
    for idx, phase in enumerate(phases, start=1):
        phase_id = phase.get("id")
        if not phase_id:
            continue
        frame_range = phase.get("frame_range")
        if not frame_range:
            continue
        step_name = _legacy_step_name(phase, idx)
        step_ranges[step_name] = list(range(frame_range[0], frame_range[1] + 1))
        phase_id_to_step[phase_id] = step_name
    return step_ranges, phase_id_to_step


def to_legacy_results(results: Dict, rule_set: Dict, phase_id_to_step: Dict[str, str]) -> Dict:
    out: Dict[str, Dict] = {}
    phase_map = {p.get("id"): p for p in rule_set.get("phases", [])}

    for phase_id, phase_result in results.items():
        # Ignore non-phase entries (e.g., profiling metadata).
        if phase_id not in phase_map:
            continue
        step_name = phase_id_to_step.get(phase_id, phase_id)
        step_dict: Dict[str, object] = {}

        rules = phase_result.get("Rules", {})
        for rule_id, rr in rules.items():
            label = rr.get("label") or rule_id
            passed = rr.get("passed")
            if passed is True:
                desc_text = "Correct"
            elif passed is False:
                desc_text = "Too different"
            else:
                desc_text = "Unknown"
            step_dict[label] = desc_text

        if "Score" in phase_result:
            step_dict["Score"] = phase_result["Score"]
        if "StepClassification" in phase_result:
            step_dict["StepClassification"] = phase_result["StepClassification"]

        feedback_msgs = []
        for rr in rules.values():
            for fb in rr.get("feedback", []):
                msg = fb.get("message")
                if msg:
                    feedback_msgs.append(msg)
        if feedback_msgs:
            step_dict["Feedback"] = " ".join(feedback_msgs)

        phase = phase_map.get(phase_id, {})
        if "label" in phase:
            step_dict["StepTitle"] = phase["label"]
        if "description" in phase:
            step_dict["StepDescription"] = phase["description"]

        if "is_important" in phase:
            step_dict["IsImportant"] = bool(phase["is_important"])

        out[step_name] = step_dict

    return out
