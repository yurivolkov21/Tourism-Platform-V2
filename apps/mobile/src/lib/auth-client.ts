import { expoClient } from '@better-auth/expo/client';
import { emailOTPClient, inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { env } from '@/lib/env';

/**
 * Client Better Auth DUY NHẤT của mobile (ADR-0017 §9) — khác web: không
 * cookie httpOnly (RN không có cookie jar), plugin `expoClient` lưu phiên
 * trong `expo-secure-store` (Keychain/EncryptedSharedPreferences) và tự đính
 * vào mỗi request.
 *
 * `scheme` khớp `app.json` → callback OAuth/reset-password đi qua
 * `nexora://` mở lại đúng app. `inferAdditionalFields` khai lại field
 * `phone` như web (chỉ để type-check `updateUser`, server vẫn là chốt thật).
 */
function buildAuthClient() {
  return createAuthClient({
    baseURL: env().apiUrl,
    plugins: [
      expoClient({
        scheme: 'nexora',
        storagePrefix: 'nexora',
        storage: SecureStore,
      }),
      emailOTPClient(),
      inferAdditionalFields({
        user: { phone: { type: 'string', required: false } },
      }),
    ],
  });
}

let cached: ReturnType<typeof buildAuthClient> | undefined;

/**
 * Dựng lười, KHÔNG ở module scope: `env()` ném nếu thiếu/sai biến — dựng
 * ngay lúc nạp module (trước khi `RootLayout` render) là ném TRƯỚC khi
 * `ErrorBoundary` tồn tại, y hệt bẫy mà `lib/env.ts` đã cảnh báo. Gọi hàm
 * này CHỈ từ trong hành động của người dùng (method của `AuthActions`) hoặc
 * component đã render — cả hai đều sau lượt `env()` đầu tiên ở `RootLayout`.
 */
export function getAuthClient(): ReturnType<typeof buildAuthClient> {
  if (cached === undefined) cached = buildAuthClient();
  return cached;
}
