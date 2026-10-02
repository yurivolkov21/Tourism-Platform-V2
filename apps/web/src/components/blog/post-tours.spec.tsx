import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { TourCardVM } from '@/lib/api/tours';
import { PostTours } from './post-tours';

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

function tour(slug: string, title: string): TourCardVM {
  return {
    id: `id-${slug}`,
    slug,
    title,
    summary: null,
    basePrice: '199.00',
    priceFrom: '199.00',
    compareAtPrice: null,
    currency: 'USD',
    durationDays: 3,
    difficulty: 'EASY',
    maxGroupSize: 12,
    isFeatured: false,
    destinations: [{ slug: 'hoi-an', name: 'Hoi An', isPrimary: true }],
    category: { slug: 'food', name: 'Food' },
    ratingAvg: 4.5,
    ratingCount: 20,
    cover: null,
  };
}

describe('PostTours', () => {
  it('có tour: tiêu đề "Tours in this story" và card theo ĐÚNG thứ tự admin xếp', () => {
    render(<PostTours tours={[tour('b-tour', 'Boat tour'), tour('a-tour', 'Alley tour')]} />);

    expect(
      screen.getByRole('heading', { level: 2, name: messages.blog.toursHeading }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Boat tour', 'Alley tour']);
  });

  it('rỗng: không vẽ gì, kể cả tiêu đề', () => {
    const { container } = render(<PostTours tours={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
