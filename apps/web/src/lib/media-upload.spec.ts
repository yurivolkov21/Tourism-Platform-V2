import { describe, expect, it } from 'vitest';
import { buildUploadFormData, imageExtensionOf } from './media-upload';

const PARAMS = {
  signature: 'sig',
  timestamp: 1_760_000_000,
  apiKey: 'key',
  cloudName: 'demo',
  folder: 'tourism/avatars/u-1',
  publicId: 'pid-1',
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
};

describe('imageExtensionOf', () => {
  it('đuôi whitelist (không phân biệt hoa thường) → chuẩn hoá lowercase', () => {
    expect(imageExtensionOf('trip.JPG')).toBe('jpg');
    expect(imageExtensionOf('a.b.webp')).toBe('webp');
  });
  it('đuôi lạ / không đuôi → null', () => {
    expect(imageExtensionOf('malware.exe')).toBeNull();
    expect(imageExtensionOf('noext')).toBeNull();
  });
});

describe('buildUploadFormData', () => {
  it('gửi ĐÚNG bộ field chữ ký phủ — file, api_key, timestamp, signature, folder, public_id', () => {
    const file = new Blob(['x'], { type: 'image/png' });
    const form = buildUploadFormData(file, PARAMS);
    expect(form.get('api_key')).toBe('key');
    expect(form.get('timestamp')).toBe('1760000000');
    expect(form.get('signature')).toBe('sig');
    expect(form.get('folder')).toBe('tourism/avatars/u-1');
    expect(form.get('public_id')).toBe('pid-1');
    expect(form.get('file')).toBeTruthy();
  });
});
