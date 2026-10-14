import type { SignedUploadParams } from '@tourism/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildUploadFormData,
  imageExtensionOf,
  UPLOAD_TIMEOUT_MS,
  uploadToCloudinary,
} from './cloudinary-upload.js';

const PARAMS: SignedUploadParams = {
  signature: 'sig',
  timestamp: 1_760_000_000,
  apiKey: 'key',
  cloudName: 'demo',
  folder: 'tourism/tours/t-1',
  publicId: 'pid-1',
  allowedFormats: 'jpg,jpeg,png,webp,avif,gif',
  transformation: 'c_limit,w_2400,h_2400,fl_force_strip',
  overwrite: false,
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
};

describe('imageExtensionOf', () => {
  it('đuôi whitelist, không phân biệt hoa thường → chuẩn hoá lowercase', () => {
    expect(imageExtensionOf('Boat.JPG')).toBe('jpg');
    expect(imageExtensionOf('a.b.webp')).toBe('webp');
  });

  it('đuôi lạ, không đuôi hay chỉ có đuôi → null', () => {
    expect(imageExtensionOf('malware.exe')).toBeNull();
    expect(imageExtensionOf('doc.pdf')).toBeNull();
    expect(imageExtensionOf('noext')).toBeNull();
    expect(imageExtensionOf('.png')).toBeNull();
  });
});

describe('buildUploadFormData', () => {
  it('gửi ĐỦ từng tham số đã ký và file — thiếu hay thừa một cái là Cloudinary 401', () => {
    const form = buildUploadFormData(new Blob(['x'], { type: 'image/png' }), PARAMS);
    expect(form.get('api_key')).toBe('key');
    expect(form.get('timestamp')).toBe('1760000000');
    expect(form.get('signature')).toBe('sig');
    expect(form.get('folder')).toBe('tourism/tours/t-1');
    expect(form.get('public_id')).toBe('pid-1');
    // ADR-0021 AMEND 1, 2: ràng buộc NẰM TRONG chữ ký — form thiếu là 401, và thiếu
    // `transformation` là mất luôn lớp strip EXIF.
    expect(form.get('allowed_formats')).toBe('jpg,jpeg,png,webp,avif,gif');
    expect(form.get('transformation')).toBe('c_limit,w_2400,h_2400,fl_force_strip');
    expect(form.get('overwrite')).toBe('false');
    expect(form.get('file')).toBeTruthy();
    expect([...form.keys()].sort()).toEqual([
      'allowed_formats',
      'api_key',
      'file',
      'folder',
      'overwrite',
      'public_id',
      'signature',
      'timestamp',
      'transformation',
    ]);
  });
});

type ProgressListener = (event: {
  lengthComputable: boolean;
  loaded: number;
  total: number;
}) => void;

/** XHR giả tối thiểu: ghi lại listener để test tự bắn sự kiện. */
class FakeXhr {
  static last: FakeXhr | null = null;
  timeout = 0;
  status = 0;
  responseText = '';
  progressListener: ProgressListener | null = null;
  upload = {
    addEventListener: (_type: string, listener: ProgressListener) => {
      this.progressListener = listener;
    },
  };
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
  /** Cloudinary trả `status` với `body` (chuỗi thô, có thể không phải JSON). */
  respond(status: number, body: string) {
    this.status = status;
    this.responseText = body;
    this.fire('load');
  }
}

/** Đọc `public_id` như web làm — đủ để thử khung XHR mà không phụ thuộc app nào. */
function publicIdOnly(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('public_id' in body)) return null;
  const publicId = (body as { public_id: unknown }).public_id;
  return typeof publicId === 'string' && publicId !== '' ? publicId : null;
}

describe('uploadToCloudinary — khung XHR dùng chung của web và admin', () => {
  beforeEach(() => {
    FakeXhr.last = null;
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('POST đúng uploadUrl với form đã ký, trả thứ `parse` đọc được từ phản hồi 2xx', async () => {
    const pending = uploadToCloudinary(new Blob(['x']), PARAMS, publicIdOnly);
    const xhr = FakeXhr.last;
    expect(xhr?.open).toHaveBeenCalledWith('POST', PARAMS.uploadUrl);
    const sent = xhr?.send.mock.calls[0]?.[0];
    expect(sent).toBeInstanceOf(FormData);
    expect((sent as FormData).get('public_id')).toBe('pid-1');

    xhr?.respond(200, JSON.stringify({ public_id: 'tourism/tours/t-1/pid-1' }));

    await expect(pending).resolves.toBe('tourism/tours/t-1/pid-1');
  });

  it('báo tiến độ 0–100 làm tròn; bỏ qua sự kiện không đo được', async () => {
    const onProgress = vi.fn();
    const pending = uploadToCloudinary(new Blob(['x']), PARAMS, publicIdOnly, { onProgress });
    const xhr = FakeXhr.last;

    xhr?.progressListener?.({ lengthComputable: false, loaded: 5, total: 0 });
    xhr?.progressListener?.({ lengthComputable: true, loaded: 1, total: 3 });
    xhr?.progressListener?.({ lengthComputable: true, loaded: 3, total: 3 });
    xhr?.respond(200, JSON.stringify({ public_id: 'p' }));

    await pending;
    expect(onProgress.mock.calls).toEqual([[33], [100]]);
  });

  it('mã lỗi, `parse` trả null hay body không phải JSON đều reject — caller không treo', async () => {
    const failed = uploadToCloudinary(new Blob(['x']), PARAMS, publicIdOnly);
    FakeXhr.last?.respond(401, JSON.stringify({ error: { message: 'Invalid Signature' } }));
    await expect(failed).rejects.toThrow('Cloudinary upload failed (401)');

    const unreadable = uploadToCloudinary(new Blob(['x']), PARAMS, publicIdOnly);
    FakeXhr.last?.respond(200, JSON.stringify({ public_id: '' }));
    await expect(unreadable).rejects.toThrow('Cloudinary upload failed (200)');

    const notJson = uploadToCloudinary(new Blob(['x']), PARAMS, publicIdOnly);
    FakeXhr.last?.respond(200, '<html>gateway</html>');
    await expect(notJson).rejects.toThrow('invalid response');
  });

  it('lỗi mạng thì reject', async () => {
    const pending = uploadToCloudinary(new Blob(['x']), PARAMS, publicIdOnly);
    FakeXhr.last?.fire('error');
    await expect(pending).rejects.toThrow('network');
  });

  it('lượt POST có hạn giờ; hết giờ thì reject — dòng tải không treo mãi (vòng review F18)', async () => {
    const pending = uploadToCloudinary(new Blob(['x']), PARAMS, publicIdOnly);
    expect(FakeXhr.last?.timeout).toBe(UPLOAD_TIMEOUT_MS);

    FakeXhr.last?.fire('timeout');

    await expect(pending).rejects.toThrow('timeout');
  });

  it('huỷ qua AbortSignal: gọi xhr.abort() rồi reject', async () => {
    const controller = new AbortController();
    const pending = uploadToCloudinary(new Blob(['x']), PARAMS, publicIdOnly, {
      signal: controller.signal,
    });

    controller.abort();

    expect(FakeXhr.last?.abort).toHaveBeenCalledTimes(1);
    await expect(pending).rejects.toThrow('aborted');
  });

  it('signal đã huỷ từ trước: reject ngay, không mở request nào', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      uploadToCloudinary(new Blob(['x']), PARAMS, publicIdOnly, { signal: controller.signal }),
    ).rejects.toThrow('aborted');
    expect(FakeXhr.last).toBeNull();
  });
});
