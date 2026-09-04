# Arquitectura

## Flux principal

```text
CSV local o GitHub
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

- `js/lib/dashboard-config.js`: propietari, repositori, branca i rutes dels CSV.
- `js/lib/data-service.js`: càrrega local/GitHub, fallback de xarxa, descodificació UTF-8 i parseig CSV.
- `js/lib/dashboard-store.js`: estat únic de sessions, planificació i fonts carregades.

### Presentació

- `js/lib/formatters.js`: format de números, dates, ritmes i escapament HTML.
- `js/lib/view-utils.js`: operacions DOM bàsiques.
- `js/lib/ui-components.js`: badges, taules, estats, modals i cicle de vida dels gràfics.
- `js/views/*.js`: render de cada vista i interaccions pròpies.

### Orquestració

- `js/app.js`: inicialització, router, càrrega i render global.
- `js/charts.js`: gràfics compartits del dashboard.
- `js/uploader/*.js`: importació i persistència de sessions i planificació.

Els scripts es carreguen com a scripts clàssics. L’ordre definit a `index.html` és part del contracte: les llibreries comunes han d’aparèixer abans de les vistes que les utilitzen.

## Estat i refresc

- `refreshDashboard()`: torna a llegir els CSV i actualitza el store.
- `refreshDashboardUI()`: torna a renderitzar l’estat ja carregat, útil després d’un canvi local.
- `dashboardStore.setSessions()` i `setPlanning()`: actualitzen dades i notifiquen futures vistes reactives.
