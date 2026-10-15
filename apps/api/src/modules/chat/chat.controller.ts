import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatRequestSchema, type ChatStatus } from '@tourism/contract';
import type { UIMessage } from 'ai';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { auth } from '../../auth/auth.config.js';
import { Public } from '../../auth/public.decorator.js';
import { CHAT_THROTTLE } from '../../config/throttle.js';
import { ChatService } from './chat.service.js';
import { writeUIMessageStream } from './chat-stream.js';

const ConversationIdSchema = z.uuid();

const notFound = () =>
  new HttpException(
    { code: 'CHAT_NOT_FOUND', message: 'Conversation not found' },
    HttpStatus.NOT_FOUND,
  );

/**
 * Ba endpoint của trợ lý (spec §2b) — Nest thuần ngoài oRPC vì `POST` trả stream UI
 * message của AI SDK chứ không phải JSON.
 *
 * `@Public()`: khách vãng lai phải hỏi được trợ lý như gửi được form enquiry
 * (ADR-0050 §1); quyền với từng hội thoại do service kiểm theo phiên nếu có.
 */
@Public()
@Controller('api/chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chat: ChatService) {}

  /** Công tắc và trần ngày; trần đọc công khai mặc định. */
  @Get()
  status(): Promise<ChatStatus> {
    return this.chat.status();
  }

  /** Tin để hiển thị lại. Id sai dạng cũng là 404 — không phân biệt với id không có. */
  @Get(':id')
  async conversation(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
  ): Promise<{ messages: UIMessage[] }> {
    if (!ConversationIdSchema.safeParse(id).success) throw notFound();
    const messages = await this.chat.getConversation(id, await this.optionalUserId(req));
    if (messages === null) throw notFound();
    return { messages };
  }

  /**
   * Một lượt. Lỗi trước stream là JSON envelope (filter); qua được thì Fastify
   * `hijack` và stream ghi thẳng lên socket.
   */
  @Post()
  @Throttle({ default: CHAT_THROTTLE })
  async turn(@Req() req: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpException(
        { code: 'INVALID_INPUT', message: 'Invalid chat request' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const stream = await this.chat.startTurn(parsed.data, await this.optionalUserId(req));
    // Header CORS và helmet đã nằm trên `reply` từ hook onRequest; `hijack` bỏ qua
    // chúng nên phải đọc ra TRƯỚC rồi chép sang `reply.raw` (spec §4).
    const headers = reply.getHeaders();
    reply.hijack();
    await writeUIMessageStream(reply.raw, headers, stream);
  }

  /** Cùng cách đọc phiên với form enquiry: lỗi đọc phiên rơi về khách ẩn danh. */
  private async optionalUserId(req: FastifyRequest): Promise<string | null> {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      return session && session.user.deletedAt == null ? (session.user.id as string) : null;
    } catch (err) {
      this.logger.warn(`Chat: could not read session, treating as anonymous — ${String(err)}`);
      return null;
    }
  }
}
