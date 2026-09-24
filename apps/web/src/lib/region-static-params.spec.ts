import { REGIONS as CONTRACT_REGIONS } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { generateStaticParams } from '@/app/(site)/destinations/[region]/page';
import { REGIONS } from '@/mocks/regions';

/**
 * Lưới của rủi ro spec P4e-2 §6: ba vùng dời từ `mocks/regions.ts` vào
 * `@tourism/contract` (ADR-0045), mà `generateStaticParams` của
 * `/destinations/[region]` đọc gián tiếp qua đúng file ấy.
 *
 * Dời sai thì không có gì đỏ ở tầng nào khác: build vẫn xanh, chỉ là ba trang
 * vùng lặng lẽ biến khỏi bản build và slug của chúng rơi vào trang 404 chung.
 */
describe('/destinations/[region] — ba trang sinh sẵn lúc build', () => {
  it('`generateStaticParams` trả ĐÚNG ba slug, không hơn không kém', () => {
    expect(generateStaticParams()).toEqual([
      { region: 'northern-vietnam' },
      { region: 'central-vietnam' },
      { region: 'southern-vietnam' },
    ]);
  });

  it('web đọc ba vùng TỪ contract — cùng một mảng, không phải một bản chép', () => {
    // So THAM CHIẾU chứ không so nội dung: hai bản chép giống nhau hôm nay vẫn
    // là hai bản sẽ trôi xa nhau, và picker của admin đọc bản ở contract.
    expect(REGIONS).toBe(CONTRACT_REGIONS);
  });
});
