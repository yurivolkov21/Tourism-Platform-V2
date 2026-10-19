import type { ContractProcedure, InferSchemaInput, InferSchemaOutput } from '@orpc/server';
import type {
  ActivityDetails,
  ActivityLoggedProcedure,
  ActivityTargetType,
  contract,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';

/**
 * Bảng mô tả từng lệnh ghi được ghi nhật ký (ADR-0061 §3, spec §3): đối tượng là gì, nhãn đọc được,
 * chi tiết nào. Kiểu `satisfies` đủ mọi khoá `log` của contract — thêm một lệnh `log` mà quên mô tả
 * là typecheck đỏ.
 *
 * Nhãn KHÔNG bao giờ là email, số điện thoại hay dữ liệu thanh toán của khách (ADR-0061 §6); chi
 * tiết chỉ là giá trị ngắn có kiểu, không chép chữ admin gõ (lý do khoá, lý do huỷ, nội dung note).
 */

type AdminRouter = (typeof contract)['admin'];

/** Thủ tục `contract.admin` theo khoá có dấu chấm (`'tours.setPublished'`). */
type ProcedureAt<K extends string, T = AdminRouter> = K extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? ProcedureAt<Rest, T[Head]>
    : never
  : K extends keyof T
    ? T[K]
    : never;

/** Input SAU khi oRPC kiểm (middleware nối sau chạy sau bước kiểm input). */
export type ActivityInput<K extends ActivityLoggedProcedure> =
  ProcedureAt<K> extends ContractProcedure<infer I, infer _O, infer _E, infer _M>
    ? InferSchemaOutput<I>
    : never;

/** Output handler trả về, TRƯỚC bước kiểm output (đúng thứ middleware nhận từ `next()`). */
export type ActivityOutput<K extends ActivityLoggedProcedure> =
  ProcedureAt<K> extends ContractProcedure<infer _I, infer O, infer _E, infer _M>
    ? InferSchemaInput<O>
    : never;

export interface ActivityTarget {
  type: ActivityTargetType;
  id: string;
  /** Nhãn chụp lúc ghi; null khi đối tượng không có nhãn được phép lưu (người nhận tin). */
  label: string | null;
}

/** Phần riêng của một dòng; người làm, khoá thao tác và khu vực do bộ ghi điền. */
export interface ActivityEntry {
  target: ActivityTarget | null;
  details?: ActivityDetails;
}

export interface ActivityDescriber<K extends ActivityLoggedProcedure> {
  /** Chỉ lệnh xoá: đọc nhãn TRƯỚC khi handler chạy, vì sau đó đối tượng không còn. */
  before?: (input: ActivityInput<K>) => Promise<string | null>;
  /** `null` = không ghi: output nói lệnh không đổi gì (`changed: false`). */
  describe: (args: {
    input: ActivityInput<K>;
    output: ActivityOutput<K>;
    before: string | null;
  }) => ActivityEntry | null | Promise<ActivityEntry | null>;
}

// ── Nhãn đọc từ DB khi input và output không mang sẵn ────────────────────────────────────────

async function tourTitle(id: string): Promise<string | null> {
  const row = await prisma.tour.findUnique({ where: { id }, select: { title: true } });
  return row?.title ?? null;
}

async function categoryName(id: string): Promise<string | null> {
  const row = await prisma.tourCategory.findUnique({ where: { id }, select: { name: true } });
  return row?.name ?? null;
}

async function destinationName(id: string): Promise<string | null> {
  const row = await prisma.destination.findUnique({ where: { id }, select: { name: true } });
  return row?.name ?? null;
}

async function postTitle(id: string): Promise<string | null> {
  const row = await prisma.post.findUnique({ where: { id }, select: { title: true } });
  return row?.title ?? null;
}

async function enquiryName(id: string): Promise<string | null> {
  const row = await prisma.enquiry.findUnique({ where: { id }, select: { name: true } });
  return row?.name ?? null;
}

/** Chuyến không có tên riêng: nhãn là tên tour của nó, ngày đi nằm ở `details`. */
async function departureTourTitle(id: string): Promise<string | null> {
  const row = await prisma.tourDeparture.findUnique({
    where: { id },
    select: { tour: { select: { title: true } } },
  });
  return row?.tour.title ?? null;
}

/** Tên hiển thị của tài khoản; trống thì không có nhãn — không bao giờ lấy email (spec §3). */
async function accountName(id: string): Promise<string | null> {
  const row = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  const name = row?.name?.trim();
  return name ? name : null;
}

// ── Bảng mô tả ───────────────────────────────────────────────────────────────────────────────

type ActivityDescribers = { [K in ActivityLoggedProcedure]: ActivityDescriber<K> };

export const ACTIVITY_DESCRIBERS = {
  'bookings.refund': {
    describe: ({ input, output }) => ({
      target: { type: 'booking', id: output.booking.code, label: output.booking.code },
      details: {
        amount: input.amount,
        currency: output.booking.currency,
        full: output.booking.status === 'REFUNDED',
      },
    }),
  },
  'reviews.moderate': {
    describe: ({ input, output }) => ({
      target: { type: 'review', id: output.id, label: output.tourTitle ?? null },
      details: { verdict: input.verdict },
    }),
  },
  'outbox.retry': {
    // Người nhận là email của khách: không lưu, chỉ loại email.
    describe: ({ output }) => ({
      target: { type: 'email', id: output.id, label: null },
      details: { emailType: output.type },
    }),
  },
  'enquiries.setStatus': {
    describe: ({ output }) =>
      output.changed
        ? {
            target: { type: 'enquiry', id: output.id, label: output.name },
            details: { status: output.status },
          }
        : null,
  },
  'enquiries.addNote': {
    // Output là id của NOTE; đối tượng là enquiry của input. Nội dung note không chép.
    describe: async ({ input }) => ({
      target: { type: 'enquiry', id: input.id, label: await enquiryName(input.id) },
    }),
  },
  'subscribers.unsubscribe': {
    // Email là danh tính duy nhất của người nhận tin: không có nhãn.
    describe: ({ output }) => ({ target: { type: 'subscriber', id: output.id, label: null } }),
  },
  'tours.create': {
    describe: ({ input, output }) => ({
      target: { type: 'tour', id: output.id, label: input.title },
    }),
  },
  'tours.updateDetails': {
    describe: ({ output }) => ({ target: { type: 'tour', id: output.id, label: output.title } }),
  },
  'tours.setItinerary': {
    describe: ({ input, output }) => ({
      target: { type: 'tour', id: output.id, label: output.title },
      details: { days: input.days.length },
    }),
  },
  'tours.setFaqsPolicies': {
    describe: ({ input, output }) => ({
      target: { type: 'tour', id: output.id, label: output.title },
      details: { faqs: input.faqs.length, policies: input.policies.length },
    }),
  },
  'tours.setCosts': {
    describe: ({ input, output }) => ({
      target: { type: 'tour', id: output.id, label: output.title },
      details: { items: input.items.length },
    }),
  },
  'tours.setPhotos': {
    describe: ({ input, output }) => ({
      target: { type: 'tour', id: output.id, label: output.title },
      details: { photos: input.photos.length },
    }),
  },
  'tours.delete': {
    before: (input) => tourTitle(input.id),
    describe: ({ input, before }) => ({ target: { type: 'tour', id: input.id, label: before } }),
  },
  'tours.setPublished': {
    describe: async ({ output }) =>
      output.changed
        ? {
            target: { type: 'tour', id: output.id, label: await tourTitle(output.id) },
            details: { published: output.isPublished },
          }
        : null,
  },
  'categories.create': {
    describe: ({ output }) => ({
      target: { type: 'category', id: output.id, label: output.name },
    }),
  },
  'categories.update': {
    describe: ({ output }) => ({
      target: { type: 'category', id: output.id, label: output.name },
    }),
  },
  'categories.setActive': {
    describe: ({ output }) => ({
      target: { type: 'category', id: output.id, label: output.name },
      details: { active: output.isActive },
    }),
  },
  'categories.move': {
    // Output là cả danh sách sau khi đổi chỗ; nhãn là hàng của input.
    describe: ({ input, output }) => ({
      target: {
        type: 'category',
        id: input.id,
        label: output.find((row) => row.id === input.id)?.name ?? null,
      },
      details: { direction: input.direction },
    }),
  },
  'categories.delete': {
    before: (input) => categoryName(input.id),
    describe: ({ input, before }) => ({
      target: { type: 'category', id: input.id, label: before },
    }),
  },
  'destinations.create': {
    describe: ({ output }) => ({
      target: { type: 'destination', id: output.id, label: output.name },
    }),
  },
  'destinations.update': {
    describe: ({ output }) => ({
      target: { type: 'destination', id: output.id, label: output.name },
    }),
  },
  'destinations.setActive': {
    describe: ({ output }) => ({
      target: { type: 'destination', id: output.id, label: output.name },
      details: { active: output.isActive },
    }),
  },
  'destinations.delete': {
    before: (input) => destinationName(input.id),
    describe: ({ input, before }) => ({
      target: { type: 'destination', id: input.id, label: before },
    }),
  },
  'destinations.setPhotos': {
    describe: ({ input, output }) => ({
      target: { type: 'destination', id: output.id, label: output.name },
      details: { photos: input.photos.length },
    }),
  },
  'departures.create': {
    describe: async ({ output }) => ({
      target: { type: 'departure', id: output.id, label: await departureTourTitle(output.id) },
      details: { startDate: output.startDate },
    }),
  },
  'departures.update': {
    describe: async ({ output }) => ({
      target: { type: 'departure', id: output.id, label: await departureTourTitle(output.id) },
      details: { startDate: output.startDate },
    }),
  },
  'departures.cancel': {
    // Lý do huỷ là chữ admin gõ, đã nằm ở chính dòng chuyến: không chép.
    describe: async ({ output }) => ({
      target: { type: 'departure', id: output.id, label: await departureTourTitle(output.id) },
      details: { startDate: output.startDate },
    }),
  },
  'departures.setStatus': {
    describe: async ({ output }) => ({
      target: { type: 'departure', id: output.id, label: await departureTourTitle(output.id) },
      details: { startDate: output.startDate, status: output.status },
    }),
  },
  'posts.create': {
    describe: ({ input, output }) => ({
      target: { type: 'post', id: output.id, label: input.title },
    }),
  },
  'posts.update': {
    describe: ({ output }) => ({
      target: { type: 'post', id: output.id, label: output.title },
      details: { status: output.status },
    }),
  },
  'posts.delete': {
    before: (input) => postTitle(input.id),
    describe: ({ input, before }) => ({ target: { type: 'post', id: input.id, label: before } }),
  },
  'appearance.setSlot': {
    describe: ({ input }) => ({ target: { type: 'slot', id: input.key, label: input.key } }),
  },
  'media.update': {
    describe: ({ output }) => ({
      target: { type: 'photo', id: output.publicId, label: output.usages[0]?.label ?? null },
      details: { uses: output.usages.length },
    }),
  },
  'users.setRole': {
    describe: async ({ output }) => ({
      target: { type: 'account', id: output.id, label: await accountName(output.id) },
      details: { role: output.role },
    }),
  },
  'users.lock': {
    // Lý do khoá đã nằm ở `user_events.note`: không chép.
    describe: async ({ output }) => ({
      target: { type: 'account', id: output.id, label: await accountName(output.id) },
    }),
  },
  'users.unlock': {
    describe: async ({ output }) => ({
      target: { type: 'account', id: output.id, label: await accountName(output.id) },
    }),
  },
  'users.revokeSessions': {
    describe: async ({ output }) => ({
      target: { type: 'account', id: output.id, label: await accountName(output.id) },
      details: { sessions: output.revoked },
    }),
  },
} satisfies ActivityDescribers;
