from typing import Dict
import numpy as np


class BaseRulePlugin:
    """
    Base interface for rule plugins. Plugins compute phase-specific metrics.
    """

    def compute_metrics(self, phase_id: str, student_data: np.ndarray, coach_data: np.ndarray) -> Dict[str, float]:
        raise NotImplementedError
