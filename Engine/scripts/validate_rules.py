import argparse
import json
import sys
from pathlib import Path

try:
    import jsonschema
    from jsonschema import Draft202012Validator
except ImportError:  # pragma: no cover - dependency should be installed via env.yml/requirements
    sys.stderr.write("jsonschema is required to run this validator.\n")
    sys.exit(1)


REPO_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = REPO_ROOT / "configs" / "rules" / "schema" / "v1.json"


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

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


def ensure_unique_ids(items, key_name, context):
    seen = set()
    for item in items:
        key = item.get(key_name)
        if key in seen:
            raise ValueError(f"Duplicate {key_name} '{key}' in {context}")
        seen.add(key)
    return seen


def validate_references(rule_set):
    phase_ids = ensure_unique_ids(rule_set.get("phases", []), "id", "phases")
    rule_ids = ensure_unique_ids(rule_set.get("rules", []), "id", "rules")

    for rule in rule_set.get("rules", []):
        # phase existence
        phase = rule.get("phase")
        if phase not in phase_ids:
            raise ValueError(f"Rule '{rule.get('id')}' references missing phase '{phase}'")

        # condition ids uniqueness
        cond_ids = ensure_unique_ids(rule.get("conditions", []), "id", f"rule {rule.get('id')} conditions")

        # feedback condition references
        for fb in rule.get("feedback", []):
            for cid in fb.get("condition_ids", []):
                if cid not in cond_ids:
                    raise ValueError(
                        f"Rule '{rule.get('id')}' feedback references missing condition '{cid}'"
                    )

        # signal ref check
        signal = rule.get("signal", {})
        if signal.get("type") == "frame_range_ref":
            ref = signal.get("ref", "")
            if not ref.startswith("phase:"):
                raise ValueError(f"Rule '{rule.get('id')}' has invalid ref '{ref}' (expected 'phase:<id>')")
            ref_phase = ref.split("phase:", 1)[1]
            if ref_phase not in phase_ids:
                raise ValueError(f"Rule '{rule.get('id')}' references missing phase '{ref_phase}' in signal")

    return True


def validate_with_schema(rule_set, schema):
    Draft202012Validator(schema).validate(rule_set)


def main():
    parser = argparse.ArgumentParser(description="Validate rule JSON against schema and cross-references.")
    parser.add_argument("rule_path", type=Path, help="Path to rule JSON file (e.g., configs/rules/baseball_swing_v1.json)")
    parser.add_argument("--schema", type=Path, default=SCHEMA_PATH, help="Path to schema JSON (default: v1)")
    args = parser.parse_args()

    schema = load_json(_resolve_path(args.schema))
    rule_set = load_json(_resolve_path(args.rule_path))

    validate_with_schema(rule_set, schema)
    validate_references(rule_set)

    print(f"Validation succeeded for {args.rule_path}")


if __name__ == "__main__":
    main()
