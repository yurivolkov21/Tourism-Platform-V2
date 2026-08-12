import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { SignedUploadParams, SignUploadInput } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import {
  buildSignedUploadParams,
  resolveUploadConfig,
  uploadFolderFor,
} from '../../lib/upload-signing.js';
import { checkReviewEligibility } from '../reviews/review-eligibility.js';
import {
  BookingForbiddenError,
  BookingNotFoundError,
  ReviewNotEligibleError,
  ReviewTripNotCompletedError,
} from '../reviews/reviews.service.js';

/** Thiếu cặp CLOUDINARY_API_KEY/SECRET — trạng thái hợp lệ (ADR-0021 §6). */
export class UploadsNotConfiguredError extends Error {}

/**
 * Ký upload trực-tiếp-lên-Cloudinary cho KHÁCH (ADR-0021). Server quyết
 * WHO (AVATAR: chính chủ; REVIEW_PHOTO: cùng luật eligibility với
 * reviews.create) và WHERE (folder theo purpose) — client chỉ cầm chữ ký.
 */
@Injectable()
export class UploadSigningService {
  async signUpload(callerId: string, input: SignUploadInput): Promise<SignedUploadParams> {
    const cfg = resolveUploadConfig(env);
    if (!cfg) throw new UploadsNotConfiguredError();

    if (input.purpose === 'REVIEW_PHOTO') {
      // Soi CÙNG luật với reviews.create — ký được nghĩa là review được;
      // lệch luật là khách upload xong mới bị từ chối ở bước gửi review.
      const booking = await prisma.booking.findUnique({
        where: { code: input.bookingCode },
        select: { userId: true, status: true, departureEndDate: true },
      });
      if (!booking) throw new BookingNotFoundError();
      const eligibility = checkReviewEligibility({
        bookingStatus: booking.status,
        departureEndDate: booking.departureEndDate,
        now: new Date(),
        ownerId: booking.userId,
        callerId,
      });
      if (!eligibility.ok) {
        if (eligibility.reason === 'NOT_OWNER') throw new BookingForbiddenError();
        if (eligibility.reason === 'TRIP_NOT_COMPLETED') throw new ReviewTripNotCompletedError();
        throw new ReviewNotEligibleError();
      }
    }

    const folder = uploadFolderFor(
      cfg.rootFolder,
      input.purpose === 'AVATAR'
        ? { purpose: 'AVATAR', userId: callerId }
        : { purpose: 'REVIEW_PHOTO', bookingCode: input.bookingCode },
    );
    // publicId server sinh (ADR-0021 §1) — client không được đặt tên file.
    return buildSignedUploadParams(cfg, folder, randomUUID(), Math.floor(Date.now() / 1000));
  }
}
