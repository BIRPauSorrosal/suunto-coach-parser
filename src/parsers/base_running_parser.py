from pathlib import Path

from src.parsers.base_parser import BaseParser
from src.utils.helpers import ms_to_minkm, hz_to_spm


class BaseRunningParser(BaseParser):
    """
    Classe intermitèdia per a totes les activitats de RUNNING.
    Afegeix les mètriques específiques del running sobre la base genèrica:
      - Ritme mitjà global (min/km)
      - Cadència mitjana global (spm)

    Jerarquia d'herència:
      BaseParser
      └── BaseRunningParser
          ├── Z2Parser
          ├── QualityParser  (TEMPO, TEST, INTERVALS)
          └── LlargaParser   (futur)
    """

    def __init__(self, filepath: Path):
        super().__init__(filepath)

    def get_pace(self) -> float:
        """Ritme mitjà global de la sessió en min/km."""
        speed_list = [
            s["Speed"] for s in self.samples
            if "Speed" in s and s["Speed"] is not None and s["Speed"] > 0
        ]
        if not speed_list:
            return 0.0
        return ms_to_minkm(sum(speed_list) / len(speed_list))

    def get_cadence_spm(self) -> int:
        """Cadència mitjana global de la sessió en passes per minut."""
        cadence_list = [
            s["Cadence"] for s in self.samples
            if "Cadence" in s and s["Cadence"] is not None and s["Cadence"] > 0
        ]
        if not cadence_list:
            return 0
        return hz_to_spm(sum(cadence_list) / len(cadence_list))

    def parse(self) -> dict:
        """Amplia la base genèrica amb ritme i cadència globals del running."""
        base = super().parse()
        # Inserim Ritme i Cadencia just després de Desnivell
        result = {}
        for k, v in base.items():
            result[k] = v
            if k == "Desnivell(m)":
                result["Ritme(min/km)"] = self.get_pace()
                result["Cadencia(spm)"] = self.get_cadence_spm()
        return result
