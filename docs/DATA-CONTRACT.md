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

Les importacions noves també conserven `source_fingerprint`: una empremta del
JSON original que permet detectar el mateix export encara que se n’hagi canviat
el nom. Els registres històrics sense empremta continuen sent compatibles.

En importar-lo, l’aplicació el valida, el fusiona per identificador i desa el
resultat a `activities` per a l’usuari autenticat. En carregar el dashboard,
les activitats es llegeixen de `activities`, no de `docs/data/sessions.json`.

## Taxonomia d'activitats

La font de veritat de l'aplicació és `docs/js/lib/activity-types.js`, mitjançant
`ACTIVITY_CATALOG`. Allà es defineixen els esports, els tipus canònics, les
variants, les etiquetes visibles, els àlies històrics, els grups d'Analytics,
els colors i el dia suggerit al calendari.

Qualsevol selector nou ha de consumir els helpers del catàleg (`activitySportOptions`,
`activityTypeOptionsForSport`, `activitySubtypeOptions` i `activityVariantOptions`)
i ha de desar sempre `type`, `sport`, `subtype` i `variant`. Els camps tenen
una semàntica fixa: esport → tipus d'entrenament → subtipus → variant de medi.
Per exemple, `Running → Qualitat → Intervals → Carretera` i
`Strength → Força → S3`. `Z1`–`Z5` són únicament zones cardíaques; `z2` es
manté només com a àlies legacy que es normalitza a `Aeròbic` sense subtipus.
No s'han de duplicar llistes d'esports o tipus en
una vista. Els noms legacy de fitxer i les etiquetes antigues es converteixen al
catàleg durant la importació; les activitats ja sincronitzades continuen sent
compatibles sense cap resincronització.

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

Un fitxer d'importació pot contenir només una part de la temporada. Les
setmanes absents sempre es conserven. El modal ofereix dos modes:

- **Actualitzar sessions** (per defecte): fusiona per ID de setmana/sessió i
  conserva les sessions absents del fitxer. Els camps de resum entrants
  actualitzen els existents.
- **Substituir setmanes completes**: substitueix el contingut de les setmanes
  incloses i elimina de `planning_sessions` les sessions antigues absents.
  Una setmana inclosa amb `sessions: []` buida el planning d'aquella setmana.

`day` accepta `monday`–`sunday`, enters 0–6 (dilluns–diumenge), o `null`
(per assignar). Es normalitza a enter/null. La importació permet aplicar els
dies a les sessions pendents o conservar els ajustos del calendari; les
sessions noves utilitzen el dia importat en qualsevol dels dos casos.
Les targetes completades, les activitats manuals i els enllaços reals es
conserven, fins i tot quan una sessió desapareix del planning. No s'escriu a
`activities` ni a `activity_links` durant la importació del planning.

Setmana, Mes i Avui comparteixen `js/lib/planning-calendar.js` per reconciliar
sessions i calendari. `null` no es substitueix per un dia predeterminat.
El resum de la importació mostra altes, modificacions, eliminacions i els
objectius de km que difereixen de la suma de sessions de running. Els
objectius explícits no es recalculen silenciosament.

Abans d'escriure es comprova que les setmanes i el calendari no hagin canviat
respecte a la previsualització i que no hi hagi moviments locals pendents.
L'èxit només es mostra després de rellegir i verificar planning i calendari
a Supabase. Les escriptures entre taules no són una transacció: un error pot
deixar una importació parcial, es comunica i cal revisar/recarregar les dades
abans de repetir-la.

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
