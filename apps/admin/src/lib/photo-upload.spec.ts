import { UPLOAD_TIMEOUT_MS } from '@tourism/ui/lib/cloudinary-upload';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signedUploadParams } from '@/test/photo-upload';
import { parseUploadResponse, uploadPhoto } from './photo-upload';

// `imageExtensionOf`, bộ field đã ký và khung XHR (hạn giờ, huỷ, lỗi) có spec ở bản dùng chung
// `libs/shared/ui/src/lib/cloudinary-upload.spec.ts` (G15). Ở đây chỉ phần riêng của admin.

const PARAMS = signedUploadParams('tourism/tours/t-1', 'pid-1');

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
  /** Cloudinary trả `status` với `body` đã tuần tự hoá. */
  respond(status: number, body: string) {
    this.status = status;
    this.responseText = body;
    this.fire('load');
  }
}

describe('uploadPhoto — lớp mỏng của admin trên bản dùng chung', () => {
  const body = {
    public_id: 'tourism/tours/t-1/pid-1',
    version: 1759000000,
    width: 2000,
    height: 1333,
    format: 'jpg',
    bytes: 523000,
  };

  beforeEach(() => {
    FakeXhr.last = null;
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('2xx đủ số đo → publicId kèm metadata; lượt POST có hạn giờ (vòng review F18)', async () => {
    const pending = uploadPhoto(new Blob(['x']), PARAMS);
    expect(FakeXhr.last?.timeout).toBe(UPLOAD_TIMEOUT_MS);

    FakeXhr.last?.respond(200, JSON.stringify(body));

    await expect(pending).resolves.toEqual({
      publicId: 'tourism/tours/t-1/pid-1',
      upload: { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 523000 },
    });
  });

  it('2xx thiếu số đo ảnh → reject, không dựng ảnh nửa vời', async () => {
    const pending = uploadPhoto(new Blob(['x']), PARAMS);

    FakeXhr.last?.respond(200, JSON.stringify({ ...body, width: undefined }));

    await expect(pending).rejects.toThrow('Cloudinary upload failed (200)');
  });

  it('huỷ qua AbortSignal: gọi xhr.abort() rồi reject', async () => {
    const controller = new AbortController();
    const pending = uploadPhoto(new Blob(['x']), PARAMS, undefined, controller.signal);

    controller.abort();

    expect(FakeXhr.last?.abort).toHaveBeenCalledTimes(1);
    await expect(pending).rejects.toThrow('aborted');
  });
});
