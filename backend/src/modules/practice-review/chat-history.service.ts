import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessageEntity } from '../../database/entities/chat-message.entity';
import { ChatMessage, ChatAction } from './practice-review.service';

@Injectable()
export class ChatHistoryService {
  constructor(
    @InjectRepository(ChatMessageEntity)
    private readonly repo: Repository<ChatMessageEntity>,
  ) {}

  async getHistory(videoId: string): Promise<ChatMessage[]> {
    const rows = await this.repo.find({
      where: { videoId },
      order: { timestamp: 'ASC' },
    });
    return rows.map((r) => ({
      role: r.role,
      content: r.content,
      timestamp: r.timestamp.toISOString(),
      actions: (r.actions as ChatAction[] | null) ?? undefined,
    }));
  }

  async saveMessage(
    videoId: string,
    role: 'user' | 'assistant',
    content: string,
    actions?: ChatAction[],
  ): Promise<void> {
    await this.repo.save(
      this.repo.create({ videoId, role, content, actions: actions ?? null }),
    );
  }

  async clearHistory(videoId: string): Promise<void> {
    await this.repo.delete({ videoId });
  }
}
