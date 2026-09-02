//=====================================================================
// Vintage Delay (Faust) per AmpRig (WASM) - TAPE / ECHO STYLE
//---------------------------------------------------------------------
// Effetto MONOFONICO per la pipeline condivisa (js/faust-loader.js).
// I nomi dei widget corrispondono agli id della registry EFFECTS_REGISTRY:
// "Time", "Feedback", "Mix", "Tone", "Drive".
//=====================================================================
import("stdfaust.lib");

//------------------ UI (nomi widget = id Registry) ------------------
Time    = hslider("Time",    300, 20, 2000, 1) : si.smoo;   // ms
Fb      = hslider("Feedback",0.45, 0, 0.95, 0.01) : si.smoo;
Mix     = hslider("Mix",     0.5,  0, 1, 0.01) : si.smoo;
Tone     = hslider("Tone",   0.6,  0,  1,  0.01) : si.smoo;
DriveIn = hslider("Drive",  0.35,  0, 1, 0.01) : si.smoo;

//------------------ Buffer di ritardo ------------------
maxSamp = ma.SR *  2.05;                      // memoria max (~2 s con margine)
delSamp = (Time /  1000.0) * ma.SR;           // ms -> campioni

//------------------ Tone: cutoff del lowpass nel feedback ------------------
toneCut =  300.0 + (Tone * (12000.0 -  300.0));   // 300..12000 Hz

//------------------ Saturazione morbida ("vintage") ------------------
drive(x) = ma.tanh(DriveIn * x *  2.0);

//------------------ Catena del feedback: delay frazionario + lowpass ------------------
fbK(x) = de.fdelay(maxSamp, delSamp, x) : fi.lowpass(1, toneCut);

//------------------ Corpo dell'eco: satura, poi feedback con ritardo ------------------
echoOut(x) = drive(x) : +~ (fbK(x) : *(Fb) );

//------------------ Miscela dry/wet ------------------
process(x) = x * (1.0 - Mix) + echoOut(x)*Mix;

