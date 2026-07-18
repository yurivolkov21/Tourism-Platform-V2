import { Controller, Delete, Get, HttpCode, UseGuards } from '@nestjs/common';
// NB: AccountService phải là VALUE import (DI qua decorator metadata).
import { AccountService } from './account.service.js';
import type { SessionUser } from './auth.config.js';
import { AuthGuard } from './auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';

@Controller('api/account')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  /** Probe có-auth (dùng cho client + integration test): trả user của session. */
  @Get('me')
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }

  /** Tombstone delete tài khoản của CHÍNH MÌNH (xem AccountService). */
  @Delete()
  @HttpCode(204)
  async deleteOwnAccount(@CurrentUser() user: SessionUser): Promise<void> {
    await this.accountService.deleteAccount(user.id);
  }
}
