import { createSecureStorePackingListStore, toggleChecked } from './packing-list';

describe('toggleChecked', () => {
  it('chưa có thì thêm vào', () => {
    expect(toggleChecked([], 'ID or passport')).toEqual(['ID or passport']);
  });

  it('đã có thì bỏ ra', () => {
    expect(toggleChecked(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('createSecureStorePackingListStore', () => {
  it('chưa tích gì thì rỗng', async () => {
    const store = createSecureStorePackingListStore();
    await expect(store.getChecked('BK-PACK0001')).resolves.toEqual([]);
  });

  it('ghi rồi đọc lại đúng danh sách, theo ĐÚNG mã booking', async () => {
    const store = createSecureStorePackingListStore();
    await store.setChecked('BK-PACK0002', ['ID or passport', 'Modest dress']);

    await expect(store.getChecked('BK-PACK0002')).resolves.toEqual([
      'ID or passport',
      'Modest dress',
    ]);
    // Mã booking khác không dính ghi chú của mã này.
    await expect(store.getChecked('BK-PACK0003')).resolves.toEqual([]);
  });

  it('một bản dựng MỚI vẫn đọc lại được — sống qua "mở lạnh"', async () => {
    const first = createSecureStorePackingListStore();
    await first.setChecked('BK-PACK0004', ['Travel insurance']);

    const second = createSecureStorePackingListStore();
    await expect(second.getChecked('BK-PACK0004')).resolves.toEqual(['Travel insurance']);
  });
});
