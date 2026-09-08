// Env công khai của app mobile. Fail-fast khi thiếu — thiếu origin API thì mọi
// màn hình chỉ hỏng SAU khi người dùng bấm vào, còn ném ngay lúc nạp thì lỗi
// hiện ở màn đầu tiên (cùng tinh thần fail-fast của apps/web, ADR-0016 §6).
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
    apiUrl: source.EXPO_PUBLIC_API_URL ?? '',
    webUrl: source.EXPO_PUBLIC_WEB_URL ?? '',
  };
}

// Metro nội tuyến `process.env.EXPO_PUBLIC_*` lúc bundle CHỈ khi truy cập tĩnh
// — viết `process.env[key]` trong vòng lặp là bundle ra `undefined`.
export const env: MobileEnv = readEnv({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_WEB_URL: process.env.EXPO_PUBLIC_WEB_URL,
});
