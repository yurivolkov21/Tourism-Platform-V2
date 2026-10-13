import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTableFrame } from './data-table-frame';

describe('DataTableFrame — khe hành động ở khổ hẹp (G45)', () => {
  it('khe hành động co được (`min-w-0`) và xuống dòng', () => {
    // Đo bằng CSS build thật (13/10): thiếu `min-w-0` thì chip lọc tài khoản mang email dài giữ
    // khe rộng bằng nguyên email, trang tràn ngang 322px ở 390px; có nó thì chip cắt chữ trong khung
    // ở 390, 768 và 1600px. jsdom không dàn trang nên ở đây chỉ canh class.
    render(
      <DataTableFrame views={null} actions={<button type="button">Columns</button>} footer={null}>
        <table />
      </DataTableFrame>,
    );

    const slot = screen.getByRole('button', { name: 'Columns' }).parentElement;
    expect(slot).toHaveClass('flex', 'min-w-0', 'flex-wrap');
  });
});
