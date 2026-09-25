import { consumePendingReplay, consumeReturnPath, setPendingReturn } from './return-to';

describe('return-to', () => {
  it('chưa set gì: consumeReturnPath trả null, consumePendingReplay trả undefined', () => {
    expect(consumeReturnPath()).toBeNull();
    expect(consumePendingReplay()).toBeUndefined();
  });

  it('set rồi consumeReturnPath: trả đúng path, KHÔNG xoá replay', () => {
    setPendingReturn({ path: '/tours/hoi-an', replay: { kind: 'wishlist', tourId: 't1' } });
    expect(consumeReturnPath()).toBe('/tours/hoi-an');
    // replay còn nguyên sau khi đọc path — hai hàm đọc độc lập.
    expect(consumePendingReplay()).toEqual({ kind: 'wishlist', tourId: 't1' });
  });

  it('consumePendingReplay xoá hẳn — gọi lần hai trả undefined', () => {
    setPendingReturn({ path: '/tours/hoi-an', replay: { kind: 'wishlist', tourId: 't1' } });
    consumePendingReplay();
    expect(consumePendingReplay()).toBeUndefined();
    expect(consumeReturnPath()).toBeNull();
  });

  it('set không có replay: consumePendingReplay trả undefined', () => {
    setPendingReturn({ path: '/(tabs)/saved' });
    expect(consumeReturnPath()).toBe('/(tabs)/saved');
    expect(consumePendingReplay()).toBeUndefined();
  });

  it('set lần hai ĐÈ lần một (chưa consume gì)', () => {
    setPendingReturn({ path: '/(tabs)/saved' });
    setPendingReturn({ path: '/(tabs)/account' });
    expect(consumeReturnPath()).toBe('/(tabs)/account');
  });
});
