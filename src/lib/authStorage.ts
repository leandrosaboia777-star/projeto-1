import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
const CHUNK = 1800;
export const authStorage =
  Platform.OS === "web"
    ? AsyncStorage
    : {
        async getItem(key: string) {
          const count = Number(await SecureStore.getItemAsync(`${key}.count`));
          if (!count) return null;
          let value = "";
          for (let n = 0; n < count; n++) {
            const chunk = await SecureStore.getItemAsync(`${key}.${n}`);
            if (chunk === null) return null;
            value += chunk;
          }
          return value;
        },
        async setItem(key: string, value: string) {
          const previous = Number(
            await SecureStore.getItemAsync(`${key}.count`),
          );
          const count = Math.ceil(value.length / CHUNK);
          for (let n = 0; n < count; n++)
            await SecureStore.setItemAsync(
              `${key}.${n}`,
              value.slice(n * CHUNK, (n + 1) * CHUNK),
              {
                keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
              },
            );
          await SecureStore.setItemAsync(`${key}.count`, String(count));
          for (let n = count; n < previous; n++)
            await SecureStore.deleteItemAsync(`${key}.${n}`);
        },
        async removeItem(key: string) {
          const count = Number(await SecureStore.getItemAsync(`${key}.count`));
          await SecureStore.deleteItemAsync(`${key}.count`);
          for (let n = 0; n < count; n++)
            await SecureStore.deleteItemAsync(`${key}.${n}`);
        },
      };
