import {
  type GoogleSdk,
  isGoogleSignInAvailable,
  requestGoogleIdToken,
  signOutOfGoogle,
} from './google-native';

const GOOGLE_ENV = {
  webClientId: 'web.apps.googleusercontent.com',
  iosClientId: 'ios.apps.googleusercontent.com',
};

const STATUS = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
};

/** SDK giả cùng hình dạng phần `@react-native-google-signin/google-signin` mà seam dùng. */
function fakeSdk(overrides: Partial<GoogleSdk['GoogleSignin']> = {}): GoogleSdk {
  return {
    GoogleSignin: {
      configure: jest.fn(),
      hasPlayServices: jest.fn().mockResolvedValue(true),
      signIn: jest.fn().mockResolvedValue({
        type: 'success',
        data: { idToken: 'id-token-123' },
      }),
      signOut: jest.fn().mockResolvedValue(null),
      ...overrides,
    },
    statusCodes: STATUS,
  };
}

function nativeError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

describe('isGoogleSignInAvailable', () => {
  it('Expo Go (storeClient) không có module native — ẩn nút', () => {
    expect(isGoogleSignInAvailable('storeClient', GOOGLE_ENV)).toBe(false);
  });

  it('thiếu env Google — ẩn nút', () => {
    expect(isGoogleSignInAvailable('bare', null)).toBe(false);
    expect(isGoogleSignInAvailable('standalone', null)).toBe(false);
  });

  it('dev build hoặc APK có env — hiện nút', () => {
    expect(isGoogleSignInAvailable('bare', GOOGLE_ENV)).toBe(true);
    expect(isGoogleSignInAvailable('standalone', GOOGLE_ENV)).toBe(true);
  });
});

describe('requestGoogleIdToken', () => {
  it('cấu hình đúng hai client rồi trả ID token', async () => {
    const sdk = fakeSdk();
    await expect(requestGoogleIdToken(sdk, GOOGLE_ENV)).resolves.toEqual({
      kind: 'token',
      idToken: 'id-token-123',
    });
    expect(sdk.GoogleSignin.configure).toHaveBeenCalledWith({
      webClientId: GOOGLE_ENV.webClientId,
      iosClientId: GOOGLE_ENV.iosClientId,
    });
    expect(sdk.GoogleSignin.hasPlayServices).toHaveBeenCalled();
  });

  it('khách đóng bảng chọn tài khoản — cancelled', async () => {
    const sdk = fakeSdk({
      signIn: jest.fn().mockResolvedValue({ type: 'cancelled', data: null }),
    });
    await expect(requestGoogleIdToken(sdk, GOOGLE_ENV)).resolves.toEqual({ kind: 'cancelled' });
  });

  it('mã SIGN_IN_CANCELLED ném ra cũng là cancelled, không phải lỗi', async () => {
    const sdk = fakeSdk({
      signIn: jest.fn().mockRejectedValue(nativeError(STATUS.SIGN_IN_CANCELLED)),
    });
    await expect(requestGoogleIdToken(sdk, GOOGLE_ENV)).resolves.toEqual({ kind: 'cancelled' });
  });

  it('bấm hai lần khi luồng trước chưa xong — error inProgress', async () => {
    const sdk = fakeSdk({
      signIn: jest.fn().mockRejectedValue(nativeError(STATUS.IN_PROGRESS)),
    });
    await expect(requestGoogleIdToken(sdk, GOOGLE_ENV)).resolves.toEqual({
      kind: 'error',
      code: 'inProgress',
    });
  });

  it('máy không có Google Play Services — error playServicesNotAvailable', async () => {
    const sdk = fakeSdk({
      hasPlayServices: jest.fn().mockRejectedValue(nativeError(STATUS.PLAY_SERVICES_NOT_AVAILABLE)),
    });
    await expect(requestGoogleIdToken(sdk, GOOGLE_ENV)).resolves.toEqual({
      kind: 'error',
      code: 'playServicesNotAvailable',
    });
    expect(sdk.GoogleSignin.signIn).not.toHaveBeenCalled();
  });

  it('lỗi lạ (DEVELOPER_ERROR, mất mạng) — error unknown, không ném', async () => {
    const sdk = fakeSdk({ signIn: jest.fn().mockRejectedValue(nativeError('10')) });
    await expect(requestGoogleIdToken(sdk, GOOGLE_ENV)).resolves.toEqual({
      kind: 'error',
      code: 'unknown',
    });
    const sdkPlain = fakeSdk({ signIn: jest.fn().mockRejectedValue(new Error('boom')) });
    await expect(requestGoogleIdToken(sdkPlain, GOOGLE_ENV)).resolves.toEqual({
      kind: 'error',
      code: 'unknown',
    });
  });

  it('thành công mà thiếu idToken — tính là lỗi missingIdToken', async () => {
    const sdk = fakeSdk({
      signIn: jest.fn().mockResolvedValue({ type: 'success', data: { idToken: null } }),
    });
    await expect(requestGoogleIdToken(sdk, GOOGLE_ENV)).resolves.toEqual({
      kind: 'error',
      code: 'missingIdToken',
    });
  });
});

describe('signOutOfGoogle', () => {
  it('gọi signOut của SDK để lần sau được chọn tài khoản khác', async () => {
    const sdk = fakeSdk();
    await signOutOfGoogle(sdk);
    expect(sdk.GoogleSignin.signOut).toHaveBeenCalled();
  });

  it('nuốt lỗi của SDK — đăng xuất khỏi app không bị chặn', async () => {
    const sdk = fakeSdk({ signOut: jest.fn().mockRejectedValue(new Error('boom')) });
    await expect(signOutOfGoogle(sdk)).resolves.toBeUndefined();
  });

  it('không có SDK (Expo Go) thì không làm gì', async () => {
    await expect(signOutOfGoogle(null)).resolves.toBeUndefined();
  });
});
