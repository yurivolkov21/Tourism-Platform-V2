import { v2 as cloudinary } from 'cloudinary';
import type { UploadSigningConfig } from './upload-signing.js';

/**
 * Lời gọi `uploader.destroy` của Cloudinary (ADR-0035) — đường XOÁ duy nhất
 * của hệ, và là lời gọi API ra ngoài đầu tiên tới Cloudinary: trước nay server
 * chỉ dựng URL (`cloudinary-url.ts`) và ký chữ ký (`upload-signing.ts`), cả hai
 * đều thuần và không chạm mạng.
 *
 * Đặt cạnh `upload-signing.ts` và dùng lại `UploadSigningConfig` của nó vì
 * chúng cần ĐÚNG một bộ credential; hai nơi tự đọc env là hai nơi để lệch.
 *
 * ⚠️ Mọi thứ ở đây là KHÔNG HOÀN TÁC. Không hàm nào trong file này được gọi
 * ngoài `MediaGarbageService`, nơi giữ lưới an toàn 7 ngày và phép kiểm tham
 * chiếu (ADR-0035 §1, §2).
 */

/** Phản hồi ta thật sự đọc; SDK khai `Promise<any>`. */
export interface DestroyResponse {
  result?: string;
}

/**
 * Xoá một asset khỏi Cloudinary.
 *
 * `invalidate: true` để CDN edge cũng quên nó, không chỉ origin — thiếu vế
 * này thì ảnh của một review bị bác vẫn phát được từ cache biên hàng giờ sau
 * khi đã xoá, tức lỗ nội dung mà ADR-0035 đi chữa vẫn hở thêm một quãng.
 *
 * `cloudinary.config()` gọi mỗi lượt chứ không set một lần lúc boot: env có
 * thể thiếu secret ở môi trường chỉ-đọc (CI), và ta không muốn một side effect
 * lúc import quyết định số phận của cả process.
 */
export async function destroyAsset(
  cfg: UploadSigningConfig,
  publicId: string,
  resourceType: string,
): Promise<DestroyResponse> {
  cloudinary.config({
    cloud_name: cfg.cloudName,
    api_key: cfg.apiKey,
    api_secret: cfg.apiSecret,
  });

  return (await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType as 'image' | 'video' | 'raw',
    invalidate: true,
  })) as DestroyResponse;
}
