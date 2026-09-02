//=====================================================================
// Tremolo (Faust) per AmpRig (WASM) - AMPLITUDE MODULATION
//---------------------------------------------------------------------
// Effetto MONOFONICO per la pipeline condivisa (js/faust-loader.js).
// I nomi dei widget corrispondono agli id della registry EFFECTS_REGISTRY.
//
// Suona come un pedale per chitarra: LFO morbido che modula il volume
// senza mai tagliare completamente il segnale (a meno che Soft non sia 0).

import("stdfaust.lib");

//------------------ UI (nomi widget = id registry) ------------------
Rate  = hslider("Rate",  4,   0.1, 20,  0.01) : si.smoo;  // LFO Hz
Depth = hslider("Depth", 0.7, 0,   1,   0.01) : si.smoo;  // modulazione 0-1
Wave  = hslider("Wave",  0.5, 0,   1,   0.01) : si.smoo;  // sine<->square
Soft  = hslider("Soft",  0.3, 0,   1,   0.01) : si.smoo;  // morbidezza (0=dura, 1=morbida)
Level = hslider("Level", 1,   0,   2,   0.01) : si.smoo;  // output volume

//------------------ LFO: morph sine -> square ------------------
sineLFO   = os.osc(Rate);       // -1..1 dolce
squareLFO = os.square(Rate);    // -1..1 dura

// Crossfade morbido tra le due forme
rawLFO = sineLFO * (1.0 - Wave) + squareLFO * Wave;

// Smoothing: elimina i click della quadra nelle transizioni
lfo = rawLFO : fi.lowpass(1, 1200);

//------------------ Softness: volume minimo ------------------
// Soft=0 → il segnale può scendere a 0 (taglio totale)
// Soft=1 → il segnale scende al massimo a 0.5 (mai silenzio)
volFloor = 0.5 * Soft * Depth;

// Modulazione ampiezza: oscillazione tra (1-Depth) e 1, con pavimento
mod = max(volFloor, 1.0 - (lfo * 0.5 + 0.5) * Depth);

//------------------ Output ------------------
process = _ * mod * Level;