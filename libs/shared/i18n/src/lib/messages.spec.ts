import { messages } from './messages.js';

describe('messages: tourDetail', () => {
  it('tourDetail: mọi nhãn tab và copy modal đều có chữ', () => {
    const t = messages.tourDetail;
    expect(Object.values(t.tabs)).toHaveLength(5);
    for (const v of Object.values(t.tabs)) expect(v.trim().length).toBeGreaterThan(0);
    expect(t.dialogs.allDatesTitle.length).toBeGreaterThan(0);
    expect(t.dialogs.allReviewsTitle.length).toBeGreaterThan(0);
  });
});

describe('messages: mobile.appShell (P5a — vỏ điều hướng)', () => {
  const shell = messages.mobile.appShell;

  // 11 màn của template P5a, cộng ba màn P5b-1 thêm vào cụm auth (verify email,
  // reset password, màn kết quả), cộng đổi mật khẩu (A6, P5b-4).
  it('có đủ tiêu đề cho 15 màn của cây route', () => {
    expect(Object.keys(shell.titles)).toHaveLength(15);
  });

  it('mọi chuỗi trong appShell đều có chữ, không khoá nào rỗng', () => {
    const walk = (node: unknown): string[] =>
      typeof node === 'string' ? [node] : Object.values(node as object).flatMap(walk);

    for (const value of walk(shell)) expect(value.trim().length).toBeGreaterThan(0);
  });

  it('tiêu đề 5 tab DÙNG CHUNG chuỗi với nhãn thanh tab — một khái niệm một chữ', () => {
    expect(shell.titles.home).toBe(messages.mobile.tabs.home);
    expect(shell.titles.explore).toBe(messages.mobile.tabs.explore);
    expect(shell.titles.saved).toBe(messages.mobile.tabs.saved);
    expect(shell.titles.trips).toBe(messages.mobile.tabs.trips);
    expect(shell.titles.account).toBe(messages.mobile.tabs.account);
  });

  it('thanh tab đúng 5 nhãn', () => {
    expect(Object.keys(messages.mobile.tabs)).toHaveLength(5);
  });
});

describe('messages: mobile.auth (P5b-1 — cụm màn auth)', () => {
  /** Duyệt sâu mọi chuỗi trong một nhánh copy, trả về đường dẫn của chuỗi rỗng. */
  function emptyPaths(node: unknown, path: string): string[] {
    if (typeof node === 'string') return node.trim() === '' ? [path] : [];
    if (Array.isArray(node)) return node.flatMap((item, i) => emptyPaths(item, `${path}[${i}]`));
    if (node !== null && typeof node === 'object') {
      return Object.entries(node).flatMap(([key, value]) => emptyPaths(value, `${path}.${key}`));
    }
    return [];
  }

  it('mọi khoá đều có chữ, không khoá nào rỗng', () => {
    expect(emptyPaths(messages.mobile.auth, 'mobile.auth')).toEqual([]);
  });

  it('onboarding đúng ba trang, mỗi trang đủ địa danh, tiêu đề và mô tả', () => {
    const { pages } = messages.mobile.onboarding;

    expect(pages).toHaveLength(3);
    for (const page of pages) {
      expect(page.place.length).toBeGreaterThan(0);
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.body.length).toBeGreaterThan(0);
    }
  });

  it('có tiêu đề cho ba route mới của cụm auth', () => {
    const { titles } = messages.mobile.appShell;

    expect(titles.verifyEmail).toBeTruthy();
    expect(titles.resetPassword).toBeTruthy();
    expect(titles.success).toBeTruthy();
  });

  it('câu lỗi KHÔNG có bản riêng cho mobile — dùng chung với web', () => {
    // Bản chép thứ hai (`mobile.authErrors`) đã bị xoá ở P5b-1. Test này là thứ
    // giữ cho nó không mọc lại: hai client cùng API thì không được nói hai kiểu.
    expect('authErrors' in messages.mobile).toBe(false);
    expect(messages.authForms.errors.invalidCredentials).toBeTruthy();
    expect(messages.formErrors.email.invalid).toBeTruthy();
  });
});
