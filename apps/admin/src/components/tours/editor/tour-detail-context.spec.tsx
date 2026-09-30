import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminTourDetail } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { detailFixture } from '@/test/tour-detail';
import {
  TourDetailProvider,
  usePublishSavedDetail,
  useWorkspaceDetail,
} from './tour-detail-context';

/**
 * Bản tour mà PHẦN ĐẦU khu làm việc và thanh bước đọc (vòng review F17, F19): layout
 * không render lại khi chuyển bước phía client, nên props của nó chỉ mới tới lượt
 * refresh kế tiếp. Form đẩy bản vừa lưu vào đây để phần đầu và thanh bước đổi ngay.
 */
const V1 = '2026-09-28T01:00:00.000Z';
const V2 = '2026-09-28T02:00:00.000Z';
const V3 = '2026-09-28T03:00:00.000Z';

function Probe() {
  const detail = useWorkspaceDetail();
  return (
    <p data-testid="probe">
      {detail.title} · {detail.readiness.ready ? 'ready' : 'missing'} ·{' '}
      {detail.isPublished ? 'on sale' : 'off sale'}
    </p>
  );
}

function Publisher({ next }: { next: AdminTourDetail }) {
  const publish = usePublishSavedDetail();
  return (
    <button type="button" onClick={() => publish(next)}>
      publish
    </button>
  );
}

const missingSummary = (version: string, title: string) =>
  detailFixture({ version, title, summary: null, isPublished: false });
const ready = (version: string, title: string, isPublished = false) =>
  detailFixture({ version, title, isPublished });

function tree(server: AdminTourDetail, saved: AdminTourDetail) {
  return (
    <TourDetailProvider detail={server}>
      <Probe />
      <Publisher next={saved} />
    </TourDetailProvider>
  );
}

describe('TourDetailProvider', () => {
  it('bản form vừa lưu hiện NGAY ở phần đầu, không chờ lượt refresh', async () => {
    const user = userEvent.setup();
    render(tree(missingSummary(V1, 'Draft'), ready(V2, 'Draft')));
    expect(screen.getByTestId('probe')).toHaveTextContent('Draft · missing · off sale');

    await user.click(screen.getByRole('button', { name: 'publish' }));

    expect(screen.getByTestId('probe')).toHaveTextContent('Draft · ready · off sale');
  });

  it('props server CŨ hơn bản đã có (refresh về muộn) → giữ bản mới hơn', async () => {
    const user = userEvent.setup();
    const view = render(tree(missingSummary(V1, 'Draft'), ready(V2, 'Saved')));
    await user.click(screen.getByRole('button', { name: 'publish' }));

    view.rerender(tree(missingSummary(V1, 'Draft'), ready(V2, 'Saved')));

    expect(screen.getByTestId('probe')).toHaveTextContent('Saved · ready');
  });

  it('props server CÙNG phiên bản → nhận (bật/tắt bán không đổi phiên bản)', async () => {
    const user = userEvent.setup();
    const view = render(tree(missingSummary(V1, 'Draft'), ready(V2, 'Saved')));
    await user.click(screen.getByRole('button', { name: 'publish' }));

    view.rerender(tree(ready(V2, 'Saved', true), ready(V2, 'Saved')));

    expect(screen.getByTestId('probe')).toHaveTextContent('Saved · ready · on sale');
  });

  it('props server MỚI hơn (người khác vừa lưu) → nhận', () => {
    const view = render(tree(ready(V1, 'Mine'), ready(V2, 'Mine')));

    view.rerender(tree(missingSummary(V3, 'Theirs'), ready(V2, 'Mine')));

    expect(screen.getByTestId('probe')).toHaveTextContent('Theirs · missing');
  });

  it('ngoài provider (form dựng một mình trong test) thì publish là no-op', async () => {
    const user = userEvent.setup();
    render(<Publisher next={ready(V2, 'Alone')} />);
    await user.click(screen.getByRole('button', { name: 'publish' }));
    expect(screen.getByRole('button', { name: 'publish' })).toBeInTheDocument();
  });
});
