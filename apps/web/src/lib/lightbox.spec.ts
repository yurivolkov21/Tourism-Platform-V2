import { describe, expect, it } from 'vitest';
import { clampPan, nextZoom, ZOOM_STEPS, zoomPercent } from './lightbox';

describe('nextZoom', () => {
  it('đi lên từng nấc theo thang đã khai, không nhân đôi tuỳ tiện', () => {
    expect(nextZoom(1, 1)).toBe(ZOOM_STEPS[1]);
    expect(nextZoom(ZOOM_STEPS[1] as number, 1)).toBe(ZOOM_STEPS[2]);
  });

  it('kịch trần thì đứng yên, KHÔNG phóng vô hạn', () => {
    const max = ZOOM_STEPS[ZOOM_STEPS.length - 1] as number;
    expect(nextZoom(max, 1)).toBe(max);
  });

  it('kịch đáy thì đứng ở 1× — không thu nhỏ hơn ảnh gốc', () => {
    expect(nextZoom(1, -1)).toBe(1);
  });

  it('giá trị lạ (không nằm trên thang) rơi về nấc gần nhất rồi mới đi', () => {
    // Có thể xảy ra nếu ai đó bơm state từ ngoài; không được kẹt.
    // 1.7 nằm giữa 1.5 và 2 → lên là 2, xuống là 1.5 (nấc kề, không nhảy về đáy).
    expect(nextZoom(1.7, 1)).toBe(ZOOM_STEPS[2]);
    expect(nextZoom(1.7, -1)).toBe(ZOOM_STEPS[1]);
  });
});

describe('zoomPercent', () => {
  it('in số nguyên phần trăm, không phần thập phân', () => {
    expect(zoomPercent(1)).toBe(100);
    expect(zoomPercent(1.5)).toBe(150);
    expect(zoomPercent(3)).toBe(300);
  });
});

describe('clampPan', () => {
  const box = { width: 800, height: 500 };

  it('ở 1× thì KHÔNG kéo được — không có gì thừa ra để kéo', () => {
    expect(clampPan({ x: 120, y: 80 }, 1, box)).toEqual({ x: 0, y: 0 });
  });

  it('ở 2× kéo được tối đa nửa phần thừa mỗi chiều', () => {
    // Ảnh rộng 1600 trong khung 800 → thừa 800, mỗi bên 400.
    expect(clampPan({ x: 1000, y: 1000 }, 2, box)).toEqual({ x: 400, y: 250 });
    expect(clampPan({ x: -1000, y: -1000 }, 2, box)).toEqual({ x: -400, y: -250 });
  });

  it('trong biên thì giữ nguyên, không bẻ về 0', () => {
    expect(clampPan({ x: 100, y: -60 }, 2, box)).toEqual({ x: 100, y: -60 });
  });

  it('khung 0×0 (chưa đo được lúc mount) không cho ra NaN', () => {
    expect(clampPan({ x: 50, y: 50 }, 2, { width: 0, height: 0 })).toEqual({ x: 0, y: 0 });
  });
});
