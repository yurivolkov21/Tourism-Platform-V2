import { readEnv } from './env';

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
