import { describe, expect, it } from 'vitest';
import { buildUploadFormData, imageExtensionOf, parseUploadResponse } from './photo-upload';

const PARAMS = {
  signature: 'sig',
  timestamp: 1_760_000_000,
  apiKey: 'key',
  cloudName: 'demo',
  folder: 'tourism/tours/t-1',
  publicId: 'pid-1',
  allowedFormats: 'jpg,jpeg,png,webp,avif,gif',
  transformation: 'c_limit,w_2400,h_2400,fl_force_strip',
  overwrite: false as const,
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
};

describe('imageExtensionOf', () => {
  it('đuôi whitelist, không phân biệt hoa thường; lạ hay không đuôi thì null', () => {
    expect(imageExtensionOf('Boat.JPG')).toBe('jpg');
    expect(imageExtensionOf('a.b.webp')).toBe('webp');
    expect(imageExtensionOf('doc.pdf')).toBeNull();
    expect(imageExtensionOf('noext')).toBeNull();
  });
});

describe('buildUploadFormData', () => {
  it('gửi ĐỦ từng tham số đã ký — thiếu một cái là Cloudinary 401', () => {
    const form = buildUploadFormData(new Blob(['x'], { type: 'image/png' }), PARAMS);
    expect(form.get('api_key')).toBe('key');
    expect(form.get('timestamp')).toBe('1760000000');
    expect(form.get('signature')).toBe('sig');
    expect(form.get('folder')).toBe('tourism/tours/t-1');
    expect(form.get('public_id')).toBe('pid-1');
    expect(form.get('allowed_formats')).toBe('jpg,jpeg,png,webp,avif,gif');
    expect(form.get('transformation')).toBe('c_limit,w_2400,h_2400,fl_force_strip');
    expect(form.get('overwrite')).toBe('false');
    expect(form.get('file')).toBeTruthy();
  });
});

describe('parseUploadResponse', () => {
  const body = {
    public_id: 'tourism/tours/t-1/pid-1',
    version: 1759000000,
    width: 2000,
    height: 1333,
    format: 'jpg',
    bytes: 523000,
  };

  it('đọc publicId đầy đủ và metadata; version số thành chuỗi', () => {
    expect(parseUploadResponse(body)).toEqual({
      publicId: 'tourism/tours/t-1/pid-1',
      upload: { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 523000 },
    });
  });

  it('thiếu hay sai kiểu một field là null — không dựng ảnh nửa vời', () => {
    for (const broken of [
      null,
      'text',
      { ...body, public_id: '' },
      { ...body, version: undefined },
      { ...body, width: 20.5 },
      { ...body, format: 7 },
      { ...body, bytes: undefined },
    ]) {
      expect(parseUploadResponse(broken)).toBeNull();
    }
  });
});
