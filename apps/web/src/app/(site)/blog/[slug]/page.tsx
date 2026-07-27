import { Typeset } from '@tourism/ui/components/typeset';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostCard } from '@/components/blog/post-card';
import { PostHero } from '@/components/blog/post-hero';
import { PostNav } from '@/components/blog/post-nav';
import { ShareRow } from '@/components/blog/share-row';
import { OnThisPage } from '@/components/content/on-this-page';
import { ReadingProgress } from '@/components/content/reading-progress';
import { Reveal } from '@/components/motion/reveal';
import { adjacentPosts, relatedPosts } from '@/lib/blog';
import { absoluteUrl } from '@/lib/site';
import { slugify } from '@/lib/slug';
import { tocFromSections } from '@/lib/toc';
import { JOURNAL_POSTS } from '@/mocks/journal';

// Sinh sẵn 9 slug lúc build; slug lạ rơi vào notFound() → trang 404 của cụm
// pháp lý đón. Thân bài dùng ĐÚNG khuôn LegalArticle nên /blog/[slug] và
// /terms là anh em cùng bộ xương.
export function generateStaticParams() {
  return JOURNAL_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = JOURNAL_POSTS.find((p) => p.slug === slug);
  if (!post) return { title: 'Post not found — Tourism' };
  return {
    title: `${post.title} — Tourism`,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = JOURNAL_POSTS.find((p) => p.slug === slug);
  if (!post) notFound();

  const toc = tocFromSections(post.sections);
  // Điều hướng cuối bài + gợi ý bài liên quan — cùng nguồn JOURNAL_POSTS,
  // logic thuần đã có test riêng ở lib/blog.spec.ts.
  const { newer, older } = adjacentPosts(JOURNAL_POSTS, slug);
  const more = relatedPosts(JOURNAL_POSTS, slug, 3);

  // JSON-LD dựng từ mock TĨNH, escape `<` để không thoát khỏi thẻ script —
  // cùng pattern an toàn với trang /faq.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    ...(post.updated ? { dateModified: post.updated } : {}),
    author: { '@type': 'Person', name: post.author },
    // Schema.org cần URL tuyệt đối cho ảnh, không phải đường dẫn tương đối.
    image: absoluteUrl(post.image),
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
                  class `.lead` cũ không có rule nào định nghĩa, chỉ nằm chết */}
              <p className="text-lg">{post.excerpt}</p>
            </Typeset>

            <div className="mt-12 divide-y divide-border border-t border-border">
              {post.sections.map((section, i) => (
                <section
                  key={section.heading}
                  id={slugify(section.heading)}
                  className="scroll-mt-28 py-10"
                >
                  <Reveal>
                    <div className="mb-4 flex items-baseline gap-4">
                      <span className="font-mono text-xs tabular-nums text-primary">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h2 className="font-heading text-2xl leading-snug font-medium text-balance text-foreground">
                        {section.heading}
                      </h2>
                    </div>

                    <Typeset preset="reading" className="text-muted-foreground">
                      {section.paragraphs?.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                      {section.bullets ? (
                        <ul>
                          {section.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      ) : null}
                    </Typeset>
                  </Reveal>
                </section>
              ))}
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
