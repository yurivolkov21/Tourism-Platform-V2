import type { MockJournalPost } from './types.js';

// Ứng viên schema khi gắn API (tiền đề hệ blogs như Nexora): bảng blog_posts
// (slug · title · excerpt · category · author · published_at · read_minutes ·
// hero_image) — shape này là bản nháp khám phá, chốt lúc reconcile Prisma.
export const JOURNAL_POSTS: MockJournalPost[] = [
  {
    slug: 'what-to-pack-for-the-mist-season',
    title: 'What to pack for the mist season',
    excerpt:
      'A light jacket, real shoes, and patience. The terraces reward all three — our guides share their honest checklist.',
    date: '2026-10-02',
    readMinutes: 6,
    image: '/mock/journal-mist.jpg',
    category: 'Packing',
    author: 'Mai — Sa Pa guide',
  },
  {
    slug: 'eating-your-way-through-hoi-an',
    title: 'Eating your way through Hoi An',
    excerpt:
      'Cao lầu at a market stall, bánh mì by the river, and the one dessert locals queue for after dark.',
    date: '2026-09-18',
    readMinutes: 8,
    image: '/mock/hoian.jpg',
    category: 'Food',
    author: 'Linh — Hội An guide',
  },
  {
    slug: 'floating-markets-before-sunrise',
    title: 'Floating markets before sunrise',
    excerpt:
      'Why the Mekong wakes up at 4am, and how to see Cái Răng the way traders do — from the water, with coffee.',
    date: '2026-08-30',
    readMinutes: 5,
    image: '/mock/mekong.jpg',
    category: 'Markets',
    author: 'Tâm — Cần Thơ guide',
  },
];
