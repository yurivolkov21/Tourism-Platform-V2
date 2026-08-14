import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Lightbox } from './lightbox';

/**
 * Harness giữ state thay cho consumer thật. `Lightbox` là component ĐƯỢC ĐIỀU
 * KHIỂN (`openAt` do bên ngoài giữ) nên spec phải tự dựng chỗ chứa state.
 *
 * Có NÚT MỞ thật, không mở sẵn lúc mount: mở bằng cú bấm là đúng cách cả hai
 * consumer dùng nó (ô khảm tour, ô gallery vùng). Chuyện focus xem ở `open()`.
 *
 * Copy ở đây CỐ Ý khác copy của cả hai consumer thật (`1 of 3`, không phải
 * `1 / 3`): nhờ vậy test nào đọc được chuỗi này là bằng chứng chuỗi đi qua prop
 * chứ không nằm cứng trong component.
 */
function Harness({
  count = 3,
  openAt: openIndex = 0,
  caption,
  zoom,
}: {
  count?: number;
  /** Index mà nút "Open" sẽ mở tới. */
  openAt?: number;
  caption?: (index: number) => string | null;
  zoom?: {
    inLabel: string;
    outLabel: string;
    valueLabel: (percent: number) => string;
    toggleLabel: string;
  };
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpenAt(openIndex)}>
        Open
      </button>
      <Lightbox
        count={count}
        openAt={openAt}
        onOpenChange={(open) => setOpenAt(open ? (openAt ?? 0) : null)}
        onNavigate={setOpenAt}
        dialogTitle="Photo viewer"
        counterLabel={(current, total) => `${current} of ${total}`}
        closeLabel="Dismiss"
        previousLabel="Back one"
        nextLabel="On one"
        caption={caption}
        zoom={zoom}
        renderMedia={(index) => <div data-testid="media">media {index}</div>}
      />
    </>
  );
}

/**
 * Mở lightbox đúng cách người dùng mở nó. Trả về `user` để test bấm tiếp.
 *
 * `waitFor` chờ focus RƠI VÀO trong dialog, không chỉ chờ dialog xuất hiện: Base
 * UI dời focus trong một effect chạy SAU khi popup vào DOM, nên `findByRole` về
 * trước cuộc đua đó. Đo được `document.activeElement` vẫn là nút "Open" ngay sau
 * `findByRole` — và nút đó nằm NGOÀI portal, nên `user.keyboard` bắn mũi tên vào
 * nó thì `DialogContent` không bao giờ nhận được. Triệu chứng là một test mũi tên
 * đỏ tuỳ THỨ TỰ chạy: chạy riêng thì xanh (thắng cuộc đua), chạy cả file thì đỏ.
 */
async function open(ui: React.ReactElement) {
  const user = userEvent.setup();
  render(ui);
  await user.click(screen.getByRole('button', { name: 'Open' }));
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  return user;
}

