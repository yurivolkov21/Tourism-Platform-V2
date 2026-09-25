import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TourTabs } from './tour-tabs';

let pathname = '/tours/ha-long';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

beforeEach(() => {
  pathname = '/tours/ha-long';
});

/** Thanh tab của khu làm việc (spec F17 §2g): năm link, đúng một tab đang mở. */
describe('TourTabs', () => {
  it('năm link đúng thứ tự và đúng đường, trong một nav tên "Tour sections"', () => {
    render(<TourTabs slug="ha-long" />);

    const nav = screen.getByRole('navigation', { name: 'Tour sections' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Details',
      'Itinerary',
      'FAQ & policies',
      'Costs',
      'Departures',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/tours/ha-long',
      '/tours/ha-long/itinerary',
      '/tours/ha-long/content',
      '/tours/ha-long/costs',
      '/tours/ha-long/departures',
    ]);
  });

  it('ở /tours/ha-long/costs thì ĐÚNG MỘT link mang aria-current — "Costs"', () => {
    pathname = '/tours/ha-long/costs';
    render(<TourTabs slug="ha-long" />);

    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Costs']);
  });

  it('ở gốc /tours/ha-long thì tab đang mở là "Details"', () => {
    render(<TourTabs slug="ha-long" />);

    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.textContent)).toEqual(['Details']);
  });
});
