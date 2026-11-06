import { Platform } from "react-native";
import * as Speech from "expo-speech";
import type { Language } from "./i18n";
let stopListening: (() => void) | null = null;
export function speak(text: string, language: Language) {
  Speech.stop();
  Speech.speak(text, { language, rate: 0.92 });
}
export async function listen(
  language: Language,
  onText: (text: string) => void,
  onEnd: () => void,
) {
  if (Platform.OS === "web") {
    const w = globalThis as any;
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) throw new Error("UNSUPPORTED");
    const r = new Recognition();
    r.lang = language;
    r.interimResults = false;
    r.onresult = (e: any) => onText(e.results[0][0].transcript);
    r.onend = onEnd;
    r.onerror = (e: any) => {
      onEnd();
    };
    r.start();
    stopListening = () => r.stop();
    return;
  }
  // Native speech recognition requires the documented development build.
  const { ExpoSpeechRecognitionModule } =
    await import("expo-speech-recognition");
  const granted = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!granted.granted)
    throw new Error("Microphone / speech permission denied");
  const result = ExpoSpeechRecognitionModule.addListener("result", (e) => {
    if (e.isFinal && e.results[0]) onText(e.results[0].transcript);
  });
  const end = ExpoSpeechRecognitionModule.addListener("end", () => {
    result.remove();
    end.remove();
    error.remove();
    onEnd();
  });
  const error = ExpoSpeechRecognitionModule.addListener("error", () => {
    result.remove();
    end.remove();
    error.remove();
    onEnd();
  });
  ExpoSpeechRecognitionModule.start({ lang: language, interimResults: false });
  stopListening = () => ExpoSpeechRecognitionModule.stop();
}
export function stop() {
  stopListening?.();
  stopListening = null;
}
