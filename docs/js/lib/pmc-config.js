// docs/js/lib/pmc-config.js
// Constants del model PMC (Performance Management Chart)
//
// Usem TrainingLoadPeak (TLP) de Suunto com a unitat de càrrega nativa.
// NO convertim a TSS de Coggan — treballem a escala TLP directament.
//
// Calibratge empíric (abril 2026):
//   Z2  55min: TLP=81.7   vs TSS~29  → factor sessió ~2.8x
//   TEMPO 55min: TLP=182.6 vs TSS~52 → factor sessió ~3.5x
//   CTL actual: TLP=51.1  vs CTL Suunto=27 → factor CTL ~1.9x
//   ATL actual: TLP=62.5  vs ATL Suunto=23 → factor ATL ~2.7x
//
// Conseqüència: els llindars TSB es multipliquen ~1.9x respecte Coggan.

const PMC_CONFIG = {
  // ── Constants de temps (dies) ─────────────────────────────────────────────
  // Iguals que el model Banister/Coggan — la memòria biològica no canvia
  TAU_CTL: 42,   // Fitness (Chronic Training Load)
  TAU_ATL: 7,    // Fatigue (Acute Training Load)

  // ── Llindars TSB recalibrats a escala TLP ────────────────────────────────
  // Coggan (TSS):  fresc>+5 | òptim 0..+5 | prod. -10..0 | fatigat -30..-10 | sobrecarregat<-30
  // Nosaltres (TLP, factor ~1.9x):
  TSB_THRESHOLDS: {
    fresc:         +10,   // > +10  → Descansat, a punt de competir
    optim_min:       0,   // 0..+10 → Forma pic
    productiu_min:  -20,  // -20..0 → Càrrega ben absorbida, progressió
    fatigat_min:    -57,  // -57..-20 → Precaució, risc acumulació
    // < -57 → Sobrecarregat
  },

  // ── Escala de càrrega setmanal (panell EPOC/TSS) ─────────────────────────
  // Valors recalibrats: score = avg_TLP * sqrt(numSessions)
  // Recuperació: avg~60 * sqrt(1) = 60  → max 85
  // Fàcil:       avg~90 * sqrt(2) = 127 → max 170
  // Moderada:    avg~120 * sqrt(3) = 208 → max 280
  // Dura:        avg~150 * sqrt(4) = 300 → max 420
  TSS_WEEKLY_SCALE: [
    { max:   85, key: 'recovery', label: 'Recuperació', cls: 'tss-recovery' },
    { max:  170, key: 'easy',     label: 'Fàcil',       cls: 'tss-easy'     },
    { max:  280, key: 'moderate', label: 'Moderada',    cls: 'tss-moderate' },
    { max:  420, key: 'hard',     label: 'Dura',        cls: 'tss-hard'     },
    { max: Infinity, key: 'extreme', label: 'Extrem',   cls: 'tss-extreme'  },
  ],

  // ── Barem de TSS màxim per a la barra de progrés del panell setmanal ─────
  TSS_BAR_MAX: 420,
};
