import { SITE_SLOT_KEYS, SITE_SLOTS, siteSlot } from '@tourism/contract';
import { aboutPage, homePage, messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { allSiteSlots, siteSlotFixture, slotImage } from '@/test/appearance';
import {
  CARD_PREVIEW_BOX,
  creditLine,
  fitFrame,
  narrowFrameWidth,
  slotCaption,
  toAppearanceBoard,
  toSlotVM,
} from './appearance-view';

const t = messages.admin.appearance;

describe('fitFrame — khung thu nhỏ giữ tỉ lệ', () => {
  it('khung ngang lớn thu theo bề rộng hộp', () => {
    expect(fitFrame([1436, 900], [256, 160])).toEqual([255, 160]);
  });

  it('khung đứng thu theo chiều cao hộp', () => {
    expect(fitFrame([390, 844], [120, 180])).toEqual([83, 180]);
  });

  it('khung nhỏ hơn hộp giữ nguyên, không phóng to', () => {
    expect(fitFrame([175, 131], [256, 160])).toEqual([175, 131]);
  });

  it('mọi khe của danh mục vừa ô thẻ mà tỉ lệ lệch không quá 2%', () => {
    for (const slot of SITE_SLOTS) {
      const frame = slot.frames.desktop ?? slot.frames.phone;
      if (frame === null) continue;
      const [width, height] = fitFrame(frame, CARD_PREVIEW_BOX);
      expect(width, slot.key).toBeLessThanOrEqual(CARD_PREVIEW_BOX[0]);
      expect(height, slot.key).toBeLessThanOrEqual(CARD_PREVIEW_BOX[1]);
      expect(Math.abs(width / height / (frame[0] / frame[1]) - 1), slot.key).toBeLessThan(0.02);
    }
  });
});

describe('narrowFrameWidth — cảnh báo ảnh hẹp', () => {
  const hero = siteSlot('home-hero').frames;

  it('ảnh 1200 px cho hero 1436 px: cảnh báo kèm bề rộng khung', () => {
    expect(narrowFrameWidth(1200, hero)).toBe(1436);
  });

  it('ảnh đủ rộng, hoặc không biết cỡ: không cảnh báo', () => {
    expect(narrowFrameWidth(2400, hero)).toBeNull();
    expect(narrowFrameWidth(1436, hero)).toBeNull();
    expect(narrowFrameWidth(null, hero)).toBeNull();
  });

  it('khe không hiện ở điện thoại so với khung desktop', () => {
    expect(narrowFrameWidth(700, siteSlot('auth-panel').frames)).toBe(720);
  });
});

describe('slotCaption — câu web đặt cạnh ảnh', () => {
  it('39 khe có câu, tám khe không', () => {
    const without = SITE_SLOT_KEYS.filter((key) => slotCaption(key) === null);
    expect(without).toEqual([
      'home-hero',
      'home-why-choose',
      'cta-band',
      'about-hero',
      'about-story',
      'about-cta-video',
      'contact-panel',
      'auth-panel',
    ]);
    expect(SITE_SLOT_KEYS.length - without.length).toBe(39);
  });

  it('đọc thẳng chuỗi web khi chuỗi nằm ở i18n', () => {
    expect(slotCaption('why-food')).toBe(homePage.whyChooseUs.items.food.title);
    expect(slotCaption('about-timeline-2021')).toBe(aboutPage.timeline.milestones.delta.title);
    expect(slotCaption('about-gallery-all')).toBe(aboutPage.gallery.allTitle);
    expect(slotCaption('region-gallery-north-1')).toBe(
      messages.regionPage.regions.north.galleryTiles[0],
    );
    expect(slotCaption('region-gallery-south-3')).toBe(
      messages.regionPage.regions.south.galleryTiles[2],
    );
  });

  it('ô bento in tên vùng; bưu thiếp in tiêu đề kèm câu nhỏ', () => {
    expect(slotCaption('about-gallery-central')).toBe('Central Vietnam');
    expect(slotCaption('region-signature-south-3')).toBe('Phú Quốc · Island sunsets');
  });

  it('khoảnh khắc và Team đọc bản chép; Team in chức danh', () => {
    expect(slotCaption('moment-lanha-kayak')).toBe(t.copiedCaptions['moment-lanha-kayak']);
    expect(slotCaption('about-team-ceo')).toBe('Co-founder & CEO');
  });
});

describe('creditLine', () => {
  it('ghép tác giả và giấy phép; thiếu cả hai thì null', () => {
    expect(creditLine('Jane Doe', 'CC BY-SA 4.0')).toBe('Jane Doe · CC BY-SA 4.0');
    expect(creditLine(null, 'Unsplash License')).toBe('Unsplash License');
    expect(creditLine(null, null)).toBeNull();
    expect(creditLine('', null)).toBeNull();
  });
});

describe('toSlotVM', () => {
  it('khe ảnh gốc: chip Original, cỡ ảnh, không có Restore original', () => {
    const vm = toSlotVM(siteSlotFixture('home-hero'));
    expect(vm.name).toBe('Home · Hero');
    expect(vm.imageKey).toBe('home-hero');
    expect(vm.image?.sourceLabel).toBe(t.source.ORIGINAL);
    expect(vm.image?.sizeLabel).toBe('2400 × 1350 px');
    expect(vm.image?.previewUrl).toContain('/upload/f_auto,q_auto,w_640/');
    expect(vm.canRestore).toBe(false);
    expect(vm.pageHref).toBe('http://localhost:3000/');
  });

  it('ảnh tải lên, ảnh thư viện, khe trống: đều có Restore original', () => {
    const upload = siteSlotFixture('cta-band', {
      image: slotImage('cta-band', { publicId: 'tourism/site/x/new', source: 'UPLOAD' }),
    });
    expect(toSlotVM(upload).canRestore).toBe(true);
    const library = siteSlotFixture('cta-band', {
      image: slotImage('cta-band', { publicId: 'lib/a1', source: 'LIBRARY' }),
    });
    expect(toSlotVM(library).canRestore).toBe(true);
    const empty = siteSlotFixture('cta-band', { image: null, version: null });
    expect(toSlotVM(empty)).toMatchObject({ canRestore: true, image: null, version: null });
  });

  it('khe video: không có khoá nhận ảnh, không Restore, vẽ ảnh poster', () => {
    const vm = toSlotVM(
      siteSlotFixture('about-cta-video', {
        image: slotImage('about-cta-video', {
          type: 'VIDEO',
          url: 'https://res.cloudinary.com/demo/video/upload/f_auto,q_auto/v1/clip',
          posterUrl: 'https://res.cloudinary.com/demo/video/upload/so_0/v1/clip.jpg',
        }),
      }),
    );
    expect(vm.imageKey).toBeNull();
    expect(vm.canRestore).toBe(false);
    expect(vm.image?.previewUrl).toBe(
      'https://res.cloudinary.com/demo/video/upload/so_0/v1/clip.jpg',
    );
  });

  it('dòng thiếu số đo: không in cỡ ảnh', () => {
    const vm = toSlotVM(
      siteSlotFixture('home-hero', {
        image: slotImage('home-hero', { width: null, height: null }),
      }),
    );
    expect(vm.image?.sizeLabel).toBeNull();
  });
});

describe('toAppearanceBoard', () => {
  it('tám nhóm theo thứ tự danh mục, đủ 47 khe, đếm đúng từng nhóm', () => {
    const board = toAppearanceBoard(allSiteSlots());
    expect(board.map((group) => [group.label, group.slots.length])).toEqual([
      ['Home', 8],
      ['About', 14],
      ['Contact', 1],
      ['Destinations', 5],
      ['Northern Vietnam', 6],
      ['Central Vietnam', 6],
      ['Southern Vietnam', 6],
      ['Sign-in pages', 1],
    ]);
    expect(board[0]?.countLabel).toBe('8 photos');
    expect(board[2]?.countLabel).toBe('1 photo');
    expect(board[4]?.pageHref).toBe('http://localhost:3000/destinations/northern-vietnam');
  });

  it('khe API không trả thì vắng mặt, không vỡ trang', () => {
    const board = toAppearanceBoard([siteSlotFixture('auth-panel')]);
    expect(board.flatMap((group) => group.slots.map((slot) => slot.key))).toEqual(['auth-panel']);
  });
});
