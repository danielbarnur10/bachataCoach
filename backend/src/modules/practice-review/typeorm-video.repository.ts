import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VideoEntity } from '../../database/entities/video.entity';
import {
  PracticeVideoEntity,
  PracticeVideoVisibility,
} from './practice-video.entity';
import { VideoRepository } from './practice-video.repository';

@Injectable()
export class TypeOrmVideoRepository implements VideoRepository {
  constructor(
    @InjectRepository(VideoEntity)
    private readonly repository: Repository<VideoEntity>,
  ) {}

  async listOwned(ownerId: string): Promise<PracticeVideoEntity[]> {
    const rows = await this.repository.find({
      where: { ownerId },
      relations: { owner: true },
      order: { uploadedAt: 'DESC' },
    });
    return rows.map((row) => this.toPracticeVideo(row));
  }

  async listShared(viewerId?: string | null): Promise<PracticeVideoEntity[]> {
    const rows = await this.repository.find({
      where: { visibility: 'shared' },
      relations: { owner: true },
      order: { uploadedAt: 'DESC' },
    });
    return rows
      .filter((row) => !viewerId || row.ownerId !== viewerId)
      .map((row) => this.toPracticeVideo(row));
  }

  async getOwnedById(id: string, ownerId: string): Promise<PracticeVideoEntity | null> {
    const row = await this.repository.findOne({
      where: { id, ownerId },
      relations: { owner: true },
    });
    return row ? this.toPracticeVideo(row) : null;
  }

  async getAccessibleById(id: string, viewerId?: string | null): Promise<PracticeVideoEntity | null> {
    const row = await this.repository.findOne({
      where: { id },
      relations: { owner: true },
    });
    if (!row) return null;
    if (viewerId && row.ownerId === viewerId) return this.toPracticeVideo(row);
    return row.visibility === 'shared' ? this.toPracticeVideo(row) : null;
  }

  async create(video: PracticeVideoEntity): Promise<PracticeVideoEntity> {
    const row = this.repository.create({
      id: video.id,
      ownerId: video.ownerId,
      title: video.title,
      originalFilename: video.filename,
      storedFilename: video.filename,
      durationSeconds: 0,
      fileSizeBytes: video.sizeBytes,
      mimeType: video.mimeType,
      uploadStatus: 'completed',
      preparationStatus: 'completed',
      visibility: video.visibility,
      purpose: video.purpose,
    });
    return this.toPracticeVideo(await this.repository.save(row));
  }

  async setVisibility(id: string, ownerId: string, visibility: PracticeVideoVisibility): Promise<PracticeVideoEntity | null> {
    const row = await this.repository.findOne({ where: { id, ownerId } });
    if (!row) return null;
    row.visibility = visibility;
    return this.toPracticeVideo(await this.repository.save(row));
  }

  async deleteOwned(id: string, ownerId: string): Promise<boolean> {
    const result = await this.repository.delete({ id, ownerId });
    return (result.affected ?? 0) > 0;
  }

  private toPracticeVideo(row: VideoEntity): PracticeVideoEntity {
    return new PracticeVideoEntity(
      row.id,
      row.title,
      row.storedFilename,
      row.uploadedAt?.toISOString() ?? new Date().toISOString(),
      row.mimeType,
      Number(row.fileSizeBytes),
      row.ownerId,
      row.owner?.displayName || row.owner?.email || row.ownerId,
      row.visibility === 'shared' ? 'shared' : 'private',
      row.purpose === 'reference' ? 'reference' : 'practice',
    );
  }
}
