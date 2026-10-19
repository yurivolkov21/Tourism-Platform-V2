import { z } from 'zod';
import type { AdminProcedureKey } from '../admin-access.js';
import { UserRoleSchema } from './admin-users.js';
import { PagedSchema } from './catalog.js';
import { AdminPageQuerySchema, CalendarDateSchema, CalendarMonthSchema } from './common.js';

/**
 * Nhật ký thao tác admin (ADR-0061, spec 2026-10-19) — bảng phân loại thủ tục, khoá thao tác,
 * khu vực, và schema của hai thủ tục `admin.activity.*`.
 */

/** `log` = mỗi lần chạy thành công ghi một dòng nhật ký; `skip` = không ghi (ADR-0061 §2). */
export type ActivityKind = 'log' | 'skip';

/**
 * Mỗi thủ tục admin một dòng, cùng thứ tự `ADMIN_ACCESS`. `satisfies` bắt cả hai chiều như bảng
 * quyền: thêm thủ tục admin mới mà chưa quyết nó có vào nhật ký không là typecheck đỏ.
 *
 * `skip`: lệnh chỉ đọc; bốn lệnh ký tải ảnh lên (chưa đổi gì — lệnh lưu sau đó mới đổi, và lệnh
 * ấy được ghi); hai thủ tục của chính nhật ký.
 */
export const ADMIN_ACTIVITY = {
  'bookings.list': 'skip',
  'bookings.byCode': 'skip',
  'bookings.refund': 'log',
  'reviews.list': 'skip',
  'reviews.moderate': 'log',
  'stats.bookings': 'skip',
  'stats.reviews': 'skip',
  'stats.outbox': 'skip',
  'stats.paymentEvents': 'skip',
  'stats.enquiries': 'skip',
  'stats.subscribers': 'skip',
  'stats.dashboard': 'skip',
  'outbox.list': 'skip',
  'outbox.retry': 'log',
  'paymentEvents.list': 'skip',
  'paymentEvents.byId': 'skip',
  'enquiries.list': 'skip',
  'enquiries.byId': 'skip',
  'enquiries.setStatus': 'log',
  'enquiries.addNote': 'log',
  'subscribers.list': 'skip',
  'subscribers.unsubscribe': 'log',
  'reports.monthly': 'skip',
  'tours.list': 'skip',
  'tours.get': 'skip',
  'tours.create': 'log',
  'tours.updateDetails': 'log',
  'tours.setItinerary': 'log',
  'tours.setFaqsPolicies': 'log',
  'tours.setCosts': 'log',
  'tours.setPhotos': 'log',
  'tours.signPhotoUploads': 'skip',
  'tours.photoLibrary': 'skip',
  'tours.delete': 'log',
  'tours.setPublished': 'log',
  'categories.list': 'skip',
  'categories.create': 'log',
  'categories.update': 'log',
  'categories.setActive': 'log',
  'categories.move': 'log',
  'categories.delete': 'log',
  'destinations.list': 'skip',
  'destinations.create': 'log',
  'destinations.update': 'log',
  'destinations.setActive': 'log',
  'destinations.delete': 'log',
  'destinations.photos': 'skip',
  'destinations.setPhotos': 'log',
  'destinations.signPhotoUploads': 'skip',
  'departures.list': 'skip',
  'departures.create': 'log',
  'departures.update': 'log',
  'departures.cancel': 'log',
  'departures.setStatus': 'log',
  'posts.list': 'skip',
  'posts.get': 'skip',
  'posts.create': 'log',
  'posts.update': 'log',
  'posts.delete': 'log',
  'posts.signCoverUpload': 'skip',
  'posts.tags': 'skip',
  'appearance.list': 'skip',
  'appearance.signUpload': 'skip',
  'appearance.setSlot': 'log',
  'media.list': 'skip',
  'media.update': 'log',
  'media.queue': 'skip',
  'users.list': 'skip',
  'users.byId': 'skip',
  'users.setRole': 'log',
  'users.lock': 'log',
  'users.unlock': 'log',
  'users.revokeSessions': 'log',
  'activity.list': 'skip',
  'activity.recordExport': 'skip',
} as const satisfies Record<AdminProcedureKey, ActivityKind>;

type ActivityTable = typeof ADMIN_ACTIVITY;

