import { fireEvent, render, screen, within } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TourCardPreviewVM } from '@/lib/tour-editor-view';
import {
  AsideJumpLink,
  CoverPreviewCard,
  NoteCard,
  OptionalStepCard,
  StepChecklist,
  StepTips,
  TourCardPreview,
} from './step-aside';

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

  it('nhận mô tả riêng (bước Photos có dòng là luật lưu); tiêu đề luôn "This step"', () => {
    render(<StepChecklist description="Needed to save." items={[]} />);
    expect(screen.getByText(a.thisStep)).toBeInTheDocument();
    expect(screen.getByText('Needed to save.')).toBeInTheDocument();
  });
});

describe('StepTips và NoteCard', () => {
  it('tiêu đề "Tips" và đủ từng gợi ý', () => {
    render(<StepTips items={['One.', 'Two.']} />);
    expect(screen.getByText(a.tips)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual(['One.', 'Two.']);
  });

  it('NoteCard nhận tiêu đề riêng — khối "When it goes on sale" của Review', () => {
    render(<NoteCard title="When it goes on sale" items={['It appears on /tours.']} />);
    expect(screen.getByText('When it goes on sale')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('It appears on /tours.');
  });
});

describe('OptionalStepCard', () => {
  it('tiêu đề "On this step", câu "Optional"; có nội dung thì hiện kèm', () => {
    render(
      <OptionalStepCard>
        <span>2 questions</span>
      </OptionalStepCard>,
    );
    expect(screen.getByText(a.onThisStep)).toBeInTheDocument();
    expect(screen.getByText(a.optionalStep)).toBeInTheDocument();
    expect(screen.getByText('2 questions')).toBeInTheDocument();
  });
});

/**
 * Vòng review F19: link nhảy KHÔNG để trình duyệt đổi #hash — mục lịch sử do trình duyệt
 * tạo có `state` null, Next bỏ qua popstate của nó nên Back hỏng và hộp hỏi lại bị lách.
 */
describe('AsideJumpLink', () => {
  const scrollIntoView = vi.fn();
  beforeEach(() => {
    scrollIntoView.mockReset();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  function renderWithTarget() {
    render(
      <>
        <div id="day-2" tabIndex={-1}>
          Day 2 card
        </div>
        <AsideJumpLink targetId="day-2" label={<span>Day 2</span>} meta={<span>Done</span>} />
      </>,
    );
    return screen.getByRole('link', { name: 'Day 2 Done' });
  }

  it('tên truy cập tách hai phần bằng khoảng trắng; href giữ #id cho ngữ nghĩa link', () => {
    expect(renderWithTarget()).toHaveAttribute('href', '#day-2');
  });

  it('bấm: chặn đổi hash, cuộn tới đích và dời tiêu điểm vào nó', () => {
    const link = renderWithTarget();
    const clicked = fireEvent.click(link);
    expect(clicked).toBe(false); // preventDefault → trình duyệt không tạo mục lịch sử
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Day 2 card')).toHaveFocus();
  });

  it('đích không tồn tại: để trình duyệt tự xử lý, không ném lỗi', () => {
    render(<AsideJumpLink targetId="missing" label="FAQ" meta="0 questions" />);
    expect(fireEvent.click(screen.getByRole('link'))).toBe(true);
    expect(scrollIntoView).not.toHaveBeenCalled();
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
    price: '$199',
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
    expect(screen.getByText('$199')).toBeInTheDocument();
    expect(screen.getByText(a.preview.priceNote)).toBeInTheDocument();
  });

  it('không Featured: không chip, không câu luật; chưa ai đánh giá: "Not yet reviewed"', () => {
    render(<TourCardPreview preview={{ ...PREVIEW, featured: false, rating: null }} />);
    expect(screen.queryByText(tp.featuredBadge)).toBeNull();
    expect(screen.queryByText(a.preview.featuredNote)).toBeNull();
    expect(screen.getByText(tp.notRated)).toBeInTheDocument();
  });

  describe('Summary dài hơn hai dòng', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    function fakeLayout(scrollHeight: number) {
      // jsdom không dựng layout — giả hai thước đo của đoạn bị kẹp hai dòng.
      vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
      vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(32);
    }

    it('tràn: hiện câu báo card cắt sau hai dòng', async () => {
      fakeLayout(64);
      render(<TourCardPreview preview={PREVIEW} />);
      expect(await screen.findByText(a.preview.summaryCut)).toBeInTheDocument();
    });

    it('vừa hai dòng: không báo gì', () => {
      fakeLayout(32);
      render(<TourCardPreview preview={PREVIEW} />);
      expect(screen.queryByText(a.preview.summaryCut)).toBeNull();
    });

    // Spec §4 #1 "đo lại khi chữ đổi": đoạn cao cố định 2lh nên sửa chữ không đổi cỡ hộp,
    // ResizeObserver không báo — chỉ `text` trong mảng phụ thuộc của effect mới đo lại. Đi
    // chiều tràn → vừa để bắt cả lỗi quên đo lại lẫn lỗi chỉ bật cờ mà không tắt.
    it('chữ đổi thì đo lại: rút Summary về vừa hai dòng, câu báo mất', async () => {
      fakeLayout(64);
      const { rerender } = render(<TourCardPreview preview={PREVIEW} />);
      expect(await screen.findByText(a.preview.summaryCut)).toBeInTheDocument();
      fakeLayout(32);
      rerender(<TourCardPreview preview={{ ...PREVIEW, summary: 'Three days.' }} />);
      expect(screen.queryByText(a.preview.summaryCut)).toBeNull();
    });
  });
});
