import { ArrowUpRightIcon } from 'lucide-react';
import Link from 'next/link';
import { ImagePlaceholder } from '@/components/image-placeholder';
import type { JournalPost } from '@/lib/api/posts';

// Card bài viết dùng chung cho Home (teaser 3 bài, section Journal) và lưới
// /blog — Home là bản chuẩn (#33, convert forged/Blog), /blog kế thừa nguyên
// xi cùng một diện mạo, không rẽ nhánh riêng (task 3c mục 2 — user chỉ ra
// /blog trước đây tự vẽ card khác Home, phải đổi ngược lại).
// Card TRẦN: không viền, không nền bg-card, không nâng lên khi hover (thiết
// kế Home không có hộp để nâng — nâng sẽ trông sai). Ba tín hiệu hover: ảnh
// zoom, tiêu đề đổi màu + gạch chân, nút mũi tên sáng viền.
const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function PostCard({
  post,
  featured = false,
}: {
  post: JournalPost;
  /** Bài dẫn của /blog: chiếm 2 cột, ảnh cao hơn, tiêu đề lớn hơn. */
  featured?: boolean;
}) {
  // sm:col-span-2 ở dòng dưới KHÔNG có tác dụng khi card nằm trong BlogExplorer
  // (grid item thật là motion.div bọc ngoài, nó tự đặt class này). Giữ lại để
  // PostCard vẫn đúng nếu sau này được dùng làm grid item trực tiếp.
  return (
    <Link href={`/blog/${post.slug}`} className={`group block ${featured ? 'sm:col-span-2' : ''}`}>
      {/* Ảnh: placeholder + gradient chân + chip chuyên mục */}
      <div
        className={`relative mb-5 overflow-hidden rounded-2xl ${featured ? 'h-56 md:h-96' : 'h-56'}`}
      >
        {/* Trợ năng: KHÔNG dùng post.title làm label (trùng y hệt <h3> ngay
            dưới, trình đọc màn hình đọc tiêu đề bài hai lần liên tiếp) —
            cùng lỗi đã sửa ở PostHero, mô tả theo chuyên mục thay vào đó. */}
        <ImagePlaceholder
          label={`${post.category} · story photo`}
          className="h-full w-full transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-linear-to-t from-overlay/60 to-transparent" />
        <span className="absolute top-4 left-4 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold tracking-widest text-primary-foreground uppercase">
          {post.category}
        </span>
      </div>

      {/* Meta: chỉ còn ngày đăng. Chip "min read" đã BỎ (Task 7) — PostCardSchema
          (contract) không trả `content` cho item listing, nên readMinutes ở
          card chỉ tính được trên `excerpt` (vài chục từ) → gần như luôn ra
          "1 min read", một con số bịa. VM (`JournalPost.readMinutes`) vẫn giữ
          field này cho trang chi tiết, nơi có content thật để tính đúng. */}
      <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
        <time dateTime={post.date}>{DATE_FMT.format(new Date(post.date))}</time>
      </div>

      <h3
        className={`mb-3 line-clamp-2 font-heading leading-tight font-semibold text-foreground transition-colors duration-300 group-hover:text-primary-emphasis ${
          featured ? 'text-xl md:text-3xl' : 'text-xl'
        }`}
      >
        {/* Gạch chân chạy từ trái sang phải khi hover: nền gradient 1px cao lớn
            dần theo bề rộng, dùng currentColor nên tự ăn màu chữ hiện tại —
            không cần khai thêm token màu (tuân luật tokens-only). */}
        <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-no-repeat bg-left-bottom motion-safe:transition-[background-size] motion-safe:duration-300 group-hover:bg-[length:100%_1px]">
          {post.title}
        </span>
      </h3>

      <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {post.excerpt}
      </p>

      {/* Tác giả + nút tròn mũi tên */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{post.author}</span>
        <span className="flex size-8 items-center justify-center rounded-full border text-muted-foreground transition-all duration-300 group-hover:border-primary group-hover:text-primary-emphasis">
          <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
