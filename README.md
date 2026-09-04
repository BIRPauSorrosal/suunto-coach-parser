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

## Conceptes i operativa

### Fitxers Suunto i tipus d’activitat

L’importador detecta el tipus a partir del nom del JSON, sense distingir majúscules i minúscules. Utilitza paraules clau com `z2`, `tempo`, `intervals`, `test`, `llarga`, `trail`, `cursa`, `forca`, `bici_estatica`, `padel`, `tennis`, `hiking`, `natacio` o `swim`. Per exemple: `260323_running_z2.json` o `260401_bici_estatica.json`.

Les paraules clau més específiques tenen prioritat. Si no es detecta cap tipus, el fitxer no es converteix en una fila de `sessions.csv`.

### Token de GitHub

El botó **Token GitHub** desa el token a `sessionStorage` per defecte (només durant la sessió). Si marques «Recorda el token», es desa a `localStorage`. El token no queda escrit al repositori, però qualsevol codi JavaScript que s'executi al mateix domini podria llegir-lo: utilitza l'aplicació només en un dispositiu de confiança i esborra'l quan acabis.

Per pujar CSV, crea un **Fine-grained Personal Access Token** amb accés només a aquest repositori, permís `Contents: Read and write` i una data d'expiració. No utilitzis el permís clàssic `repo` si no és imprescindible. No introdueixis mai el token en fitxers, commits, logs ni captures de pantalla.

La configuració utilitza `main` per defecte. Per provar la branca de desenvolupament publicada a Pages, afegeix `?env=development` a la URL; aquest mode llegeix i escriu a `refactor/optimitzacio`. Revisa sempre la branca abans de confirmar una importació.

Sense token, la lectura continua funcionant i les importacions o comentaris es descarreguen com a CSV perquè es puguin substituir manualment.

### Mètriques

- **CTL**: càrrega crònica aproximada i forma a llarg termini.
- **ATL**: càrrega aguda i fatiga recent.
- **TSB**: frescor, calculada com `CTL − ATL`.
- **TLP/TSS**: càrrega de cada sessió segons la mètrica disponible.
- **EPOC**: excés de consum d’oxigen post-exercici estimat per Suunto.

### Afegir un tipus d’activitat

1. Afegeix la paraula clau i l’etiqueta a `ACTIVITY_*_TYPES` de `docs/js/lib/activity-types.js`.
2. Registra la paraula clau a `PARSER_REGISTRY` de `docs/js/uploader/parser.js`.
3. Tria el parser existent (`parseRunningBase`, `parseQuality`, `parseLongRun`, `parseStrength` o `parseGeneric`) o crea’n un de nou.
4. Actualitza el smoke check i prova un JSON real i el CSV resultant.

### Troubleshooting ràpid

- **No es carreguen dades**: serveix `docs/` per HTTP i comprova la consola i les rutes de `DashboardConfig`.
- **Es veu una versió antiga**: espera el deploy, força una recàrrega i neteja la cache/service worker.
- **No es pot pujar a GitHub**: revisa el token fine-grained, el permís `Contents`, l'expiració, la branca i la ruta configurada.
- **Una activitat surt com a ALTRES**: comprova que el nom del fitxer conté una paraula clau registrada.
- **El check falla**: executa `node scripts/check-dashboard.js` i resol el primer error indicat.
