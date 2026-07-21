import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { PagedSchema, PostCardSchema, PostDetailSchema } from '@tourism/contract';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { MediaOwnerType, PostStatus } from '../../generated/prisma/enums.js';

/**
 * Integration (Docker PG, db tourism_test — xem vitest.int.config.ts).
 * Chốt `GET /api/posts` (spec §4.6, P3a-C W5): card gọn (KHÔNG content),
 * cover role hero, lọc published-quá-khứ (ADR-0004), tie-breaker sort ổn định,
 * lọc theo tag, search title.
 */

const AUTHOR_ID = '0bbb0001-0000-4000-8000-000000000001';
const now = Date.now();

const PagedCards = PagedSchema(PostCardSchema);

describe('posts integration (oRPC @Implement over Fastify) — GET /api/posts', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Thứ tự truncate theo chiều phụ thuộc FK; media_assets không có FK cứng
    // (ADR-0005) nên phải truncate riêng. `tour_categories CASCADE` kéo theo
    // `tours` (FK categoryId) rồi `post_tours` (FK cả hai chiều) — dọn sạch
    // fixture tour dùng cho test related tours (Task 5) mỗi lần chạy.
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE media_assets, post_tag_links, post_tags, posts, users, sessions, accounts, tour_categories CASCADE',
    );
    // Tác giả cố định — `name: null` cố ý để canh nhánh nullable
    // (User.name VarChar(120)?) không làm mapper vỡ hay parse output lỗi.
    await prisma.user.create({
      data: {
        id: AUTHOR_ID,
        email: 'blog-author@tourism.test',
        name: null,
        image: 'https://res.cloudinary.com/demo/image/upload/avatar-1.jpg',
      },
    });
    // 3 bài nền: published quá khứ (hiện), published tương lai (ẩn), DRAFT (ẩn).
    await prisma.post.createMany({
      data: [
        {
          id: 'c0000001-0000-4000-8000-000000000001',
          slug: 'bai-a',
          title: 'Bài A',
          excerpt: 'Trich doan A',
          content: 'noi dung A',
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(now - 86_400_000), // hôm qua
          authorId: AUTHOR_ID,
        },
        {
          id: 'c0000001-0000-4000-8000-000000000002',
          slug: 'bai-tuong-lai',
          title: 'Bài tương lai',
          content: 'x',
          status: PostStatus.PUBLISHED,
          publishedAt: new Date(now + 86_400_000), // ngày mai — chưa tới giờ hiện
          authorId: AUTHOR_ID,
        },
        {
          id: 'c0000001-0000-4000-8000-000000000003',
          slug: 'bai-nhap',
          title: 'Bài nháp',
          content: 'x',
          status: PostStatus.DRAFT,
          publishedAt: null,
          authorId: AUTHOR_ID,
        },
      ],
    });
    // Cover cho bai-a: MediaAsset ownerType POST role hero.
    await prisma.mediaAsset.create({
      data: {
        publicId: 'posts/bai-a-hero',
        type: 'IMAGE',
        ownerType: MediaOwnerType.POST,
        ownerId: 'c0000001-0000-4000-8000-000000000001',
        role: 'hero',
      },
    });
  });

  it('chỉ trả bài published-quá-khứ, đúng PostCardSchema, KHÔNG content', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/posts' });
    expect(res.statusCode).toBe(200);

    const paged = PagedCards.parse(res.json());
    expect(paged.items.map((p) => p.slug)).toEqual(['bai-a']);
    expect(paged.total).toBe(1);
    // Card gọn: parse bằng PostCardSchema (strip mode mặc định của Zod) đã
    // đảm bảo output không có field lạ dạng object thừa; khẳng định thêm
    // bằng cách nhìn raw JSON — nếu service lỡ trả `content` thì key này có
    // mặt trong response thô, PostCardSchema.parse sẽ không tự ý xoá nó vì
    // Zod object mặc định strip KHÔNG báo lỗi field thừa (nên phải tự kiểm).
    expect(res.json().items[0]).not.toHaveProperty('content');

    const card = paged.items[0];
    expect(card?.cover?.role).toBe('hero');
    expect(card?.excerpt).toBe('Trich doan A');
    // Author.name nullable → null (KHÔNG phải undefined) khi User.name null.
    expect(card?.author.name).toBeNull();
    expect(card?.author.avatarUrl).toBe(
      'https://res.cloudinary.com/demo/image/upload/avatar-1.jpg',
    );
  });

  it('tie-breaker: 2 bài cùng publishedAt sort ổn định theo id desc', async () => {
    const tieAt = new Date(now - 5 * 86_400_000);
    await prisma.post.createMany({
      data: [
        {
          id: 'c0000001-0000-4000-8000-000000000005', // id nhỏ hơn
          slug: 'bai-tie-1',
          title: 'Bài tie 1',
          content: 'x',
          status: PostStatus.PUBLISHED,
          publishedAt: tieAt,
          authorId: AUTHOR_ID,
        },
        {
          id: 'c0000001-0000-4000-8000-000000000006', // id lớn hơn → phải đứng trước
          slug: 'bai-tie-2',
          title: 'Bài tie 2',
          content: 'x',
          status: PostStatus.PUBLISHED,
          publishedAt: tieAt,
          authorId: AUTHOR_ID,
        },
      ],
    });

    const call = async () => {
      const res = await app.inject({ method: 'GET', url: '/api/posts' });
      return PagedCards.parse(res.json()).items.map((p) => p.slug);
    };

    const first = await call();
    // publishedAt desc: bai-a (mới nhất) trước, rồi 2 bài trùng publishedAt
    // theo id desc (bai-tie-2 > bai-tie-1).
    expect(first).toEqual(['bai-a', 'bai-tie-2', 'bai-tie-1']);

    const second = await call();
    expect(second).toEqual(first); // ổn định giữa 2 lần gọi
  });

  it('lọc theo ?tag=slug', async () => {
    // Bài published thêm, KHÔNG gắn tag — chứng minh filter thật sự loại trừ
    // (chứ không phải trùng hợp vì baseline chỉ có 1 bài hiện).
    await prisma.post.create({
      data: {
        id: 'c0000001-0000-4000-8000-000000000004',
        slug: 'bai-b',
        title: 'Bài B',
        content: 'x',
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(now - 2 * 86_400_000),
        authorId: AUTHOR_ID,
      },
    });
    const tag = await prisma.postTag.create({
      data: { slug: 'kinh-nghiem', name: 'Kinh nghiệm' },
    });
    await prisma.postTagLink.create({
      data: { postId: 'c0000001-0000-4000-8000-000000000001', tagId: tag.id },
    });

    const res = await app.inject({ method: 'GET', url: '/api/posts?tag=kinh-nghiem' });
    expect(res.statusCode).toBe(200);
    const paged = PagedCards.parse(res.json());
    expect(paged.total).toBe(1);
    expect(paged.items[0]?.slug).toBe('bai-a');
    expect(paged.items[0]?.tags).toEqual([{ slug: 'kinh-nghiem', name: 'Kinh nghiệm' }]);
  });

  it('search title case-insensitive substring', async () => {
    await prisma.post.create({
      data: {
        id: 'c0000001-0000-4000-8000-000000000004',
        slug: 'bai-b',
        title: 'Kham pha Ha Long Bay',
        content: 'x',
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(now - 2 * 86_400_000),
        authorId: AUTHOR_ID,
      },
    });

    const res = await app.inject({ method: 'GET', url: '/api/posts?search=HA LONG' });
    expect(res.statusCode).toBe(200);
    const paged = PagedCards.parse(res.json());
    expect(paged.total).toBe(1);
    expect(paged.items[0]?.slug).toBe('bai-b');

    const none = PagedCards.parse(
      (await app.inject({ method: 'GET', url: '/api/posts?search=khong-ton-tai-xyz' })).json(),
    );
    expect(none.total).toBe(0);
    expect(none.items).toEqual([]);
  });

  it('GET /api/posts/:slug trả detail đầy đủ + media + related tours (không media)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/posts/bai-a' });
    expect(res.statusCode).toBe(200);
    const detail = PostDetailSchema.parse(res.json());
    expect(detail.content).toBe('noi dung A');
    expect(detail.media.length).toBeGreaterThanOrEqual(1);
    // related tours là TourCard (không có field media) — parse đã đảm bảo.
  });

  it('bài DRAFT hoặc hẹn-giờ-tương-lai → 404 POST_NOT_FOUND (như không tồn tại)', async () => {
    for (const slug of ['bai-nhap', 'bai-tuong-lai']) {
      const res = await app.inject({ method: 'GET', url: `/api/posts/${slug}` });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'POST_NOT_FOUND', message: 'Post not found' });
    }
  });

  it('bài không tồn tại → cùng 404 POST_NOT_FOUND (không phân biệt với draft/tương lai)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/posts/khong-ton-tai-xyz' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'POST_NOT_FOUND' });
  });

  it('related tour bị unpublish → rớt âm thầm khỏi mảng, không 500', async () => {
    const category = await prisma.tourCategory.create({
      data: { slug: 'day', name: 'Day Tours' },
    });
    const tourVisible = await prisma.tour.create({
      data: {
        slug: 'tour-con-hien',
        title: 'Tour con hiển thị',
        categoryId: category.id,
        durationDays: 1,
        basePrice: '10.00',
        isPublished: true,
      },
    });
    const tourAnUnpublish = await prisma.tour.create({
      data: {
        slug: 'tour-bi-an',
        title: 'Tour bị ẩn',
        categoryId: category.id,
        durationDays: 2,
        basePrice: '20.00',
        isPublished: true,
      },
    });
    await prisma.postTour.createMany({
      data: [
        { postId: 'c0000001-0000-4000-8000-000000000001', tourId: tourVisible.id, order: 0 },
        { postId: 'c0000001-0000-4000-8000-000000000001', tourId: tourAnUnpublish.id, order: 1 },
      ],
    });
    // Unpublish sau khi đã pick — mô phỏng admin ẩn tour sau khi bài đã ra.
    await prisma.tour.update({ where: { id: tourAnUnpublish.id }, data: { isPublished: false } });

    const res = await app.inject({ method: 'GET', url: '/api/posts/bai-a' });
    expect(res.statusCode).toBe(200);
    const detail = PostDetailSchema.parse(res.json());
    expect(detail.relatedTours).toHaveLength(1);
    expect(detail.relatedTours[0]?.slug).toBe('tour-con-hien');
  });
});
