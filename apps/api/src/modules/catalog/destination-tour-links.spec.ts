import { describe, expect, it } from 'vitest';
import { countLinkedTours, type TourLink, writtenTags } from './destination-tour-links.js';

/**
 * Logic THUẦN đọc liên kết tour của một điểm đến (ADR-0053 §5, nợ G5) — test được mà không
 * cần DB. Ca đắt nhất: liên kết mang `tour: null`, hình Prisma 7.8 trả về khi tour bị xoá
 * giữa hai câu đọc quan hệ (đo 05/10). Trước bản vá, cả hai hàm ném `TypeError` và lệnh
 * `list`/`update`/`setActive` của admin thành 500.
 */

describe('countLinkedTours', () => {
  it('tour đã đăng và tour mọi trạng thái đếm từ CÙNG một danh sách', () => {
    expect(
      countLinkedTours([
        { tour: { isPublished: true } },
        { tour: { isPublished: false } },
        { tour: { isPublished: true } },
      ]),
    ).toEqual({ tourCount: 2, linkedTourCount: 3 });
  });

  it('không liên kết nào thì cả hai số là 0', () => {
    expect(countLinkedTours([])).toEqual({ tourCount: 0, linkedTourCount: 0 });
  });

  it('liên kết mang `tour: null` (tour vừa bị xoá) không được đếm, và không ném lỗi', () => {
    expect(
      countLinkedTours([
        { tour: { isPublished: true } },
        { tour: null },
        { tour: { isPublished: false } },
      ]),
    ).toEqual({ tourCount: 1, linkedTourCount: 2 });
  });
});

describe('writtenTags', () => {
  it('`tours` cộng trang của mọi tour gắn điểm đến, không tag nào lặp', () => {
    expect(writtenTags([{ tour: { slug: 'a' } }, { tour: { slug: 'b' } }]).sort()).toEqual([
      'tour:a',
      'tour:b',
      'tours',
    ]);
  });

  it('không tour nào gắn thì chỉ còn `tours`', () => {
    expect(writtenTags([])).toEqual(['tours']);
  });

  it('liên kết mang `tour: null` bị bỏ qua — tour không còn thì không có trang nào để bust', () => {
    expect(writtenTags([{ tour: null }, { tour: { slug: 'a' } }]).sort()).toEqual([
      'tour:a',
      'tours',
    ]);
  });
});

describe('TourLink (review AL6)', () => {
  it('khai `tour` có thể null — đọc thẳng `.tour.slug` không qua được typecheck', () => {
    // Kiểu Prisma khai `tour` KHÔNG null nên `link.tour.slug` biên dịch êm rồi ném `TypeError`
    // đúng lúc tour bị xoá giữa hai câu đọc. `TourLink` khai đúng hình thật: gỡ `| null` khỏi nó
    // thì dòng `@ts-expect-error` dưới đây thừa và `pnpm typecheck` đỏ.
    const links: TourLink<{ slug: string }>[] = [{ tour: null }];
    // @ts-expect-error — `tour` có thể null: đọc qua `writtenTags`/`countLinkedTours`.
    const deref = () => links.map((link) => link.tour.slug);
    expect(deref).toThrow(TypeError);
    expect(writtenTags(links)).toEqual(['tours']);
  });
});
