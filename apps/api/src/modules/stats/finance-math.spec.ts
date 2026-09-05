import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { grossMarginPct, paymentFees, taxOnMargin } from './finance-math.js';

/**
 * Phần THUẦN của mô hình tài chính (ADR-0033 §5, §6) — không đụng DB, nên mọi
 * ca LỖ test được mà không phải dựng một tháng thua lỗ trong Postgres.
 *
 * Ba hàm, ba chỗ dễ sai khác nhau, và bộ này canh đúng ba chỗ ấy: thuế trên
 * giá-đã-gồm-thuế phải BÓC ra chứ không nhân thẳng; phí cổng tính theo SỐ GIAO
 * DỊCH chứ không một lần cho cả kỳ; và biên gộp khi không có doanh thu là
 * KHÔNG XÁC ĐỊNH chứ không phải 0.
 */
const d = (v: string) => new Prisma.Decimal(v);

describe('taxOnMargin', () => {
  it('20% ra đúng MỘT PHẦN SÁU của margin — quy tắc nghề của margin scheme', () => {
    // Giá bán đã bao gồm thuế, nên phần thuế nằm TRONG margin: 600 × 20/120.
    // Nhân thẳng 20% sẽ ra 120.00 — sai 20%, và sai theo hướng thu quá tay.
    expect(taxOnMargin(d('600.00'), 0.2).toFixed(2)).toBe('100.00');
  });

  it('margin ÂM thì KHÔNG có thuế — luật của scheme, không phải làm tròn', () => {
    // Bỏ vế này đi là sinh ra một khoản thuế âm cộng vào lợi nhuận của một
    // tháng lỗ, tức tháng càng lỗ càng "được hoàn thuế".
    expect(taxOnMargin(d('-500.00'), 0.2).toFixed(2)).toBe('0.00');
  });

  it('margin bằng 0 cũng không thuế', () => {
    expect(taxOnMargin(d('0.00'), 0.2).toFixed(2)).toBe('0.00');
  });

  it('suất 0 thì thuế 0 — dự án chưa khai thuế vẫn ra báo cáo đúng', () => {
    expect(taxOnMargin(d('600.00'), 0).toFixed(2)).toBe('0.00');
  });

  it('làm tròn HALF_UP về 2 chữ số', () => {
    // 400 × 0.1/1.1 = 36.3636… → 36.36
    expect(taxOnMargin(d('400.00'), 0.1).toFixed(2)).toBe('36.36');
  });
});

describe('paymentFees', () => {
  it('cộng phần trăm với phí cố định MỖI GIAO DỊCH', () => {
    // 1000 × 0.029 + 4 × 0.30 = 29.00 + 1.20 = 30.20. Mỗi booking là một
    // giao dịch, nên phần cố định nhân với số booking chứ không tính một lần
    // cho cả kỳ.
    expect(paymentFees(d('1000.00'), 4, 0.029, 0.3).toFixed(2)).toBe('30.20');
  });

  it('không giao dịch nào thì không phí nào', () => {
    expect(paymentFees(d('0.00'), 0, 0.029, 0.3).toFixed(2)).toBe('0.00');
  });

  it('tỉ lệ 0 vẫn thu phần cố định, và ngược lại', () => {
    expect(paymentFees(d('1000.00'), 4, 0, 0.3).toFixed(2)).toBe('1.20');
    expect(paymentFees(d('1000.00'), 4, 0.029, 0).toFixed(2)).toBe('29.00');
  });

  it('làm tròn HALF_UP về 2 chữ số', () => {
    // 999.99 × 0.029 = 28.999710 → 29.00
    expect(paymentFees(d('999.99'), 0, 0.029, 0).toFixed(2)).toBe('29.00');
  });
});

describe('grossMarginPct', () => {
  it('null khi doanh thu 0 — biên gộp KHÔNG XÁC ĐỊNH, không phải 0', () => {
    // In `0.0%` cho một tháng không có chuyến nào chạy là nói tháng ấy hoà vốn
    // trắng — một câu khác hẳn, và sai.
    expect(grossMarginPct(d('0.00'), d('0.00'))).toBeNull();
  });

  it('trả TỈ LỆ chứ không phần trăm — client nhân 100 khi in', () => {
    expect(grossMarginPct(d('400.00'), d('1000.00'))).toBeCloseTo(0.4, 10);
  });

  it('lỗ ra tỉ lệ âm', () => {
    expect(grossMarginPct(d('-150.00'), d('1000.00'))).toBeCloseTo(-0.15, 10);
  });

  it('doanh thu có mà lãi bằng 0 thì là 0, khác hẳn null', () => {
    expect(grossMarginPct(d('0.00'), d('1000.00'))).toBe(0);
  });
});
