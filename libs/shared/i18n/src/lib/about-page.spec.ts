import { aboutPage } from './about-page.js';

describe('aboutPage.gallery: bộ đếm tour', () => {
  it('chia số ít và số nhiều như mọi bộ đếm tour khác trong `messages`', () => {
    expect(aboutPage.gallery.regionTours(1)).toBe('1 tour');
    expect(aboutPage.gallery.regionTours(12)).toBe('12 tours');
    expect(aboutPage.gallery.allTours(1)).toBe('1 tour across three regions');
    expect(aboutPage.gallery.allTours(29)).toBe('29 tours across three regions');
  });
});
