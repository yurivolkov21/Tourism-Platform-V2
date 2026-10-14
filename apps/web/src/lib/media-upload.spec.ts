import { UPLOAD_TIMEOUT_MS } from '@tourism/ui/lib/cloudinary-upload';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publicIdOf, uploadToCloudinary } from './media-upload';

// `imageExtensionOf`, bộ field đã ký và khung XHR (hạn giờ, huỷ, lỗi) có spec ở bản dùng chung
// `libs/shared/ui/src/lib/cloudinary-upload.spec.ts` (G15). Ở đây chỉ phần riêng của web.

const PARAMS = {
  signature: 'sig',
  timestamp: 1_760_000_000,
  apiKey: 'key',
  cloudName: 'demo',
  folder: 'tourism/avatars/u-1',
  publicId: 'pid-1',
  allowedFormats: 'jpg,jpeg,png,webp,avif,gif',
  transformation: 'c_limit,w_2400,h_2400,fl_force_strip',
  overwrite: false as const,
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
};

describe('publicIdOf', () => {
  it('đọc public_id ĐẦY ĐỦ `<folder>/<basename>` — đúng chuỗi account.setAvatar cần nhận lại', () => {
    expect(publicIdOf({ public_id: 'tourism/avatars/u-1/pid-1', width: 400 })).toBe(
      'tourism/avatars/u-1/pid-1',
    );
  });

  it('thiếu, rỗng hay không phải object → null', () => {
    expect(publicIdOf({})).toBeNull();
    expect(publicIdOf({ public_id: '' })).toBeNull();
    expect(publicIdOf(null)).toBeNull();
    expect(publicIdOf('tourism/avatars/u-1/pid-1')).toBeNull();
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
  abort = vi.fn();
  constructor() {
    FakeXhr.last = this;
  }
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, listener);
  }
}

describe('uploadToCloudinary của web', () => {
  beforeEach(() => {
    FakeXhr.last = null;
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('có hạn giờ của bản dùng chung và trả public_id đầy đủ (G15: trước đó mạng chết là treo mãi)', async () => {
    const pending = uploadToCloudinary(new Blob(['x']), PARAMS);
    const xhr = FakeXhr.last;
    expect(xhr?.timeout).toBe(UPLOAD_TIMEOUT_MS);

    if (xhr) {
      xhr.status = 200;
      xhr.responseText = JSON.stringify({ public_id: 'tourism/avatars/u-1/pid-1' });
    }
    xhr?.listeners.get('load')?.();

    await expect(pending).resolves.toBe('tourism/avatars/u-1/pid-1');
  });
});
