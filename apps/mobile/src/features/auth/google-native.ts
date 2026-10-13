import type { SignInResponse } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { env, type GoogleEnv } from '@/lib/env';

/**
 * Phần của `@react-native-google-signin/google-signin` mà app dùng (ADR-0056
 * §1). Khai bằng interface để test truyền SDK giả, và để file này không nạp
 * module native lúc import — Expo Go và Jest không có module đó.
 */
export interface GoogleSdk {
  GoogleSignin: {
    configure(options: { webClientId: string; iosClientId?: string }): void;
    hasPlayServices(options?: { showPlayServicesUpdateDialog?: boolean }): Promise<boolean>;
    signIn(): Promise<SignInResponse>;
    signOut(): Promise<null>;
  };
  statusCodes: {
    SIGN_IN_CANCELLED: string;
    IN_PROGRESS: string;
    PLAY_SERVICES_NOT_AVAILABLE: string;
  };
}

export type GoogleIdTokenResult =
  | { kind: 'token'; idToken: string }
  // Khách đóng bảng chọn tài khoản: màn đứng yên, không báo gì (F12).
  | { kind: 'cancelled' }
  | {
      kind: 'error';
      code: 'inProgress' | 'playServicesNotAvailable' | 'missingIdToken' | 'unknown';
    };

/**
 * Nút Google có hiện không. Hàm THUẦN: Expo Go (`storeClient`) không nạp được
 * module native, còn thiếu env Google thì không có client để xin token — cả
 * hai trường hợp đều ẩn nút thay vì để một nút bấm vào là chết.
 */
export function isGoogleSignInAvailable(
  executionEnvironment: string,
  googleEnv: GoogleEnv | null,
): boolean {
  return executionEnvironment !== 'storeClient' && googleEnv !== null;
}

/** Bản đọc môi trường thật của `isGoogleSignInAvailable`, cho route và hành động auth. */
export function canUseGoogleSignIn(): boolean {
  return isGoogleSignInAvailable(Constants.executionEnvironment, env().google);
}

/**
 * Nạp module native LƯỜI, chỉ khi `canUseGoogleSignIn()` đúng — import tĩnh sẽ
 * làm Expo Go chết ngay lúc mở app vì thiếu `RNGoogleSignin`.
 */
export function loadGoogleSdk(): GoogleSdk | null {
  if (!canUseGoogleSignIn()) return null;
  return require('@react-native-google-signin/google-signin') as GoogleSdk;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Mở bảng chọn tài khoản Google gốc và lấy ID token (spec §2 bước 2–3). Không
 * bao giờ ném: mọi lỗi của SDK thành một kết cục có tên để route quyết định
 * câu hiện ra.
 */
export async function requestGoogleIdToken(
  sdk: GoogleSdk,
  googleEnv: GoogleEnv,
): Promise<GoogleIdTokenResult> {
  const { GoogleSignin, statusCodes } = sdk;
  try {
    GoogleSignin.configure({
      webClientId: googleEnv.webClientId,
      iosClientId: googleEnv.iosClientId,
    });
    // Android: máy thiếu hoặc cũ Google Play Services thì hiện hộp cập nhật của
    // hệ thống. iOS luôn trả true.
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') return { kind: 'cancelled' };
    const idToken = response.data.idToken;
    // Không có token thì không có gì để gửi API — thường do cấu hình client sai.
    if (!idToken) return { kind: 'error', code: 'missingIdToken' };
    return { kind: 'token', idToken };
  } catch (error) {
    const code = errorCode(error);
    if (code === statusCodes.SIGN_IN_CANCELLED) return { kind: 'cancelled' };
    if (code === statusCodes.IN_PROGRESS) return { kind: 'error', code: 'inProgress' };
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { kind: 'error', code: 'playServicesNotAvailable' };
    }
    return { kind: 'error', code: 'unknown' };
  }
}

/**
 * Đăng xuất khỏi Google trên máy (spec §2 bước 7) để lần đăng nhập sau hiện lại
 * bảng chọn tài khoản. Nuốt lỗi: phiên của app đã xoá ở bước khác, việc này chỉ
 * là dọn phía Google.
 */
export async function signOutOfGoogle(sdk: GoogleSdk | null): Promise<void> {
  if (sdk === null) return;
  try {
    await sdk.GoogleSignin.signOut();
  } catch {
    // Xem JSDoc — không có gì để báo.
  }
}