/** Khoá của một thủ tục admin được ghi vào nhật ký. */
export type ActivityLoggedProcedure = {
  [K in keyof ActivityTable]: ActivityTable[K] extends 'log' ? K : never;
}[keyof ActivityTable];

export const ACTIVITY_LOGGED_PROCEDURES = (
  Object.keys(ADMIN_ACTIVITY) as (keyof ActivityTable)[]
).filter((key): key is ActivityLoggedProcedure => ADMIN_ACTIVITY[key] === 'log');

export function isLoggedProcedure(key: AdminProcedureKey): key is ActivityLoggedProcedure {
  return ADMIN_ACTIVITY[key] === 'log';
}

/**
 * Ba lượt xuất Excel (ADR-0061 §5): route của app admin gom trang bằng lệnh đọc nên API không tự
 * biết; route gọi `admin.activity.recordExport` khi file đã dựng xong.
 */
export const ACTIVITY_EXPORT_KINDS = ['bookings', 'subscribers', 'reports'] as const;
export type ActivityExportKind = (typeof ACTIVITY_EXPORT_KINDS)[number];
export const ACTIVITY_EXPORT_ACTIONS = [
  'bookings.export',
  'subscribers.export',
  'reports.export',
] as const satisfies readonly `${ActivityExportKind}.export`[];
export type ActivityExportAction = (typeof ACTIVITY_EXPORT_ACTIONS)[number];

export function exportActivityAction(kind: ActivityExportKind): ActivityExportAction {
  return `${kind}.export`;
}

/** Khoá thao tác của một dòng nhật ký: 37 lệnh ghi cộng ba lượt xuất. */
export type ActivityAction = ActivityLoggedProcedure | ActivityExportAction;
export const ACTIVITY_ACTIONS: readonly ActivityAction[] = [
  ...ACTIVITY_LOGGED_PROCEDURES,
  ...ACTIVITY_EXPORT_ACTIONS,
];

const ACTIVITY_ACTION_SET: ReadonlySet<string> = new Set(ACTIVITY_ACTIONS);

export function isActivityAction(value: string): value is ActivityAction {
  return ACTIVITY_ACTION_SET.has(value);
}

/**
 * Khu vực = phần trước dấu chấm của khoá thao tác, cột `area` của bảng và ô lọc Area của trang.
 * Thứ tự theo sidebar: Operations, Content, rồi System.
 */
export const ACTIVITY_AREAS = [
  'bookings',
  'reviews',
  'reports',
  'enquiries',
  'subscribers',
  'tours',
  'departures',
  'categories',
  'destinations',
  'posts',
  'media',
  'appearance',
  'outbox',
  'users',
] as const;
export const ActivityAreaSchema = z.enum(ACTIVITY_AREAS);
export type ActivityArea = z.output<typeof ActivityAreaSchema>;

type AreaOf<A extends string> = A extends `${infer Area}.${string}` ? Area : never;

export function activityArea<A extends ActivityAction>(action: A): AreaOf<A> & ActivityArea {
  return action.slice(0, action.indexOf('.')) as AreaOf<A> & ActivityArea;
}

/**
 * Loại đối tượng của một dòng (spec §3). Output đọc `type` bằng chuỗi thường chứ không bằng enum
 * này: dòng cũ phải đọc được kể cả khi danh sách đổi.
 */
export const ACTIVITY_TARGET_TYPES = [
  'booking',
  'review',
  'email',
  'enquiry',
  'subscriber',
  'tour',
  'category',
  'destination',
  'departure',
  'post',
  'slot',
  'photo',
  'account',
] as const;
export type ActivityTargetType = (typeof ACTIVITY_TARGET_TYPES)[number];

/** Trần nhãn chụp lúc ghi — cột `target_label VarChar(200)`. */
export const ACTIVITY_LABEL_MAX = 200;
/** Trần nhãn người làm — tên hoặc email của chính admin, cột `actor_label VarChar(320)`. */
export const ACTIVITY_ACTOR_LABEL_MAX = 320;
/** Trần số khoá của `details`: object phẳng vài giá trị ngắn (ADR-0061 §1). */
export const ACTIVITY_DETAILS_MAX_KEYS = 8;

export const ActivityDetailValueSchema = z.union([
  z.string().max(120),
  z.number(),
  z.boolean(),
  z.null(),
]);
export type ActivityDetailValue = z.output<typeof ActivityDetailValueSchema>;

