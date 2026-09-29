import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminTourDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetContentAction } from '@/lib/tour-editor-write';
import { detailFixture, TOUR_ID, VERSION } from '@/test/tour-detail';
import { TourContentForm } from './tour-content-form';

/**
 * Tab FAQ & policies (spec F17 §2h): hai khung sửa danh sách; chính sách huỷ sinh
 * tự động nên không nhập ở đây, và dòng CANCELLATION cũ không bị xoá im lặng.
 */
const e = messages.admin.tours.editor;
const t = e.content;
const le = messages.admin.listEditor;
const fe = e.form.errors;

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const NEXT_VERSION = '2026-09-24T10:11:13.000Z';

const TWO_FAQS = [
  { question: 'Q1', answer: 'A1' },
  { question: 'Q2', answer: 'A2' },
];
const BOOKING_POLICY = { kind: 'BOOKING' as const, title: 'Payment', body: 'Pay in full.' };

function renderForm(detail: AdminTourDetail = detailFixture(), save: SetContentAction = vi.fn()) {
  const user = userEvent.setup();
  render(<TourContentForm detail={detail} save={save} />);
  return { user };
}

const saveButton = () => screen.getByRole('button', { name: e.save });
const questions = () => screen.getAllByRole('textbox', { name: t.question });
const answers = () => screen.getAllByRole('textbox', { name: t.answer });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TourContentForm', () => {
  it('trần hai danh sách: 20 câu hỏi và 10 chính sách thì hai nút thêm khoá', () => {
    renderForm(
      detailFixture({
        faqs: Array.from({ length: 20 }, (_, i) => ({ question: `Q${i}`, answer: `A${i}` })),
        policies: Array.from({ length: 10 }, (_, i) => ({ ...BOOKING_POLICY, title: `P${i}` })),
      }),
    );

    expect(screen.getByRole('button', { name: t.addFaq })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: t.addPolicy })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByText(le.limit(20))).toBeInTheDocument();
    expect(screen.getByText(le.limit(10))).toBeInTheDocument();
  });

  it('thêm, dời, xoá một câu hỏi rồi Save: payload đúng thứ tự trên màn hình', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, detail: detailFixture() });
    const { user } = renderForm(
      detailFixture({ faqs: TWO_FAQS, policies: [BOOKING_POLICY] }),
      save,
    );

    await user.click(screen.getByRole('button', { name: t.addFaq }));
    await user.type(questions()[2] as HTMLElement, 'Q3');
    await user.type(answers()[2] as HTMLElement, 'A3');
    await user.click(screen.getByRole('button', { name: le.moveUp(t.faqName(3)) }));
    await user.click(screen.getByRole('button', { name: le.remove(t.faqName(1)) }));
    await user.click(saveButton());

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toEqual({
      id: TOUR_ID,
      version: VERSION,
      faqs: [
        { question: 'Q3', answer: 'A3' },
        { question: 'Q2', answer: 'A2' },
      ],
      policies: [BOOKING_POLICY],
    });
  });

  it('dòng mới để trống: lỗi dưới ô, không gửi', async () => {
    const save = vi.fn();
    const { user } = renderForm(detailFixture(), save);

    await user.click(screen.getByRole('button', { name: t.addFaq }));
    await user.click(saveButton());

    const alerts = screen.getAllByRole('alert').map((alert) => alert.textContent);
    expect(alerts).toEqual([fe.required, fe.required]);
    expect(save).not.toHaveBeenCalled();
  });

  it('loại chính sách là ô chọn hai mục Booking / General, và đổi được', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, detail: detailFixture() });
    const { user } = renderForm(detailFixture({ policies: [BOOKING_POLICY] }), save);

    const kind = screen.getByRole('combobox', { name: t.kind });
    expect(kind).toHaveTextContent(t.kinds.BOOKING);
    await user.click(kind);
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([t.kinds.BOOKING, t.kinds.GENERAL]);
    await user.click(screen.getByRole('option', { name: t.kinds.GENERAL }));
    await user.click(saveButton());

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0].policies).toEqual([{ ...BOOKING_POLICY, kind: 'GENERAL' }]);
  });

  it('câu về chính sách huỷ tự sinh luôn hiện; không có dòng CANCELLATION thì không báo gì', () => {
    renderForm();

    expect(screen.getByText(t.cancellationNote)).toBeInTheDocument();
    expect(screen.getByText(t.emptyFaq)).toBeInTheDocument();
    expect(screen.getByText(t.emptyPolicies)).toBeInTheDocument();
    expect(screen.queryByText(t.droppedCancellation(1))).not.toBeInTheDocument();
  });

  it('dữ liệu cũ có một chính sách CANCELLATION: không vào form, có câu báo sẽ bị xoá', () => {
    renderForm(
      detailFixture({
        policies: [
          BOOKING_POLICY,
          { kind: 'CANCELLATION', title: 'Old cancellation', body: 'Legacy text.' },
        ],
      }),
    );

    expect(screen.getByText(t.droppedCancellation(1))).toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { name: t.policyTitle })).toHaveLength(1);
    expect(screen.queryByDisplayValue('Old cancellation')).not.toBeInTheDocument();
  });

  it('lưu hai lần liền: lần hai gửi version của response lần một, không phải của props', async () => {
    // Response mang ĐÚNG thứ vừa lưu ("Q1!"): form phải lấy nó làm bản gốc mới thì
    // nút Save mới tắt — response trùng dữ liệu cũ sẽ che mất lỗi ấy.
    const save = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        detail: detailFixture({
          faqs: [
            { question: 'Q1!', answer: 'A1' },
            { question: 'Q2', answer: 'A2' },
          ],
          version: NEXT_VERSION,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        detail: detailFixture({ faqs: TWO_FAQS, version: '2026-09-24T10:11:14.000Z' }),
      });
    const { user } = renderForm(detailFixture({ faqs: TWO_FAQS }), save);

    await user.type(questions()[0] as HTMLElement, '!');
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(saveButton()).toHaveAttribute('aria-disabled', 'true'));

    await user.type(questions()[0] as HTMLElement, '?');
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));

    expect(save.mock.calls[0]?.[0].version).toBe(VERSION);
    expect(save.mock.calls[1]?.[0].version).toBe(NEXT_VERSION);
  });

  it('dòng FAQ và dòng chính sách mở đầu bằng nhãn: cụm nút canh ngang ô nhập đầu tiên', () => {
    // Thử tay F17: ↑ ↓ và thùng rác nằm ngang nhãn "Question" / "Kind", lệch khỏi ô nhập.
    renderForm(detailFixture({ faqs: TWO_FAQS, policies: [BOOKING_POLICY] }));
    const rows = document.querySelectorAll('[data-slot="row-actions"]');

    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row).toHaveAttribute('data-align', 'field');
  });
});

