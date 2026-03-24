import json
from datetime import datetime
from pathlib import Path

from src.utils.helpers import ms_to_minkm, hz_to_spm


class BaseParser:
    """
    Classe pare que extreu les dades comunes de qualsevol activitat Suunto.
    Llegeix el JSON brut i retorna un diccionari amb les mètriques principals.
    Inclou ritme mitjà i cadència globals per a totes les sessions.
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
        """Retorna la data de l'activitat en format DD/MM/YYYY."""
        raw = self.header.get("DateTime", "")
        if raw:
            dt = datetime.fromisoformat(raw)
            return dt.strftime("%d/%m/%Y")
        return ""

    def get_duration_min(self) -> float:
        """Retorna la durada total en minuts."""
        secs = self.header.get("Duration", 0) or 0
        return round(secs / 60, 1)

    def get_distance_km(self) -> float:
        """Retorna la distància total en km."""
        metres = self.header.get("Distance", 0) or 0
        return round(metres / 1000, 2)

    def get_ascent_m(self) -> int:
        """Retorna el desnivell positiu acumulat en metres."""
        return int(self.header.get("Ascent", 0) or 0)

    def get_pace(self) -> float:
        """Calcula el ritme mitjà global (min/km) a partir dels samples de velocitat."""
        speed_list = [
            s["Speed"] for s in self.samples
            if "Speed" in s and s["Speed"] is not None and s["Speed"] > 0
        ]
        if not speed_list:
            return 0.0
        return ms_to_minkm(sum(speed_list) / len(speed_list))

    def get_cadence_spm(self) -> int:
        """Calcula la cadència mitjana global (spm) a partir dels samples."""
        cadence_list = [
            s["Cadence"] for s in self.samples
            if "Cadence" in s and s["Cadence"] is not None and s["Cadence"] > 0
        ]
        if not cadence_list:
            return 0
        return hz_to_spm(sum(cadence_list) / len(cadence_list))

    def get_hr_avg(self) -> int:
        """Calcula la FC mitjana en bpm a partir dels samples."""
        hr_list = [s["HR"] for s in self.samples if "HR" in s and s["HR"] is not None]
        if not hr_list:
            return 0
        return int(round((sum(hr_list) / len(hr_list)) * 60))

    def get_hr_max(self) -> int:
        """Calcula la FC màxima en bpm a partir dels samples."""
        hr_list = [s["HR"] for s in self.samples if "HR" in s and s["HR"] is not None]
        if not hr_list:
            return 0
        return int(round(max(hr_list) * 60))

    def get_hr_zones(self) -> dict:
        """Retorna el temps en cada zona de FC en minuts."""
        zones = self.header.get("HrZones", {}) or {}
        return {
            "Z1": round((zones.get("Zone1Duration") or 0) / 60, 1),
            "Z2": round((zones.get("Zone2Duration") or 0) / 60, 1),
            "Z3": round((zones.get("Zone3Duration") or 0) / 60, 1),
            "Z4": round((zones.get("Zone4Duration") or 0) / 60, 1),
            "Z5": round((zones.get("Zone5Duration") or 0) / 60, 1),
        }

    def get_pte(self) -> float:
        """Retorna el Peak Training Effect (PTE) de la sessió."""
        return self.header.get("PeakTrainingEffect", 0.0) or 0.0

    def get_recovery_hours(self) -> float:
        """Retorna el temps de recuperació estimat en hores."""
        secs = self.header.get("RecoveryTime", 0) or 0
        return round(secs / 3600, 1)

    def parse(self) -> dict:
        """
        Mètode base que retorna les dades comunes de qualsevol sessió.
        Ordre de columnes CSV:
          Data | Tipus | Durada | Dist | Desnivell | Ritme | Cadència |
          FCMitja | FCMax | Z1-Z5 | PTE | Recup
        Els parsers fills afegeixen les seves columnes específiques al final.
        """
        zones = self.get_hr_zones()
        return {
            "Data":          self.get_date(),
            "Tipus":         "",  # sobreescrit pel parser fill
            "Durada(min)":   self.get_duration_min(),
            "Dist(km)":      self.get_distance_km(),
            "Desnivell(m)": self.get_ascent_m(),
            "Ritme(min/km)": self.get_pace(),
            "Cadencia(spm)": self.get_cadence_spm(),
            "FCMitja":       self.get_hr_avg(),
            "FCMax":         self.get_hr_max(),
            "Z1(min)":       zones["Z1"],
            "Z2(min)":       zones["Z2"],
            "Z3(min)":       zones["Z3"],
            "Z4(min)":       zones["Z4"],
            "Z5(min)":       zones["Z5"],
            "PTE":           self.get_pte(),
            "Recup(h)":      self.get_recovery_hours(),
        }
