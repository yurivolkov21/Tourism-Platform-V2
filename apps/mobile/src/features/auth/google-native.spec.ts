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

/** Thứ tự lần gọi đầu của một mock; chưa gọi thì NaN để mọi phép so "trước" đều đỏ. */
function firstCall(fn: unknown): number {
  return (fn as jest.Mock).mock.invocationCallOrder[0] ?? Number.NaN;
}

describe('isGoogleSignInAvailable', () => {
  it('Expo Go (storeClient) không có module native — ẩn nút', () => {
    expect(isGoogleSignInAvailable('storeClient', GOOGLE_ENV, 'android')).toBe(false);
    expect(isGoogleSignInAvailable('storeClient', GOOGLE_ENV, 'ios')).toBe(false);
  });

  it('thiếu env Google — ẩn nút', () => {
    expect(isGoogleSignInAvailable('bare', null, 'android')).toBe(false);
    expect(isGoogleSignInAvailable('standalone', null, 'android')).toBe(false);
  });

  it('dev build hoặc APK có env — hiện nút', () => {
    expect(isGoogleSignInAvailable('bare', GOOGLE_ENV, 'android')).toBe(true);
    expect(isGoogleSignInAvailable('standalone', GOOGLE_ENV, 'android')).toBe(true);
    expect(isGoogleSignInAvailable('standalone', GOOGLE_ENV, 'ios')).toBe(true);
  });

  it('Android chỉ cần client web; iOS thiếu client iOS thì ẩn nút — SDK iOS không cấu hình được', () => {
    const webOnly = { webClientId: GOOGLE_ENV.webClientId, iosClientId: undefined };
    expect(isGoogleSignInAvailable('standalone', webOnly, 'android')).toBe(true);
    expect(isGoogleSignInAvailable('standalone', webOnly, 'ios')).toBe(false);
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

  it('đăng xuất phiên Google cũ TRƯỚC khi mở bảng chọn, để lần nào cũng chọn được tài khoản', async () => {
    // Android nhớ tài khoản đã chọn và tự vào lại nó, không hiện bảng chọn,
    // cho tới khi signOut — kể cả khi lần trước đổi token lấy phiên thất bại
    // hay app đã mở lại (signOut lúc đăng xuất chạy khi SDK chưa cấu hình).
    const sdk = fakeSdk();
    await requestGoogleIdToken(sdk, GOOGLE_ENV);
    const { configure, signOut, signIn } = sdk.GoogleSignin;
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(firstCall(configure)).toBeLessThan(firstCall(signOut));
    expect(firstCall(signOut)).toBeLessThan(firstCall(signIn));
  });

  it('signOut trước bảng chọn hỏng cũng không chặn đăng nhập', async () => {
    const sdk = fakeSdk({ signOut: jest.fn().mockRejectedValue(new Error('boom')) });
    await expect(requestGoogleIdToken(sdk, GOOGLE_ENV)).resolves.toEqual({
      kind: 'token',
      idToken: 'id-token-123',
    });
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
  it('cấu hình SDK rồi mới signOut — sau khi mở lại app, signOut chưa cấu hình bị Android từ chối', async () => {
    const sdk = fakeSdk();
    await signOutOfGoogle(sdk, GOOGLE_ENV);
    const { configure, signOut } = sdk.GoogleSignin;
    expect(configure).toHaveBeenCalledWith({
      webClientId: GOOGLE_ENV.webClientId,
      iosClientId: GOOGLE_ENV.iosClientId,
    });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(firstCall(configure)).toBeLessThan(firstCall(signOut));
  });

  it('nuốt lỗi của SDK — đăng xuất khỏi app không bị chặn', async () => {
    const sdk = fakeSdk({ signOut: jest.fn().mockRejectedValue(new Error('boom')) });
    await expect(signOutOfGoogle(sdk, GOOGLE_ENV)).resolves.toBeUndefined();
    const throwsOnConfigure = fakeSdk({
      configure: jest.fn(() => {
        throw new Error('bad config');
      }),
    });
    await expect(signOutOfGoogle(throwsOnConfigure, GOOGLE_ENV)).resolves.toBeUndefined();
  });

  it('không có SDK (Expo Go) hay thiếu env Google thì không làm gì', async () => {
    await expect(signOutOfGoogle(null, GOOGLE_ENV)).resolves.toBeUndefined();
    const sdk = fakeSdk();
    await expect(signOutOfGoogle(sdk, null)).resolves.toBeUndefined();
    expect(sdk.GoogleSignin.signOut).not.toHaveBeenCalled();
  });
});
