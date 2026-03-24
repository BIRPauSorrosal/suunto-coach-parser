import json
from datetime import datetime
from pathlib import Path


class BaseParser:
    """
    Classe pare genèrica per a QUALSEVOL activitat de Suunto.
    Conté únicament les mètriques comunes a tots els esports:
    data, durada, distància, desnivell, FC i zones de FC, PTE i recuperació.

    Per afegir un nou esport, crear un BaseXxxParser que hereti d'aquesta classe.
    """

    def __init__(self, filepath: Path):
        self.filepath = filepath
        self.data = self._load_json()
        self.header = self.data["DeviceLog"]["Header"]
        self.samples = self.data["DeviceLog"]["Samples"]

    def _load_json(self) -> dict:
        with open(self.filepath, "r", encoding="utf-8") as f:
            return json.load(f)

    def get_date(self) -> str:
        raw = self.header.get("DateTime", "")
        if raw:
            dt = datetime.fromisoformat(raw)
            return dt.strftime("%d/%m/%Y")
        return ""

    def get_duration_min(self) -> float:
        secs = self.header.get("Duration", 0) or 0
        return round(secs / 60, 1)

    def get_distance_km(self) -> float:
        metres = self.header.get("Distance", 0) or 0
        return round(metres / 1000, 2)

    def get_ascent_m(self) -> int:
        return int(self.header.get("Ascent", 0) or 0)

    def get_hr_avg(self) -> int:
        hr_list = [s["HR"] for s in self.samples if "HR" in s and s["HR"] is not None]
        if not hr_list:
            return 0
        return int(round((sum(hr_list) / len(hr_list)) * 60))

    def get_hr_max(self) -> int:
        hr_list = [s["HR"] for s in self.samples if "HR" in s and s["HR"] is not None]
        if not hr_list:
            return 0
        return int(round(max(hr_list) * 60))

    def get_hr_zones(self) -> dict:
        zones = self.header.get("HrZones", {}) or {}
        return {
            "Z1": round((zones.get("Zone1Duration") or 0) / 60, 1),
            "Z2": round((zones.get("Zone2Duration") or 0) / 60, 1),
            "Z3": round((zones.get("Zone3Duration") or 0) / 60, 1),
            "Z4": round((zones.get("Zone4Duration") or 0) / 60, 1),
            "Z5": round((zones.get("Zone5Duration") or 0) / 60, 1),
        }

    def get_pte(self) -> float:
        return self.header.get("PeakTrainingEffect", 0.0) or 0.0

    def get_recovery_hours(self) -> float:
        secs = self.header.get("RecoveryTime", 0) or 0
        return round(secs / 3600, 1)

    def parse(self) -> dict:
        """Dades comunes a tots els esports. Els parsers fills amplien aquest diccionari."""
        zones = self.get_hr_zones()
        return {
            "Data":         self.get_date(),
            "Tipus":        "",  # sobreescrit pel parser fill
            "Durada(min)": self.get_duration_min(),
            "Dist(km)":    self.get_distance_km(),
            "Desnivell(m)": self.get_ascent_m(),
            "FCMitja":     self.get_hr_avg(),
            "FCMax":       self.get_hr_max(),
            "Z1(min)":     zones["Z1"],
            "Z2(min)":     zones["Z2"],
            "Z3(min)":     zones["Z3"],
            "Z4(min)":     zones["Z4"],
            "Z5(min)":     zones["Z5"],
            "PTE":         self.get_pte(),
            "Recup(h)":    self.get_recovery_hours(),
        }