export const ActivityDetailsSchema = z
  .record(z.string().min(1).max(40), ActivityDetailValueSchema)
  .refine((details) => Object.keys(details).length <= ACTIVITY_DETAILS_MAX_KEYS, {
    message: `details holds at most ${ACTIVITY_DETAILS_MAX_KEYS} keys`,
  });
export type ActivityDetails = z.output<typeof ActivityDetailsSchema>;

/** Người làm của một dòng: bậc và nhãn chụp lúc ghi; `id` null khi tài khoản đã mất. */
export const AdminActivityActorSchema = z.object({
  id: z.uuid().nullable(),
  label: z.string().min(1).max(ACTIVITY_ACTOR_LABEL_MAX),
  role: UserRoleSchema,
});

/**
 * Một dòng nhật ký. `action`, `area`, `target.type` là chuỗi thường, không phải enum: lịch sử có
 * thể mang khoá đã đổi tên, và một dòng cũ không được làm hỏng cả trang. `target.ref` là khoá đường
 * HIỆN TẠI của đối tượng (slug, mã đơn, id, khoá khe) nếu nó còn, không thì null (spec §5).
 */
export const AdminActivityItemSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  actor: AdminActivityActorSchema,
  action: z.string().min(1).max(64),
  area: z.string().min(1).max(32),
  target: z
    .object({
      type: z.string().min(1).max(32),
      id: z.string().min(1).max(ACTIVITY_LABEL_MAX),
      label: z.string().min(1).max(ACTIVITY_LABEL_MAX).nullable(),
      ref: z.string().min(1).max(ACTIVITY_LABEL_MAX).nullable(),
    })
    .nullable(),
  details: ActivityDetailsSchema,
});
export type AdminActivityItem = z.output<typeof AdminActivityItemSchema>;

export const AdminActivityListQuerySchema = AdminPageQuerySchema.extend({
  actorId: z.uuid().optional(),
  area: ActivityAreaSchema.optional(),
  /**
   * Khoảng NGÀY LỊCH theo thời điểm ghi, hai đầu đều tính, ngày UTC qua `createdAtRange` như
   * `/subscribers`. Vắng cả hai = mọi ngày.
   */
  from: CalendarDateSchema.optional(),
  to: CalendarDateSchema.optional(),
})
  // `.refine` giữ `.shape` cho `ZodSmartCoercionPlugin` — xem `AdminSubscribersListQuerySchema`.
  .refine(({ from, to }) => !(from && to) || from <= to, {
    message: 'from must be on or before to',
    path: ['to'],
  });
export type AdminActivityListQuery = z.output<typeof AdminActivityListQuerySchema>;

/** Người làm có trong nhật ký, cho ô lọc People: nhãn và bậc của dòng mới nhất của họ. */
export const AdminActivityActorOptionSchema = AdminActivityActorSchema.extend({ id: z.uuid() });
export type AdminActivityActorOption = z.output<typeof AdminActivityActorOptionSchema>;

export const AdminActivityListResultSchema = PagedSchema(AdminActivityItemSchema).extend({
  actors: z.array(AdminActivityActorOptionSchema),
});
export type AdminActivityListResult = z.output<typeof AdminActivityListResultSchema>;

/** Trần số dòng một lượt xuất ghi được — rộng hơn mọi trần xuất thật, chỉ chặn số vô lý. */
export const ACTIVITY_EXPORT_ROWS_MAX = 1_000_000;

export const AdminActivityRecordExportInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.enum(['bookings', 'subscribers']),
    rows: z.int().min(0).max(ACTIVITY_EXPORT_ROWS_MAX),
    /** `selection` = xuất các hàng đã tích; `all` = cả tập đang lọc. */
    mode: z.enum(['all', 'selection']),
    /** Có bộ lọc nào ngoài mặc định không — chỉ có hay không, không chép chuỗi tìm (ADR-0061 §5). */
    filtered: z.boolean(),
  }),
  z.object({ kind: z.literal('reports'), month: CalendarMonthSchema }),
]);
export type AdminActivityRecordExportInput = z.output<typeof AdminActivityRecordExportInputSchema>;

export const AdminActivityRecordExportResultSchema = z.object({ id: z.uuid() });
export type AdminActivityRecordExportResult = z.output<
  typeof AdminActivityRecordExportResultSchema
>;
