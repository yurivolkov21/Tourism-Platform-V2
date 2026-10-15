import { createAnthropic } from '@ai-sdk/anthropic';
import type { Provider } from '@nestjs/common';
import type { LanguageModel } from 'ai';
import { env } from '../../config/env.js';

/**
 * Cấu hình của trợ lý (spec §2g) đi qua DI chứ không đọc `env` thẳng trong service,
 * để int test ghi đè được bằng `overrideProvider`: bật cờ, hạ trần ngày, thay model
 * thật bằng `MockLanguageModelV4` — test không bao giờ gọi Anthropic.
 */

export const CHAT_CONFIG = Symbol('CHAT_CONFIG');
export const CHAT_LANGUAGE_MODEL = Symbol('CHAT_LANGUAGE_MODEL');

export interface ChatConfig {
  enabled: boolean;
  /** Id model để tra bảng giá; env.ts đã chặn model không có giá. */
  model: string;
  budgetUsd: number;
}

export const chatConfigProviders: Provider[] = [
  {
    provide: CHAT_CONFIG,
    useFactory: (): ChatConfig => ({
      enabled: env.CHAT_ENABLED,
      model: env.CHAT_MODEL,
      budgetUsd: env.CHAT_DAILY_BUDGET_USD,
    }),
  },
  {
    provide: CHAT_LANGUAGE_MODEL,
    inject: [CHAT_CONFIG],
    // Cờ tắt thì không dựng client nào: thiếu khoá vẫn khởi động được (env.ts chỉ
    // đòi khoá khi cờ bật).
    useFactory: (config: ChatConfig): LanguageModel | null =>
      config.enabled && env.ANTHROPIC_API_KEY
        ? createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(config.model)
        : null,
  },
];
