from pathlib import Path
from src.parsers.base_running_parser import BaseRunningParser


class LlargaParser(BaseRunningParser):
    """
    Parser per a tirades llargues de cap de setmana.
    Estructura idèntica al Z2Parser: només diferencia el camp Tipus.
    Hereta totes les mètriques de BaseRunningParser.
    """

    def __init__(self, filepath: Path):
        super().__init__(filepath)

    def parse(self) -> dict:
        base = super().parse()
        base["Tipus"] = "LLARGA"
        return base
