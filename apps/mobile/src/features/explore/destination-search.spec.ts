import type { Destination } from '@tourism/contract';
import { matchDestinationsByPrefix } from './destination-search';

function dest(overrides: Partial<Destination>): Destination {
  return {
    id: 'id',
    slug: 'slug',
    name: 'Name',
    country: 'Vietnam',
    region: 'Northern Vietnam',
    description: null,
    tourCount: 0,
    cover: null,
    ...overrides,
  };
}

describe('matchDestinationsByPrefix', () => {
  const destinations = [
    dest({ id: 'hn', slug: 'ha-noi', name: 'Hà Nội' }),
    dest({ id: 'hl', slug: 'ha-long', name: 'Hạ Long' }),
    dest({ id: 'hg', slug: 'ha-giang', name: 'Hà Giang' }),
    dest({ id: 'mc', slug: 'mai-chau', name: 'Mai Châu' }),
    dest({ id: 'pn', slug: 'phong-nha', name: 'Phong Nha' }),
  ];

  it('"ha" khớp ĐẦU TỪ, bỏ dấu — ra Hà Nội/Hạ Long/Hà Giang, KHÔNG ra Mai Châu hay Phong Nha', () => {
    const result = matchDestinationsByPrefix(destinations, 'ha');
    expect(result.map((d) => d.id).sort()).toEqual(['hg', 'hl', 'hn']);
  });

  it('bỏ dấu ở CẢ hai phía: gõ không dấu "ha long" vẫn ra "Hạ Long"', () => {
    expect(matchDestinationsByPrefix(destinations, 'ha long').map((d) => d.id)).toEqual(['hl']);
  });

  it('query rỗng (hoặc chỉ khoảng trắng) → mảng rỗng, không phải "khớp mọi thứ"', () => {
    expect(matchDestinationsByPrefix(destinations, '')).toEqual([]);
    expect(matchDestinationsByPrefix(destinations, '   ')).toEqual([]);
  });

  it('không khớp gì → mảng rỗng', () => {
    expect(matchDestinationsByPrefix(destinations, 'xyz')).toEqual([]);
  });
});
