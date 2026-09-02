// @ts-check

/**
 * Loader WebAudio/Faust condiviso da TUTTI gli effetti.
 *
 * Ogni effetto nella registry (EFFECTS_REGISTRY) punta a una cartella
 * (es. './effects/proco_rat_2/') che contiene SOLO i dati esportati da Faust:
 *   - dsp-meta.json
 *   - dsp-module.wasm
 *   - (solo polifonico) mixer-module.wasm, effect-module.wasm, effect-meta.json
 *
 * Uso tipico:
 *   const { createFaustNode } = await import('./js/faust-loader.js');
 *   const { faustNode } = await createFaustNode(audioCtx, folder, {
 *       dspName, voices
 *   });
 */

/**
 * @typedef {import('./faustwasm').FaustDspMeta} FaustDspMeta
 * @typedef {import('./faustwasm').FaustMonoAudioWorkletNode} FaustMonoAudioWorkletNode
 * @typedef {import('./faustwasm').FaustPolyAudioWorkletNode} FaustPolyAudioWorkletNode
 * @typedef {import('./faustwasm').FaustMonoScriptProcessorNode} FaustMonoScriptProcessorNode
 * @typedef {import('./faustwasm').FaustPolyScriptProcessorNode} FaustPolyScriptProcessorNode
 * @typedef {FaustMonoAudioWorkletNode | FaustPolyAudioWorkletNode | FaustMonoScriptProcessorNode | FaustPolyScriptProcessorNode} FaustNode
 */

/**
 * @typedef {{ dspModule: WebAssembly.Module; dspMeta: FaustDspMeta; effectModule?: WebAssembly.Module; effectMeta?: FaustDspMeta; mixerModule?: WebAssembly.Module }} FaustDspDistribution
 */

/**
 * Crea un nodo audio Faust partendo dai file contenuti nella cartella dell'effetto.
 *
 * @param {AudioContext} audioContext - L'AudioContext Web Audio.
 * @param {string} baseUrl - Percorso base della cartella dell'effetto (es. './effects/proco_rat_2/').
 * @param {object} [options]
 * @param {string} [options.dspName] - Nome del DSP.
 * @param {number} [options.voices] - Numero di voci (0 = mono, >0 = polifonico).
 * @param {boolean} [options.sp] - Usa ScriptProcessorNode invece di AudioWorkletNode.
 * @param {number} [options.bufferSize] - Dimensione del buffer per ScriptProcessorNode.
 * @param {boolean} [options.hasEffect] - Vero se il DSP ha un modulo effect separato.
 * @returns {Promise<{ faustNode: FaustNode | null; dspMeta: FaustDspMeta }>}
 */
const createFaustNode = async (audioContext, baseUrl, {
    dspName = "template",
    voices = 0,
    sp = false,
    bufferSize = 512,
    hasEffect = false
} = {}) => {

    // Import necessary Faust modules and data
    const { FaustMonoDspGenerator, FaustPolyDspGenerator } = await import("./faustwasm/index.js");

    // Load DSP metadata from JSON
    const dspMeta = await (await fetch(`${baseUrl}dsp-meta.json`)).json();

    // Compile the DSP module from WebAssembly binary data
    const dspModule = await WebAssembly.compileStreaming(await fetch(`${baseUrl}dsp-module.wasm`));

    /** @type {FaustDspDistribution} */
    const faustDsp = { dspMeta, dspModule };

    /** @type {FaustNode | null} */
    let faustNode = null;

    // Create either a polyphonic or monophonic Faust audio node based on the number of voices
    if (voices > 0) {

        // Try to load optional mixer and effect modules
        faustDsp.mixerModule = await WebAssembly.compileStreaming(await fetch(`${baseUrl}mixer-module.wasm`));

        if (hasEffect) {
            faustDsp.effectMeta = await (await fetch(`${baseUrl}effect-meta.json`)).json();
            faustDsp.effectModule = await WebAssembly.compileStreaming(await fetch(`${baseUrl}effect-module.wasm`));
        }

        // Create a polyphonic Faust audio node
        const generator = new FaustPolyDspGenerator();
        faustNode = await generator.createNode(
            audioContext,
            voices,
            dspName,
            { module: faustDsp.dspModule, json: JSON.stringify(faustDsp.dspMeta), soundfiles: {} },
            faustDsp.mixerModule,
            faustDsp.effectModule ? { module: faustDsp.effectModule, json: JSON.stringify(faustDsp.effectMeta), soundfiles: {} } : undefined,
            sp,
            bufferSize
        );
    } else {
        // Create a standard Faust audio node
        const generator = new FaustMonoDspGenerator();
        faustNode = await generator.createNode(
            audioContext,
            dspName,
            { module: faustDsp.dspModule, json: JSON.stringify(faustDsp.dspMeta), soundfiles: {} },
            sp,
            bufferSize
        );
    }

    // Return an object with the Faust audio node and the DSP metadata
    return { faustNode, dspMeta };
};

/**
 * Collega una sorgente microfonica a un nodo Faust. Restituisce il
 * MediaStreamAudioSourceNode creato (o collegato), così il chiamante può
 * gestirne la disconnessione in seguito.
 *
 * @param {AudioContext} audioContext - L'AudioContext.
 * @param {string|null} id - Id del dispositivo di input desiderato (opzionale).
 * @param {AudioNode|null} faustNode - Il nodo Faust a cui collegare il microfono.
 * @param {MediaStreamAudioSourceNode|null} oldInputStreamNode - Precedente nodo di input da disconnettere.
 * @returns {Promise<MediaStreamAudioSourceNode>}
 */
async function connectToAudioInput(audioContext, id, faustNode, oldInputStreamNode) {
    // Vincoli generici per evitare OverconstrainedError
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const inputNode = audioContext.createMediaStreamSource(stream);
    if (oldInputStreamNode) oldInputStreamNode.disconnect();
    if (faustNode) inputNode.connect(faustNode);
    return inputNode;
}

/**
 * Richiede il permesso per sensori di movimento/orientamento (iOS).
 */
async function requestPermissions() {
    if (typeof window.DeviceMotionEvent !== "undefined" && typeof window.DeviceMotionEvent.requestPermission === "function") {
        try {
            const permissionState = await window.DeviceMotionEvent.requestPermission();
            if (permissionState !== "granted") {
                console.warn("Motion sensor permission denied.");
            }
        } catch (error) {
            console.error("Error requesting motion sensor permission:", error);
        }
    }

    if (typeof window.DeviceOrientationEvent !== "undefined" && typeof window.DeviceOrientationEvent.requestPermission === "function") {
        try {
            const permissionState = await window.DeviceOrientationEvent.requestPermission();
            if (permissionState !== "granted") {
                console.warn("Orientation sensor permission denied.");
            }
        } catch (error) {
            console.error("Error requesting orientation sensor permission:", error);
        }
    }
}

export { createFaustNode, connectToAudioInput, requestPermissions };