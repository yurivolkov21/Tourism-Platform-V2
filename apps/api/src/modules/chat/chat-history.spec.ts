import type { UIMessage } from 'ai';
import {
  countUserMessages,
  ENQUIRY_CANCELLED_REASON,
  ENQUIRY_SKIPPED_REASON,
  nextSeq,
  prepareTurn,
  type StoredChatRow,
} from './chat-history.js';

function userRow(seq: number, text: string): StoredChatRow {
  return {
    seq,
    role: 'USER',
    message: { id: `u${seq}`, role: 'user', parts: [{ type: 'text', text }] },
  };
}

function assistantRow(seq: number, parts: UIMessage['parts']): StoredChatRow {
  return { seq, role: 'ASSISTANT', message: { id: `a${seq}`, role: 'assistant', parts } };
}

/** Phần tool đang chờ khách bấm Send/Cancel trên thẻ xác nhận. */
function pendingEnquiry(toolCallId: string, approvalId: string): UIMessage['parts'][number] {
  return {
    type: 'tool-submitEnquiry',
    toolCallId,
    state: 'approval-requested',
    input: { name: 'An', email: 'an@example.com', message: 'Hi' },
    approval: { id: approvalId },
  };
}

const textPart = (text: string): UIMessage['parts'][number] => ({ type: 'text', text });

describe('countUserMessages', () => {
  it('chỉ đếm tin của khách', () => {
    const rows = [userRow(1, 'a'), assistantRow(2, [textPart('b')]), userRow(3, 'c')];
    expect(countUserMessages(rows)).toBe(2);
    expect(countUserMessages([])).toBe(0);
  });
});

describe('nextSeq', () => {
  it('hội thoại mới bắt đầu từ 1', () => {
    expect(nextSeq([])).toBe(1);
  });

  it('lấy seq lớn nhất cộng một, không phụ thuộc thứ tự mảng', () => {
    expect(nextSeq([assistantRow(4, []), userRow(3, 'x'), userRow(1, 'y')])).toBe(5);
  });
});

describe('lý do từ chối gửi cho model', () => {
  // Không có lý do thì SDK gửi model câu "Tool call execution denied." như một lỗi, và model
  // nói "I'm unable to process this enquiry" sau khi khách bấm Cancel (B3 thử 19/10).
  // Câu "did not press Send" thì model hiểu là "chưa bấm" và bảo khách bấm Send (B3 thử
  // lại sau PR #42), nên lý do phải nói rõ thẻ đã đóng.
  it('bấm Cancel: nói rõ khách đã bấm Cancel, chưa gửi gì, thẻ đã đóng, không phải lỗi', () => {
    expect(ENQUIRY_CANCELLED_REASON).toContain('pressed Cancel');
    expect(ENQUIRY_CANCELLED_REASON).toContain('was not sent');
    expect(ENQUIRY_CANCELLED_REASON).toContain('the card is closed');
    expect(ENQUIRY_CANCELLED_REASON).toContain('not an error');
    expect(ENQUIRY_CANCELLED_REASON).toContain('tell them nothing was sent');
    expect(ENQUIRY_CANCELLED_REASON).not.toContain('did not press Send');
  });

  it('bỏ qua thẻ: chưa gửi gì và thẻ đã đóng', () => {
    expect(ENQUIRY_SKIPPED_REASON).toContain('without pressing Send or Cancel');
    expect(ENQUIRY_SKIPPED_REASON).toContain('was not sent');
    expect(ENQUIRY_SKIPPED_REASON).toContain('the card is closed');
  });
});

describe('prepareTurn — tin chữ', () => {
  it('nối tin khách vào cuối lịch sử, seq kế tiếp', () => {
    const rows = [userRow(1, 'hello'), assistantRow(2, [textPart('hi')])];
    const turn = prepareTurn(rows, { type: 'message', text: 'tours in Hue?' }, 'new-id');
    if (!turn.ok || turn.kind !== 'message') throw new Error('expected message turn');
    const userMessage = {
      id: 'new-id',
      role: 'user',
      parts: [{ type: 'text', text: 'tours in Hue?' }],
    };
    expect(turn.userSeq).toBe(3);
    expect(turn.userMessage).toEqual(userMessage);
    expect(turn.messages).toEqual([rows[0]?.message, rows[1]?.message, userMessage]);
    expect(turn.rewritten).toBeUndefined();
  });

  it('khách gõ tin mới khi thẻ xác nhận còn chờ: approval bị tự từ chối và ghi đè', () => {
    const rows = [
      userRow(1, 'send my enquiry'),
      assistantRow(2, [textPart('Please confirm.'), pendingEnquiry('call-1', 'appr-1')]),
    ];
    const turn = prepareTurn(rows, { type: 'message', text: 'actually, wait' }, 'new-id');
    if (!turn.ok || turn.kind !== 'message') throw new Error('expected message turn');

    expect(turn.rewritten?.seq).toBe(2);
    const denied = turn.rewritten?.message.parts[1];
    expect(denied).toMatchObject({
      type: 'tool-submitEnquiry',
      state: 'output-denied',
      approval: { id: 'appr-1', approved: false, reason: ENQUIRY_SKIPPED_REASON },
    });
    // Lịch sử đưa cho model mang bản đã từ chối, không còn phần đang chờ nào.
    expect(turn.messages[1]).toBe(turn.rewritten?.message);
    expect(JSON.stringify(turn.messages)).not.toContain('approval-requested');
    // Bản gốc không bị đổi tại chỗ.
    expect(rows[1]?.message.parts[1]).toMatchObject({ state: 'approval-requested' });
  });
});

