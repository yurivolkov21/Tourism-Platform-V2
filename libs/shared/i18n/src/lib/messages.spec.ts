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

  it('có đủ tiêu đề cho 11 màn của cây route template', () => {
    expect(Object.keys(shell.titles)).toHaveLength(11);
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
