import json
import statistics
from pathlib import Path

from src.parsers.base_parser import BaseParser
from src.utils.helpers import ms_to_minkm, hz_to_spm


# Mapa de paraules clau al nom de l'arxiu → etiqueta del tipus de sessió
QUALITY_TYPES = {
    "tempo":     "TEMPO",
    "test":      "TEST",
    "intervals": "INTERVALS",
}

# Llindar de durada curta: intervals <= 3.5 min sempre són recuperació
RECUPERACIO_MAX_DURADA = 210

# Llindar de FC: si la FC d'un interval llarg és <= FC_global * aquest factor,
# es classifica com a recuperació (no com a sèrie d'esforç)
RECUPERACIO_FC_FACTOR = 0.88


class QualityParser(BaseParser):
    """
    Parser per a sessions de qualitat: TEMPO, TEST i INTERVALS.
    Extreu dades globals de la sessió + anàlisi detallat de cada sèrie
    a partir dels Windows de tipus 'Interval' del JSON de Suunto.

    Lògica de classificació sèrie vs recuperació:
      - És RECUPERACIÓ si dura <= 3.5 min (recuperació curta típica), O
      - És RECUPERACIÓ si la seva FC mitjana <= FC_global_sessió * 0.88
        (clarament per sota de l'esforç mig, tot i ser un interval llarg)
    """

    def __init__(self, filepath: Path):
        super().__init__(filepath)
        self.windows = self.data["DeviceLog"].get("Windows", [])
        self.tipus = self._detect_type(filepath)

    def _detect_type(self, filepath: Path) -> str:
        """Detecta el tipus de sessió pel nom de l'arxiu."""
        name = filepath.stem.lower()
        return next(
            (label for keyword, label in QUALITY_TYPES.items() if keyword in name),
            "QUALITAT"  # fallback genèric
        )

    def _es_recuperacio(self, dur_s: float, fc_mitja_bpm: int, fc_global_bpm: int) -> bool:
        """
        Determina si un interval és una recuperació o una sèrie d'esforç.
        Combina criteri de durada curta i criteri de FC relativa.
        """
        if dur_s <= RECUPERACIO_MAX_DURADA:
            return True
        if fc_global_bpm > 0 and fc_mitja_bpm <= fc_global_bpm * RECUPERACIO_FC_FACTOR:
            return True
        return False

    def _extract_intervals(self, fc_global_bpm: int) -> tuple[list, list]:
        """
        Separa els Windows de tipus 'Interval' en sèries i recuperacions.
        Necessita la FC global de la sessió per aplicar el criteri de FC relativa.
        Retorna (series, recuperacions) com a llistes de diccionaris.
        """
        series = []
        recuperacions = []

        for w in self.windows:
            ww = w.get("Window", {})
            if ww.get("Type") != "Interval":
                continue

            dur = ww.get("Duration", 0) or 0
            dist = ww.get("Distance", 0) or 0
            speed_avg = (ww.get("Speed") or [{}])[0].get("Avg") or 0
            hr_avg = (ww.get("HR") or [{}])[0].get("Avg") or 0
            hr_max = (ww.get("HR") or [{}])[0].get("Max") or 0
            cad_avg = (ww.get("Cadence") or [{}])[0].get("Avg") or 0

            fc_mitja_bpm = int(round(hr_avg * 60))

            entry = {
                "dist_m":   round(dist),
                "dur_min":  round(dur / 60, 1),
                "ritme":    ms_to_minkm(speed_avg),
                "fc_mitja": fc_mitja_bpm,
                "fc_max":   int(round(hr_max * 60)),
                "cadencia": hz_to_spm(cad_avg),
            }

            if self._es_recuperacio(dur, fc_mitja_bpm, fc_global_bpm):
                recuperacions.append(entry)
            else:
                series.append(entry)

        return series, recuperacions

    @staticmethod
    def _avg(lst: list, key: str) -> float:
        """Calcula la mitjana d'un camp numèric d'una llista de diccionaris."""
        vals = [x[key] for x in lst if x.get(key, 0) > 0]
        return round(statistics.mean(vals), 2) if vals else 0.0

    @staticmethod
    def _std(lst: list, key: str) -> float:
        """Calcula la desviació estàndard d'un camp (mesura de consistència)."""
        vals = [x[key] for x in lst if x.get(key, 0) > 0]
        return round(statistics.stdev(vals), 2) if len(vals) > 1 else 0.0

    def parse(self) -> dict:
        """Retorna les dades globals + resum de sèries per al CSV."""
        base = super().parse()

        # Necessitem la FC global per al criteri de classificació
        fc_global = self.get_hr_avg()
        series, recuperacions = self._extract_intervals(fc_global)

        # Afegim número de sèrie a cada entrada per facilitar lectura de la IA
        for i, s in enumerate(series, 1):
            s["serie"] = i

        base["Tipus"]                 = self.tipus
        base["Num_Series"]            = len(series)
        base["Ritme_Mitja_Series"]    = self._avg(series, "ritme")
        base["Consistencia_Ritme"]    = self._std(series, "ritme")
        base["FC_Mitja_Series"]       = self._avg(series, "fc_mitja")
        base["FC_Max_Mitja_Series"]   = self._avg(series, "fc_max")
        base["Cadencia_Mitja_Series"] = self._avg(series, "cadencia")
        base["Series_Detall"]         = json.dumps(series, ensure_ascii=False)

        return base
