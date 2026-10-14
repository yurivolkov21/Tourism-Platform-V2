import { flattenWishlistPages, nextWishlistPage, wishlistCount } from './wishlist-pages';

describe('nextWishlistPage', () => {
  it('còn trang thì trả số trang kế', () => {
    expect(nextWishlistPage({ page: 1, totalPages: 3 })).toBe(2);
  });

  it('trang cuối thì trả undefined — TanStack Query hiểu là hết trang', () => {
    expect(nextWishlistPage({ page: 3, totalPages: 3 })).toBeUndefined();
  });

  it('wishlist rỗng (totalPages 0) cũng là hết trang', () => {
    expect(nextWishlistPage({ page: 1, totalPages: 0 })).toBeUndefined();
  });
});

describe('flattenWishlistPages', () => {
  it('nối item các trang theo đúng thứ tự', () => {
    const pages = [{ items: [{ tourId: 't1' }, { tourId: 't2' }] }, { items: [{ tourId: 't3' }] }];

    expect(flattenWishlistPages(pages).map((item) => item.tourId)).toEqual(['t1', 't2', 't3']);
  });

  // L5: khách lưu thêm tour giữa lúc đang tải trang 2 → danh sách (mới nhất
  // trước) dịch xuống một ô, mục cuối trang 1 lặp lại ở đầu trang 2.
  it('bỏ mục trùng tourId, giữ lần xuất hiện đầu', () => {
    const pages = [
      { items: [{ tourId: 't1', title: 'a' }] },
      {
        items: [
          { tourId: 't1', title: 'b' },
          { tourId: 't2', title: 'c' },
        ],
      },
    ];

    expect(flattenWishlistPages(pages)).toEqual([
      { tourId: 't1', title: 'a' },
      { tourId: 't2', title: 'c' },
    ]);
  });

  it('chưa có trang nào thì trả mảng rỗng', () => {
    expect(flattenWishlistPages(undefined)).toEqual([]);
  });
});

// N9 (rà 07/10): wishlist 150 mục từng đếm "100 tours" suốt lúc trang 2 đang về.
describe('wishlistCount', () => {
  it('còn trang chưa về thì đếm theo total của server, không theo số mục đã tải', () => {
    expect(wishlistCount([{ total: 150 }], true, 100, 100)).toBe(150);
  });

  it('còn trang chưa về: trừ các mục khách vừa bỏ lưu trong số đã tải', () => {
    expect(wishlistCount([{ total: 150 }], true, 100, 98)).toBe(148);
  });

  it('đọc total của trang mới nhất (wishlist đổi giữa hai lần tải trang)', () => {
    expect(wishlistCount([{ total: 250 }, { total: 251 }], true, 200, 200)).toBe(251);
  });

  it('đã tải hết trang thì đếm số mục đang hiện', () => {
    expect(wishlistCount([{ total: 150 }, { total: 150 }], false, 150, 149)).toBe(149);
  });

  it('chưa có trang nào thì đếm số mục đang hiện', () => {
    expect(wishlistCount(undefined, false, 0, 0)).toBe(0);
  });

  it('không bao giờ đếm ít hơn số thẻ đang hiện', () => {
    expect(wishlistCount([{ total: 90 }], true, 100, 100)).toBe(100);
  });
});
