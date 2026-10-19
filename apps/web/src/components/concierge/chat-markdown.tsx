import { Typeset } from '@tourism/ui/components/typeset';
import Link from 'next/link';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Chỉ đường dẫn nội bộ của site (`/tours/…`). `//host` bị loại: trình duyệt đọc nó thành
 * địa chỉ không kèm scheme, tức là một host lạ. `/\host` cũng vậy, nhưng markdown đã mã
 * hoá `\` thành `%5C` trước khi tới đây (đo bằng test), nên vế ấy chỉ là lưới thứ hai.
 */
function isInternal(href: string | undefined): href is string {
  return typeof href === 'string' && /^\/(?![/\\])/.test(href);
}

/**
 * Câu trả lời của trợ lý (spec §2h). Model đọc kết quả tool và tin khách, nên chữ nó viết
 * có thể mang link do prompt injection cài vào: chỉ link nội bộ thành `Link`, link khác
 * chỉ còn chữ. Không nhận HTML, không tải ảnh.
 */
export function ChatMarkdown({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  return (
    <Typeset preset="chat">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) =>
            isInternal(href) ? (
              <Link href={href} onClick={onNavigate}>
                {children}
              </Link>
            ) : (
              <span>{children}</span>
            ),
          img: ({ alt }) => alt ?? null,
        }}
      >
        {text}
      </Markdown>
    </Typeset>
  );
}
