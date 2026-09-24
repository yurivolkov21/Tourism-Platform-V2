import { ContractError, toContractError } from './contract-error.js';

/**
 * `toContractError` là cổng DUY NHẤT từ lỗi service sang lỗi contract của các
 * controller danh mục và điểm đến (nợ G3). Bốn ca dưới đây là bốn cách nó có
 * thể nói sai: đổi nhầm một lỗi không phải của mình, đổi sang mã procedure
 * không khai, lộ câu của service ra ngoài, hoặc nuốt câu mang con số thật.
 */

/** Giả `errors` của một procedure: mỗi mã khai một hàm dựng, ghi lại lời gọi. */
function fakeErrors(...codes: string[]) {
  const calls: Array<{ code: string; init: { message: string } | undefined }> = [];
  const errors: Record<string, (init?: { message: string }) => Error> = {};
  for (const code of codes) {
    errors[code] = (init) => {
      calls.push({ code, init });
      return new Error(`contract:${code}`);
    };
  }
  return { errors, calls };
}

describe('toContractError', () => {
  it('mã mà procedure khai → lỗi contract của mã ấy, CHỞ theo câu của service', () => {
    // Câu mang con số thật ("đã có hàng khác dùng slug X") là thứ admin cần đọc.
    const { errors, calls } = fakeErrors('SLUG_TAKEN');

    const mapped = toContractError(
      new ContractError('SLUG_TAKEN', 'Slug already taken: x'),
      errors,
    );

    expect((mapped as Error).message).toBe('contract:SLUG_TAKEN');
    expect(calls).toEqual([{ code: 'SLUG_TAKEN', init: { message: 'Slug already taken: x' } }]);
  });

  it('lỗi tắt `exposeMessage` dùng câu mặc định của contract, không lộ câu mang id', () => {
    const { errors, calls } = fakeErrors('NOT_FOUND');

    toContractError(new ContractError('NOT_FOUND', 'Destination not found: 1234', false), errors);

    expect(calls).toEqual([{ code: 'NOT_FOUND', init: undefined }]);
  });

  it('mã mà procedure KHÔNG khai → trả nguyên lỗi (500 nhìn thấy được), không đổi sai loại', () => {
    const { errors, calls } = fakeErrors('NOT_FOUND');
    const original = new ContractError('SLUG_TAKEN', 'Slug already taken: x');

    expect(toContractError(original, errors)).toBe(original);
    expect(calls).toEqual([]);
  });

  it('lỗi KHÔNG dựng từ `ContractError` thì không được làm phán quyết, dù mang `code` trùng', () => {
    // Bài học vòng hai F12: so theo tên hay theo một thuộc tính `code` bất kỳ
    // là bắt nhầm lỗi của module khác — lỗi Prisma cũng mang `code`.
    const { errors, calls } = fakeErrors('NOT_FOUND');
    const lookalike = Object.assign(new Error('Not found'), { code: 'NOT_FOUND' });

    expect(toContractError(lookalike, errors)).toBe(lookalike);
    expect(toContractError({ code: 'NOT_FOUND', message: 'x' }, errors)).toEqual({
      code: 'NOT_FOUND',
      message: 'x',
    });
    expect(calls).toEqual([]);
  });

  it('lớp con giữ tên của chính nó — dòng log đọc ra lớp nào đã ném', () => {
    class DestinationNotFoundError extends ContractError<'NOT_FOUND'> {
      constructor(id: string) {
        super('NOT_FOUND', `Destination not found: ${id}`, false);
      }
    }

    const error = new DestinationNotFoundError('1234');

    expect(error.name).toBe('DestinationNotFoundError');
    expect(error).toBeInstanceOf(ContractError);
  });
});
