from pathlib import Path
from src.parsers.base_parser import BaseParser


class Z2Parser(BaseParser):
    """
    Parser específic per a rodatges suaus (Z2).
    Ritme i cadència ja els aporta el BaseParser.
    Aquí només sobreescrivim el camp Tipus.
    """

    def __init__(self, filepath: Path):
        super().__init__(filepath)

    def parse(self) -> dict:
        base = super().parse()
        base["Tipus"] = "Z2"
        return base
