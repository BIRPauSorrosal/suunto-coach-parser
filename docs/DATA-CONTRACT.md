# Contracte de dades

## `sessions.json`

És la font principal d’activitats realitzades. Utilitza el contracte definit a
[`data/sessions.schema.json`](data/sessions.schema.json), amb una activitat per
objecte dins de `sessions`. Cada activitat té un `id` estable, una data ISO,
`type`, `sport` i `variant`, i pot incloure mètriques, zones, intervals,
comentaris i enllaços amb el planning.

L’aplicació carrega aquest fitxer i el normalitza temporalment al model pla que
encara utilitzen algunes vistes. Cada importació es fusiona amb el document
existent; mai no ha de substituir l’històric complet. Els camps `feeling` i
`vo2max` són opcionals i `planning_links` conserva les associacions confirmades.

## `sessions.csv`

Format legacy de compatibilitat. No és la font principal del dashboard ni el
format de persistència de les noves importacions.

És una còpia legacy de les activitats realitzades. La primera fila defineix els noms de columna. Els camps poden contenir comes, cometes escapades (`""`) i salts de línia si estan entre cometes.

Columnes utilitzades habitualment:

- Identificació: `Data`, `Arxiu`, `Tipus`.
- Volum: `Dist(km)`, `Durada(min)`.
- Intensitat: `Ritme(min/km)`, `FCMitja`, `FCMax`.
- Càrrega: `Carrega`, `EPOC`, `Desnivell(m)`.
- Zones: `Z1(min)` fins a `Z5(min)`.
- Text lliure: `Comentari`.

Els valors numèrics accepten punt o coma decimal segons el parser corresponent. Les dates es normalitzen abans de calcular setmanes i períodes.

## `planning.json`

És la font principal del planning. Utilitza el contracte definit a
[`data/planning.schema.json`](data/planning.schema.json) i agrupa les dades com
`cycles[] → weeks[] → sessions[]`.

Cada setmana té un codi ISO com `2026-S37` i cada sessió té un ID únic, per
exemple `2026-S37-z2-01` i `2026-S37-z2-02`. Les sessions inclouen `type`,
`sport`, `variant`, `day` i els objectius disponibles. `day` pot ser `null`
quan la sessió encara està pendent d’assignar.

## `calendar.json`

És la font del calendari editable i utilitza el contracte definit a
[`data/calendar.schema.json`](data/calendar.schema.json). Per cada setmana
conserva `items[]`, el `day` assignat (0 dilluns … 6 diumenge), `status`
(`pending` o `done`) i `kind` (`planned` o `manual`). Les entrades manuals tenen
`planning_session_id: null` i no modifiquen `planning.json` ni `sessions.json`.

Les associacions entre una activitat real i una sessió planificada es guarden a
`sessions.json` mitjançant `planning_links[].planning_session_id`. La
confirmació és explícita i no es dedueix només pel nom de l’activitat.

## `planning.csv` (legacy)

Defineix una fila per setmana planificada. Les columnes obligatòries de l’importador són:

```text
Setmana, Data_Inici, Data_Fi, Cicle, Fase,
Q_Series, Q_Durada_Serie_min, Q_Ritme_min_km, Q_Rec_min,
Q_FC_min, Q_FC_max, Q_Km_Plan,
Z2_Durada_min, Z2_Ritme_min_km_min, Z2_Ritme_min_km_max,
Z2_FC_min, Z2_FC_max, Z2_Km_Plan,
LL_Tipus, LL_Durada_min, LL_Km_Plan,
Forca_Plan, Padel_Plan, Km_Total_Plan
```

Es conserva com a origen històric i com a suport de migració. El format actiu de
l’aplicació és `planning.json`; els canvis nous s’han de fer sobre el JSON o
mitjançant el seu importador.

## Compatibilitat

Quan s’afegeixi una columna nova:

1. mantén el nom estable al CSV;
2. actualitza el parser o l’enriquiment si té semàntica numèrica;
3. afegeix-la a la vista només després de validar files buides i valors no numèrics;
4. comprova el merge local i el de GitHub.
