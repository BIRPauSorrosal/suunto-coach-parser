# Arquitectura

## Principi de dades

Supabase és la font operativa única de l’aplicació. Els fitxers JSON del
repositori són dades inicials, formats d’importació/exportació o material de
migració; no són un fallback automàtic de lectura ni d’escriptura.

```text
Supabase Auth
     ↓
SupabaseDataProvider / CalendarSync / SessionsSync / SettingsSync
     ↓
DashboardStore
     ↓
app.js (càrrega, refresc i router)
     ↓
Vistes + DashboardComponents
     ↓
DOM i gràfics Chart.js
```

## Capes

### Configuració i dades

- `js/lib/supabase-client.js`: client Supabase amb la URL i la publishable key.
- `js/lib/supabase-auth.js`: inici i tancament de sessió.
- `js/lib/supabase-data-provider.js`: lectures i escriptures de dades personals.
- `js/lib/calendar-sync.js`: persistència de `calendar_weeks` i cua offline.
- `js/lib/sessions-sync.js`: persistència d’enllaços a `activity_links`.
- `js/lib/settings-sync.js`: persistència de la configuració personal.
- `js/lib/sync-queue.js`: reintents locals quan Supabase no està disponible.
- `js/lib/supabase-realtime.js`: refresc després de canvis Realtime.
- `js/lib/data-service.js`: validació i normalització dels documents JSON
  d’importació/exportació; no és el proveïdor principal de dades.

### Persistència Supabase

| Dada | Taula | Abast |
|---|---|---|
| Perfil | `profiles` | Usuari autenticat |
| Configuració | `user_settings` | Usuari autenticat |
| Activitats | `activities` | Usuari autenticat |
| Enllaços activitat-planning | `activity_links` | Usuari autenticat |
| Calendari editable | `calendar_weeks` | Usuari autenticat |
| Setmanes de planning | `planning_weeks` | Usuari autenticat |
| Sessions de planning | `planning_sessions` | Usuari autenticat |

Les polítiques RLS restringeixen les files a `auth.uid()`. Les taules
operatives estan preparades per a Supabase Realtime.

## Fluxos

### Càrrega i refresc

`refreshDashboard()` consulta Supabase per a calendari, activitats,
configuració i planning. Amb estat `loaded` o `empty`, Supabase té prioritat i
no es carreguen els JSON del repositori. Si no hi ha sessió o la connexió no
està disponible, la interfície mostra l’estat corresponent i no inventa dades
remotes a partir dels fitxers legacy.

`refreshDashboardUI()` només torna a renderitzar l’estat actual del store.

### Importacions i edicions

- Un JSON d’activitats es valida, es fusiona amb les dades rebudes i s’insereix
  a `activities`.
- Un `planning.json` es valida, es fusiona amb el planning actual de l’usuari
  i s’insereix a `planning_weeks` i `planning_sessions`.
- Moure una activitat o una sessió del calendari actualitza `calendar_weeks`.
- Associar una activitat a una sessió planificada actualitza `activity_links`.
- Editar un comentari actualitza `activities`.
- La configuració cardíaca actualitza `user_settings`.

Els canvis que no es poden enviar es mantenen temporalment a la cua/local
cache i es reintenten quan torna la sessió o la connexió. Aquest cache no és la
font de veritat.

### Exportacions

Les exportacions explícites d’activitats poden generar `sessions.json`. Els
JSON exportats són còpies intercanviables i no substitueixen les dades de
Supabase. La importació de `planning.json` i d’activitats escriu a Supabase;
no fa push automàtic a GitHub ni descarrega un fitxer de fallback.

## Identificadors i concurrència

Els identificadors externs de les activitats, setmanes i sessions permeten fer
upsert idempotent. Les files operatives conserven `revision`, `updated_at` i
validacions RLS. Els conflictes de revisió es comuniquen a l’usuari i no es
sobreescriuen silenciosament.
