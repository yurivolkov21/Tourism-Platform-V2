import {
  categoryFromEntryParams,
  destinationFromEntryParams,
  exploreEntryParams,
} from './explore-entry';

describe('exploreEntryParams (F5)', () => {
  it('có điểm đến: gửi slug kèm nonce', () => {
    expect(exploreEntryParams('hoi-an', '1')).toEqual({
      destination: 'hoi-an',
      category: '',
      nav: '1',
    });
  });

  it('"See all tours" (null): gửi destination rỗng để BỎ lọc cũ', () => {
    expect(exploreEntryParams(null, '2')).toEqual({ destination: '', category: '', nav: '2' });
  });
});

describe('destinationFromEntryParams (F5)', () => {
  it('không có destination: undefined — giữ nguyên lựa chọn hiện có', () => {
    expect(destinationFromEntryParams({})).toBeUndefined();
  });

  it('destination rỗng: null — bỏ lọc điểm đến', () => {
    expect(destinationFromEntryParams({ destination: '' })).toBeNull();
  });

  it('destination có slug: trả slug', () => {
    expect(destinationFromEntryParams({ destination: 'hoi-an' })).toBe('hoi-an');
  });

  it('khứ hồi với exploreEntryParams', () => {
    expect(destinationFromEntryParams(exploreEntryParams(null, '3'))).toBeNull();
    expect(destinationFromEntryParams(exploreEntryParams('da-lat', '4'))).toBe('da-lat');
  });
});

describe('categoryFromEntryParams', () => {
  it('chip danh mục ở chi tiết tour: lọc đúng danh mục, bỏ lọc điểm đến', () => {
    const params = exploreEntryParams(null, '4', 'trekking');
    expect(categoryFromEntryParams(params)).toBe('trekking');
    expect(destinationFromEntryParams(params)).toBeNull();
  });

  it('vào từ Home thì bỏ lọc danh mục cũ; vào bằng thanh tab thì giữ', () => {
    expect(categoryFromEntryParams(exploreEntryParams('hoi-an', '5'))).toBeNull();
    expect(categoryFromEntryParams({})).toBeUndefined();
  });
});
