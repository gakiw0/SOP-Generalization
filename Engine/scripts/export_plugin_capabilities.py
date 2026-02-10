import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.rules_engine import plugins
from src.rules_engine.plugins.registry import default_plugin_registry


METRIC_CATALOG_PATH = REPO_ROOT / "configs" / "metrics" / "core_metric_catalog_v1.json"


def _load_metric_catalog() -> dict:
    if not METRIC_CATALOG_PATH.exists():
        return {"metric_space": "core_v1", "metrics": []}
    with METRIC_CATALOG_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _build_capabilities() -> dict:
    plugins.load_builtin_plugins()
    metric_catalog = _load_metric_catalog()
    catalog_metrics = metric_catalog.get("metrics", [])
    catalog_metric_ids = sorted(
        {
            str(metric.get("id"))
            for metric in catalog_metrics
            if isinstance(metric, dict) and str(metric.get("id", "")).strip()
        }
    )

    plugin_names = sorted(default_plugin_registry.names())
    plugin_map: dict[str, dict] = {}
    profiles: dict[str, dict] = {}

    for plugin_name in plugin_names:
        plugin = default_plugin_registry.create(plugin_name)
        metrics_by_phase = plugin.list_supported_metrics()
        sorted_metrics_by_phase = {
            str(phase_id): sorted({str(metric) for metric in metrics})
            for phase_id, metrics in metrics_by_phase.items()
        }

        all_metrics = sorted(
            {
                metric
                for metrics in sorted_metrics_by_phase.values()
                for metric in metrics
            }
        )

        plugin_map[plugin_name] = {
            "supported_condition_types": sorted(
                {str(cond_type) for cond_type in plugin.list_supported_condition_types()}
            ),
            "metrics_by_phase": sorted_metrics_by_phase,
            "all_metrics": all_metrics,
        }

        profile_id = plugin_name
        profile_type = "generic" if plugin_name == "generic_core" else "preset"
        profiles[profile_id] = {
            "id": profile_id,
            "plugin": plugin_name,
            "type": profile_type,
            "preset_id": None if profile_type == "generic" else f"{plugin_name}_starter",
            "metric_space": str(metric_catalog.get("metric_space", "core_v1")),
            "supported_condition_types": plugin_map[plugin_name]["supported_condition_types"],
            "metrics_by_phase": sorted_metrics_by_phase,
            "available_metric_ids": sorted(set(all_metrics) | set(catalog_metric_ids)),
            "metric_catalog_ref": "core_metric_catalog_v1",
        }

    return {
        "version": 2,
        "default_profile_id": "generic_core",
        "metric_catalog": {
            "id": "core_metric_catalog_v1",
            "metric_space": str(metric_catalog.get("metric_space", "core_v1")),
            "available_metric_ids": catalog_metric_ids,
        },
        "profiles": profiles,
        # Keep legacy shape during migration window.
        "plugins": plugin_map,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Export plugin runtime capabilities for coach-builder UI."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=REPO_ROOT / ".." / "ui" / "src" / "generated" / "pluginCapabilities.json",
        help="Output JSON path (default: ui/src/generated/pluginCapabilities.json).",
    )
    args = parser.parse_args()

    capabilities = _build_capabilities()
    output_path = args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(capabilities, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Exported plugin capabilities to {output_path}")


if __name__ == "__main__":
    main()
