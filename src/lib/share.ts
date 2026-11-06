import { Platform } from "react-native";
// Native extension storage is loaded only in a development/production iOS build.
export async function consumeSharedMessage(): Promise<string | null> {
  if (Platform.OS !== "ios") return null;
  try {
    const { ExtensionStorage } = await import("@bacons/apple-targets");
    const storage = new ExtensionStorage("group.com.saboiacleaning.app");
    const text = storage.get("pendingMessage");
    if (text) storage.remove("pendingMessage");
    return text;
  } catch {
    return null;
  }
}
