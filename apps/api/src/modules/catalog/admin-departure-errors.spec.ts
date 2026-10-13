import { createORPCErrorConstructorMap, type ErrorMap, ORPCError } from '@orpc/server';
import { contract } from '@tourism/contract';
import { ContractError, toContractError } from '../../lib/contract-error.js';
import {
  DepartureNotFoundError,
  DepartureRuleError,
  TourNotFoundError,
} from './admin-departure-errors.js';

/**
 * Lỗi của vùng chuyến khởi hành đi qua cổng chung `toContractError` (G3), như danh mục, điểm
 * đến và tour. Trước G3 controller chuyến giữ một `mapError` riêng ba nhánh `instanceof`.
 *
 * Dùng `errors` THẬT dựng từ bảng mã mà chính contract khai cho từng procedure: Proxy của oRPC
 * trả hàm dựng cho MỌI mã, nên một bảng giả không bắt được ca "mã procedure không khai".
 */
function errorsOf(procedure: { '~orpc': { errorMap: ErrorMap } }) {
  return createORPCErrorConstructorMap(procedure['~orpc'].errorMap) as unknown as Record<
    string,
    (init?: { message: string }) => Error
  >;
}

const DEPARTURE_ID = '7d1e0000-0000-4000-8000-000000000001';

describe('lỗi của vùng chuyến qua toContractError (G3)', () => {
  it('cả ba lớp là ContractError mang mã của contract, và giữ tên lớp cho dòng log', () => {
    const errors = [
      new TourNotFoundError('ha-long-bay-cruise'),
      new DepartureNotFoundError(DEPARTURE_ID),
      new DepartureRuleError('DEPARTURE_STALE', 'Someone else changed this departure'),
    ];

    expect(errors.map((error) => error instanceof ContractError)).toEqual([true, true, true]);
    expect(errors.map((error) => error.code)).toEqual([
      'NOT_FOUND',
      'NOT_FOUND',
      'DEPARTURE_STALE',
    ]);
    expect(errors.map((error) => error.name)).toEqual([
      'TourNotFoundError',
      'DepartureNotFoundError',
      'DepartureRuleError',
    ]);
  });

  it('chuyến không còn: 404 mang câu MẶC ĐỊNH của procedure, không lộ id', () => {
    const mapped = toContractError(
      new DepartureNotFoundError(DEPARTURE_ID),
      errorsOf(contract.admin.departures.update),
    );

    expect(mapped).toBeInstanceOf(ORPCError);
    expect((mapped as ORPCError<string, unknown>).code).toBe('NOT_FOUND');
    expect((mapped as Error).message).toBe('Departure not found');
  });

  it('tour không còn (list, create): 404 nói về TOUR, câu của chính procedure, không lộ slug', () => {
    for (const procedure of [contract.admin.departures.list, contract.admin.departures.create]) {
      const mapped = toContractError(
        new TourNotFoundError('khong-co-tour-nay'),
        errorsOf(procedure),
      );

      expect((mapped as ORPCError<string, unknown>).code).toBe('NOT_FOUND');
      expect((mapped as Error).message).toBe('Tour not found');
    }
  });

  it('luật chặn: mã và CÂU mang con số thật đi nguyên ra client', () => {
    const message = 'The seat total cannot go below the 4 seats already booked';
    const mapped = toContractError(
      new DepartureRuleError('SEATS_BELOW_BOOKED', message),
      errorsOf(contract.admin.departures.update),
    );

    expect((mapped as ORPCError<string, unknown>).code).toBe('SEATS_BELOW_BOOKED');
    expect((mapped as Error).message).toBe(message);
  });

  it('mã mà procedure KHÔNG khai: trả nguyên lỗi (500 nhìn thấy được), không đổi sai loại', () => {
    // `DEPARTURE_STARTED` chỉ lệnh huỷ khai; lọt sang lệnh sửa thì không được thành 409 câm.
    const error = new DepartureRuleError('DEPARTURE_STARTED', 'This departure has started');

    expect(toContractError(error, errorsOf(contract.admin.departures.update))).toBe(error);
  });
});
