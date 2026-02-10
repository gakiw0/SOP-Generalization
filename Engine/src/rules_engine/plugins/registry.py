"""
Plugin registry for the rule engine.

Purpose:
- Allow selecting a sport/plugin without hardcoding conditionals in runner.py.
- Enable "auto" plugin selection via rule_set["sport"].
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, Optional, Type, TypeVar, Union


PluginFactory = Callable[[], object]
T = TypeVar("T")


@dataclass(frozen=True)
class RegisteredPlugin:
    name: str
    factory: PluginFactory


class PluginRegistry:
    def __init__(self):
        self._registry: Dict[str, RegisteredPlugin] = {}

    def register(self, name: str, factory: PluginFactory) -> None:
        if not name:
            raise ValueError("Plugin name must be non-empty.")
        key = str(name).strip()
        if not key:
            raise ValueError("Plugin name must be non-empty.")
        if key in self._registry:
            raise ValueError(f"Plugin '{key}' already registered.")
        self._registry[key] = RegisteredPlugin(name=key, factory=factory)

    def create(self, name: str) -> object:
        if name not in self._registry:
            known = ", ".join(sorted(self._registry.keys())) or "<none>"
            raise KeyError(f"Plugin '{name}' is not registered. Known: {known}")
        return self._registry[name].factory()

    def names(self):
        return list(self._registry.keys())


default_plugin_registry = PluginRegistry()


def register_plugin(name: str):
    """
    Decorator helper to register a plugin on the default registry.

    Usage:
      @register_plugin("baseball")
      class BaseballPlugin(BaseRulePlugin):
          ...
    """

    def decorator(obj: Union[Type[T], Callable[[], T]]):
        if isinstance(obj, type):
            default_plugin_registry.register(name, lambda: obj())
            return obj
        default_plugin_registry.register(name, obj)
        return obj

    return decorator


def _schema_major(rule_set: dict) -> int:
    version = str((rule_set or {}).get("schema_version", "")).strip()
    parts = version.split(".")
    if len(parts) == 3 and all(part.isdigit() for part in parts):
        return int(parts[0])
    return 1


def resolve_plugin_name(rule_set: dict, plugin_name: Optional[str]) -> str:
    """
    Resolve plugin name:
    - v1: auto => rule_set["sport"] (legacy behavior)
    - v2+: auto => rule_set["metric_profile"]["id"], fallback generic_core
    """
    if plugin_name and plugin_name != "auto":
        return plugin_name
    major = _schema_major(rule_set)
    if major >= 2:
        metric_profile = (rule_set or {}).get("metric_profile") or {}
        profile_id = str(metric_profile.get("id", "")).strip()
        return profile_id or "generic_core"

    sport = (rule_set or {}).get("sport")
    if not sport:
        raise ValueError("plugin_name is 'auto' but rule_set.sport is missing for schema v1.")
    return str(sport)
