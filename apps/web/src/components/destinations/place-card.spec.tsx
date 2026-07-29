import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MockDestination } from '@/mocks/types';
import { PlaceCard } from './place-card';

function dest(overrides: Partial<MockDestination> = {}): MockDestination {
  return {
    id: 'id-sa-pa',
    slug: 'sa-pa',
    name: 'Sa Pa',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description: 'Misty rice terraces',
    tourCount: 3,
    ...overrides,
  };
}

describe('PlaceCard', () => {
  it('CẢ HÀNG là một link sang trang lọc tour CÓ THẬT', () => {
    render(<PlaceCard destination={dest()} />);
    expect(screen.getByRole('link', { name: /Sa Pa/ })).toHaveAttribute(
      'href',
      '/tours?destinations=sa-pa',
    );
  });

  it('HIỆN description — đây là thứ bản 3-thẻ bỏ phí', () => {
    render(<PlaceCard destination={dest()} />);
    expect(screen.getByText('Misty rice terraces')).toBeInTheDocument();
  });

  it('in số tour DẪN XUẤT, số nhiều', () => {
    render(<PlaceCard destination={dest()} />);
    expect(screen.getByText('3 tours')).toBeInTheDocument();
  });

  it('số ÍT khi địa điểm chỉ có 1 tour', () => {
    render(<PlaceCard destination={dest({ tourCount: 1 })} />);
    expect(screen.getByText('1 tour')).toBeInTheDocument();
  });

  // `description` nullable trong contract (`DestinationSchema`) — không render
  // đoạn rỗng, và không in chữ "null".
  it('description null thì bỏ hẳn đoạn, không in "null"', () => {
    render(<PlaceCard destination={dest({ description: null })} />);
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sa Pa/ })).toBeInTheDocument();
  });
});
