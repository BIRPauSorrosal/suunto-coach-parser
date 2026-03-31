from pathlib import Path

# Rutes base del projecte
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

RAW_DIR = DATA_DIR / "raw"
ARCHIVE_DIR = DATA_DIR / "archive"
OUTPUT_DIR = "docs/data"

# Nom de l'arxiu CSV on anirem afegint les files de cada entrenament
CSV_FILENAME = "sessions.csv"
CSV_PATH = OUTPUT_DIR / CSV_FILENAME

# Crear directoris locals automàticament si no existeixen
for directory in [RAW_DIR, ARCHIVE_DIR, OUTPUT_DIR]:
    directory.mkdir(parents=True, exist_ok=True)
