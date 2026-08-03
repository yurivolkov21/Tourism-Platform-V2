import { describe, expect, it } from 'vitest';
import { nextPanelState, parseUnsubscribeParams } from './unsubscribe';

const VALID_ID = '11111111-1111-4111-8111-111111111111';

describe('parseUnsubscribeParams', () => {
  it('id + token hợp lệ → trả về {id, token}', () => {
    expect(parseUnsubscribeParams({ id: VALID_ID, token: 'abc' })).toEqual({
      id: VALID_ID,
      token: 'abc',
    });
  });

  it('thiếu id → null', () => {
    expect(parseUnsubscribeParams({ token: 'abc' })).toBeNull();
  });

  it('thiếu token → null', () => {
    expect(parseUnsubscribeParams({ id: VALID_ID })).toBeNull();
  });

  it('id không phải uuid → null', () => {
    expect(parseUnsubscribeParams({ id: 'not-a-uuid', token: 'abc' })).toBeNull();
  });

  it('không truyền gì → null', () => {
    expect(parseUnsubscribeParams({})).toBeNull();
  });
});

describe('nextPanelState', () => {
  // Chỉ 3 trạng thái panel có copy riêng trong `messages.unsubscribePage`
  // (`confirm`/`unsubscribed`/`alreadyUnsubscribed` — `invalidToken` nằm
  // NGOÀI panel, xử lý ở page.tsx). Không có copy "resubscribed" riêng
  // (chỉ có `toast.resubscribed`) vì token dùng lại được — resubscribe xong
  // quay về `confirm` để khách unsubscribe lại được nếu muốn (nút "Unsubscribe
  // me" hiện lại), toast "Welcome back" đủ báo hiệu khoảnh khắc đó.
  it('từ confirm, unsubscribe-success → unsubscribed', () => {
    expect(nextPanelState('confirm', 'unsubscribe-success')).toBe('unsubscribed');
  });

  it('từ alreadyUnsubscribed, resubscribe-success → confirm', () => {
    expect(nextPanelState('alreadyUnsubscribed', 'resubscribe-success')).toBe('confirm');
  });

  it('từ unsubscribed, resubscribe-success → confirm', () => {
    expect(nextPanelState('unsubscribed', 'resubscribe-success')).toBe('confirm');
  });
});
