import type { SignedUploadParams } from '@tourism/contract';
import type { UploadedPhoto } from '@/lib/photo-upload';

/**
 * Fixture tải ảnh DÙNG CHUNG cho các spec admin của tab Photos (F18) và ảnh bìa bài viết
 * (P4e-4), cùng nếp `tour-detail.ts`: contract đổi bộ tham số ký là sửa đúng một chỗ (G14).
 * Trước đó ba spec chép tay cùng một bộ tham số, hai spec chép cùng một file giả.
 */

/** Một lượt ký của API cho ảnh `publicId` (tên do server sinh) trong `folder`. */
export function signedUploadParams(folder: string, publicId: string): SignedUploadParams {
  return {
    signature: 'sig',
    timestamp: 1_760_000_000,
    apiKey: 'key',
    cloudName: 'demo',
    folder,
    publicId,
    allowedFormats: 'jpg,jpeg,png,webp,avif,gif',
    transformation: 'c_limit,w_2400,h_2400,fl_force_strip',
    overwrite: false,
    uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
  };
}

/** Kết quả `uploadPhoto` khi Cloudinary nhận ảnh: publicId đầy đủ và số đo của ảnh. */
export function uploadedPhoto(publicId: string): UploadedPhoto {
  return {
    publicId,
    upload: { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 1000 },
  };
}

/** File ảnh giả `bytes` byte: jsdom không đọc nội dung, các luật chỉ xét tên, cỡ và kiểu. */
export function imageFile(name: string, bytes = 10): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' });
}
