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
from src.parsers.generic_parser import GenericParser


# ─────────────────────────────────────────────────────────────
# REGISTRE DE PARSERS
# Clau: paraula clau al nom de l'arxiu | Valor: classe parser
# Per afegir un nou tipus, només cal afegir una línia aquí.
# ─────────────────────────────────────────────────────────────
PARSER_REGISTRY = {
    # Sessions de running suau
    "z2":            Z2Parser,

    # Sessions de qualitat (mateix parser, tipus diferent per nom d'arxiu)
    "tempo":         QualityParser,
    "test":          QualityParser,
    "intervals":     QualityParser,

    # Tirades llargues i curses (mateix parser, tipus diferent per nom d'arxiu)
    "llarga":        LongRunParser,
    "longrun":       LongRunParser,
    "marat":         LongRunParser,   # cobreix 'marató' i 'maraton'
    "trail":         LongRunParser,
    "mitja":         LongRunParser,

    # Força / gimnasio
    "força":        StrengthParser,

    # Activitats simples genèriques
    "bici_estatica": GenericParser,
    "padel":         GenericParser,
    "tennis":        GenericParser,
    "hiking":        GenericParser,
    "natacio":       GenericParser,
    "swim":          GenericParser,
}


def detect_parser(filepath: Path):
    """
    Detecta el parser adequat a partir del nom de l'arxiu.
    Exemple: '260323_running_z2.json'           -> Z2Parser
             '260311_running_tempo.json'         -> QualityParser
             '260315_running_tirada_llarga.json' -> LongRunParser
             '260317_força_S2.json'             -> StrengthParser
             '260308_bici_estatica_z2.json'      -> GenericParser
             '260321_padel.json'                 -> GenericParser
    Retorna la classe del parser o None si no en troba cap.
    """
    filename_lower = filepath.stem.lower()
    for keyword, parser_class in PARSER_REGISTRY.items():
        if keyword in filename_lower:
            return parser_class
    return None


def append_to_csv(row: dict, source_filename: str):
    """
    Afegeix una nova fila al CSV de resum.
    Si el CSV no existeix, el crea amb capçalera.
    El control de duplicats es fa pel nom de l'arxiu font (columna 'Arxiu'),
    permetent així múltiples activitats en el mateix dia.
    """
    row["Arxiu"] = source_filename  # clau única per detectar duplicats
    new_df = pd.DataFrame([row])

    if CSV_PATH.exists():
        existing_df = pd.read_csv(CSV_PATH)
        if source_filename in existing_df["Arxiu"].values:
            print(f"  ⚠️   L'arxiu '{source_filename}' ja existeix al CSV. Saltant...")
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

    append_to_csv(row, filepath.stem)

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
