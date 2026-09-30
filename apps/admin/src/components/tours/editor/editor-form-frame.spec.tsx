import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsavedChangesProvider } from '@/components/kit/unsaved-changes';
import { EditorFormFrame } from './editor-form-frame';

/**
 * Khung chung của bốn form tab (spec F17 §2i): dải báo trên cùng, ghi chú và nút
 * Save ở chân. Nút chỉ sáng khi form có thay đổi.
 */
const t = messages.admin.tours.editor;

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const onReload = vi.fn();
beforeEach(() => {
  push.mockReset();
  onReload.mockReset();
});

function frame(props: Partial<React.ComponentProps<typeof EditorFormFrame>> = {}) {
  const onSubmit = vi.fn();
  render(
    <EditorFormFrame
      dirty={false}
      pending={false}
      banner={null}
      aside={<p>Right column</p>}
      onSubmit={onSubmit}
      onReload={onReload}
      {...props}
    >
      <input aria-label="Name" />
    </EditorFormFrame>,
  );
  return { onSubmit: (props.onSubmit as ReturnType<typeof vi.fn>) ?? onSubmit };
}

const saveButton = () => screen.getByRole('button', { name: t.save });

describe('EditorFormFrame', () => {
  it('chưa có thay đổi: nút Save khoá (vẫn focus được) và bấm không gửi', async () => {
    const user = userEvent.setup();
    const { onSubmit } = frame();

    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
    await user.click(saveButton());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('có thay đổi: bấm Save gửi đúng một lần', async () => {
    const user = userEvent.setup();
    const { onSubmit } = frame({ dirty: true });

    await user.click(saveButton());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('đang lưu: chữ nút là "Saving…" và không gửi thêm', async () => {
    const user = userEvent.setup();
    const { onSubmit } = frame({ dirty: true, pending: true });

    const button = screen.getByRole('button', { name: t.saving });
    await user.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('dải stale: câu báo và nút Reload gọi đường nạp lại của form', async () => {
    const user = userEvent.setup();
    frame({ banner: { kind: 'stale' } });

    expect(screen.getByText(t.banners.stale)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.banners.reload }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('server có bản mới hơn thứ đang sửa (serverChanged) → dải stale dù lần lưu chưa hỏng', async () => {
    // Vòng review F17: bản mới trôi về lúc form đang sửa thì form giữ chữ và
    // báo — không dựng lại form, không im lặng.
    const user = userEvent.setup();
    frame({ dirty: true, serverChanged: true });

    expect(screen.getByText(t.banners.stale)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.banners.reload }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('có thay đổi chưa lưu thì bấm link nội bộ bị hỏi lại (khung tự báo cho provider)', async () => {
    // Vòng review F17: không spec nào bọc khung trong provider, nên xoá
    // `useReportUnsaved(dirty)` khỏi khung vẫn xanh.
    const user = userEvent.setup();
    render(
      <UnsavedChangesProvider>
        <a href="/tours/ha-long/itinerary">Itinerary</a>
        <EditorFormFrame
          dirty
          pending={false}
          banner={null}
          aside={null}
          onSubmit={vi.fn()}
          onReload={onReload}
        >
          <input aria-label="Name" />
        </EditorFormFrame>
      </UnsavedChangesProvider>,
    );

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));

    expect(
      screen.getByRole('alertdialog', { name: messages.admin.unsavedChanges.title }),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('busy (đang tải ảnh) mà form sạch: rời trang vẫn bị hỏi lại, Save vẫn khoá (vòng review F18)', async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesProvider>
        <a href="/tours/ha-long/itinerary">Itinerary</a>
        <EditorFormFrame
          dirty={false}
          aside={null}
          busy
          pending={false}
          banner={null}
          onSubmit={vi.fn()}
          onReload={onReload}
        >
          <input aria-label="Name" />
        </EditorFormFrame>
      </UnsavedChangesProvider>,
    );

    // Đang tải không phải "có thay đổi để lưu".
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));

    expect(
      screen.getByRole('alertdialog', { name: messages.admin.unsavedChanges.title }),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('dải notReady: câu báo và link của từng chỗ thiếu', () => {
    frame({
      banner: {
        kind: 'notReady',
        issues: [
          { key: 'summary', label: 'A summary', href: '/tours/ha-long#tour-summary' },
          { key: 'days', label: 'An itinerary for day 3', href: '/tours/ha-long/itinerary#day-3' },
        ],
      },
    });

    expect(screen.getByText(t.banners.notReady)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'A summary' })).toHaveAttribute(
      'href',
      '/tours/ha-long#tour-summary',
    );
    expect(screen.getByRole('link', { name: 'An itinerary for day 3' })).toHaveAttribute(
      'href',
      '/tours/ha-long/itinerary#day-3',
    );
  });

  it('dải notReady mà bản dự tính không thấy thiếu gì → câu "Reload to see what changed"', () => {
    frame({ banner: { kind: 'notReady', issues: [] } });
    expect(screen.getByText(t.banners.notReadyUnknown)).toBeInTheDocument();
    // Không in câu "…would leave it missing:" trước một danh sách rỗng.
    expect(screen.queryByText(t.banners.notReady)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.banners.reload })).toBeInTheDocument();
  });

  it('dải lỗi kết cục không rõ: câu lỗi kèm Reload; lỗi rõ thì không có Reload', () => {
    const { unmount } = render(
      <EditorFormFrame
        dirty
        aside={null}
        pending={false}
        banner={{ kind: 'error', message: 'Something broke', uncertain: true }}
        onSubmit={vi.fn()}
        onReload={onReload}
      >
        <span />
      </EditorFormFrame>,
    );
    expect(screen.getByText('Something broke')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.banners.reload })).toBeInTheDocument();
    unmount();

    frame({ banner: { kind: 'error', message: 'Not allowed', uncertain: false } });
    expect(screen.getByText('Not allowed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.banners.reload })).not.toBeInTheDocument();
  });

  it('ghi chú hiện cạnh nút Save', () => {
    frame({ note: 'A new base price applies straight away.' });
    expect(screen.getByText('A new base price applies straight away.')).toBeInTheDocument();
  });

  it('blockedNote: Save khoá dù form có thay đổi, câu lý do thay chỗ ghi chú, submit không chạy', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <EditorFormFrame
        dirty
        aside={null}
        pending={false}
        banner={null}
        note="Saved costs apply from now on."
        blockedNote="Waiting for 2 uploads to finish."
        onSubmit={onSubmit}
        onReload={vi.fn()}
      >
        <input aria-label="Field" />
      </EditorFormFrame>,
    );

    expect(screen.getByText('Waiting for 2 uploads to finish.')).toBeInTheDocument();
    expect(screen.queryByText('Saved costs apply from now on.')).not.toBeInTheDocument();
    const save = screen.getByRole('button', { name: messages.admin.tours.editor.save });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    await user.type(screen.getByLabelText('Field'), '{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    // Lưới thứ hai: nút khoá đã chặn gửi ngầm, nên gửi thẳng form để chạm điều kiện
    // trong `onSubmit` của khung.
    const form = screen.getByLabelText('Field').closest('form');
    if (form === null) throw new Error('expected the field inside a form');
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('EditorFormFrame — bố cục bước (ADR-0049 §6)', () => {
  it('cột phải là <aside> đứng SAU form trong DOM', () => {
    frame();
    const aside = screen.getByRole('complementary');
    expect(aside).toHaveTextContent('Right column');
    const form = screen.getByRole('button', { name: t.save }).closest('form');
    expect(form?.compareDocumentPosition(aside)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  // Vòng review F19: hộp sticky cao hơn cửa sổ ghim theo mép trên và giấu phần dưới tới
  // hết form (1366×768 mất Tips và dòng giá của thẻ xem trước) — cột phải phải có trần
  // bằng cửa sổ và tự cuộn bên trong.
  it('cột phải dính có trần bằng cửa sổ và tự cuộn bên trong', () => {
    frame();
    const aside = screen.getByRole('complementary');
    expect(aside).toHaveClass('xl:sticky', 'xl:max-h-[calc(100svh-2rem)]', 'xl:overflow-y-auto');
  });

  it('next: link "Next: <bước>" ở chân form, đứng trước nút Save', () => {
    frame({ next: { href: '/tours/ha-long/photos', label: 'Photos' } });
    const next = screen.getByRole('link', { name: t.next('Photos') });
    expect(next).toHaveAttribute('href', '/tours/ha-long/photos');
    expect(next.compareDocumentPosition(screen.getByRole('button', { name: t.save }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('form có thay đổi: bấm Next bật hộp hỏi lại, không điều hướng (spec §4.4)', async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesProvider>
        <EditorFormFrame
          dirty
          aside={null}
          pending={false}
          banner={null}
          next={{ href: '/tours/ha-long/photos', label: 'Photos' }}
          onSubmit={vi.fn()}
          onReload={onReload}
        >
          <input aria-label="Name" />
        </EditorFormFrame>
      </UnsavedChangesProvider>,
    );

    await user.click(screen.getByRole('link', { name: t.next('Photos') }));

    expect(
      screen.getByRole('alertdialog', { name: messages.admin.unsavedChanges.title }),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
