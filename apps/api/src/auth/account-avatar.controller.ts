import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AccountService, AvatarPublicIdInvalidError } from './account.service.js';
import type { SessionUser } from './auth.config.js';
import { AuthGuard } from './auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';

/**
 * Procedure oRPC ĐẦU TIÊN của namespace account (ADR-0021 §3) — me/delete
 * vẫn là REST thuần bên AccountController. Tách class vì prefix
 * @Controller('api/account') bên đó không dành cho @Implement.
 */
@Controller()
export class AccountAvatarController {
  constructor(private readonly account: AccountService) {}

  @UseGuards(AuthGuard)
  @Implement(contract.account.setAvatar)
  setAvatar(@CurrentUser() user: SessionUser) {
    return implement(contract.account.setAvatar).handler(async ({ input, errors }) => {
      try {
        return { image: await this.account.setAvatar(user.id, input.publicId) };
      } catch (err) {
        if (err instanceof AvatarPublicIdInvalidError) throw errors.AVATAR_PUBLIC_ID_INVALID();
        throw err;
      }
    });
  }
}
