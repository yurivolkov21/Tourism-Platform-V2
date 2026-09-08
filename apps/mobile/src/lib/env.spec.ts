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
});
