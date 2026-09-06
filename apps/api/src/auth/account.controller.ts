import { Body, Controller, Delete, Get, HttpCode, HttpException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AUTHED_WRITE_THROTTLE } from '../config/throttle.js';
// NB: AccountService phải là VALUE import (DI qua decorator metadata).
import {
  AccountCredentialMissingError,
  AccountHasOpenCancellationError,
  AccountHasPaidBookingsError,
  AccountPasswordInvalidError,
  AccountService,
} from './account.service.js';
import type { SessionUser } from './auth.config.js';
import { AuthGuard } from './auth.guard.js';
import { AuthedWriteThrottlerGuard } from './authed-write-throttler.guard.js';
import { CurrentUser } from './current-user.decorator.js';

/** Body của DELETE /api/account (ADR-0017 §7b) — route REST thuần (không qua
 *  contract oRPC) nên parse zod tại chỗ, cùng envelope lỗi của filter chung. */
const DeleteAccountBodySchema = z.object({ password: z.string().min(1) });

@Controller('api/account')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  /** Probe có-auth (dùng cho client + integration test): trả user của session. */
  @Get('me')
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }

  /** Tombstone delete tài khoản của CHÍNH MÌNH (xem AccountService) — đòi
   *  mật khẩu + gate nghiệp vụ, mỗi kết cục một mã lỗi riêng cho web. */
  // Đường GHI (W1): trần theo user — xem AUTHED_WRITE_THROTTLE.
  @UseGuards(AuthedWriteThrottlerGuard)
  @Throttle({ default: AUTHED_WRITE_THROTTLE })
  @Delete()
  @HttpCode(204)
  async deleteOwnAccount(@CurrentUser() user: SessionUser, @Body() body: unknown): Promise<void> {
    const parsed = DeleteAccountBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new HttpException(
        { code: 'PASSWORD_REQUIRED', message: 'Password is required to delete your account' },
        400,
      );
    }
    try {
      await this.accountService.deleteAccount(user.id, parsed.data.password);
    } catch (error) {
      if (error instanceof AccountPasswordInvalidError) {
        throw new HttpException({ code: 'INVALID_PASSWORD', message: 'Incorrect password' }, 403);
      }
      if (error instanceof AccountCredentialMissingError) {
        // Cùng tên mã với Better Auth (CREDENTIAL_ACCOUNT_NOT_FOUND) — web đã
        // có key map sẵn cho hoàn cảnh "tài khoản không có mật khẩu".
        throw new HttpException(
          {
            code: 'CREDENTIAL_ACCOUNT_NOT_FOUND',
            message: 'This account has no password credential',
          },
          409,
        );
      }
      if (error instanceof AccountHasPaidBookingsError) {
        throw new HttpException(
          {
            code: 'ACCOUNT_HAS_PAID_BOOKINGS',
            message: 'Account still has paid upcoming bookings',
          },
          409,
        );
      }
      if (error instanceof AccountHasOpenCancellationError) {
        throw new HttpException(
          {
            code: 'ACCOUNT_HAS_OPEN_CANCELLATION',
            message: 'Account still has an open cancellation request',
          },
          409,
        );
      }
      throw error;
    }
  }
}
