import { render, screen, within } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import type { TourCardPreviewVM } from '@/lib/tour-editor-view';
import { CoverPreviewCard, StepChecklist, StepTips, TourCardPreview } from './step-aside';

/**
 * Khối dùng chung của cột phải (ADR-0049 §6): danh sách việc cần làm của bước, gợi ý,
 * ảnh bìa. Dấu trạng thái là icon ẩn — trình đọc màn hình nghe chữ thay cho nó.
 */
const a = messages.admin.tours.editor.aside;
const state = messages.admin.tours.editor.steps.state;

describe('StepChecklist', () => {
  it('tiêu đề mặc định "This step"; mỗi dòng nói trạng thái bằng chữ cho trình đọc màn hình', () => {
    render(
      <StepChecklist
        items={[
          { key: 'summary', label: 'A summary', detail: a.required, state: 'ok' },
          { key: 'primary', label: 'A primary destination', detail: a.required, state: 'warn' },
          { key: 'selling', label: 'Highlights', detail: 'Optional', state: 'optional' },
        ]}
      />,
    );
    expect(screen.getByText(a.thisStep)).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent(`${state.ok}A summary`);
    expect(rows[1]).toHaveTextContent(`${state.warn}A primary destination`);
    expect(rows[2]).toHaveTextContent(`${state.optional}Highlights`);
    expect(within(rows[1] as HTMLElement).getByText(a.required)).toBeInTheDocument();
  });

  it('nhận tiêu đề và mô tả riêng', () => {
    render(<StepChecklist title="On this step" description="Optional." items={[]} />);
    expect(screen.getByText('On this step')).toBeInTheDocument();
    expect(screen.getByText('Optional.')).toBeInTheDocument();
  });
});

describe('StepTips', () => {
  it('tiêu đề "Tips" và đủ từng gợi ý', () => {
    render(<StepTips items={['One.', 'Two.']} />);
    expect(screen.getByText(a.tips)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual(['One.', 'Two.']);
  });
});

describe('CoverPreviewCard', () => {
  it('có ảnh: ảnh trang trí (alt rỗng) dùng thumbnail 320px', () => {
    const { container } = render(
      <CoverPreviewCard url="https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/x" />,
    );
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('alt', '');
    expect(img?.getAttribute('src')).toContain('/upload/f_auto,q_auto,w_320/');
  });

  it('chưa có ảnh: nói ra thay vì để ô trống', () => {
    render(<CoverPreviewCard url={null} />);
    expect(screen.getByText(a.preview.noCover)).toBeInTheDocument();
  });
});

describe('TourCardPreview', () => {
  const tp = messages.toursPage;
  const PREVIEW: TourCardPreviewVM = {
    coverUrl: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/x',
    title: 'Ha Long Bay Cruise',
    summary: 'Three days on the bay.',
    featured: true,
    facts: 'Hạ Long · 3 days · Max 12',
    rating: { value: '4.7', count: '128' },
    price: '$199.00',
  };

  it('Featured: chip trên ảnh kèm câu luật giảm giá; dữ kiện, tên, sao; giá GỐC kèm câu giải thích', () => {
    render(<TourCardPreview preview={PREVIEW} />);
    expect(screen.getByText(a.preview.title)).toBeInTheDocument();
    expect(screen.getByText(tp.featuredBadge)).toBeInTheDocument();
    expect(screen.getByText(a.preview.featuredNote)).toBeInTheDocument();
    expect(screen.getByText('Hạ Long · 3 days · Max 12')).toBeInTheDocument();
    expect(screen.getByText('Ha Long Bay Cruise')).toBeInTheDocument();
    expect(screen.getByText('4.7')).toBeInTheDocument();
    expect(screen.getByText('(128)')).toBeInTheDocument();
    expect(screen.getByText(a.preview.basePrice)).toBeInTheDocument();
    expect(screen.getByText('$199.00')).toBeInTheDocument();
    expect(screen.getByText(a.preview.priceNote)).toBeInTheDocument();
  });

  it('không Featured: không chip, không câu luật; chưa ai đánh giá: "Not yet reviewed"', () => {
    render(<TourCardPreview preview={{ ...PREVIEW, featured: false, rating: null }} />);
    expect(screen.queryByText(tp.featuredBadge)).toBeNull();
    expect(screen.queryByText(a.preview.featuredNote)).toBeNull();
    expect(screen.getByText(tp.notRated)).toBeInTheDocument();
  });
});
