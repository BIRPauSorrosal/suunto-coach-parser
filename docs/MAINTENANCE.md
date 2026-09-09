# Manteniment i proves

## Regles de persistència

- Supabase és la font operativa única.
- Cal tenir una sessió Supabase per llegir i modificar dades personals.
- No s’han d’afegir fallbacks de lectura o escriptura a GitHub/JSON.
- El `localStorage` només es pot utilitzar com a cache, cua offline o estat de
  la interfície; mai com a font de veritat.
- Les exportacions JSON són explícites i no actualitzen automàticament GitHub.

## Comprovacions abans de fer commit

```bash
node scripts/check-dashboard.js
node scripts/test-dashboard.js
git diff --check
```

També cal validar la sintaxi dels fitxers JavaScript modificats amb `node
--check <fitxer>`.

## Validació manual

- iniciar i tancar sessió Supabase sense recarregar la pàgina;
- carregar un dashboard amb dades i amb taules buides;
- importar activitats i verificar les files a `activities`;
- importar `planning.json` i verificar `planning_weeks` i
  `planning_sessions`;
- moure una targeta i verificar `calendar_weeks`;
- associar una activitat i verificar `activity_links`;
- editar un comentari i verificar `activities`;
- actualitzar la configuració cardíaca i verificar `user_settings`;
- obrir dues pestanyes i comprovar el refresc Realtime;
- provocar una pèrdua temporal de connexió i comprovar la cua i el reintent;
- exportar activitats a JSON i confirmar que és una operació explícita;
- comprovar que la consola no mostra errors ni intents d’escriptura a GitHub.

## Diagnosi ràpida

- **No hi ha dades:** comprova la sessió Supabase, les taules i les polítiques
  RLS; no revisis primer els JSON del repositori.
- **403 o `permission denied`:** comprova els `GRANT` a `authenticated`, les
  polítiques RLS i que la sessió correspon a l’usuari esperat.
- **Canvi pendent:** revisa `sync-queue` i torna a provar amb la sessió activa.
- **Conflicte:** no forcis una sobreescriptura; torna a carregar les dades i
  repeteix l’edició sobre la revisió actual.
- **Planning absent:** comprova `planning_weeks` i `planning_sessions` i que
  el `user_id` sigui el de la sessió actual.
- **Versió antiga a Pages:** espera el deploy i invalida la cache/service
  worker si s’ha modificat un asset precachejat.

## SQL de Supabase

`supabase-planning.sql` documenta la creació de les taules personals de
planning, els índexs, els grants, RLS, triggers i Realtime. S’executa al SQL
Editor de Supabase; no és codi de runtime del navegador.

## Compatibilitat CSV

Els fluxos CSV de `planning-uploader.js` i `csv-writer.js` són legacy. No s’han
de considerar acabats fins que la seva importació també passi per Supabase o
quedi substituïda per la importació JSON. Aquesta és la següent línia de
neteja prevista.
