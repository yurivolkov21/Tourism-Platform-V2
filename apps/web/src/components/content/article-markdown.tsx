import { Typeset } from '@tourism/ui/components/typeset';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { slugify } from '@/lib/slug';

/**
 * Thân bài markdown từ API (PostDetail.content — ADR-0016/spec §2D), render
 * trong Typeset preset reading (ADR-0012). H2 gắn id = slugify(text) để khớp
 * tocFromMarkdown. KHÔNG bật rehype-raw: content là dữ liệu seed của mình
 * nhưng giữ mặc định không-raw-HTML làm lưới (spec §6).
 */
export function ArticleMarkdown({ markdown }: { markdown: string }) {
  return (
    <Typeset preset="reading" className="text-muted-foreground">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => <h2 id={slugify(String(children))}>{children}</h2>,
        }}
      >
        {markdown}
      </Markdown>
    </Typeset>
  );
}
