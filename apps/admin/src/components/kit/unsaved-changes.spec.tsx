import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsavedChangesProvider, useReportUnsaved } from './unsaved-changes';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

function Form({ dirty }: { dirty: boolean }) {
  useReportUnsaved(dirty);
  return <p>form</p>;
}

function Page({ dirty, showForm = true }: { dirty: boolean; showForm?: boolean }) {
  return (
    <UnsavedChangesProvider>
      <a href="/tours/ha-long/itinerary">Itinerary</a>
      {showForm ? <Form dirty={dirty} /> : null}
    </UnsavedChangesProvider>
  );
}

beforeEach(() => push.mockReset());

describe('UnsavedChangesProvider', () => {
  it('có thay đổi mà bấm link nội bộ → hỏi, chưa đi đâu cả', async () => {
    const user = userEvent.setup();
    render(<Page dirty />);

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));

    expect(
      screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' }),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('link điều hướng trong onClick (như next/link) KHÔNG chạy khi đang hỏi', async () => {
    // `next/link` điều hướng bằng `router.push` trong `onClick` của React, không
    // qua hành vi mặc định của thẻ <a>. Provider phải chặn ở pha CAPTURE của
    // `document` — trước listener gốc của React — nên onClick này không bao giờ chạy.
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(
      <UnsavedChangesProvider>
        <a
          href="/tours/ha-long/costs"
          onClick={(event) => {
            event.preventDefault();
            navigate();
          }}
        >
          Costs
        </a>
        <Form dirty />
      </UnsavedChangesProvider>,
    );

    await user.click(screen.getByRole('link', { name: 'Costs' }));

    expect(navigate).not.toHaveBeenCalled();
    expect(
      screen.getByRole('alertdialog', { name: 'Discard unsaved changes?' }),
    ).toBeInTheDocument();
  });

  it('Discard changes → đi đúng đường vừa bấm', async () => {
    const user = userEvent.setup();
    render(<Page dirty />);

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(push).toHaveBeenCalledWith('/tours/ha-long/itinerary');
  });

  it('Keep editing → đóng hộp, ở lại', async () => {
    const user = userEvent.setup();
    render(<Page dirty />);

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('không có thay đổi → không hỏi', async () => {
    const user = userEvent.setup();
    render(<Page dirty={false} />);

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('form gỡ khỏi trang thì thôi báo thay đổi', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Page dirty />);
    rerender(<Page dirty showForm={false} />);

    await user.click(screen.getByRole('link', { name: 'Itinerary' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('có thay đổi thì beforeunload bị chặn; không có thì không', () => {
    const { rerender } = render(<Page dirty />);
    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    rerender(<Page dirty={false} />);
    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
  });
});
