# Manteniment i proves

## Com afegir una vista

1. Crea `docs/js/views/<nom>.js`.
2. Mantén la vista centrada en render i interaccions; posa la lectura de dades a `DashboardDataService`.
3. Reutilitza `DashboardViewUtils` i `DashboardComponents` abans de crear HTML duplicat.
4. Afegeix el script a `index.html` i a `sw.js`, respectant l’ordre de dependències.
5. Connecta la navegació a `app.js` i prova l’estat buit.

## Com afegir un component

Els components han de ser petits, independents de la vista i previsibles:

- reben dades com a arguments;
- no llegeixen el store directament;
- escapen text d’usuari abans d’injectar-lo com HTML;
- retornen HTML o una instància amb un cicle de vida clar.

## Gràfics

Registra els gràfics amb `DashboardComponents.createChart(key, canvas, config)` i destrueix-los amb `destroyChart(key)` o `destroyAllCharts()`. Això evita gràfics duplicats quan es canvia de vista o es recarreguen dades.

## Comprovacions abans de fer push

```bash
node scripts/check-dashboard.js
```

Després, comprova manualment:

- càrrega inicial i botó de recàrrega;
- les quatre vistes i navegació mòbil;
- estat sense dades;
- importació i merge de CSV;
- editor de comentaris amb i sense token;
- gràfics després de recarregar dades;
- consola del navegador sense errors.

## Service worker

Quan s’afegeix o modifica un asset precachejat, incrementa `CACHE_NAME` a `docs/sw.js`. En desenvolupament local el service worker està bypassat; a GitHub Pages pot caldre una recàrrega forçada o netejar les dades del lloc.
