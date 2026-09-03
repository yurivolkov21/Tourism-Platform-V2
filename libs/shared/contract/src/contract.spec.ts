import type { ContractRouterClient } from '@orpc/contract';
import { isContractProcedure } from '@orpc/contract';
import { contract } from './contract.js';
import type { ContractInputs, ContractOutputs } from './index.js';
import type {
  Destination,
  Paged,
  TourCard,
  TourCategory,
  TourDetail,
  ToursListQuery,
} from './schemas/catalog.js';

/** Route metadata drives the @orpc/nest mount points — pin it. */
describe('contract routes', () => {
  const routes: Array<[{ '~orpc': { route?: { method?: string; path?: string } } }, string]> = [
    [contract.health.check, 'GET /api/health'],
    [contract.catalog.tours.list, 'GET /api/tours'],
    [contract.catalog.tours.bySlug, 'GET /api/tours/{slug}'],
    [contract.catalog.destinations.list, 'GET /api/destinations'],
    [contract.catalog.categories.list, 'GET /api/categories'],
    [contract.bookings.create, 'POST /api/bookings'],
    [contract.bookings.mine, 'GET /api/bookings'],
    [contract.bookings.byCode, 'GET /api/bookings/{code}'],
    [contract.media.signUpload, 'POST /api/media/upload-signatures'],
    [contract.account.setAvatar, 'PATCH /api/account/avatar'],
    [contract.admin.stats.bookings, 'GET /api/admin/stats/bookings'],
    [contract.admin.stats.cancellations, 'GET /api/admin/stats/cancellations'],
    [contract.admin.stats.reviews, 'GET /api/admin/stats/reviews'],
    [contract.admin.reports.monthly, 'GET /api/admin/reports/monthly'],
    [contract.admin.outbox.list, 'GET /api/admin/outbox'],
    [contract.admin.outbox.retry, 'POST /api/admin/outbox/{id}/retry'],
    [contract.admin.stats.outbox, 'GET /api/admin/stats/outbox'],
    [contract.admin.paymentEvents.list, 'GET /api/admin/payment-events'],
    [contract.admin.paymentEvents.byId, 'GET /api/admin/payment-events/{id}'],
    [contract.admin.stats.paymentEvents, 'GET /api/admin/stats/payment-events'],
    [contract.admin.enquiries.list, 'GET /api/admin/enquiries'],
    [contract.admin.enquiries.byId, 'GET /api/admin/enquiries/{id}'],
    [contract.admin.enquiries.setStatus, 'POST /api/admin/enquiries/{id}/status'],
    [contract.admin.enquiries.addNote, 'POST /api/admin/enquiries/{id}/notes'],
    [contract.admin.stats.enquiries, 'GET /api/admin/stats/enquiries'],
  ];

  it.each(routes)('procedure %# is mounted at %s', (procedure, expected) => {
    expect(isContractProcedure(procedure)).toBe(true);
    const route = procedure['~orpc'].route;
    expect(`${route?.method} ${route?.path}`).toBe(expected);
  });

  it('bySlug declares a typed NOT_FOUND error', () => {
    expect(contract.catalog.tours.bySlug['~orpc'].errorMap).toHaveProperty('NOT_FOUND');
  });

  it('bookings.create declares its typed business errors with explicit statuses', () => {
    const errorMap = contract.bookings.create['~orpc'].errorMap as Record<
      string,
      { status?: number } | undefined
    >;
    expect(errorMap.DEPARTURE_NOT_AVAILABLE?.status).toBe(400);
    expect(errorMap.SEATS_UNAVAILABLE?.status).toBe(409);
    expect(contract.bookings.byCode['~orpc'].errorMap).toHaveProperty('NOT_FOUND');
  });

  it('reviews.create declares REVIEW_PHOTO_INVALID (ADR-0021)', () => {
    expect(contract.reviews.create['~orpc'].errorMap).toHaveProperty('REVIEW_PHOTO_INVALID');
  });

  // F7: retry chỉ hợp lệ trên hàng FAILED — hai mã, hai câu riêng phía admin.
  it('admin.outbox.retry declares NOT_FOUND (404) and NOT_FAILED (409)', () => {
    const errorMap = contract.admin.outbox.retry['~orpc'].errorMap as Record<
      string,
      { status?: number } | undefined
    >;
    expect(errorMap.NOT_FOUND?.status).toBe(404);
    expect(errorMap.NOT_FAILED?.status).toBe(409);
    expect(contract.admin.outbox.list['~orpc'].errorMap).toEqual({});
  });

  // F9: ba endpoint đụng tới MỘT lead cụ thể đều khai NOT_FOUND (404) và chỉ
  // thế — chuyển trạng thái là TỰ DO giữa năm giá trị nên không có mã "không
  // chuyển được"; `list` thì không có phán quyết nào. Test chốt ý định đó: mã
  // thứ hai thêm vào sau phải là một quyết định có ý thức (và kéo theo một
  // câu i18n, vì codec bên admin derive tập mã từ chính khối đó).
  it('admin.enquiries: byId/setStatus/addNote khai ĐÚNG NOT_FOUND (404); list không khai lỗi', () => {
    for (const procedure of [
      contract.admin.enquiries.byId,
      contract.admin.enquiries.setStatus,
      contract.admin.enquiries.addNote,
    ]) {
      const errorMap = procedure['~orpc'].errorMap as Record<string, { status?: number }>;
      expect(Object.keys(errorMap)).toEqual(['NOT_FOUND']);
      expect(errorMap.NOT_FOUND?.status).toBe(404);
    }
    expect(contract.admin.enquiries.list['~orpc'].errorMap).toEqual({});
  });

  // F5: đọc thuần, không có phán quyết nghiệp vụ nào để mà khai lỗi riêng —
  // chỉ 401/403 của guard (AllExceptionsFilter lo) và 500. Test này chốt ý
  // định đó, để một mã lỗi thêm vào sau là quyết định có ý thức.
  it('admin.stats procedures declare no business errors', () => {
    for (const procedure of Object.values(contract.admin.stats)) {
      expect(procedure['~orpc'].errorMap).toEqual({});
    }
  });
});

