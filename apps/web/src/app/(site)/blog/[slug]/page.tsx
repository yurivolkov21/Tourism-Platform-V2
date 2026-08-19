import { Typeset } from '@tourism/ui/components/typeset';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostCard } from '@/components/blog/post-card';
import { PostHero } from '@/components/blog/post-hero';
import { PostNav } from '@/components/blog/post-nav';
import { ShareRow } from '@/components/blog/share-row';
import { ArticleMarkdown } from '@/components/content/article-markdown';
import { OnThisPage } from '@/components/content/on-this-page';
import { ReadingProgress } from '@/components/content/reading-progress';
import { fetchPostDetail, fetchPosts } from '@/lib/api/posts';
import { adjacentPosts, relatedPosts } from '@/lib/blog';
import { absoluteUrl } from '@/lib/site';
import { tocFromMarkdown } from '@/lib/toc';

export const revalidate = 300;

// Sinh sẵn slug lúc build từ API THẬT (ADR-0016 §3), KHÔNG settle lỗi ở đây:
// fetch hỏng lúc build phải ném ra ngoài → build fail TO TIẾNG. Settle êm ở
// đây là slug rỗng âm thầm → sitemap/ISR rỗng âm thầm, lỗi chỉ lộ ra khi
// người dùng vào trang 404 nhầm chỗ. Slug lạ ngoài danh sách này vẫn rơi vào
// notFound() bên dưới — trang 404 của cụm pháp lý đón. Thân bài dùng ĐÚNG
// khuôn LegalArticle nên /blog/[slug] và /terms là anh em cùng bộ xương.
export async function generateStaticParams() {
  const posts = await fetchPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // React cache() dedupe: cùng slug với thân trang bên dưới chỉ tốn một fetch.
  const post = await fetchPostDetail(slug);
  if (!post) return { title: 'Post not found — Nexora' };
  // excerpt có thể là '' (VM map null → '' — xem lib/api/posts.ts) — bỏ hẳn
  // field description thay vì phát chuỗi rỗng, để Next tự fallback im lặng
  // thay vì render <meta description=""> vô nghĩa.
  return {
    title: `${post.title} — Nexora`,
    ...(post.excerpt ? { description: post.excerpt } : {}),
    openGraph: {
      title: post.title,
      ...(post.excerpt ? { description: post.excerpt } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await fetchPostDetail(slug);
  if (!post) notFound();

  const toc = tocFromMarkdown(post.contentMarkdown);
  // Điều hướng cuối bài + gợi ý bài liên quan — cùng nguồn fetchPosts() (cùng
  // tag TAGS.POSTS với trang listing nên chung một fetch cache), logic thuần
  // đã có test riêng ở lib/blog.spec.ts.
  const posts = await fetchPosts();
  const { newer, older } = adjacentPosts(posts, slug);
  const more = relatedPosts(posts, slug, 3);

  // JSON-LD dựng từ dữ liệu API, escape `<` để không thoát khỏi thẻ script —
  // cùng pattern an toàn với trang /faq. VM không có `updated`/`image` (contract
  // không trả field này, và không bịa URL ảnh khi cover null) nên hai field đó
  // bị bỏ hẳn thay vì suy đoán.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    // excerpt rỗng thì bỏ field description luôn thay vì bịa chuỗi rỗng —
    // cùng nguyên tắc với field `image` bên trên (không suy đoán dữ liệu).
    ...(post.excerpt ? { description: post.excerpt } : {}),
    datePublished: post.date,
    author: { '@type': 'Person', name: post.author },
  };

  // BreadcrumbList 3 cấp khớp breadcrumb đang hiển thị ở PostHero:
  // Home → Journal → tiêu đề bài.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Journal', item: absoluteUrl('/blog') },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: absoluteUrl(`/blog/${post.slug}`),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: nội dung tĩnh của mình, đã escape `<`
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: nội dung tĩnh của mình, đã escape `<`
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <ReadingProgress />
      <PostHero post={post} />

      <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
        <div className="mx-auto flex max-w-7xl flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-16">
          <div className="min-w-0 max-w-[68ch]">
            <Typeset preset="reading" className="text-muted-foreground">
              {/* Câu mở đầu to hơn thân bài thật sự (token Tailwind text-lg) —
                  class `.lead` cũ không có rule nào định nghĩa, chỉ nằm chết.
                  VM trả '' khi excerpt null nên bọc điều kiện, không render
                  <p> rỗng. */}
              {post.excerpt ? <p className="text-lg">{post.excerpt}</p> : null}
            </Typeset>

            {/* ArticleMarkdown tự bọc Typeset riêng — thân bài từ nội dung
                markdown thật của API, khác ArticleBody (giữ nguyên cho cụm
                pháp lý — không đụng). */}
            <div className="mt-12">
              <ArticleMarkdown markdown={post.contentMarkdown} />
            </div>

            <ShareRow title={post.title} />
            <PostNav newer={newer} older={older} />
          </div>

          <aside className="order-first mb-12 lg:order-none lg:mb-0">
            <div className="max-h-64 overflow-y-auto lg:sticky lg:top-28 lg:max-h-none lg:overflow-visible">
              <OnThisPage items={toc} />
            </div>
          </aside>
        </div>
      </div>

      <section className="w-full px-4 pb-24 md:px-16 lg:px-24 xl:px-32">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-8 font-heading text-2xl font-medium text-foreground">
            More from the journal
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((related) => (
              <PostCard key={related.slug} post={related} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
