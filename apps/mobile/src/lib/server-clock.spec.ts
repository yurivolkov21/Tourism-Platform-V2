import { clockOffsetMs, serverNow } from './server-clock';

describe('clockOffsetMs', () => {
  it('server đi nhanh hơn máy 5 phút → lệch dương', () => {
    const clientNowMs = Date.parse('2026-10-02T00:00:00.000Z');
    const serverTimestamp = '2026-10-02T00:05:00.000Z';
    expect(clockOffsetMs(serverTimestamp, clientNowMs)).toBe(5 * 60_000);
  });

  it('đồng hồ máy chỉnh sai 10 ngày (học sinh chỉnh khi chấm) → lệch âm đúng 10 ngày', () => {
    const clientNowMs = Date.parse('2026-10-12T00:00:00.000Z');
    const serverTimestamp = '2026-10-02T00:00:00.000Z';
    expect(clockOffsetMs(serverTimestamp, clientNowMs)).toBe(-10 * 86_400_000);
  });
});

describe('serverNow', () => {
  it('offset=0 thì bằng giờ máy', () => {
    expect(serverNow(0, 1000).getTime()).toBe(1000);
  });

  it('cộng offset vào giờ máy hiện tại', () => {
    expect(serverNow(5000, 1000).getTime()).toBe(6000);
  });
});