describe('prepareTurn — quyết định duyệt', () => {
  const rows = [
    userRow(1, 'send my enquiry'),
    assistantRow(2, [textPart('Please confirm.'), pendingEnquiry('call-1', 'appr-1')]),
  ];

  it('Send: phần đang chờ thành approval-responded approved=true, ghi đè đúng tin trả lời', () => {
    const turn = prepareTurn(rows, { type: 'approval', approvalId: 'appr-1', approved: true }, 'x');
    if (!turn.ok || turn.kind !== 'approval') throw new Error('expected approval turn');
    expect(turn.pendingSeq).toBe(2);
    expect(turn.messages).toHaveLength(2);
    expect(turn.messages[1]?.id).toBe('a2');
    expect(turn.messages[1]?.parts[1]).toMatchObject({
      state: 'approval-responded',
      approval: { id: 'appr-1', approved: true },
    });
    expect(turn.messages[1]?.parts[1]).not.toHaveProperty('approval.reason');
    expect(rows[1]?.message.parts[1]).toMatchObject({ state: 'approval-requested' });
  });

  it('Cancel: approved=false, kèm lý do để model không đọc thành lỗi (B3 thử 19/10)', () => {
    const turn = prepareTurn(
      rows,
      { type: 'approval', approvalId: 'appr-1', approved: false },
      'x',
    );
    if (!turn.ok || turn.kind !== 'approval') throw new Error('expected approval turn');
    expect(turn.messages[1]?.parts[1]).toMatchObject({
      state: 'approval-responded',
      approval: { approved: false, reason: ENQUIRY_CANCELLED_REASON },
    });
  });

  it('approvalId lạ → không còn chờ', () => {
    expect(
      prepareTurn(rows, { type: 'approval', approvalId: 'nope', approved: true }, 'x'),
    ).toEqual({ ok: false, reason: 'approval-not-pending' });
  });

  it('phần đã trả lời rồi (gửi lại quyết định cũ) → không còn chờ', () => {
    const answered = [
      userRow(1, 'send'),
      assistantRow(2, [
        {
          type: 'tool-submitEnquiry',
          toolCallId: 'call-1',
          state: 'output-available',
          input: {},
          output: { sent: true },
          approval: { id: 'appr-1', approved: true },
        },
      ]),
    ];
    expect(
      prepareTurn(answered, { type: 'approval', approvalId: 'appr-1', approved: true }, 'x'),
    ).toEqual({ ok: false, reason: 'approval-not-pending' });
  });

  it('approval ở tin cũ không còn là tin cuối → không còn chờ', () => {
    const older = [...rows, userRow(3, 'something else')];
    expect(
      prepareTurn(older, { type: 'approval', approvalId: 'appr-1', approved: true }, 'x'),
    ).toEqual({ ok: false, reason: 'approval-not-pending' });
  });

  it('hội thoại rỗng → không còn chờ', () => {
    expect(
      prepareTurn([], { type: 'approval', approvalId: 'appr-1', approved: true }, 'x'),
    ).toEqual({ ok: false, reason: 'approval-not-pending' });
  });

  it('phần không phải tool có cùng chuỗi id không bị nhầm', () => {
    const textOnly = [userRow(1, 'hi'), assistantRow(2, [textPart('appr-1')])];
    expect(
      prepareTurn(textOnly, { type: 'approval', approvalId: 'appr-1', approved: true }, 'x'),
    ).toEqual({ ok: false, reason: 'approval-not-pending' });
  });

  it('hai tool cùng chờ: duyệt một cái, cái còn lại tự bị từ chối để model không gặp lời gọi treo', () => {
    const two = [
      userRow(1, 'send'),
      assistantRow(2, [pendingEnquiry('call-1', 'appr-1'), pendingEnquiry('call-2', 'appr-2')]),
    ];
    const turn = prepareTurn(two, { type: 'approval', approvalId: 'appr-2', approved: true }, 'x');
    if (!turn.ok || turn.kind !== 'approval') throw new Error('expected approval turn');
    expect(turn.messages[1]?.parts[0]).toMatchObject({
      state: 'approval-responded',
      approval: { id: 'appr-1', approved: false, reason: ENQUIRY_SKIPPED_REASON },
    });
    expect(turn.messages[1]?.parts[1]).toMatchObject({
      state: 'approval-responded',
      approval: { id: 'appr-2', approved: true },
    });
  });

  it('hai tool cùng chờ, khách bấm Cancel một cái: cái bấm mang lý do Cancel, cái kia lý do bỏ qua', () => {
    const two = [
      userRow(1, 'send'),
      assistantRow(2, [pendingEnquiry('call-1', 'appr-1'), pendingEnquiry('call-2', 'appr-2')]),
    ];
    const turn = prepareTurn(two, { type: 'approval', approvalId: 'appr-2', approved: false }, 'x');
    if (!turn.ok || turn.kind !== 'approval') throw new Error('expected approval turn');
    expect(turn.messages[1]?.parts[0]).toMatchObject({
      approval: { id: 'appr-1', approved: false, reason: ENQUIRY_SKIPPED_REASON },
    });
    expect(turn.messages[1]?.parts[1]).toMatchObject({
      approval: { id: 'appr-2', approved: false, reason: ENQUIRY_CANCELLED_REASON },
    });
  });

  it('approval tự động của SDK không phải thứ khách bấm được', () => {
    const auto = [
      userRow(1, 'send'),
      assistantRow(2, [
        {
          type: 'tool-submitEnquiry',
          toolCallId: 'call-1',
          state: 'approval-requested',
          input: {},
          approval: { id: 'appr-1', isAutomatic: true },
        },
      ]),
    ];
    expect(
      prepareTurn(auto, { type: 'approval', approvalId: 'appr-1', approved: true }, 'x'),
    ).toEqual({ ok: false, reason: 'approval-not-pending' });
  });
});