describe('Lightbox — mở, đóng, và chỗ media', () => {
  it('chưa mở thì KHÔNG có dialog nào trong cây', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('không có gì để xem (count 0) thì bấm mở cũng KHÔNG dựng dialog rỗng', async () => {
    // Nhánh THẬT khi gắn API: bộ ảnh rỗng mà state mở còn sót lại từ lần trước.
    const user = userEvent.setup();
    render(<Harness count={0} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mở ở index nào thì renderMedia nhận ĐÚNG index đó', async () => {
    await open(<Harness count={5} openAt={3} />);
    expect(screen.getByTestId('media')).toHaveTextContent('media 3');
  });

  it('Escape đóng — dialog rời khỏi cây', async () => {
    const user = await open(<Harness />);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('nút đóng gọi onOpenChange(false)', async () => {
    const user = await open(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Lightbox — điều hướng', () => {
  it('mũi tên phải/trái đổi ảnh, và bộ đếm theo kịp', async () => {
    const user = await open(<Harness count={3} />);

    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    expect(screen.getByTestId('media')).toHaveTextContent('media 1');

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    expect(screen.getByTestId('media')).toHaveTextContent('media 0');
  });

  it('nút trước/sau đổi ảnh', async () => {
    const user = await open(<Harness count={3} openAt={1} />);
    await user.click(screen.getByRole('button', { name: 'On one' }));
    expect(screen.getByText('3 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back one' }));
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
  });

  // KHÔNG cuộn vòng: tới ảnh cuối rồi bấm tiếp mà quay về ảnh đầu làm người xem
  // tưởng mình chưa xem hết. Hành vi này ĐÃ CÓ ở bản cục bộ trong `tour-gallery`
  // (đã xoá 13/08) và việc tách ra không được đổi nó.
  it('KHÔNG cuộn vòng: nút bị vô hiệu ở ảnh đầu và ảnh cuối', async () => {
    const user = await open(<Harness count={3} />);
    expect(screen.getByRole('button', { name: 'Back one' })).toBeDisabled();

    const next = screen.getByRole('button', { name: 'On one' });
    await user.click(next);
    await user.click(next);
    expect(screen.getByText('3 of 3')).toBeInTheDocument();
    expect(next).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back one' })).toBeEnabled();
  });

  it('mũi tên ở hai đầu không đẩy index ra ngoài khoảng', async () => {
    const user = await open(<Harness count={2} />);
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });

  it('chỉ một ảnh thì cả hai nút đều vô hiệu', async () => {
    await open(<Harness count={1} />);
    expect(screen.getByRole('button', { name: 'Back one' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'On one' })).toBeDisabled();
  });
});

describe('Lightbox — trợ năng và copy', () => {
  it('mọi chuỗi đến TỪ PROP — component không tự chứa copy nào', async () => {
    // Bộ đếm dùng chữ `of` của harness, không phải `/` của trang tour: nếu
    // component tự format thì test này đỏ.
    await open(<Harness count={3} />);
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    expect(screen.queryByText('1 / 3')).not.toBeInTheDocument();
  });

  it('DialogTitle có mặt cho trợ năng nhưng ẩn thị giác', async () => {
    await open(<Harness />);
    expect(screen.getByText('Photo viewer')).toHaveClass('sr-only');
  });

  it('bộ đếm công bố qua aria-live — đổi ảnh bằng bàn phím vẫn nghe được', async () => {
    await open(<Harness count={3} />);
    expect(screen.getByText('1 of 3')).toHaveAttribute('aria-live', 'polite');
  });
});

describe('Lightbox — chú thích', () => {
  it('caption trả chuỗi thì hiện thành chữ đọc được, theo đúng index', async () => {
    const user = await open(<Harness count={3} caption={(index) => `Scene ${index}`} />);
    expect(screen.getByText('Scene 0')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('Scene 1')).toBeInTheDocument();
  });

  it('caption trả null thì KHÔNG bịa chú thích — chỉ còn bộ đếm', async () => {
    await open(<Harness count={3} caption={() => null} />);
    expect(screen.getByRole('dialog').querySelectorAll('p')).toHaveLength(1);
  });

  it('không truyền caption thì cũng không có chú thích nào', async () => {
    await open(<Harness count={3} />);
    expect(screen.getByRole('dialog').querySelectorAll('p')).toHaveLength(1);
  });
});

describe('Lightbox — thu/phóng (nợ A12)', () => {
  const zoom = {
    inLabel: 'Zoom in',
    outLabel: 'Zoom out',
    valueLabel: (p: number) => `${p}%`,
    toggleLabel: 'Zoom photo',
  };

  const openZoomable = () => open(<Harness count={3} zoom={zoom} />);

  it('KHÔNG truyền prop `zoom` thì không có nút thu/phóng nào', async () => {
    await open(<Harness count={3} />);
    expect(screen.queryByRole('button', { name: 'Zoom in' })).toBeNull();
  });

  it('mở ra ở 100%, nút thu bị vô hiệu — không thu nhỏ hơn ảnh gốc', async () => {
    await openZoomable();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
  });

  it('bấm phóng đi từng nấc và dừng ở trần, KHÔNG phóng vô hạn', async () => {
    const user = await openZoomable();
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    await user.click(zoomIn);
    expect(screen.getByText('150%')).toBeInTheDocument();
    await user.click(zoomIn);
    await user.click(zoomIn);
    expect(screen.getByText('300%')).toBeInTheDocument();
    expect(zoomIn).toBeDisabled();
  });

  it('đổi ảnh thì zoom về gốc — ảnh kế mở ra ở góc crop ngẫu nhiên là vô nghĩa', async () => {
    const user = await openZoomable();
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('150%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'On one' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('phím + và - đổi mức, phím 0 về gốc', async () => {
    const user = await openZoomable();
    await user.keyboard('+');
    expect(screen.getByText('150%')).toBeInTheDocument();
    await user.keyboard('-');
    expect(screen.getByText('100%')).toBeInTheDocument();
    await user.keyboard('++0');
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('mọi chuỗi thu/phóng cũng đến TỪ PROP', async () => {
    await open(
      <Harness
        count={2}
        zoom={{
          inLabel: 'PHONG',
          outLabel: 'THU',
          valueLabel: (p: number) => `${p} phần trăm`,
          toggleLabel: 'BAM DE PHONG',
        }}
      />,
    );
    expect(screen.getByRole('button', { name: 'PHONG' })).toBeInTheDocument();
    expect(screen.getByText('100 phần trăm')).toBeInTheDocument();
  });
});
