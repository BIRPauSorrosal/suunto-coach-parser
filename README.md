# Personal Coach

Personal Coach és una aplicació personal de planificació, seguiment i anàlisi
de l’entrenament amb dades de Suunto.

## Inici ràpid

La carpeta `docs/` és l’aplicació publicada. Per provar-la localment, serveix
el repositori amb qualsevol servidor HTTP estàtic i obre `docs/index.html` des
de l’adreça del servidor. No es recomana obrir-lo amb `file://` perquè el
navegador pot bloquejar els JSON i el service worker.

## Arquitectura actual

Supabase és la font operativa única per a l’usuari autenticat:

- activitats → `activities`;
- planning personal → `planning_weeks` i `planning_sessions`;
- calendari editable → `calendar_weeks`;
- enllaços activitat-planning → `activity_links`;
- configuració personal → `user_settings`.

Els JSON només s’utilitzen per importar o exportar dades. Les exportacions són
explícites i no fan push automàtic a GitHub. El `localStorage` es limita a
cache/cua offline temporal i no és la font de veritat.

Consulta la documentació detallada:

- [Arquitectura](docs/ARCHITECTURE.md)
- [Contracte de dades](docs/DATA-CONTRACT.md)
- [Manteniment i proves](docs/MAINTENANCE.md)

## Supabase

Cal iniciar sessió amb Supabase per consultar i modificar dades personals.
L’autenticació i les polítiques RLS limiten les files a l’usuari actual.
`supabase-planning.sql` documenta la creació de les taules específiques del
planning, inclosos grants, RLS, triggers i Realtime.

## Importació i exportació

L’importador valida els JSON d’activitats i planning, els fusiona amb les dades
de l’usuari i desa el resultat a Supabase. Les activitats es poden exportar en
format `sessions.json` per intercanviar-les o conservar una còpia.

## Validació

Executa abans de fer push:

```bash
node scripts/check-dashboard.js
node scripts/test-dashboard.js
git diff --check
```

GitHub Pages publica la carpeta `docs/`. Després d’un deploy, pot caldre una
recàrrega forçada si el service worker conserva una versió anterior.
