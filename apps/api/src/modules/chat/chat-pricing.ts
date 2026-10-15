/**
 * Bảng giá của trợ lý AI (ADR-0050 §4, spec §2e) — USD mỗi triệu token.
 *
 * Trần ngày `CHAT_DAILY_BUDGET_USD` đổi token đã ghi thành tiền bằng bảng này,
 * nên nó là một phần của cơ chế chặn chi phí chứ không chỉ là số hiển thị. Model
 * nào không có dòng ở đây thì env.ts chặn ngay lúc khởi động: không đoán giá.
 *
 * Nguồn: bảng giá công khai của Anthropic. Đổi model là thêm một dòng ở đây rồi
 * đổi `CHAT_MODEL`; giá đổi thì sửa dòng (giá không có ngày hiệu lực — số tiền
 * của những ngày đã qua không được tính lại vì trần chỉ đọc hôm nay).
 */
export const CHAT_PRICES = {
  'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
} as const satisfies Record<string, { inputPerMTok: number; outputPerMTok: number }>;

export type ChatModelId = keyof typeof CHAT_PRICES;

/** Model mặc định của spec §2g. */
export const DEFAULT_CHAT_MODEL: ChatModelId = 'claude-haiku-4-5';

export function isPricedModel(model: string): model is ChatModelId {
  return Object.hasOwn(CHAT_PRICES, model);
}

/** Chi phí USD của một lượng token theo bảng giá của model. */
export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  if (!isPricedModel(model)) throw new Error(`chat model ${model} has no price`);
  const price = CHAT_PRICES[model];
  return (inputTokens * price.inputPerMTok + outputTokens * price.outputPerMTok) / 1_000_000;
}
