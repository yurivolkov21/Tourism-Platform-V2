import type { Destination } from '@tourism/contract';
import { groupDestinationsByRegion } from './group-destinations-by-region';

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

describe('groupDestinationsByRegion', () => {
  it('luôn trả đủ 3 nhóm theo đúng thứ tự Bắc · Trung · Nam, kể cả khi rỗng', () => {
    const groups = groupDestinationsByRegion([]);
    expect(groups.map((g) => g.region)).toEqual([
      'Northern Vietnam',
      'Central Vietnam',
      'Southern Vietnam',
    ]);
    expect(groups.every((g) => g.destinations.length === 0)).toBe(true);
  });

  it('xếp tourCount giảm dần trong từng nhóm', () => {
    const groups = groupDestinationsByRegion([
      dest({ id: 'a', region: 'Northern Vietnam', tourCount: 3 }),
      dest({ id: 'b', region: 'Northern Vietnam', tourCount: 11 }),
      dest({ id: 'c', region: 'Northern Vietnam', tourCount: 7 }),
    ]);
    const north = groups.find((g) => g.region === 'Northern Vietnam');
    expect(north?.destinations.map((d) => d.id)).toEqual(['b', 'c', 'a']);
  });

  it('bỏ qua region null hoặc lạ — không rơi vào nhóm nào', () => {
    const groups = groupDestinationsByRegion([
      dest({ id: 'a', region: null }),
      dest({ id: 'b', region: 'Somewhere Else' }),
      dest({ id: 'c', region: 'Central Vietnam' }),
    ]);
    const total = groups.reduce((sum, g) => sum + g.destinations.length, 0);
    expect(total).toBe(1);
    expect(groups.find((g) => g.region === 'Central Vietnam')?.destinations[0]?.id).toBe('c');
  });

  it('mỗi địa danh chỉ vào đúng MỘT nhóm', () => {
    const groups = groupDestinationsByRegion([dest({ id: 'a', region: 'Southern Vietnam' })]);
    const containing = groups.filter((g) => g.destinations.some((d) => d.id === 'a'));
    expect(containing).toHaveLength(1);
    expect(containing[0]?.region).toBe('Southern Vietnam');
  });
});
