import {
  abandonPendingReturn,
  clearPendingReturn,
  consumePendingReplay,
  consumeReturnPath,
  peekReturnPath,
  setPendingReturn,
} from './return-to';

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

  it('consumePendingReplay xoá hẳn replay — gọi lần hai trả undefined', () => {
    setPendingReturn({ path: '/tours/hoi-an', replay: { kind: 'wishlist', tourId: 't1' } });
    consumePendingReplay();
    expect(consumePendingReplay()).toBeUndefined();
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

  it('clearPendingReturn xoá sạch entry đã set — consumeReturnPath trả null sau đó', () => {
    setPendingReturn({ path: '/tours/hoi-an', replay: { kind: 'wishlist', tourId: 't1' } });
    clearPendingReturn();
    expect(consumeReturnPath()).toBeNull();
    expect(consumePendingReplay()).toBeUndefined();
  });

  // F1 (review 06/10): rời nhóm (auth) bằng back/vuốt không qua nút X — lượt
  // đăng nhập SAU (mở từ chỗ không đặt pending) không được nhặt lại đích cũ.
  it('abandonPendingReturn khi CHƯA đăng nhập xong: dọn sạch cả path lẫn replay', () => {
    setPendingReturn({ path: '/tours/hoi-an', replay: { kind: 'wishlist', tourId: 't1' } });
    abandonPendingReturn();
    expect(consumeReturnPath()).toBeNull();
    expect(consumePendingReplay()).toBeUndefined();
  });

  it('abandonPendingReturn SAU khi đăng nhập xong: giữ replay cho màn đích', () => {
    setPendingReturn({ path: '/tours/hoi-an', replay: { kind: 'wishlist', tourId: 't1' } });
    expect(consumeReturnPath()).toBe('/tours/hoi-an');
    // Nhóm (auth) unmount NGAY sau `router.replace` — màn đích chưa chắc đã
    // kịp đọc replay.
    abandonPendingReturn();
    expect(consumePendingReplay()).toEqual({ kind: 'wishlist', tourId: 't1' });
  });

  it('màn đích đọc replay TRƯỚC khi chặng auth đọc path: path vẫn còn nguyên', () => {
    setPendingReturn({ path: '/tours/hoi-an', replay: { kind: 'wishlist', tourId: 't1' } });
    expect(consumePendingReplay()).toEqual({ kind: 'wishlist', tourId: 't1' });
    expect(consumeReturnPath()).toBe('/tours/hoi-an');
  });

  it('consumeReturnPath chỉ trả path MỘT lần', () => {
    setPendingReturn({ path: '/(tabs)/saved' });
    expect(consumeReturnPath()).toBe('/(tabs)/saved');
    expect(consumeReturnPath()).toBeNull();
  });

  // D3: Explore và tour detail cùng mount (tab giữ mount, tour detail đè lên)
  // và cùng đọc replay khi `signedIn` bật — màn nào KHÔNG phải chủ thì không
  // được nuốt mất replay của màn kia.
  it('consumePendingReplay có điều kiện: không khớp thì KHÔNG xoá, màn đúng vẫn đọc được', () => {
    setPendingReturn({
      path: '/explore',
      replay: { kind: 'wishlist', tourId: 't1', from: 'explore' },
    });

    expect(consumePendingReplay((r) => r.from === 'tour-detail')).toBeUndefined();
    expect(consumePendingReplay((r) => r.from === 'explore')).toEqual({
      kind: 'wishlist',
      tourId: 't1',
      from: 'explore',
    });
    expect(consumePendingReplay()).toBeUndefined();
  });

  it('peekReturnPath đọc path mà KHÔNG đánh dấu đã đăng nhập xong', () => {
    setPendingReturn({ path: '/tours/hoi-an', replay: { kind: 'wishlist', tourId: 't1' } });

    expect(peekReturnPath()).toBe('/tours/hoi-an');
    expect(peekReturnPath()).toBe('/tours/hoi-an');
    // Vẫn là "chưa đăng nhập xong" — rời nhóm auth thì dọn cả replay.
    abandonPendingReturn();
    expect(consumePendingReplay()).toBeUndefined();
  });
});
