import { ORPCError } from '@orpc/client';
import { contract } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  classifySetPublishedError,
  isSetPublishedStale,
  SET_PUBLISHED_CONTRACT_CODES,
  setPublishedErrorCopy,
  setPublishedToast,
} from './tours-publish';

/**
 * Logic THUẦN của hành vi bật/tắt đăng (spec P4e-1 §3-F11).
 *
 * File này sinh ra ở vòng review 21/09: `SET_PUBLISHED_CONTRACT_CODES` được
 * export mà không nơi nào đọc và không spec nào ghim, trong khi SÁU vùng ghi
 * trước đều có đúng một test đối chiếu tập mã với `errorMap` thật của contract
 * (`outbox-retry.spec.ts`, `subscribers-unsubscribe.spec.ts`, …).
 *
 * Vì sao test đó đáng có: `codec.codes` derive từ **i18n**, không từ contract.
 * Thêm một mã lỗi vào contract mà quên câu tương ứng trong i18n thì codec
 * không khớp, lỗi rơi về `GENERIC`, và công tắc in câu "có thể đã đi qua" cộng
 * một `router.refresh()` thừa — cho một lệnh server từ chối dứt khoát. Không
 * có test này thì chẳng gì đỏ.
 */
const t = messages.admin.tours.publish;

describe('SET_PUBLISHED_CONTRACT_CODES', () => {
  it('khớp ĐÚNG errorMap của contract.admin.tours.setPublished — không thừa không thiếu', () => {
    const errorMap = (
      contract.admin.tours.setPublished as unknown as { '~orpc': { errorMap: object } }
    )['~orpc'].errorMap;
    expect([...SET_PUBLISHED_CONTRACT_CODES].sort()).toEqual(Object.keys(errorMap).sort());
  });
});

describe('classifySetPublishedError + setPublishedErrorCopy', () => {
  it('mã contract có dấu defined → chính mã đó, và có câu riêng', () => {
    const error = new ORPCError('NOT_FOUND', { defined: true, status: 404 });
    expect(classifySetPublishedError(error)).toBe('NOT_FOUND');
    expect(setPublishedErrorCopy('NOT_FOUND')).toBe(t.errors.NOT_FOUND);
  });

  it('lỗi lạ rơi về GENERIC chứ không ném ra ngoài', () => {
    expect(classifySetPublishedError(new Error('đứt mạng'))).toBe('GENERIC');
  });
});

describe('isSetPublishedStale', () => {
  it('NOT_FOUND là trạng-thái-cũ: hàng đã biến mất giữa render và cú bấm', () => {
    expect(isSetPublishedStale('NOT_FOUND')).toBe(true);
  });
});

describe('setPublishedToast', () => {
  /**
   * `Tour.isPublished` mặc định `false`, nên một tour do P4e-3 tạo rồi đăng
   * LẦN ĐẦU cũng đi qua nhánh này. Câu phải đúng với cả lần đầu lẫn lần đưa
   * trở lại kệ — "again"/"back on the public site" là nói sai hai lần về một
   * tour chưa từng lên sóng (vòng review 21/09).
   */
  it('câu cho lượt BẬT không khẳng định tour từng lên sóng trước đó', () => {
    const câu = setPublishedToast('Hoi An Lantern Evening', {
      isPublished: true,
      changed: true,
    });
    expect(câu).toBe(t.toast.live('Hoi An Lantern Evening'));
    expect(câu).not.toMatch(/again|back on/i);
  });

  it('câu cho lượt TẮT nói rõ khách đã đặt vẫn đi', () => {
    expect(setPublishedToast('Hoi An Lantern Evening', { isPublished: false, changed: true })).toBe(
      t.toast.off('Hoi An Lantern Evening'),
    );
  });

  it('không đổi gì thì nói đúng thế, không giả vờ vừa làm được việc', () => {
    expect(setPublishedToast('Hoi An Lantern Evening', { isPublished: true, changed: false })).toBe(
      t.toast.unchanged('Hoi An Lantern Evening'),
    );
  });
});