describe('TourContentForm — bước FAQ & policies (F19)', () => {
  const a = e.aside;
  const aside = () => within(screen.getByRole('complementary'));

  it('hai card mang id="faq" và id="policies"; cột phải đếm theo danh sách ĐANG SOẠN', async () => {
    const { user } = renderForm();
    expect(document.getElementById('faq')).toHaveTextContent(t.faqTitle);
    expect(document.getElementById('policies')).toHaveTextContent(t.policiesTitle);
    expect(
      aside().getByRole('link', { name: `${t.faqTitle} ${a.content.faqCount(0)}` }),
    ).toHaveAttribute('href', '#faq');
    expect(
      aside().getByRole('link', { name: `${t.policiesTitle} ${a.content.policyCount(0)}` }),
    ).toHaveAttribute('href', '#policies');

    await user.click(screen.getByRole('button', { name: t.addFaq }));

    expect(
      aside().getByRole('link', { name: `${t.faqTitle} ${a.content.faqCount(1)}` }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.addPolicy }));

    expect(
      aside().getByRole('link', { name: `${t.policiesTitle} ${a.content.policyCount(1)}` }),
    ).toBeInTheDocument();
  });

  it('câu chính sách huỷ chỉ còn ở card riêng bên phải — không lặp trong card Policies', () => {
    renderForm();
    expect(screen.getAllByText(t.cancellationNote)).toHaveLength(1);
    expect(aside().getByText(t.cancellationNote)).toBeInTheDocument();
    expect(aside().getByText(a.content.cancellationTitle)).toBeInTheDocument();
    expect(aside().getByText(a.optionalStep)).toBeInTheDocument();
  });

  it('chân form: link Next: Costs', () => {
    renderForm();
    expect(screen.getByRole('link', { name: e.next(e.tabs.costs) })).toHaveAttribute(
      'href',
      '/tours/ha-long-bay-cruise/costs',
    );
  });
});
