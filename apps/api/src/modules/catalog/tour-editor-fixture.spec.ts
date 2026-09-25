import {
  AdminTourCostsInputSchema,
  AdminTourDetailsInputSchema,
  AdminTourFaqsPoliciesInputSchema,
  AdminTourItineraryInputSchema,
} from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import * as catalog from '../../../prisma/fixtures/catalog/index.js';

/**
 * Mọi tour seed qua được bốn schema sửa của F17 (spec §3) — tức admin mở bất kỳ
 * tour nào đang bán ra rồi bấm Save mà không đổi gì thì lệnh ghi đi qua. Một trần
 * đặt chặt hơn dữ liệu thật sẽ đỏ ở đây, không phải ở tay người dùng.
 */
const VERSION = new Date(0).toISOString();

/** Issues của một lần parse hỏng, in kèm slug để biết tour nào vượt trần nào. */
function failures(slug: string, result: { success: boolean; error?: { issues: unknown[] } }) {
  return result.success ? [] : [`${slug}: ${JSON.stringify(result.error?.issues)}`];
}

describe('fixture seed vừa khuôn khu làm việc F17', () => {
  it('bốn schema sửa đều nhận mọi tour seed', () => {
    // Fixture phải có đủ 29 tour — một mảng rỗng thì "không lỗi nào" chẳng chứng minh gì.
    expect(catalog.tours.length).toBeGreaterThan(0);
    const problems = catalog.tours.flatMap((tour) => {
      const byTour = <T extends { tourId: string }>(rows: readonly T[]) =>
        rows.filter((row) => row.tourId === tour.id);
      return [
        ...failures(
          tour.slug,
          AdminTourDetailsInputSchema.safeParse({
            id: tour.id,
            version: VERSION,
            title: tour.title,
            summary: tour.summary,
            categoryId: tour.categoryId,
            difficulty: tour.difficulty,
            isFeatured: tour.isFeatured,
            durationDays: tour.durationDays,
            maxGroupSize: tour.maxGroupSize,
            basePrice: tour.basePrice,
            destinations: byTour(catalog.tourDestinations).map((link) => ({
              destinationId: link.destinationId,
              isPrimary: link.isPrimary,
            })),
            suitableFor: tour.suitableFor,
            badges: tour.badges,
            highlights: tour.highlights,
            included: tour.included,
            excluded: tour.excluded,
            meetingPoint: tour.meetingPoint,
            factDurationNote: tour.factDurationNote,
            factGroupSizeNote: tour.factGroupSizeNote,
            factDifficultyNote: tour.factDifficultyNote,
            factGoodForNote: tour.factGoodForNote,
          }),
        ),
        ...failures(
          tour.slug,
          AdminTourItineraryInputSchema.safeParse({
            id: tour.id,
            version: VERSION,
            days: byTour(catalog.tourItineraryDays).map((day) => ({
              dayNumber: day.dayNumber,
              title: day.title,
              description: day.description,
            })),
          }),
        ),
        ...failures(
          tour.slug,
          AdminTourFaqsPoliciesInputSchema.safeParse({
            id: tour.id,
            version: VERSION,
            faqs: byTour(catalog.tourFaqs).map((faq) => ({
              question: faq.question,
              answer: faq.answer,
            })),
            policies: byTour(catalog.tourPolicies).map((policy) => ({
              kind: policy.kind,
              title: policy.title,
              body: policy.body,
            })),
          }),
        ),
        ...failures(
          tour.slug,
          AdminTourCostsInputSchema.safeParse({
            id: tour.id,
            version: VERSION,
            items: byTour(catalog.tourCostItems).map((item) => ({
              category: item.category,
              label: item.label,
              amount: item.amount,
              basis: item.basis,
            })),
          }),
        ),
      ];
    });

    expect(problems).toEqual([]);
  });
});
