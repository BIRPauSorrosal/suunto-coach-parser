# Arquitectura

## Flux principal

```text
JSON local o GitHub
        ↓
DashboardDataService
        ↓
DashboardStore
        ↓
app.js (router i orquestració)
        ↓
Vistes + DashboardComponents
        ↓
DOM i gràfics Chart.js
```

## Capes

### Configuració i dades

- `js/lib/dashboard-config.js`: propietari, repositori, branca i rutes dels fitxers de dades.
- `js/lib/data-service.js`: càrrega local/GitHub, fallback de xarxa, descodificació UTF-8 i validació dels JSON.
- `js/lib/dashboard-store.js`: estat únic de sessions, planning, calendari i fonts carregades.

### Presentació

- `js/lib/formatters.js`: format de números, dates, ritmes i escapament HTML.
- `js/lib/view-utils.js`: operacions DOM bàsiques.
- `js/lib/ui-components.js`: badges, taules, estats, modals i cicle de vida dels gràfics.
- `js/views/*.js`: render de cada vista i interaccions pròpies.

### Orquestració

- `js/app.js`: inicialització, router, càrrega i render global.
- `js/charts.js`: gràfics compartits del dashboard.
- `js/uploader/*.js`: importació i persistència de sessions i planificació.
- `js/views/weekly-planner.js`: calendari setmanal editable, sessions pendents d’assignar, activitats manuals i reconciliació.
- `js/views/today.js`: resum contextual del dia i de la setmana actual.

Els scripts es carreguen com a scripts clàssics. L’ordre definit a `index.html` és part del contracte: les llibreries comunes han d’aparèixer abans de les vistes que les utilitzen.

## Estat i refresc

- `refreshDashboard()`: torna a llegir els JSON i actualitza el store.
- `refreshDashboardUI()`: torna a renderitzar l’estat ja carregat, útil després d’un canvi local.
- `dashboardStore.setSessions()` i `setPlanning()`: actualitzen dades i notifiquen futures vistes reactives.

## Fonts i responsabilitats

```text
planning.json  ──> sessions previstes i cicles
sessions.json  ──> activitats reals i històric immutable
calendar.json  ──> dies assignats, estat i sessions manuals
                         │
                         └── associacions confirmades per planning_session_id
```

El planning no es modifica quan l’usuari mou una targeta. Els moviments, les sessions manuals i els estats del calendari es desen localment al navegador i poden exportar-se o sincronitzar-se en una etapa posterior. Les activitats reals importades continuen sent la font de l’històric.

Les sessions planificades tenen un ID únic dins de `planning.json`. Aquest ID és imprescindible per associar correctament activitats quan hi ha dues sessions del mateix tipus durant una setmana.

Els fitxers CSV que encara hi ha al repositori són material legacy o de migració.
No s’han d’utilitzar com a font principal ni s’han de substituir automàticament
quan es desa una importació nova.
