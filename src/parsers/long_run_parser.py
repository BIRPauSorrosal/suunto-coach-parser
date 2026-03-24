from pathlib import Path

from src.parsers.base_running_parser import BaseRunningParser


# Mapa de paraules clau al nom de l'arxiu → etiqueta del tipus de sessió
# Per afegir nous tipus (marà, trail, mitja...) només cal afegir una línia aquí
# i registrar la paraula clau al PARSER_REGISTRY de main.py
LONG_RUN_TYPES = {
    "llarga":  "LLARGA",
    "longrun": "LLARGA",
    "marat":   "MARATÓ",   # cobreix 'marató' i 'maraton'
    "trail":   "TRAIL",
    "mitja":   "MITJA",
}


class LongRunParser(BaseRunningParser):
    """
    Parser per a tirades llargues i curses de running.
    Hereta totes les mètriques de BaseRunningParser (ritme, cadència,
    FC, zones, PTE, recuperació) sense afegir cap columna extra.
    El tipus de sessió es detecta pel nom de l'arxiu.

    Tipus suportats (LONG_RUN_TYPES):
      _llarga_   → LLARGA
      _longrun_  → LLARGA
      _marat_    → MARATÓ
      _trail_    → TRAIL
      _mitja_    → MITJA
    """

    def __init__(self, filepath: Path):
        super().__init__(filepath)
        self.tipus = self._detect_type(filepath)

    def _detect_type(self, filepath: Path) -> str:
        """Detecta el tipus de sessió pel nom de l'arxiu."""
        name = filepath.stem.lower()
        return next(
            (label for keyword, label in LONG_RUN_TYPES.items() if keyword in name),
            "LLARGA"  # fallback genèric
        )

    def parse(self) -> dict:
        base = super().parse()
        base["Tipus"] = self.tipus
        return base
