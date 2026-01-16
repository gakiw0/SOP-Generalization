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


def resolve_plugin_name(rule_set: dict, plugin_name: Optional[str]) -> str:
    """
    Resolve a plugin name, allowing auto-selection via rule_set["sport"].
    """
    if plugin_name and plugin_name != "auto":
        return plugin_name
    sport = (rule_set or {}).get("sport")
    if not sport:
        raise ValueError("plugin_name is 'auto' but rule_set.sport is missing.")
    return str(sport)

