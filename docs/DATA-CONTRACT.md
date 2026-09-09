# Contracte de dades

## Font operativa

La font operativa de totes les dades personals és Supabase. Els documents JSON
descrits en aquest fitxer defineixen formats d’intercanvi i d’importació, però
no són la font principal del dashboard.

## Activitats i `sessions.json`

`sessions.json` és el format d’exportació/importació d’activitats. El document
utilitza `schema_version`, `source: "suunto"` i una llista `sessions`. Cada
activitat té un `id` estable, una data ISO, `type`, `sport` i `variant`, i pot
incloure mètriques, zones, comentaris i enllaços.

En importar-lo, l’aplicació el valida, el fusiona per identificador i desa el
resultat a `activities` per a l’usuari autenticat. En carregar el dashboard,
les activitats es llegeixen de `activities`, no de `docs/data/sessions.json`.

## `planning.json`

És el format d’importació/exportació del planning i manté l’estructura:

```text
cycles[] → weeks[] → sessions[]
```

Cada setmana té un identificador/codi i cada sessió planificada té un ID únic.
En importar-lo, el planning personal es desa a:

- `planning_weeks`: setmana, dates, fase, resum i payload original;
- `planning_sessions`: sessions de la setmana, ordre, esport, tipus i payload.

El planning es llegeix d’aquestes taules. Moure una targeta del calendari no
modifica el planning; modifica el calendari de l’usuari.

## Calendari i `calendar_weeks`

El calendari operatiu viu exclusivament a `calendar_weeks`, amb les setmanes i
els seus `items[]`. Cada entrada conserva el dia assignat, l’estat i el tipus
(`planned` o `manual`). Les activitats manuals no modifiquen el planning ni
l’històric d’activitats.

Moure, reassignar o eliminar una targeta actualitza `calendar_weeks`. La cua
local només serveix per reintentar una operació pendent.

## Enllaços d’activitats

Les associacions entre una activitat real i una sessió planificada viuen a
`activity_links`. La relació es desa explícitament amb els identificadors
corresponents i no es dedueix només pel nom o el tipus de sessió.

Quan s’afegeixi un camp nou:

1. actualitza el parser i el normalitzador del JSON corresponent;
2. actualitza el mapping del proveïdor Supabase i la migració SQL si cal;
3. conserva el camp original a `payload` quan sigui necessari;
4. actualitza els esquemes JSON i prova importació, lectura i exportació.
