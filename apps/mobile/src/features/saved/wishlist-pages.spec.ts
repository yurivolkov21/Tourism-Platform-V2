import { flattenWishlistPages, nextWishlistPage } from './wishlist-pages';

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
