import { prisma } from '../auth/auth.config.js';
import { ChatRetentionService } from './chat-retention.service.js';

/**
 * Integration (Docker PG, db tourism_test) — P6: job dọn hội thoại im quá 30 ngày.
 * `updatedAt` là `@updatedAt` nên Prisma tự ghi đè khi tạo; dựng mốc cũ bằng SQL.
 */

const retention = new ChatRetentionService();
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE chat_conversations RESTART IDENTITY CASCADE');
});

async function seedConversation(idleDays: number): Promise<string> {
  const conversation = await prisma.chatConversation.create({
    data: {
      messages: {
        create: [
          { seq: 1, role: 'USER', payload: { id: 'u1', role: 'user', parts: [] } },
          {
            seq: 2,
            role: 'ASSISTANT',
            payload: { id: 'a1', role: 'assistant', parts: [] },
            inputTokens: 900,
            outputTokens: 70,
          },
        ],
      },
    },
  });
  await prisma.$executeRaw`UPDATE chat_conversations SET updated_at = ${new Date(Date.now() - idleDays * DAY_MS)} WHERE id = ${conversation.id}::uuid`;
  return conversation.id;
}

describe('chat retention sweep (int)', () => {
  it('xoá hội thoại im quá 30 ngày cùng tin của nó; hội thoại còn mới giữ nguyên; chạy lại không còn gì', async () => {
    const old = await seedConversation(31);
    const fresh = await seedConversation(29);

    expect(await retention.sweep(new Date())).toBe(1);

    expect(await prisma.chatConversation.findUnique({ where: { id: old } })).toBeNull();
    expect(await prisma.chatMessage.count({ where: { conversationId: old } })).toBe(0);
    expect(await prisma.chatConversation.findUnique({ where: { id: fresh } })).not.toBeNull();
    expect(await prisma.chatMessage.count({ where: { conversationId: fresh } })).toBe(2);

    expect(await retention.sweep(new Date())).toBe(0);
  });

  it('enquiry gửi qua chat KHÔNG bị xoá theo hội thoại', async () => {
    const enquiry = await prisma.enquiry.create({
      data: { name: 'Chat Lead', email: 'chat.lead@example.com', message: 'Sent from chat.' },
    });
    const id = await seedConversation(40);
    await prisma.chatConversation.update({ where: { id }, data: { enquiryId: enquiry.id } });
    await prisma.$executeRaw`UPDATE chat_conversations SET updated_at = ${new Date(Date.now() - 40 * DAY_MS)} WHERE id = ${id}::uuid`;

    expect(await retention.sweep(new Date())).toBe(1);
    expect(await prisma.enquiry.findUnique({ where: { id: enquiry.id } })).not.toBeNull();
    await prisma.enquiry.delete({ where: { id: enquiry.id } });
  });
});
