import { costUsd } from './chat-pricing.js';

/**
 * Cổng trần chi phí ngày (ADR-0050 §4 lớp 3, spec §2e) — phần thuần, không chạm DB.
 *
 * Ngày tính theo UTC chứ không theo lịch Việt Nam như "hôm nay" trong prompt: trần
 * này so với hoá đơn của Anthropic, mà log dùng giờ UTC. Hai mốc khác nhau có chủ
 * đích (spec §4).
 */

/** 00:00 UTC của ngày chứa `now` — cận dưới của câu cộng token hôm nay. */
export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export interface TokenTotals {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Đã chạm trần chưa. ĐÚNG BẰNG trần là chặn: trần là số tiền tối đa được tiêu,
 * không phải số tiền còn được phép vượt thêm một lượt.
 */
export function isOverDailyBudget(spent: TokenTotals, model: string, budgetUsd: number): boolean {
  return costUsd(model, spent.inputTokens, spent.outputTokens) >= budgetUsd;
}
