import argparse
import json
from copy import deepcopy
from pathlib import Path


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def dump_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def schema_major(version: str) -> int:
    parts = str(version or "").split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        raise ValueError(f"Invalid schema_version '{version}'. Expected x.y.z.")
    return int(parts[0])


def migrate_v1_to_v2(
    rule_set_v1: dict,
    *,
    profile_id: str = "generic_core",
    profile_type: str = "generic",
    preset_id: str | None = None,
) -> tuple[dict, dict]:
    if schema_major(rule_set_v1.get("schema_version", "")) != 1:
        raise ValueError("Input ruleset is not schema v1.")

    migrated = {
        "schema_version": "2.0.0",
        "rule_set_id": rule_set_v1["rule_set_id"],
        "metric_profile": {
            "id": profile_id,
            "type": profile_type,
            "metric_space": "core_v1",
        },
        "metadata": deepcopy(rule_set_v1.get("metadata", {})),
        "inputs": deepcopy(rule_set_v1.get("inputs", {})),
        "globals": deepcopy(rule_set_v1.get("globals", {})),
        "phases": deepcopy(rule_set_v1.get("phases", [])),
        "rules": deepcopy(rule_set_v1.get("rules", [])),
    }

    if profile_type == "preset":
        resolved_preset_id = preset_id or f"{rule_set_v1.get('sport', 'starter')}_starter"
        migrated["metric_profile"]["preset_id"] = resolved_preset_id

    # sport fields remain metadata-only in v2 for backward context.
    if rule_set_v1.get("sport"):
        migrated["sport"] = rule_set_v1["sport"]
    if rule_set_v1.get("sport_version"):
        migrated["sport_version"] = rule_set_v1["sport_version"]

    report = {
        "source_schema_version": rule_set_v1.get("schema_version"),
        "target_schema_version": migrated["schema_version"],
        "rule_set_id": migrated["rule_set_id"],
        "metric_profile": migrated["metric_profile"],
        "phase_count": len(migrated["phases"]),
        "rule_count": len(migrated["rules"]),
    }
    return migrated, report


def default_output_path(input_path: Path) -> Path:
    stem = input_path.stem
    if stem.endswith("_v1"):
        stem = stem[:-3]
    return input_path.with_name(f"{stem}_v2.json")


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate schema v1 ruleset JSON to schema v2.")
    parser.add_argument("input", type=Path, help="Input v1 ruleset JSON path.")
    parser.add_argument("--output", type=Path, default=None, help="Output v2 JSON path.")
    parser.add_argument("--profile-id", type=str, default="generic_core")
    parser.add_argument("--profile-type", type=str, choices=["generic", "preset"], default="generic")
    parser.add_argument("--preset-id", type=str, default=None)
    args = parser.parse_args()

    source = load_json(args.input)
    migrated, report = migrate_v1_to_v2(
        source,
        profile_id=args.profile_id,
        profile_type=args.profile_type,
        preset_id=args.preset_id,
    )

    out_path = args.output or default_output_path(args.input)
    dump_json(out_path, migrated)
    print(json.dumps({"output": str(out_path), "report": report}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
