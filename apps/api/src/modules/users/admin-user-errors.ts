import type { UserAction } from '@tourism/contract';
import { ContractError } from '../../lib/contract-error.js';

/**
 * Hai lỗi của vùng Users (plan P4f, quyết định 11). Cả hai `exposeMessage = false`: câu mặc
 * định của contract là thứ client cần, còn câu có id ở đây là để đọc log.
 */

/** Không có tài khoản, hoặc đã tombstone — vùng Users coi hai ca là một. */
export class UserNotFoundError extends ContractError<'NOT_FOUND'> {
  constructor(id: string) {
    super('NOT_FOUND', `User not found: ${id}`, false);
  }
}

/** `userActions` không còn cho phép thao tác: tab cũ, người khác vừa làm, hoặc mục tiêu là Owner. */
export class UserStateChangedError extends ContractError<'STATE_CHANGED'> {
  constructor(id: string, action: UserAction) {
    super('STATE_CHANGED', `User ${id} does not allow ${action} right now`, false);
  }
}
