import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildUploadFormData,
  imageExtensionOf,
  parseUploadResponse,
  UPLOAD_TIMEOUT_MS,
  uploadPhoto,
} from './photo-upload';

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

/** XHR giả tối thiểu: ghi lại listener để test tự bắn sự kiện. */
class FakeXhr {
  static last: FakeXhr | null = null;
  timeout = 0;
  status = 0;
  responseText = '';
  upload = { addEventListener: vi.fn() };
  listeners = new Map<string, () => void>();
  open = vi.fn();
  send = vi.fn();
  abort = vi.fn(() => this.fire('abort'));
  constructor() {
    FakeXhr.last = this;
  }
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, listener);
  }
  fire(type: string) {
    this.listeners.get(type)?.();
  }
}

describe('uploadPhoto — hạn giờ và huỷ (vòng review F18)', () => {
  beforeEach(() => {
    FakeXhr.last = null;
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lượt POST có hạn giờ; hết giờ thì reject — dòng tải không treo mãi', async () => {
    const pending = uploadPhoto(new Blob(['x']), PARAMS);
    expect(FakeXhr.last?.timeout).toBe(UPLOAD_TIMEOUT_MS);

    FakeXhr.last?.fire('timeout');

    await expect(pending).rejects.toThrow('timeout');
  });

  it('huỷ qua AbortSignal: gọi xhr.abort() rồi reject', async () => {
    const controller = new AbortController();
    const pending = uploadPhoto(new Blob(['x']), PARAMS, undefined, controller.signal);

    controller.abort();

    expect(FakeXhr.last?.abort).toHaveBeenCalledTimes(1);
    await expect(pending).rejects.toThrow('aborted');
  });

  it('signal đã huỷ từ trước: reject ngay, không mở request nào', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      uploadPhoto(new Blob(['x']), PARAMS, undefined, controller.signal),
    ).rejects.toThrow('aborted');
    expect(FakeXhr.last).toBeNull();
  });
});
