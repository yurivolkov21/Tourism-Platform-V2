import { readEnv, resolveDevApiUrl } from './env';

describe('readEnv', () => {
  it('trả nguyên giá trị khi có đủ hai biến', () => {
    const env = readEnv({
      EXPO_PUBLIC_API_URL: 'https://api.example.test',
      EXPO_PUBLIC_WEB_URL: 'https://www.example.test',
    });

    expect(env).toEqual({
      apiUrl: 'https://api.example.test',
      webUrl: 'https://www.example.test',
    });
  });

  it('ném lỗi kèm TÊN biến khi thiếu EXPO_PUBLIC_API_URL', () => {
    expect(() => readEnv({ EXPO_PUBLIC_WEB_URL: 'https://www.example.test' })).toThrow(
      /EXPO_PUBLIC_API_URL/,
    );
  });

  it('ném lỗi kèm TÊN biến khi thiếu EXPO_PUBLIC_WEB_URL', () => {
    expect(() => readEnv({ EXPO_PUBLIC_API_URL: 'https://api.example.test' })).toThrow(
      /EXPO_PUBLIC_WEB_URL/,
    );
  });

  it('coi chuỗi rỗng là THIẾU — nền tảng deploy gửi chuỗi rỗng khi ô bỏ trống', () => {
    expect(() =>
      readEnv({ EXPO_PUBLIC_API_URL: '', EXPO_PUBLIC_WEB_URL: 'https://www.example.test' }),
    ).toThrow(/EXPO_PUBLIC_API_URL/);
  });

  it('gom MỌI biến thiếu vào một lỗi thay vì báo lẻ từng cái', () => {
    expect(() => readEnv({})).toThrow(/EXPO_PUBLIC_API_URL.*EXPO_PUBLIC_WEB_URL/s);
  });

  it('ném lỗi khi URL không parse được — thiếu scheme là ca hay gặp nhất', () => {
    expect(() =>
      readEnv({
        EXPO_PUBLIC_API_URL: 'api.nexora-travel.agency',
        EXPO_PUBLIC_WEB_URL: 'https://www.example.test',
      }),
    ).toThrow(/EXPO_PUBLIC_API_URL không phải URL hợp lệ/);
  });

  // Android chặn cleartext mặc định từ targetSdk 28: một origin `http://` tới
  // host thật làm 100% request chết CÂM, không cảnh báo nào ở bất kỳ khâu nào.
  it('ném lỗi khi http trỏ host thật', () => {
    expect(() =>
      readEnv({
        EXPO_PUBLIC_API_URL: 'http://api.nexora-travel.agency',
        EXPO_PUBLIC_WEB_URL: 'https://www.example.test',
      }),
    ).toThrow(/phải dùng https/);
  });

  it('cho phép http khi là loopback — đó là môi trường thử, không phải deploy', () => {
    const env = readEnv({
      EXPO_PUBLIC_API_URL: 'http://localhost:3001',
      EXPO_PUBLIC_WEB_URL: 'http://127.0.0.1:3000',
    });

    expect(env.apiUrl).toBe('http://localhost:3001');
  });

  it('trả origin TRẦN — bỏ path, query và dấu / cuối', () => {
    const env = readEnv({
      EXPO_PUBLIC_API_URL: 'https://api.example.test/',
      EXPO_PUBLIC_WEB_URL: 'https://www.example.test/en?ref=x',
    });

    expect(env).toEqual({
      apiUrl: 'https://api.example.test',
      webUrl: 'https://www.example.test',
    });
  });
});

describe('resolveDevApiUrl', () => {
  // `hostUri` là host:cổng mà Metro phục vụ bundle. Điện thoại vừa tải bundle
  // qua đúng địa chỉ đó, nên nó tới được máy dev — nhưng CHỈ khi đó là IP LAN.
  it.each([
    // [mô tả, EXPO_PUBLIC_API_URL, hostUri của Metro, origin mong đợi]
    [
      'thay localhost bằng IP LAN của Metro',
      'http://localhost:3001',
      '192.168.0.143:8081',
      'http://192.168.0.143:3001',
    ],
    [
      'giữ cổng khai trong env, không ép 3001',
      'http://localhost:3002',
      '192.168.0.143:8081',
      'http://192.168.0.143:3002',
    ],
    [
      'coi 127.0.0.1 cũng là máy dev',
      'http://127.0.0.1:3001',
      '10.0.0.5:8081',
      'http://10.0.0.5:3001',
    ],
  ])('%s', (_, apiUrl, hostUri, expected) => {
    expect(resolveDevApiUrl(apiUrl, hostUri)).toBe(expected);
  });

  it.each([
    ['URL trỏ host thật (API đã deploy)', 'https://api.nexora-travel.agency', '192.168.0.143:8081'],
    [
      'chạy tunnel — ngrok chỉ chuyển cổng Metro',
      'http://localhost:3001',
      'abc-anonymous-8081.exp.direct',
    ],
    ['chạy --localhost — Metro cũng ở loopback', 'http://localhost:3001', '127.0.0.1:8081'],
    ['hostUri là IPv6', 'http://localhost:3001', '[fe80::1]:8081'],
    ['không có hostUri (bản phát hành)', 'http://localhost:3001', undefined],
    ['hostUri rỗng', 'http://localhost:3001', ''],
  ])('giữ nguyên env khi %s', (_, apiUrl, hostUri) => {
    expect(resolveDevApiUrl(apiUrl, hostUri)).toBe(apiUrl);
  });
});
