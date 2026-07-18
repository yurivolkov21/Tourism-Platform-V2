import { z } from 'zod';

/**
 * Catalog read schemas (spec §6) — the ONE source of truth for the public
 * catalog surface: oRPC contract input/output + (later) P3 web client types.
 *
 * Conventions:
 * - Prisma `Decimal` money is serialized as a STRING (`"39.00"`) — never a
 *   float — so amounts survive JSON round-trips losslessly.
 * - Prisma `@db.Date` columns serialize as calendar dates (`YYYY-MM-DD`).
 * - DB-nullable fields are `.nullable()` (the API returns explicit `null`,
 *   not omitted keys).
 */

/** Non-negative decimal serialized as string, e.g. "39.00". */
export const DecimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'expected a non-negative decimal string');

/** Mirrors Prisma enum TourDifficulty (audit M4). */
export const TourDifficultySchema = z.enum(['EASY', 'MODERATE', 'CHALLENGING']);

/** Mirrors Prisma enum TravellerType. */
export const TravellerTypeSchema = z.enum(['FAMILY', 'COUPLE', 'FRIENDS', 'SOLO', 'BUSINESS']);

/** Mirrors Prisma enum TourBadge. */
export const TourBadgeSchema = z.enum([
  'BEST_VALUE',
  'LIMITED_OFFER',
  'EXCLUSIVE',
  'NEW',
  'POPULAR',
]);

/** Mirrors Prisma enum PolicyKind. */
export const PolicyKindSchema = z.enum(['CANCELLATION', 'BOOKING', 'GENERAL']);

// ─────────────────────────────────────────────────────────────────────────────
// Tour card (public list item)
// ─────────────────────────────────────────────────────────────────────────────

export const TourCardSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  summary: z.string().max(500).nullable(),
  basePrice: DecimalStringSchema,
  compareAtPrice: DecimalStringSchema.nullable(),
  currency: z.string().length(3),
  durationDays: z.int().positive(),
  difficulty: TourDifficultySchema.nullable(),
  maxGroupSize: z.int().positive(),
  isFeatured: z.boolean(),
  primaryDestination: z.object({ slug: z.string(), name: z.string() }).nullable(),
  category: z.object({ slug: z.string(), name: z.string() }),
});

export type TourCard = z.output<typeof TourCardSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Tour detail (card + editorial content + upcoming OPEN departures)
// ─────────────────────────────────────────────────────────────────────────────

export const TourItineraryDaySchema = z.object({
  dayNumber: z.int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
});

export const TourFaqSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(2000),
});

export const TourPolicySchema = z.object({
  kind: PolicyKindSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});

/** Upcoming OPEN departure. `effectivePrice = priceOverride ?? tour.basePrice`. */
export const TourDepartureSchema = z.object({
  id: z.uuid(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  seatsLeft: z.int().nonnegative(),
  effectivePrice: DecimalStringSchema,
  compareAtPrice: DecimalStringSchema.nullable(),
});

export const TourDetailSchema = TourCardSchema.extend({
  // Schema v2 has no single `description` column — the tour body is the
  // structured merchandising content below (summary lives on the card).
  suitableFor: z.array(TravellerTypeSchema),
  badges: z.array(TourBadgeSchema),
  included: z.array(z.string()),
  excluded: z.array(z.string()),
  highlights: z.array(z.string()),
  meetingPoint: z.string().max(300).nullable(),
  itinerary: z.array(TourItineraryDaySchema),
  faqs: z.array(TourFaqSchema),
  policies: z.array(TourPolicySchema),
  departures: z.array(TourDepartureSchema),
});

export type TourDetail = z.output<typeof TourDetailSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Destination + category
// ─────────────────────────────────────────────────────────────────────────────

export const DestinationSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  country: z.string().min(1).max(60),
  region: z.string().max(80).nullable(),
  description: z.string().max(2000).nullable(),
  /** Number of PUBLISHED tours touching this destination. */
  tourCount: z.int().nonnegative(),
});

export type Destination = z.output<typeof DestinationSchema>;

export const TourCategorySchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  order: z.int(),
});

export type TourCategory = z.output<typeof TourCategorySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// List query + pagination envelope
// ─────────────────────────────────────────────────────────────────────────────

export const TourSortKeySchema = z.enum(['createdAt', 'basePrice', 'durationDays', 'title']);
export const SortOrderSchema = z.enum(['asc', 'desc']);

/**
 * Query for `tours.list`. Plain typed fields (no z.coerce) — HTTP query-string
 * coercion is the server's job (ZodSmartCoercionPlugin), so client input
 * types stay honest (`page?: number`, `featured?: boolean`).
 */
export const ToursListQuerySchema = z.object({
  page: z.int().min(1).default(1),
  limit: z.int().min(1).max(50).default(12),
  /** Category slug. */
  category: z.string().min(1).max(60).optional(),
  /** Destination slug (any linked destination, not just primary). */
  destination: z.string().min(1).max(80).optional(),
  /** Case-insensitive substring match on title/summary. */
  search: z.string().min(1).max(100).optional(),
  featured: z.boolean().optional(),
  sort: TourSortKeySchema.default('createdAt'),
  order: SortOrderSchema.default('desc'),
});

export type ToursListQuery = z.output<typeof ToursListQuerySchema>;

/** Pagination envelope factory: `{ items, page, limit, total, totalPages }`. */
export function PagedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.int().min(1),
    limit: z.int().min(1),
    total: z.int().nonnegative(),
    totalPages: z.int().nonnegative(),
  });
}

export type Paged<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

export const HealthSchema = z.object({
  status: z.literal('ok'),
  uptimeSec: z.int().nonnegative(),
  timestamp: z.iso.datetime(),
});

export type Health = z.output<typeof HealthSchema>;
