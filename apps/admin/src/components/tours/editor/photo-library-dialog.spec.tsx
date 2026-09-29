import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminLibraryPhoto, AdminPhotoLibrary } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { LoadPhotoLibraryAction } from '@/lib/tour-photos';
import { DEST_A, DEST_B } from '@/test/tour-detail';
import { PhotoLibraryDialog } from './photo-library-dialog';

/** Hộp Add from library của tab Photos (spec F18 §2g, ADR-0048 §9). */
const t = messages.admin.tours.editor.photos.dialog;

const photo = (id: string, alt: string): AdminLibraryPhoto => ({
  publicId: `lib/${id}`,
  url: `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/lib/${id}`,
  alt,
  width: 2400,
  height: 1600,
  author: null,
  license: null,
});
const LIBRARY: AdminPhotoLibrary = [
  {
    destination: { id: DEST_A, name: 'Hạ Long' },
    photos: [photo('a1', 'Bay at dawn'), photo('a2', 'Cave lights')],
  },
  { destination: { id: DEST_B, name: 'Hà Nội' }, photos: [photo('b1', 'Old Quarter')] },
];

function Harness({
  load,
  capacity = 30,
  existing = [],
  onAdd = vi.fn(),
  tourDestinationIds = [DEST_A],
}: {
  load: LoadPhotoLibraryAction;
  capacity?: number;
  existing?: string[];
  onAdd?: (photos: AdminLibraryPhoto[]) => void;
  tourDestinationIds?: string[];
}) {
  const [library, setLibrary] = useState<AdminPhotoLibrary | null>(null);
  return (
    <PhotoLibraryDialog
      open
      onOpenChange={vi.fn()}
      library={library}
      onLoaded={setLibrary}
      load={load}
      tourDestinationIds={tourDestinationIds}
      existing={new Set(existing)}
      capacity={capacity}
      onAdd={onAdd}
    />
  );
}

