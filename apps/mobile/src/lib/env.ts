// Env công khai của app mobile. Fail-fast khi thiếu hoặc sai dạng, nhưng ném
// LƯỜI — lúc gọi, không phải lúc nạp module.
//
// Vì sao lười: bản đầu `export const env = readEnv(...)` chạy ngay khi module
// được eval, tức TRƯỚC khi cây React tồn tại. `ErrorBoundary` của expo-router
// không bắt được, `SplashScreen.preventAutoHideAsync()` chưa kịp chạy, nên
// một bản phát hành thiếu biến sẽ crash ngay lúc mở, không một chữ nào cho
// người dùng. Chính `apps/web/src/lib/api/env.ts` đã ghi luật này thành lời:
// "Gọi LƯỜI (trong hàm/handler), KHÔNG ở module scope" — bản đầu viện dẫn web
// làm tiền lệ trong khi làm ngược lại đúng điều web cấm.
//
// CẢNH BÁO (ADR-0040 §9): mọi biến `EXPO_PUBLIC_*` nằm TRONG bundle JS và đọc
// được bằng tay. Mobile là client công khai, cùng hạng browser — không bao giờ
// thêm secret vào đây.

/** Hai origin mà app mobile cần biết. */
export interface MobileEnv {
  /** Origin API oRPC — origin TRẦN, không kèm `/api`. */
  apiUrl: string;
  /** Gốc web công khai — checkout hosted và trang pháp lý mở bằng trình duyệt. */
  webUrl: string;
}

/** Tên biến env, giữ ở một chỗ để thông báo lỗi và chỗ đọc không trôi lệch. */
const KEYS = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_WEB_URL'] as const;

/**
 * Đọc và kiểm env từ một nguồn bất kỳ — hàm THUẦN nên test được mà không phải
 * đụng `process.env`.
 *
 * Chuỗi rỗng bị coi là THIẾU: nền tảng deploy gửi chuỗi rỗng khi ô cấu hình bị
 * bỏ trống (cùng gotcha `parseEnv` của apps/api), nên `KEY=` phải đỏ chứ không
 * được lọt qua thành origin rỗng.
 */
/** Loopback: môi trường thử, được phép `http`. */
function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/**
 * Chuỗi env → origin TRẦN đã kiểm. Ba việc, mỗi việc chữa một cách hỏng thật:
 *
 * 1. Parse được không — `api.nexora-travel.agency` (thiếu scheme) qua được mọi
 *    phép kiểm chuỗi rồi chết ở `fetch` với "Network request failed" vô nghĩa.
 * 2. Ép `https` trừ loopback — Android chặn cleartext mặc định từ targetSdk 28,
 *    nên một origin `http://` tới host thật làm 100% request chết CÂM, không
 *    một cảnh báo nào. `apps/web` có đúng chốt này; mobile thiếu là thụt lùi.
 * 3. Trả `.origin` — bỏ path/query/dấu `/` cuối, nên `…/agency/` không thành
 *    `https://…//rpc/...` (nhiều reverse proxy trả 404 chứ không chuẩn hoá).
 */
function readOrigin(raw: string, key: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`@tourism/mobile: ${key} không phải URL hợp lệ ("${raw}").`);
  }
  if (url.protocol !== 'https:' && !isLoopback(url.hostname)) {
    throw new Error(
      `@tourism/mobile: ${key} phải dùng https khi trỏ host thật, đang là "${url.protocol}//". ` +
        'Android chặn cleartext mặc định nên mọi request sẽ chết câm.',
    );
  }
  return url.origin;
}

export function readEnv(source: Record<string, string | undefined>): MobileEnv {
  const missing = KEYS.filter((key) => !source[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `@tourism/mobile: thiếu biến env ${missing.join(', ')}. ` +
        'Chép apps/mobile/.env.example thành .env.local rồi điền giá trị.',
    );
  }

  // `noUncheckedIndexedAccess` bật: đã lọc ở trên nên hai giá trị chắc chắn có,
  // nhưng kiểu vẫn là `string | undefined` — dùng `?? ''` cho tsgo yên tâm.
  return {
    apiUrl: readOrigin(source.EXPO_PUBLIC_API_URL ?? '', 'EXPO_PUBLIC_API_URL'),
    webUrl: readOrigin(source.EXPO_PUBLIC_WEB_URL ?? '', 'EXPO_PUBLIC_WEB_URL'),
  };
}

let cached: MobileEnv | undefined;

/**
 * Env đã kiểm, dựng một lần rồi nhớ. Gọi TRONG cây React (component, handler)
 * để lỗi rơi vào `ErrorBoundary` và người dùng thấy một màn lỗi, không phải
 * một app tắt ngóm.
 */
export function env(): MobileEnv {
  // Metro nội tuyến `process.env.EXPO_PUBLIC_*` lúc bundle CHỈ khi truy cập
  // tĩnh — viết `process.env[key]` trong vòng lặp là bundle ra `undefined`.
  cached ??= readEnv({
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_WEB_URL: process.env.EXPO_PUBLIC_WEB_URL,
  });
  return cached;
}
