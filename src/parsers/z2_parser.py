from pathlib import Path
from src.parsers.base_parser import BaseParser
from src.utils.helpers import ms_to_minkm, hz_to_spm


class Z2Parser(BaseParser):
    """
    Parser específic per a rodatges suaus (Z2).
    Amplia el BaseParser afegint el ritme mitjà i la cadència.
    """

    def __init__(self, filepath: Path):
        super().__init__(filepath)

    def get_pace(self) -> float:
        """Calcula el ritme mitjà (min/km) a partir dels samples de velocitat."""
        speed_list = [
            s["Speed"] for s in self.samples
            if "Speed" in s and s["Speed"] is not None and s["Speed"] > 0
        ]
        if not speed_list:
            return 0.0
        avg_speed = sum(speed_list) / len(speed_list)
        return ms_to_minkm(avg_speed)

    def get_cadence_spm(self) -> int:
        """Calcula la cadència mitjana (passos per minut) a partir dels samples."""
        cadence_list = [
            s["Cadence"] for s in self.samples
            if "Cadence" in s and s["Cadence"] is not None and s["Cadence"] > 0
        ]
        if not cadence_list:
            return 0
        avg_cadence = sum(cadence_list) / len(cadence_list)
        return hz_to_spm(avg_cadence)

    def parse(self) -> dict:
        """Retorna totes les dades del rodatge Z2 en un diccionari pla per al CSV."""
        base = super().parse()
        base["Tipus"] = "Z2"
        base["Ritme(min/km)"] = self.get_pace()
        base["Cadencia(spm)"] = self.get_cadence_spm()
        return base
