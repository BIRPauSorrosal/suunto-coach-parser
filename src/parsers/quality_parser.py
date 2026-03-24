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

# Factor sobre la FC màxima de les sèries d'esforç:
# si FC_mitja_interval <= FC_max_series * aquest factor → és recuperació
# Exemple: FC_max_series=189 * 0.82 = 154 bpm → intervals per sota són recuperació
RECUPERACIO_FC_MAX_FACTOR = 0.82


class QualityParser(BaseParser):
    """
    Parser per a sessions de qualitat: TEMPO, TEST i INTERVALS.
    Extreu dades globals de la sessió + anàlisi detallat de cada sèrie
    a partir dels Windows de tipus 'Interval' del JSON de Suunto.

    Lògica de classificació sèrie vs recuperació (2 passades):
      1a passada: troba la FC màxima dels intervals llargs (candidates a sèrie)
      2a passada: classifica cada interval:
        - RECUPERACIÓ si dura <= 3.5 min, O
        - RECUPERACIÓ si FC_mitja <= FC_max_series * 0.82
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

    def _get_raw_intervals(self) -> list:
        """Extreu tots els Windows de tipus Interval com a llista de diccionaris bruts."""
        intervals = []
        for w in self.windows:
            ww = w.get("Window", {})
            if ww.get("Type") != "Interval":
                continue
            dur      = ww.get("Duration", 0) or 0
            dist     = ww.get("Distance", 0) or 0
            speed    = (ww.get("Speed")   or [{}])[0].get("Avg") or 0
            hr_avg   = (ww.get("HR")      or [{}])[0].get("Avg") or 0
            hr_max   = (ww.get("HR")      or [{}])[0].get("Max") or 0
            cadence  = (ww.get("Cadence") or [{}])[0].get("Avg") or 0
            intervals.append({
                "dur_s":    dur,
                "dist_m":   round(dist),
                "dur_min":  round(dur / 60, 1),
                "ritme":    ms_to_minkm(speed),
                "fc_mitja": int(round(hr_avg * 60)),
                "fc_max":   int(round(hr_max * 60)),
                "cadencia": hz_to_spm(cadence),
            })
        return intervals

    def _extract_intervals(self) -> tuple[list, list]:
        """
        Classifica els intervals en sèries i recuperacions.
        1a passada: calcula FC max dels intervals llargs per establir el llindar.
        2a passada: aplica els criteris de durada i FC relativa.
        """
        raw = self._get_raw_intervals()

        # 1a passada: FC màxima dels intervals candidats a sèrie (llargs)
        fc_max_series = max(
            (iv["fc_max"] for iv in raw if iv["dur_s"] > RECUPERACIO_MAX_DURADA),
            default=0
        )
        llindar_fc = int(fc_max_series * RECUPERACIO_FC_MAX_FACTOR)

        # 2a passada: classificació final
        series = []
        recuperacions = []
        for iv in raw:
            es_recup = (
                iv["dur_s"] <= RECUPERACIO_MAX_DURADA or
                iv["fc_mitja"] <= llindar_fc
            )
            entry = {k: v for k, v in iv.items() if k != "dur_s"}  # traiem dur_s intern
            if es_recup:
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
        series, recuperacions = self._extract_intervals()

        # Afegim número de sèrie per facilitar lectura de la IA
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
