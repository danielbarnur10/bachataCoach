import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedReviewEntity } from '../../database/entities/saved-review.entity';

@Injectable()
export class SavedReviewService {
  constructor(
    @InjectRepository(SavedReviewEntity)
    private readonly repo: Repository<SavedReviewEntity>,
  ) {}

  async find(videoId: string, aTime: number, bTime: number, chunkNumber: number): Promise<SavedReviewEntity | null> {
    return this.repo.findOne({ where: { videoId, aTime, bTime, chunkNumber } });
  }

  async findAllForVideo(videoId: string): Promise<SavedReviewEntity[]> {
    return this.repo.find({ where: { videoId }, order: { aTime: 'ASC', chunkNumber: 'ASC' } });
  }

  async upsert(videoId: string, aTime: number, bTime: number, chunkNumber: number, reviewData: object, userContext?: string): Promise<void> {
    const existing = await this.find(videoId, aTime, bTime, chunkNumber);
    if (existing) {
      await this.repo.update(existing.id, { reviewData, ...(userContext !== undefined ? { userContext } : {}) });
    } else {
      await this.repo.save(this.repo.create({ videoId, aTime, bTime, chunkNumber, reviewData, userContext: userContext ?? null }));
    }
  }
}
