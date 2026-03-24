from pathlib import Path

from src.parsers.base_parser import BaseParser


# Mapa de paraules clau al nom de l'arxiu → etiqueta del tipus de sessió.
# Per afegir una nova activitat simple, afegir una línia aquí
# i registrar la paraula clau al PARSER_REGISTRY de main.py.
GENERIC_TYPES = {
    "padel":   "PADEL",
    "tennis":  "TENNIS",
    "hiking":  "HIKING",
    "natacio": "NATACIÓ",
    "swim":    "NATACIÓ",
}


class GenericParser(BaseParser):
    """
    Parser genèric per a activitats simples que només necessiten
    les mètriques base: durada, FC, zones, PTE, EPOC, càrrega,
    calories i recuperació.

    No afegeix cap columna extra. És el parser més simple possible:
    només detecta el tipus d'activitat pel nom de l'arxiu.

    Activitats suportades (GENERIC_TYPES):
      _padel_   → PADEL
      _tennis_  → TENNIS
      _hiking_  → HIKING
      _natacio_ → NATACIÓ
      _swim_    → NATACIÓ

    Per afegir una nova activitat simple:
      1. Afegir una línia a GENERIC_TYPES
      2. Afegir la paraula clau al PARSER_REGISTRY de main.py
    """

    def __init__(self, filepath: Path):
        super().__init__(filepath)
        self.tipus = self._detect_type(filepath)

    def _detect_type(self, filepath: Path) -> str:
        """Detecta el tipus d'activitat pel nom de l'arxiu."""
        name = filepath.stem.lower()
        return next(
            (label for keyword, label in GENERIC_TYPES.items() if keyword in name),
            "ALTRES"  # fallback genèric
        )

    def parse(self) -> dict:
        base = super().parse()
        base["Tipus"] = self.tipus
        return base
