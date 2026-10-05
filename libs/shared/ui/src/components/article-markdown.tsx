import { Typeset } from '@tourism/ui/components/typeset';
import { slugify } from '@tourism/ui/lib/slug';
import { isValidElement, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Đệ quy phẳng hoá children React về text thuần. react-markdown truyền
 * children của <h2> là string CHỈ KHI heading không có inline markdown; có
 * bold/italic/code/link thì children là mảng string + React element, và
 * String(children) trên mảng đó cho ra "[object Object]" (bug đã vá — coi
 * task-6-report.md mục "Fix sau review"). Hàm này lấy props.children đệ quy
 * của element để ra cùng text thuần mà headingPlainText() bên tocFromMarkdown
 * tạo ra từ text raw — hai phía PHẢI hội tụ trước khi slugify.
 */
function flattenToText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenToText).join('');
  if (isValidElement<{ children?: ReactNode; alt?: string }>(node)) {
    // <img> (từ ![alt](url)) không có children — ảnh đóng góp alt text vào
    // heading, hội tụ với headingPlainText() bên toc.ts xử `![alt](url)` -> alt.
    if (node.props.children === undefined && typeof node.props.alt === 'string') {
      return node.props.alt;
    }
    return flattenToText(node.props.children);
  }
  return '';
}

/** `href` đọc theo `base`; hỏng (chuỗi không thành URL) thì bỏ hẳn `href` thay vì đoán. */
function resolveHref(href: string | undefined, base: string): string | undefined {
  if (href === undefined) return undefined;
  try {
    return new URL(href, base).href;
  } catch {
    return undefined;
  }
}

/**
 * Thân bài markdown từ API (PostDetail.content — ADR-0016/spec §2D), render
 * trong Typeset preset reading (ADR-0012). H2 gắn id = slugify(text thuần đã
 * flatten) để khớp tocFromMarkdown. KHÔNG bật rehype-raw: content là dữ liệu
 * seed của mình nhưng giữ mặc định không-raw-HTML làm lưới (spec §6).
 *
 * Ở `@tourism/ui` từ P4e-4 (ADR-0051 §1): web vẽ bài bằng nó, tab Preview của admin cũng
 * vậy — hai nơi một bản, nên thứ admin xem trước là thứ khách sẽ đọc. Hai tuỳ chọn chỉ bản
 * xem trước dùng (vòng review P4e-4): tiền tố id heading, và gốc để đọc link tương đối.
 */
export function ArticleMarkdown({
  markdown,
  headingIdPrefix = '',
  linkBase,
}: {
  markdown: string;
  /**
   * Tiền tố id của H2. Bản xem trước của admin cần nó: heading "Post cover" mang id
   * `post-cover`, trùng id card ảnh bìa mà link của dải báo trỏ tới.
   */
  headingIdPrefix?: string;
  /**
   * Có thì link tương đối đọc theo gốc này và mở tab mới — bản xem trước của admin: link
   * `/tours/…` trỏ về site khách, bấm không rời trang sửa đang có chữ chưa lưu.
   */
  linkBase?: string;
}) {
  return (
    <Typeset preset="reading" className="text-muted-foreground">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 id={`${headingIdPrefix}${slugify(flattenToText(children))}`}>{children}</h2>
          ),
          // Thân bài không có ảnh (spec P4e-4 §2.4): contract chặn mọi `![`, đây là lưới thứ
          // hai cho nội dung sửa thẳng trong DB — không tải ảnh ngoài Cloudinary, in alt tại
          // chỗ. `alt` vẫn nằm trên props nên `flattenToText` cho heading ra cùng id như cũ.
          img: ({ alt }) => alt ?? null,
          ...(linkBase === undefined
            ? {}
            : {
                a: ({ href, children }) => (
                  <a href={resolveHref(href, linkBase)} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                ),
              }),
        }}
      >
        {markdown}
      </Markdown>
    </Typeset>
  );
}
