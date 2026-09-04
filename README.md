# Suunto Coach Parser

Dashboard estàtic per consultar sessions esportives i planificació d’entrenament a partir de fitxers CSV.

## Inici ràpid

La carpeta `docs/` és l’aplicació publicada. Per provar-la localment, serveix el repositori amb qualsevol servidor HTTP estàtic i obre `docs/index.html` des de l’adreça del servidor. No es recomana obrir el fitxer directament amb `file://`, perquè el navegador pot bloquejar la càrrega dels CSV i del service worker.

Exemple amb VS Code: inicia Live Server sobre `docs/index.html`.

## Documentació

- [Arquitectura](docs/ARCHITECTURE.md)
- [Contracte dels CSV](docs/DATA-CONTRACT.md)
- [Manteniment i proves](docs/MAINTENANCE.md)

## Validació

Executa la comprovació estàtica abans de pujar canvis:

```bash
node scripts/check-dashboard.js
```

El mateix check s’executa automàticament amb GitHub Actions a cada `push` a `main` o `refactor/optimitzacio` i a cada pull request.

El projecte no necessita un procés de build ni dependències de Node per executar-se al navegador.

## Publicació

GitHub Pages publica la carpeta `docs/`. Per validar una branca de desenvolupament, selecciona aquesta branca com a font de Pages, espera el deploy i força una recàrrega si hi ha un service worker antic.
