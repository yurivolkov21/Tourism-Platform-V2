import { z } from 'zod';
import { MediaItemSchema } from './media.js';

/** Một slot brand-chrome public: key ổn định + media đã dựng URL. */
export const SiteMediaEntrySchema = z.object({
  key: z.string().min(1).max(60),
  media: z.array(MediaItemSchema),
});
export type SiteMediaEntry = z.output<typeof SiteMediaEntrySchema>;
