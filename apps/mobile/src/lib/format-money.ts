/**
 * Tiền từ chuỗi thập phân sang chữ hiển thị — port nguyên thuật toán
 * `apps/web/src/lib/tours.ts` `formatMoney`. `Number()` chỉ dùng ở BƯỚC CUỐI để
 * định dạng, không bao giờ để tính tiền — nguồn sự thật vẫn là chuỗi thập phân.
 */
export function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}
