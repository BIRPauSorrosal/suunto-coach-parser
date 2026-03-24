import sys
import shutil
import pandas as pd
from pathlib import Path

# Afegim el directori arrel al path perque els imports de src funcionin
sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.config import RAW_DIR, ARCHIVE_DIR, CSV_PATH
from src.parsers.z2_parser import Z2Parser
from src.parsers.quality_parser import QualityParser
from src.parsers.long_run_parser import LongRunParser
from src.parsers.strength_parser import StrengthParser


# ─────────────────────────────────────────────────────────────
# REGISTRE DE PARSERS
# Clau: paraula clau al nom de l'arxiu | Valor: classe parser
# Per afegir un nou tipus, només cal afegir una línia aquí.
# ─────────────────────────────────────────────────────────────
PARSER_REGISTRY = {
    # Sessions suaus
    "z2":        Z2Parser,

    # Sessions de qualitat (mateix parser, tipus diferent per nom d'arxiu)
    "tempo":     QualityParser,
    "test":      QualityParser,
    "intervals": QualityParser,

    # Tirades llargues i curses (mateix parser, tipus diferent per nom d'arxiu)
    "llarga":    LongRunParser,
    "longrun":   LongRunParser,
    "marat":     LongRunParser,   # cobreix 'marató' i 'maraton'
    "trail":     LongRunParser,
    "mitja":     LongRunParser,

    # Força / gimnasio
    "força":    StrengthParser,
}


def detect_parser(filepath: Path):
    """
    Detecta el parser adequat a partir del nom de l'arxiu.
    Exemple: '260323_running_z2.json'           -> Z2Parser
             '260311_running_tempo.json'         -> QualityParser
             '260315_running_tirada_llarga.json' -> LongRunParser
             '260317_força_S2.json'             -> StrengthParser
    Retorna la classe del parser o None si no en troba cap.
    """
    filename_lower = filepath.stem.lower()
    for keyword, parser_class in PARSER_REGISTRY.items():
        if keyword in filename_lower:
            return parser_class
    return None


def append_to_csv(row: dict):
    """
    Afegeix una nova fila al CSV de resum.
    Si el CSV no existeix, el crea amb capçalera.
    Si la data ja existeix, avisa i no duplica la fila.
    """
    new_df = pd.DataFrame([row])

    if CSV_PATH.exists():
        existing_df = pd.read_csv(CSV_PATH)
        if row["Data"] in existing_df["Data"].values:
            print(f"  ⚠️   Ja existeix una entrada per la data {row['Data']}. Saltant...")
            return
        updated_df = pd.concat([existing_df, new_df], ignore_index=True)
    else:
        updated_df = new_df

    updated_df.to_csv(CSV_PATH, index=False)
    print(f"  ✅  Fila afegida al CSV: {CSV_PATH.name}")


def process_file(filepath: Path):
    """Processa un únic arxiu JSON: detecta el tipus, parseja i guarda al CSV."""
    print(f"\n📂 Processant: {filepath.name}")

    parser_class = detect_parser(filepath)
    if parser_class is None:
        print(f"  ❌  No s'ha trobat cap parser per a '{filepath.name}'.")
        print(f"      Paraules clau esperades al nom: {list(PARSER_REGISTRY.keys())}")
        return

    print(f"  🔍  Parser detectat: {parser_class.__name__}")
    parser = parser_class(filepath)
    row = parser.parse()

    print(f"  📊  Resum extret:")
    for k, v in row.items():
        if k != "Series_Detall":
            print(f"       {k}: {v}")

    append_to_csv(row)

    dest = ARCHIVE_DIR / filepath.name
    shutil.move(str(filepath), str(dest))
    print(f"  📁  Arxiu mogut a: archive/{filepath.name}")


def main():
    json_files = list(RAW_DIR.glob("*.json"))

    if not json_files:
        print("\n🔴 No s'han trobat arxius JSON a data/raw/")
        print("   Copia els arxius exportats de Suunto a aquesta carpeta i torna a executar.")
        return

    print(f"\n🏃 Suunto Coach Parser")
    print(f"   Arxius trobats a raw/: {len(json_files)}")
    print("─" * 45)

    for filepath in sorted(json_files):
        process_file(filepath)

    print("\n─" * 45)
    print(f"✔️   Procés completat. Revisa el CSV a: data/output/resum_entrenaments.csv\n")


if __name__ == "__main__":
    main()
