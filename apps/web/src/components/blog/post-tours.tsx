import { messages } from '@tourism/i18n';
import { RelatedTours } from '@/components/tours/related-tours';
import type { TourCardVM } from '@/lib/api/tours';

/**
 * Khối "Tours in this story" cuối bài (ADR-0051 §5): tour admin gắn với bài, theo thứ tự
 * admin xếp — API công khai đã bỏ tour đang tắt bán. Rỗng thì không vẽ gì, kể cả tiêu đề:
 * một tiêu đề không có card nào bên dưới là lời hứa suông. Khung và tiêu đề cùng khuôn khối
 * "More from the journal" ngay dưới nó.
 */
export function PostTours({ tours }: { tours: TourCardVM[] }) {
  if (tours.length === 0) return null;

  return (
    <section
      aria-labelledby="post-tours-heading"
      className="w-full px-4 pb-16 md:px-16 lg:px-24 xl:px-32"
    >
      <div className="mx-auto max-w-7xl">
        <h2
          id="post-tours-heading"
          className="mb-8 font-heading text-2xl font-medium text-foreground"
        >
          {messages.blog.toursHeading}
        </h2>
        <RelatedTours tours={tours} />
      </div>
    </section>
  );
}
