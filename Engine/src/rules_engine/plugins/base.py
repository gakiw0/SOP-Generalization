from typing import Dict
import numpy as np


class BaseRulePlugin:
    """
    Base interface for rule plugins. Plugins compute phase-specific metrics.
    """

    def compute_metrics(self, phase_id: str, student_data: np.ndarray, coach_data: np.ndarray) -> Dict[str, float]:
        raise NotImplementedError

    def compute_metric_series(
        self, phase_id: str, student_data: np.ndarray, coach_data: np.ndarray
    ) -> Dict[str, list[float]]:
        """
        Optional per-frame metric series used by trend conditions.
        Plugins that only support scalar metrics can keep the default empty response.
        """
        return {}

    def list_supported_metrics(self) -> Dict[str, list[str]]:
        """
        Return supported metric names by phase id.
        Example:
        {
          "step1": ["metric_a", "metric_b"],
          "step2": ["metric_c"]
        }
        """
        raise NotImplementedError

    def list_supported_condition_types(self) -> list[str]:
        """
        Return condition types currently supported by runtime evaluator.
        """
        raise NotImplementedError
