import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module.js';
import { prisma } from '../../auth/auth.config.js';
import { MediaOwnerType, MediaRole, MediaType } from '../../generated/prisma/enums.js';
import { MediaGarbageService } from './media-garbage.service.js';

/**
 * Integration (Docker PG, db tourism_test) — hàng đợi dọn ảnh mồ côi
 * (ADR-0035).
 *
 * ## Cái gì test được ở đây, và cái gì cố ý KHÔNG
 *
 * `sweep` gọi Cloudinary thật khi một row đi tới bước xoá, nên bộ này chỉ
 * chạy những đường **dừng lại TRƯỚC** lời gọi ấy — và may thay đó đúng là
 * những đường mang rủi ro:
 *
 * - Phép kiểm tham chiếu (§2): nhánh giữ được ảnh đang sống. Đây là thứ đứng
 *   giữa một cái bug và việc xoá mất ảnh của trang đang chạy production.
 * - Lưới an toàn 7 ngày (§1): row mới không được đụng tới.
 * - Trần `attempts` (§5): row hỏng mãi không quay vòng vô hạn.
 *
 * Nhánh destroy thật thì `classifyDestroyResult` đã có unit test riêng, và
 * việc nó gọi đúng SDK là thứ chỉ chạy trên prod mới chứng minh được — cố ý
 * KHÔNG mock Cloudinary ở đây để bộ test không bao giờ trở thành lý do ai đó
 * tin rằng đường xoá "đã được kiểm".
 */
let service: MediaGarbageService;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  service = moduleRef.get(MediaGarbageService);
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE media_garbage, media_assets, users, sessions, accounts RESTART IDENTITY CASCADE',
  );
});

