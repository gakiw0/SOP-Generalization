"""
Simple metric registry used by the rule engine.
"""

from typing import Callable, Dict

MetricFunc = Callable[..., float]


class MetricRegistry:
    def __init__(self):
        self._registry: Dict[str, MetricFunc] = {}

    def register(self, name: str, fn: MetricFunc):
        if name in self._registry:
            raise ValueError(f"Metric '{name}' already registered.")
        self._registry[name] = fn

    def get(self, name: str) -> MetricFunc:
        if name not in self._registry:
            raise KeyError(f"Metric '{name}' is not registered.")
        return self._registry[name]

    def names(self):
        return list(self._registry.keys())


# Global default registry for simple usage.
default_registry = MetricRegistry()


def register_metric(name: str):
    """
    Decorator helper to register a metric on the default registry.
    """

    def decorator(fn: MetricFunc):
        default_registry.register(name, fn)
        return fn

    return decorator
