import * as SecureStore from 'expo-secure-store';

export interface PendingIntent {
  returnTo: string;
  action?: {
    kind: 'wishlist';
    tourId: string;
  };
}

const STORE_KEY = 'nexora_pending_intent';

export async function setPendingIntent(intent: PendingIntent): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(intent));
}

export async function consumePendingIntent(): Promise<PendingIntent | null> {
  try {
    const data = await SecureStore.getItemAsync(STORE_KEY);
    if (!data) return null;
    await SecureStore.deleteItemAsync(STORE_KEY);
    return JSON.parse(data) as PendingIntent;
  } catch {
    return null;
  }
}
