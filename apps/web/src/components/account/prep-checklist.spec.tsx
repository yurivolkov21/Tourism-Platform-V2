import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrepChecklist } from './prep-checklist';

const KEY = 'prep:BK-B6VCOQNW';
const ITEMS = ['Lunch (own arrangement)', 'Tips', 'Personal expenses'];

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PrepChecklist', () => {
  it('mỗi mục một ô tích có tên; chưa lưu gì thì chưa tích', () => {
    render(<PrepChecklist storageKey={KEY} items={ITEMS} />);
    for (const item of ITEMS) {
      expect(screen.getByRole('checkbox', { name: item })).not.toBeChecked();
    }
  });

  it('đọc lại bản đã lưu của ĐÚNG mã đơn sau khi mount', async () => {
    window.localStorage.setItem(KEY, JSON.stringify(['Tips']));
    window.localStorage.setItem('prep:BK-OTHER', JSON.stringify(['Personal expenses']));
    render(<PrepChecklist storageKey={KEY} items={ITEMS} />);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Tips' })).toBeChecked());
    expect(screen.getByRole('checkbox', { name: 'Personal expenses' })).not.toBeChecked();
  });

  it('tích thì lưu theo thứ tự danh sách, không theo thứ tự bấm', async () => {
    const user = userEvent.setup();
    render(<PrepChecklist storageKey={KEY} items={ITEMS} />);
    await user.click(screen.getByRole('checkbox', { name: 'Personal expenses' }));
    await user.click(screen.getByRole('checkbox', { name: 'Lunch (own arrangement)' }));
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? 'null')).toEqual([
      'Lunch (own arrangement)',
      'Personal expenses',
    ]);
  });

  it('bỏ tích thì gỡ khỏi bản lưu', async () => {
    window.localStorage.setItem(KEY, JSON.stringify(['Tips', 'Personal expenses']));
    const user = userEvent.setup();
    render(<PrepChecklist storageKey={KEY} items={ITEMS} />);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Tips' })).toBeChecked());
    await user.click(screen.getByRole('checkbox', { name: 'Tips' }));
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? 'null')).toEqual(['Personal expenses']);
  });

  it('storage bị chặn: không vỡ, vẫn tích được trên màn hình', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();
    render(<PrepChecklist storageKey={KEY} items={ITEMS} />);
    await user.click(screen.getByRole('checkbox', { name: 'Tips' }));
    expect(screen.getByRole('checkbox', { name: 'Tips' })).toBeChecked();
    expect(getItem).toHaveBeenCalledWith(KEY);
    expect(setItem).toHaveBeenCalled();
  });
});
