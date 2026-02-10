import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.rules_engine import plugins
from src.rules_engine.plugins.registry import default_plugin_registry


def _build_capabilities() -> dict:
    plugins.load_builtin_plugins()

    plugin_names = sorted(default_plugin_registry.names())
    plugin_map: dict[str, dict] = {}

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

    return {
        "version": 1,
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
