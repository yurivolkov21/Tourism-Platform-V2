import { z } from 'zod';

/**
 * Một media asset đã dựng URL (ADR-0005). `url` là thứ web render; `publicId`
 * giữ để admin (P4) re-submit item không đổi. DB-nullable → `.nullable()`.
 */
export const MediaItemSchema = z.object({
  publicId: z.string().min(1),
  url: z.url(),
  type: z.enum(['IMAGE', 'VIDEO']),
  role: z.enum(['hero', 'gallery', 'avatar', 'body']),
  posterUrl: z.url().nullable(),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  alt: z.string().nullable(),
  sortOrder: z.int().nonnegative(),
});

export type MediaItem = z.output<typeof MediaItemSchema>;
