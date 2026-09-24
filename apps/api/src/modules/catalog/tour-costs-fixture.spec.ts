import {
  derivedCostPrice,
  perDepartureTotal,
  perPersonTotal,
  TourCostBasisSchema,
  TourCostCategorySchema,
} from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import * as catalog from '../../../prisma/fixtures/catalog/index.js';
import { TourCostBasis, TourCostCategory } from '../../generated/prisma/enums.js';

/**
 * Ba con số giá vốn của MỌI tour trong fixture seed, tính bằng bản contract
 * (ADR-0047 §8). Snapshot được ghi ở F17 SAU khi đối chiếu từng tour với bản
 * `Prisma.Decimal` cũ — ba con số không được đổi mà không có lý do.
 */
function itemsOf(tourId: string) {
  return catalog.tourCostItems
    .filter((item) => item.tourId === tourId)
    .map((item) => ({ amount: item.amount, basis: item.basis }));
}

function figures() {
  return catalog.tours.map((tour) => {
    const items = itemsOf(tour.id);
    return `${tour.slug} ${perPersonTotal(items)} ${perDepartureTotal(items)} ${derivedCostPrice(items, tour.maxGroupSize)}`;
  });
}

describe('giá vốn trên fixture seed', () => {
  it('hai enum chi phí của contract gương đúng enum Prisma', () => {
    expect(TourCostCategorySchema.options).toEqual(Object.values(TourCostCategory));
    expect(TourCostBasisSchema.options).toEqual(Object.values(TourCostBasis));
  });

  it('ba con số của mọi tour seed đứng yên', () => {
    expect(figures()).toMatchInlineSnapshot(`
      [
        "hanoi-old-quarter-food-night 14.71 78.00 21.21",
        "hanoi-heritage-day 20.58 91.00 27.08",
        "red-river-craft-villages-day 18.89 78.00 25.39",
        "ninh-binh-trang-an-day 24.78 104.00 31.28",
        "halong-bay-overnight-cruise 112.85 286.00 125.85",
        "lan-ha-kayak-cruise-3d 176.29 390.00 195.79",
        "sapa-terraces-homestay-2d 72.59 156.00 85.59",
        "sapa-fansipan-summit-3d 121.39 234.00 140.89",
        "ha-giang-loop-4d 200.69 260.00 226.69",
        "mai-chau-cycling-2d 60.39 182.00 73.39",
        "northern-highlights-5d 334.89 520.00 367.39",
        "vietnam-grand-journey-12d 1152.90 1248.00 1230.90",
        "hue-imperial-day 23.10 91.00 29.60",
        "phong-nha-paradise-cave-day 27.31 91.00 33.81",
        "hoi-an-lantern-evening 16.38 104.00 22.88",
        "hoi-an-countryside-cooking-day 21.84 78.00 28.34",
        "bana-hills-golden-bridge-day 33.18 104.00 39.68",
        "my-son-sunrise-halfday 15.12 65.00 21.62",
        "central-heritage-4d 280.00 416.00 306.00",
        "quy-nhon-coastal-3d 164.09 273.00 183.59",
        "central-honeymoon-5d 426.39 260.00 458.89",
        "vung-tau-coastal-2d 78.69 208.00 91.69",
        "saigon-cu-chi-day 20.58 104.00 27.08",
        "saigon-after-dark-vespa 27.31 52.00 33.81",
        "mekong-can-tho-2d 84.79 208.00 97.79",
        "ben-tre-coconut-day 18.89 91.00 25.39",
        "da-lat-highlands-3d 133.59 273.00 153.09",
        "phu-quoc-island-hopping-day 24.78 104.00 31.28",
        "phu-quoc-honeymoon-4d 353.19 156.00 379.19",
      ]
    `);
  });
});