/** Đẩy `created_at` của một row lùi lại để nó vượt hạn chờ. */
async function ageRow(publicId: string, days: number): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE media_garbage SET created_at = now() - make_interval(days => ${days}) WHERE public_id = $1`,
    publicId,
  );
}

const NOW = new Date();

describe('enqueue', () => {
  it('ghi mỗi publicId một row', async () => {
    const count = await service.enqueue(prisma, ['tourism/reviews/BK-1/a', 'tourism/avatars/u/b']);

    expect(count).toBe(2);
    expect(await prisma.mediaGarbage.count()).toBe(2);
  });

  it('enqueue LẠI không làm mới đồng hồ — `skipDuplicates`, không upsert', async () => {
    // Ghi đè `created_at` mỗi lần enqueue lại là gia hạn vô thời hạn cho đúng
    // thứ ta đang cố dọn: sửa review nhiều lần sẽ đẩy hạn đi mãi.
    await service.enqueue(prisma, ['tourism/reviews/BK-1/a']);
    await ageRow('tourism/reviews/BK-1/a', 30);
    const before = await prisma.mediaGarbage.findFirstOrThrow();

    const count = await service.enqueue(prisma, ['tourism/reviews/BK-1/a']);
    const after = await prisma.mediaGarbage.findFirstOrThrow();

    expect(count).toBe(0);
    expect(after.createdAt.getTime()).toBe(before.createdAt.getTime());
  });

  it('danh sách rỗng là no-op, không đụng DB', async () => {
    expect(await service.enqueue(prisma, [])).toBe(0);
  });
});

describe('sweep — lưới an toàn', () => {
  it('row CHƯA quá hạn thì không đụng tới', async () => {
    await service.enqueue(prisma, ['tourism/reviews/BK-1/fresh']);

    expect((await service.sweep(NOW, 7)).resolved).toBe(0);
    expect(await prisma.mediaGarbage.count()).toBe(1);
  });

  it('ảnh VẪN CÒN trong media_assets thì HOÃN một kỳ — row ở lại, KHÔNG xoá', async () => {
    // Đường sống còn: `@@unique([ownerType, ownerId, publicId])` là per-owner
    // nên một publicId gắn được nhiều owner — "một owner buông" không bằng
    // "mồ côi". Cũng là ca tác giả gỡ ảnh rồi đổi ý gắn lại trong tuần chờ.
    //
    // HOÃN chứ không xoá row (ADR-0035 §AMEND 2): xoá row là mất dấu vĩnh
    // viễn — avatar/ảnh này đổi chỗ 60 ngày sau thì không còn gì theo dõi.
    const publicId = 'tourism/reviews/BK-1/still-used';
    await prisma.mediaAsset.create({
      data: {
        publicId,
        type: MediaType.IMAGE,
        ownerType: MediaOwnerType.REVIEW,
        ownerId: '00000000-0000-4000-8000-000000000001',
        role: MediaRole.gallery,
      },
    });
    await service.enqueue(prisma, [publicId]);
    await ageRow(publicId, 30);

    // Không ném ra ngoài = không lời gọi Cloudinary nào xảy ra: test này chạy
    // không có secret thật, nên chạm tới `destroyAsset` là nó sẽ đỏ.
    const report = await service.sweep(NOW, 7);
    expect(report).toMatchObject({ deferred: 1, resolved: 0, destroyed: 0, absent: 0 });
    const row = await prisma.mediaGarbage.findUniqueOrThrow({ where: { publicId } });
    // Đồng hồ đặt lại về `now`: kỳ sau mới hỏi lại.
    expect(row.createdAt.getTime()).toBe(NOW.getTime());
    expect(await prisma.mediaAsset.count()).toBe(1);
  });

  it('`requeue` đặt LẠI đồng hồ và xoá tiền sử hỏng — dùng khi tham chiếu thật sự bị gỡ', async () => {
    // Khác `enqueue` (lúc ký): cửa sổ 7 ngày §2 hứa là kể từ lúc ảnh MẤT chỗ
    // dùng, không phải kể từ lúc ký — nếu không, ảnh ký ngày 0 gỡ ngày 6 bị
    // xoá ngày 7.
    const publicId = 'tourism/reviews/BK-1/dropped';
    await service.enqueue(prisma, [publicId]);
    await ageRow(publicId, 30);
    await prisma.mediaGarbage.update({
      where: { publicId },
      data: { attempts: 3, lastError: 'cũ' },
    });

    await service.requeue(prisma, [publicId]);

    const row = await prisma.mediaGarbage.findUniqueOrThrow({ where: { publicId } });
    expect(NOW.getTime() - row.createdAt.getTime()).toBeLessThan(60_000);
    expect(row.attempts).toBe(0);
    expect(row.lastError).toBeNull();
    // Và vì đồng hồ mới đặt lại, sweep hôm nay KHÔNG đụng tới nó.
    expect((await service.sweep(NOW, 7)).resolved).toBe(0);
  });

  it('avatar đang dùng cũng được giữ, dù KHÔNG có row media_assets nào', async () => {
    // Lỗ phát hiện lúc thi công: `setAvatar` chỉ ghi một URL vào `users.image`.
    // Chỉ hỏi `media_assets` thì bộ dọn xoá đúng avatar khách đang dùng.
    const publicId = 'tourism/avatars/u-1/live';
    await prisma.user.create({
      data: {
        id: '00000000-0000-4000-8000-0000000000aa',
        email: 'avatar-live@tourism.test',
        name: 'Avatar Live',
        emailVerified: true,
        image: `https://res.cloudinary.com/demo/image/upload/${publicId}.jpg`,
      },
    });
    await service.enqueue(prisma, [publicId]);
    await ageRow(publicId, 30);

    expect((await service.sweep(NOW, 7)).deferred).toBe(1);
    expect(await prisma.mediaGarbage.count()).toBe(1);
  });

  it('row chạm trần `attempts` bị bỏ qua — không quay vòng vô hạn', async () => {
    const publicId = 'tourism/reviews/BK-1/broken';
    await service.enqueue(prisma, [publicId]);
    await ageRow(publicId, 30);
    await prisma.mediaGarbage.update({ where: { publicId }, data: { attempts: 5 } });

    expect((await service.sweep(NOW, 7)).resolved).toBe(0);
    // Row Ở LẠI: một publicId hỏng mãi là triệu chứng, xoá nó là xoá triệu chứng.
    expect(await prisma.mediaGarbage.count()).toBe(1);
  });
});
