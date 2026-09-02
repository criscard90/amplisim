//=====================================================================
// Chorus (Faust) per AmpRig (WASM) - DUAL-VOICE MODULATED DELAY
//---------------------------------------------------------------------
// Effetto MONOFONICO per la pipeline condivisa (js/faust-loader.js).
// I nomi dei widget corrispondono agli id della registry EFFECTS_REGISTRY.

import("stdfaust.lib");

//------------------ UI (nomi widget = id registry) ------------------
Rate     = hslider("Rate",     0.5,  0.1, 10,   0.01) : si.smoo;  // LFO Hz
Depth    = hslider("Depth",    0.5,  0,   1,    0.01) : si.smoo;  // modulazione 0-1
Mix      = hslider("Mix",      0.5,  0,   1,    0.01) : si.smoo;  // dry/wet
Feedback = hslider("Feedback", 0.3,  0,   0.95, 0.01) : si.smoo;  // ritardo
Tone     = hslider("Tone",     0.5,  0,   1,    0.01) : si.smoo;  // filtro

//------------------ Parametri derivati ------------------
toneCut = 300.0 + Tone * 7700.0;                    // cutoff lowpass 300..8000 Hz
maxBuf  = ma.SR * 0.05;                             // buffer 50 ms

//------------------ LFO ------------------
lfo = os.osc(Rate);                                 // -1..1 sinusoidale

//------------------ Voci del chorus ------------------
v1 = de.fdelay(maxBuf, (10.0 + lfo * 5.0) * ma.SR / 1000.0)
     : fi.lowpass(1, toneCut)
     : *(Feedback);

v2 = de.fdelay(maxBuf, (14.0 + lfo * 5.0) * ma.SR / 1000.0)
     : fi.lowpass(1, toneCut)
     : *(Feedback);

//------------------ Miscela dry/wet ------------------
process = _ <: (v1 + v2) * 0.5 * Depth * Mix, *(1.0 - Mix) :> _;