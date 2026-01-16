"""
Plugins namespace for rule engine.

Plugins are expected to register themselves in `plugins.registry` when imported.
"""

from __future__ import annotations


def load_builtin_plugins() -> None:
    """
    Import all plugin modules in this package so they can self-register.

    This avoids hardcoding plugin imports in runner.py.
    """
    import importlib
    import pkgutil

    for module in pkgutil.iter_modules(__path__):  # type: ignore[name-defined]
        name = module.name
        if name in {"base", "registry"} or name.startswith("_"):
            continue
        importlib.import_module(f"{__name__}.{name}")
