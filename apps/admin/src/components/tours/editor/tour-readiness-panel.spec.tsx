import { render, screen } from '@testing-library/react';
import { tourReadiness } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { TourReadinessPanel } from './tour-readiness-panel';

/**
 * Khung readiness ở đầu khu làm việc (spec F17 §2c, §2g): đủ thì một câu yên
 * tâm; thiếu thì mỗi chỗ thiếu một link tới ĐÚNG tab và ĐÚNG ô cần sửa.
 */
describe('TourReadinessPanel', () => {
  it('tour đủ → "Ready to sell"', () => {
    const ready = tourReadiness({
      summary: 'x',
      destinations: [{ isPrimary: true }],
      durationDays: 1,
      itineraryDays: [1],
      hasCover: true,
    });
    render(<TourReadinessPanel readiness={ready} slug="ha-long" />);

    expect(screen.getByText('Ready to sell')).toBeInTheDocument();
    expect(
      screen.getByText('It has a summary, a primary destination and a plan for every day.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('tour thiếu → liệt kê chỗ thiếu, mỗi mục một link đúng tab và đúng ô', () => {
    const missing = tourReadiness({
      summary: null,
      destinations: [{ isPrimary: true }],
      durationDays: 3,
      itineraryDays: [1],
      hasCover: true,
    });
    render(<TourReadinessPanel readiness={missing} slug="ha-long" />);

    expect(screen.getByText('Missing before it can go on sale:')).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'A summary' })).toHaveAttribute(
      'href',
      '/tours/ha-long#tour-summary',
    );
    expect(screen.getByRole('link', { name: 'An itinerary for days 2–3' })).toHaveAttribute(
      'href',
      '/tours/ha-long/itinerary#day-2',
    );
  });
});