describe('PhotoLibraryDialog', () => {
  it('tải thư viện MỘT lần; mặc định bày ảnh các địa danh của tour', async () => {
    const load = vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({ ok: true, library: LIBRARY });
    render(<Harness load={load} />);

    expect(screen.getByText(t.loading)).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'Bay at dawn' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Cave lights' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Old Quarter' })).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('đổi địa danh ở ô chọn thì bày ảnh của địa danh ấy', async () => {
    const user = userEvent.setup();
    const load = vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({ ok: true, library: LIBRARY });
    render(<Harness load={load} />);
    await screen.findByRole('checkbox', { name: 'Bay at dawn' });

    await user.click(screen.getByRole('combobox', { name: t.destination }));
    // Popup của Select mở bất đồng bộ — tìm đồng bộ thì chập chờn khi máy tải nặng.
    await user.click(await screen.findByRole('option', { name: 'Hà Nội' }));

    expect(screen.getByRole('checkbox', { name: 'Old Quarter' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Bay at dawn' })).not.toBeInTheDocument();
  });

  it('ảnh đã có trong tour hiện "Added", không tích được', async () => {
    const load = vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({ ok: true, library: LIBRARY });
    render(<Harness load={load} existing={['lib/a1']} />);

    const added = await screen.findByRole('checkbox', { name: 'Bay at dawn' });
    expect(added).toHaveAttribute('aria-disabled', 'true');
    const item = added.closest('li') as HTMLElement;
    expect(within(item).getByText(t.added)).toBeInTheDocument();
    expect(within(item).getByText('Bay at dawn')).toBeInTheDocument();
  });

  it('"Added" là nhãn riêng, không nối vào chú thích — alt dài cả câu bị cắt hai dòng sẽ nuốt mất nó (thử tay F18)', async () => {
    const long =
      'The Japanese Covered Bridge arching over a narrow canal in Hội An, its tiled roof reflected in the still water below.';
    const library: AdminPhotoLibrary = [
      {
        destination: { id: DEST_A, name: 'Hạ Long' },
        photos: [{ ...(LIBRARY[0]?.photos[0] as AdminLibraryPhoto), alt: long }],
      },
    ];
    const load = vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({ ok: true, library });
    render(<Harness load={load} existing={['lib/a1']} />);

    const item = (await screen.findByRole('checkbox', { name: long })).closest('li') as HTMLElement;
    // Chú thích chỉ mang alt, nhãn "Added" đứng riêng ngoài phần bị cắt.
    expect(within(item).getByText(long)).toBeInTheDocument();
    expect(within(item).getByText(t.added)).toBeInTheDocument();
  });

  it('không tích quá sức chứa; Add gửi đúng ảnh đã tích theo thứ tự bày', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const load = vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({ ok: true, library: LIBRARY });
    render(<Harness load={load} capacity={1} onAdd={onAdd} />);

    await user.click(await screen.findByRole('checkbox', { name: 'Cave lights' }));

    expect(screen.getByRole('checkbox', { name: 'Bay at dawn' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.click(screen.getByRole('button', { name: t.add(1) }));
    expect(onAdd).toHaveBeenCalledWith([photo('a2', 'Cave lights')]);
  });

  it('tải hỏng → câu lỗi và nút thử lại', async () => {
    const user = userEvent.setup();
    const load = vi
      .fn<LoadPhotoLibraryAction>()
      .mockResolvedValueOnce({ ok: false, code: 'GENERIC' })
      .mockResolvedValueOnce({ ok: true, library: LIBRARY });
    render(<Harness load={load} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(t.loadErrors.GENERIC);
    await user.click(screen.getByRole('button', { name: t.retry }));

    expect(await screen.findByRole('checkbox', { name: 'Bay at dawn' })).toBeInTheDocument();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it('ảnh nằm ở HAI địa danh của tour chỉ bày một lần và gửi một lần', async () => {
    // Gửi trùng publicId là `setPhotos` trả 400 lúc lưu (schema không nhận ảnh lặp).
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const shared = photo('a2', 'Cave lights');
    const load = vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({
      ok: true,
      library: [
        { destination: { id: DEST_A, name: 'Hạ Long' }, photos: [shared] },
        { destination: { id: DEST_B, name: 'Hà Nội' }, photos: [shared] },
      ],
    });
    render(<Harness load={load} onAdd={onAdd} tourDestinationIds={[DEST_A, DEST_B]} />);

    await screen.findByRole('checkbox', { name: 'Cave lights' });
    expect(screen.getAllByRole('checkbox', { name: 'Cave lights' })).toHaveLength(1);
    await user.click(screen.getByRole('checkbox', { name: 'Cave lights' }));
    await user.click(screen.getByRole('button', { name: t.add(1) }));
    expect(onAdd).toHaveBeenCalledWith([shared]);
  });
});

/** Hộp có thể đóng rồi mở lại — như tab Photos, hộp luôn mount. */
function Reopenable({
  load,
  capacity = 30,
  existing = [],
  onAdd = vi.fn(),
}: {
  load: LoadPhotoLibraryAction;
  capacity?: number;
  existing?: string[];
  onAdd?: (photos: AdminLibraryPhoto[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const [library, setLibrary] = useState<AdminPhotoLibrary | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open library
      </button>
      <PhotoLibraryDialog
        open={open}
        onOpenChange={setOpen}
        library={library}
        onLoaded={setLibrary}
        load={load}
        tourDestinationIds={[DEST_A]}
        existing={new Set(existing)}
        capacity={capacity}
        onAdd={onAdd}
      />
    </>
  );
}

describe('PhotoLibraryDialog — vòng review F18', () => {
  const loaded = () =>
    vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({ ok: true, library: LIBRARY });

  it('đóng bằng Cancel rồi mở lại: lựa chọn cũ không còn', async () => {
    const user = userEvent.setup();
    render(<Reopenable load={loaded()} />);

    await user.click(await screen.findByRole('checkbox', { name: 'Bay at dawn' }));
    await user.click(screen.getByRole('button', { name: t.cancel }));
    await user.click(screen.getByRole('button', { name: 'open library' }));

    expect(await screen.findByRole('checkbox', { name: 'Bay at dawn' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: t.add(0) })).toBeDisabled();
  });

  it('đóng bằng Esc rồi mở lại: lựa chọn cũ không còn', async () => {
    const user = userEvent.setup();
    render(<Reopenable load={loaded()} />);

    await user.click(await screen.findByRole('checkbox', { name: 'Bay at dawn' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'open library' }));

    expect(await screen.findByRole('checkbox', { name: 'Bay at dawn' })).not.toBeChecked();
  });

  it('Add không gửi ảnh đã có trong tour và không vượt sức chứa', async () => {
    // Form nạp bản server mới GIỮA lúc hộp mở (ảnh a1 vừa được thêm ở tab khác, sức chứa còn 1).
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const view = render(<Harness load={loaded()} onAdd={onAdd} />);

    await user.click(await screen.findByRole('checkbox', { name: 'Bay at dawn' }));
    await user.click(screen.getByRole('checkbox', { name: 'Cave lights' }));
    view.rerender(<Harness load={loaded()} onAdd={onAdd} existing={['lib/a1']} capacity={1} />);
    await user.click(screen.getByRole('button', { name: t.add(1) }));

    expect(onAdd).toHaveBeenCalledWith([photo('a2', 'Cave lights')]);
  });

  it('sức chứa giảm giữa lúc hộp mở: Add chỉ gửi đủ số chỗ còn trống, theo thứ tự bày', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const view = render(<Harness load={loaded()} onAdd={onAdd} capacity={2} />);

    await user.click(await screen.findByRole('checkbox', { name: 'Bay at dawn' }));
    await user.click(screen.getByRole('checkbox', { name: 'Cave lights' }));
    view.rerender(<Harness load={loaded()} onAdd={onAdd} capacity={1} />);
    await user.click(screen.getByRole('button', { name: t.add(1) }));

    expect(onAdd).toHaveBeenCalledWith([photo('a1', 'Bay at dawn')]);
  });

  it('lệnh tải NÉM (mạng đứt, redeploy): câu lỗi và nút thử lại, không kẹt ở Loading', async () => {
    const user = userEvent.setup();
    const load = vi
      .fn<LoadPhotoLibraryAction>()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, library: LIBRARY });
    render(<Harness load={load} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(t.loadErrors.GENERIC);
    await user.click(screen.getByRole('button', { name: t.retry }));

    expect(await screen.findByRole('checkbox', { name: 'Bay at dawn' })).toBeInTheDocument();
  });

  it('hết phiên (401) hay mất quyền (403): nói đúng chuyện, không mời thử lại', async () => {
    for (const code of ['UNAUTHORIZED', 'FORBIDDEN'] as const) {
      const load = vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({ ok: false, code });
      const view = render(<Harness load={load} />);

      expect(await screen.findByRole('alert')).toHaveTextContent(t.loadErrors[code]);
      expect(screen.queryByRole('button', { name: t.retry })).toBeNull();
      view.unmount();
    }
  });
});
