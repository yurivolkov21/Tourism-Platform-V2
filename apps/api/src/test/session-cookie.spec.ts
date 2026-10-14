import { sessionCookie } from './session-cookie.js';

// Helper của int spec (G2) — logic thuần nên có spec unit riêng, chạy không cần Postgres.
describe('sessionCookie', () => {
  it('lấy cặp name=value của cookie phiên trong mảng set-cookie, bỏ thuộc tính phía sau', () => {
    const res = {
      headers: {
        'set-cookie': [
          'better-auth.session_data=xyz; Path=/; HttpOnly',
          'better-auth.session_token=abc.def; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax',
        ],
      },
    };

    expect(sessionCookie(res)).toBe('better-auth.session_token=abc.def');
  });

  it('nhận cả set-cookie dạng chuỗi đơn', () => {
    const res = { headers: { 'set-cookie': 'better-auth.session_token=abc.def; Path=/' } };

    expect(sessionCookie(res)).toBe('better-auth.session_token=abc.def');
  });

  it('không có cookie phiên thì ném lỗi kèm header thô — đăng nhập hỏng là đỏ ngay ở đây', () => {
    expect(() => sessionCookie({ headers: { 'set-cookie': ['theme=dark; Path=/'] } })).toThrow(
      'No session cookie in: ["theme=dark; Path=/"]',
    );
    expect(() => sessionCookie({ headers: {} })).toThrow('No session cookie in: undefined');
  });

  it('cookie phiên mà phần name=value rỗng thì ném lỗi thay vì gửi header cookie rỗng', () => {
    expect(() =>
      sessionCookie({ headers: { 'set-cookie': ['; better-auth.session_token=abc'] } }),
    ).toThrow('Malformed set-cookie');
  });
});
