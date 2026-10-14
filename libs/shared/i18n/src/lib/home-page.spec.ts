import { homePage } from './home-page.js';

describe('homePage.gallery.tourCount', () => {
  it('chia số ít và số nhiều như mọi bộ đếm tour khác trong `messages`', () => {
    expect(homePage.gallery.tourCount(1)).toBe('1 tour');
    expect(homePage.gallery.tourCount(4)).toBe('4 tours');
  });
});
