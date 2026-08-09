const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
(async () => {
const tts = new MsEdgeTTS();
await tts.setMetadata("es-ES-AlvaroNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
const stream = tts.toStream("hola");
console.log("Keys:", Object.keys(stream));
console.log("Constructor:", stream.constructor.name);
})();