/**
 * Type-level proof that the end-to-end type chain flows: a hypothetical
 * P3 client built from this contract infers catalog types automatically.
 */
describe('contract type inference', () => {
  type Client = ContractRouterClient<typeof contract>;

  it('tours.list output infers as Paged<TourCard>', () => {
    expectTypeOf<Awaited<ReturnType<Client['catalog']['tours']['list']>>>().toEqualTypeOf<
      Paged<TourCard>
    >();
    expectTypeOf<ContractOutputs['catalog']['tours']['list']>().toEqualTypeOf<Paged<TourCard>>();
  });

  it('tours.list input stays honest (numbers/booleans, all optional)', () => {
    type ListInput = ContractInputs['catalog']['tours']['list'];
    expectTypeOf<ListInput['page']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<ListInput['featured']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<ListInput['sort']>().toEqualTypeOf<
      'createdAt' | 'updatedAt' | 'basePrice' | 'durationDays' | 'title' | undefined
    >();
    // Parsed (server-side) query has defaults applied.
    expectTypeOf<ToursListQuery['page']>().toEqualTypeOf<number>();
  });

  it('bySlug output infers as TourDetail', () => {
    expectTypeOf<
      Awaited<ReturnType<Client['catalog']['tours']['bySlug']>>
    >().toEqualTypeOf<TourDetail>();
    expectTypeOf<ContractInputs['catalog']['tours']['bySlug']>().toEqualTypeOf<{
      slug: string;
    }>();
  });

  it('destinations/categories lists infer as arrays', () => {
    expectTypeOf<ContractOutputs['catalog']['destinations']['list']>().toEqualTypeOf<
      Destination[]
    >();
    expectTypeOf<ContractOutputs['catalog']['categories']['list']>().toEqualTypeOf<
      TourCategory[]
    >();
  });
});
