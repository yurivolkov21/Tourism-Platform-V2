import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Inclusions } from './inclusions';

describe('Inclusions', () => {
  it('render nguyên văn từng dòng của cả hai cột', () => {
    render(
      <Inclusions
        included={['One night aboard a junk', 'All meals']}
        excluded={['Flights', 'Travel insurance']}
      />,
    );
    expect(screen.getByText('One night aboard a junk')).toBeInTheDocument();
    expect(screen.getByText('Travel insurance')).toBeInTheDocument();
  });

  it('một cột rỗng vẫn GIỮ cả hai tiêu đề, cột rỗng hiện dấu gạch', () => {
    // Bỏ cột đi làm hai tour cạnh nhau có bố cục khác nhau, và người đọc mất mốc
    // so sánh "cái gì không có trong giá".
    render(<Inclusions included={['Airport transfers']} excluded={[]} />);
    expect(screen.getByRole('heading', { name: /^included$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /not included/i })).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('cả hai cột rỗng thì có HAI dấu gạch, không phải section trống', () => {
    render(<Inclusions included={[]} excluded={[]} />);
    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});
