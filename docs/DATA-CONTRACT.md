# Contracte de dades

## `sessions.json`

És la font principal d’activitats realitzades. Utilitza el contracte definit a
[`data/sessions.schema.json`](data/sessions.schema.json), amb una activitat per
objecte dins de `sessions`. Cada activitat té un `id` estable, una data ISO,
`type`, `sport` i `variant`, i pot incloure mètriques, zones, intervals,
comentaris i enllaços amb el planning.

L’aplicació carrega aquest fitxer i el normalitza temporalment al model pla que
encara utilitzen algunes vistes. El `sessions.csv` es conserva provisionalment
com a format legacy de l’importador d’activitats, però ja no és la font de
lectura del dashboard.

## `sessions.csv`

Format legacy de compatibilitat i importació. No és la font principal del dashboard.

És la font d’activitats realitzades. La primera fila defineix els noms de columna. Els camps poden contenir comes, cometes escapades (`""`) i salts de línia si estan entre cometes.

Columnes utilitzades habitualment:

- Identificació: `Data`, `Arxiu`, `Tipus`.
- Volum: `Dist(km)`, `Durada(min)`.
- Intensitat: `Ritme(min/km)`, `FCMitja`, `FCMax`.
- Càrrega: `Carrega`, `EPOC`, `Desnivell(m)`.
- Zones: `Z1(min)` fins a `Z5(min)`.
- Text lliure: `Comentari`.

Els valors numèrics accepten punt o coma decimal segons el parser corresponent. Les dates es normalitzen abans de calcular setmanes i períodes.

## `planning.csv`

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

L’importador autodetecta coma o punt i coma, ignora files buides i fa merge per `Setmana`. Les files noves s’afegeixen i les existents es reemplacen quan la setmana coincideix.

## Compatibilitat

Quan s’afegeixi una columna nova:

1. mantén el nom estable al CSV;
2. actualitza el parser o l’enriquiment si té semàntica numèrica;
3. afegeix-la a la vista només després de validar files buides i valors no numèrics;
4. comprova el merge local i el de GitHub.
