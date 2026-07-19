import { Injectable } from '@nestjs/common';
import type { CreateEnquiryInput } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { primaryAdminEmail } from '../../config/env.js';
import { EmailType } from '../../generated/prisma/enums.js';

export class TourNotFoundError extends Error {}

@Injectable()
export class EnquiriesService {
  /**
   * Ghi 1 enquiry + xếp hàng 2 email trong CÙNG một transaction — TDD Task 4
   * (spec §4.3). Điểm cốt lõi: enquiry và cả hai outbox phải hoặc cùng có,
   * hoặc không gì cả. Ghi outbox NGOÀI transaction sẽ để lộ một cửa sổ mà
   * enquiry đã lưu nhưng email không bao giờ được xếp hàng (crash/lỗi giữa
   * hai lệnh ghi rời).
   */
  async create(input: CreateEnquiryInput): Promise<{ id: string }> {
    // Tour tuỳ chọn; nếu có thì phải là tour đang publish — check TRƯỚC
    // transaction để tránh mở transaction cho một request chắc chắn fail.
    let tourTitle: string | null = null;
    if (input.tourId) {
      const tour = await prisma.tour.findFirst({
        where: { id: input.tourId, isPublished: true },
        select: { title: true },
      });
      if (!tour) throw new TourNotFoundError();
      tourTitle = tour.title;
    }

    return prisma.$transaction(async (tx) => {
      const enquiry = await tx.enquiry.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone ?? null,
          message: input.message,
          tourId: input.tourId ?? null,
          nationality: input.nationality ?? null,
          travelDate: input.travelDate ? new Date(input.travelDate) : null,
          groupSize: input.groupSize ?? null,
          budgetTier: input.budgetTier ?? null,
          interests: input.interests,
        },
        select: { id: true },
      });

      // HAI outbox trong CÙNG transaction với insert: hoặc cả ba cùng có,
      // hoặc không gì cả (xem JSDoc phía trên).
      //
      // dedupeKey chứa id vừa sinh nên duy nhất theo cấu tạo. Dùng
      // `createMany` cho gọn; `skipDuplicates` ở đây không bao giờ skip gì —
      // xem docs/conventions/outbox-dedupe-key.md.
      const shared = {
        name: input.name,
        email: input.email,
        message: input.message,
        tourTitle,
      };
      await tx.outbox.createMany({
        data: [
          {
            type: EmailType.ENQUIRY_RECEIVED,
            // Ack gửi cho khách → người nhận là `email` trong payload.
            payload: shared,
            dedupeKey: `enquiry-received:${enquiry.id}`,
          },
          {
            type: EmailType.ENQUIRY_ADMIN_ALERT,
            // ⚠️ Alert gửi cho ADMIN, KHÔNG phải khách. `deliver()` mặc định
            // lấy người nhận từ `payload.email` — mà ở đây `email` là địa chỉ
            // KHÁCH (để admin đọc trong nội dung). Thiếu `to` thì alert bay
            // thẳng về hộp thư khách và không admin nào biết có lead mới,
            // đúng thứ A13 sinh ra để sửa. `to` THẮNG `email` trong deliver().
            // `primaryAdminEmail` là `string` thật (không `| undefined`) —
            // env.ts đã chặn ADMIN_EMAILS rỗng ngay lúc boot.
            payload: { ...shared, to: primaryAdminEmail },
            dedupeKey: `enquiry-admin-alert:${enquiry.id}`,
          },
        ],
      });

      return { id: enquiry.id };
    });
  }
}
