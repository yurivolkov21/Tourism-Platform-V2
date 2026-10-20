import { buildUploadFields, UPLOAD_TIMEOUT_MS, uploadToCloudinary } from './media-upload';

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

describe('buildUploadFields', () => {
  it('trả ĐÚNG bộ field chữ ký phủ — không kèm file (RN FormData không .get() được)', () => {
    const fields = buildUploadFields(PARAMS);
    expect(fields).toEqual({
      api_key: 'key',
      timestamp: '1760000000',
      signature: 'sig',
      folder: 'tourism/avatars/u-1',
      public_id: 'pid-1',
      allowed_formats: 'jpg,jpeg,png,webp,avif,gif',
      transformation: 'c_limit,w_2400,h_2400,fl_force_strip',
      overwrite: 'false',
    });
  });
});

/** XHR giả: ghi lại `timeout` được đặt và cho test tự phát sự kiện như mạng thật. */
class FakeXhr {
  static last: FakeXhr | null = null;
  timeout = 0;
  status = 0;
  responseText = '';
  private listeners = new Map<string, () => void>();
  constructor() {
    FakeXhr.last = this;
  }
  open() {}
  send() {}
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, listener);
  }
  emit(type: string) {
    this.listeners.get(type)?.();
  }
}

describe('uploadToCloudinary — mạng treo không được để spinner quay mãi', () => {
  const realXhr = globalThis.XMLHttpRequest;
  beforeEach(() => {
    globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  });
  afterEach(() => {
    globalThis.XMLHttpRequest = realXhr;
  });

  it('đặt trần thời gian cho cả lượt upload', () => {
    void uploadToCloudinary('file:///a.jpg', 'jpg', PARAMS);
    expect(FakeXhr.last?.timeout).toBe(UPLOAD_TIMEOUT_MS);
  });

  it('hết giờ → reject (ô ảnh chuyển sang lỗi thay vì quay mãi)', async () => {
    const upload = uploadToCloudinary('file:///a.jpg', 'jpg', PARAMS);
    FakeXhr.last?.emit('timeout');
    await expect(upload).rejects.toThrow('timeout');
  });

  it('bị huỷ giữa chừng → reject, không treo', async () => {
    const upload = uploadToCloudinary('file:///a.jpg', 'jpg', PARAMS);
    FakeXhr.last?.emit('abort');
    await expect(upload).rejects.toThrow('aborted');
  });

  it('2xx có public_id → trả public_id', async () => {
    const upload = uploadToCloudinary('file:///a.jpg', 'jpg', PARAMS);
    const xhr = FakeXhr.last as FakeXhr;
    xhr.status = 200;
    xhr.responseText = JSON.stringify({ public_id: 'tourism/avatars/u-1/pid-1' });
    xhr.emit('load');
    await expect(upload).resolves.toBe('tourism/avatars/u-1/pid-1');
  });
});
