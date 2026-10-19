import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toSlotVM } from '@/lib/appearance-view';
import type { AppearanceActions, SetSlotAction, SignSlotAction } from '@/lib/appearance-write';
import type { LoadPhotoLibraryAction } from '@/lib/photo-library';
import { SLOT_VERSION, siteSlotFixture, slotImage } from '@/test/appearance';
import { SlotCard } from './slot-card';

/**
 * Thẻ khe (spec P4f Appearance §6.1): chip nguồn, cỡ ảnh, câu chú thích, dòng app mobile; nút
 * Replace mở hộp; Restore original chỉ khi khe không dùng ảnh gốc, qua hộp xác nhận.
 */
const t = messages.admin.appearance;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => refresh() }),
}));

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  refresh.mockReset();
});

function renderCard(
  slot: Parameters<typeof toSlotVM>[0],
  setSlot: SetSlotAction = vi.fn<SetSlotAction>(),
) {
  const actions: AppearanceActions = { setSlot, signUpload: vi.fn<SignSlotAction>() };
  return render(
    <SlotCard
      slot={toSlotVM(slot)}
      actions={actions}
      library={null}
      onLibraryChange={vi.fn()}
      loadLibrary={vi.fn<LoadPhotoLibraryAction>()}
    />,
  );
}

const LIBRARY_IMAGE = slotImage('moment-lanha-kayak', {
  publicId: 'tourism/catalog/destination/hoi-an/1',
  source: 'LIBRARY',
});

describe('SlotCard', () => {
  it('ảnh gốc: chip Original, cỡ ảnh, nút Replace; KHÔNG có Restore original', () => {
    renderCard(siteSlotFixture('home-hero'));
    expect(screen.getByRole('heading', { name: 'Hero' })).toBeInTheDocument();
    expect(screen.getByText(t.source.ORIGINAL)).toBeInTheDocument();
    expect(screen.getByText('2400 × 1350 px')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.replaceLabel('Home · Hero') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restore/i })).not.toBeInTheDocument();
  });

  it('khe có câu chú thích và khe app mobile ghim: in cả hai dòng', () => {
    renderCard(siteSlotFixture('moment-lanha-kayak', { image: LIBRARY_IMAGE }));
    expect(screen.getByText(t.caption(t.copiedCaptions['moment-lanha-kayak']))).toBeInTheDocument();
    expect(screen.getByText(t.mobileApp)).toBeInTheDocument();
    expect(screen.getByText(t.source.LIBRARY)).toBeInTheDocument();
  });

  it('khe video: chỉ xem, không nút nào', () => {
    renderCard(siteSlotFixture('about-cta-video'));
    expect(screen.getByText(t.video)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('khe trống: khung ghi "No photo", câu đầy đủ (site vẽ ô giữ chỗ) đứng một lần dưới nhãn', () => {
    renderCard(siteSlotFixture('cta-band', { image: null, version: null }));
    expect(screen.getByText(t.emptyFrame)).toBeInTheDocument();
    expect(screen.getByText(t.empty)).toBeInTheDocument();
  });

  it('Restore original: hộp xác nhận mang tên khe, lệnh gửi ảnh gốc ở phiên bản thẻ đang cầm', async () => {
    const setSlot = vi.fn<SetSlotAction>(async () => ({
      ok: true,
      slot: siteSlotFixture('moment-lanha-kayak'),
    }));
    const user = userEvent.setup();
    renderCard(siteSlotFixture('moment-lanha-kayak', { image: LIBRARY_IMAGE }), setSlot);

    await user.click(
      screen.getByRole('button', { name: t.restoreLabel('Destinations · Moments · large photo') }),
    );
    const dialog = await screen.findByRole('dialog', { name: t.restoreDialog.title });
    expect(within(dialog).getByText('Destinations · Moments · large photo')).toBeInTheDocument();
    expect(within(dialog).getByText(t.restoreDialog.kept)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.restoreDialog.submit }));

    await waitFor(() =>
      expect(setSlot).toHaveBeenCalledWith({
        key: 'moment-lanha-kayak',
        version: SLOT_VERSION,
        image: { publicId: 'tourism/catalog/site/moment-lanha-kayak', alt: 'A city at sunrise' },
      }),
    );
    await waitFor(() => expect(success).toHaveBeenCalled());
    expect(refresh).toHaveBeenCalled();
  });

  it('Restore original khi ảnh đang dùng là ảnh tải lên: câu hệ quả nói ảnh ấy bị xoá sau 7 ngày', async () => {
    const user = userEvent.setup();
    renderCard(
      siteSlotFixture('cta-band', {
        image: slotImage('cta-band', { publicId: 'tourism/site/s1/new', source: 'UPLOAD' }),
      }),
    );
    await user.click(screen.getByRole('button', { name: t.restoreLabel('Home · Closing banner') }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(t.restoreDialog.uploadedGone)).toBeInTheDocument();
  });

  it('Restore original gặp STALE_SLOT: đóng hộp, toast lỗi, tải lại thẻ', async () => {
    const setSlot = vi.fn<SetSlotAction>(async () => ({ ok: false, code: 'STALE_SLOT' }));
    const user = userEvent.setup();
    renderCard(siteSlotFixture('moment-lanha-kayak', { image: LIBRARY_IMAGE }), setSlot);

    await user.click(screen.getByRole('button', { name: /restore/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: t.restoreDialog.submit }));

    await waitFor(() => expect(errorToast).toHaveBeenCalledWith(t.errors.STALE_SLOT));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(refresh).toHaveBeenCalled();
  });
});
