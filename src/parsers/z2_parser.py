from pathlib import Path
from src.parsers.base_running_parser import BaseRunningParser


class Z2Parser(BaseRunningParser):
    """
    Parser per a rodatges suaus (Z2).
    Hereta totes les mètriques de BaseRunningParser.
    Només sobreescriu el camp Tipus.
    """

    def __init__(self, filepath: Path):
        super().__init__(filepath)

    def parse(self) -> dict:
        base = super().parse()
        base["Tipus"] = "Z2"
        return base
