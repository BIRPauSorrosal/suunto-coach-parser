import re
from pathlib import Path

from src.parsers.base_parser import BaseParser


# Mapa de paraules clau al nom de l'arxiu → etiqueta del tipus de sessió
# El codi de sessió (S1, S2...) es detecta dinàmicament del nom de l'arxiu
STRENGTH_KEYWORD = "força"


class StrengthParser(BaseParser):
    """
    Parser per a sessions de força / gimnasio.
    Hereta les mètriques genèriques del BaseParser.
    No afegeix columnes extra: distància, ritme i cadència no són rellevants.

    El tipus de sessió es construeix combinant 'FORÇA' + el codi de sessió
    detectat al nom de l'arxiu (S1, S2, S3, etc.).

    Exemple:
      '260317_força_S2.json'  →  Tipus = 'FORÇA S2'
      '260320_força_S1.json'  →  Tipus = 'FORÇA S1'
    """

    def __init__(self, filepath: Path):
        super().__init__(filepath)
        self.tipus = self._detect_type(filepath)

    def _detect_type(self, filepath: Path) -> str:
        """Detecta el codi de sessió (S1, S2...) pel nom de l'arxiu."""
        name = filepath.stem
        match = re.search(r'[Ss](\d+)', name)
        session_code = f"S{match.group(1)}" if match else ""
        return f"FORÇA {session_code}".strip()

    def parse(self) -> dict:
        base = super().parse()
        base["Tipus"] = self.tipus
        return base
