import { Injectable } from '@nestjs/common';
import { PracticeVideoEntity } from './practice-video.entity';
import { VideoRepository } from './practice-video.repository';

@Injectable()
export class InMemoryVideoRepository implements VideoRepository {
  private readonly videos: PracticeVideoEntity[] = [];

  async list(): Promise<PracticeVideoEntity[]> {
    return [...this.videos];
  }

  async getById(id: string): Promise<PracticeVideoEntity | null> {
    return this.videos.find((video) => video.id === id) ?? null;
  }

  async create(video: PracticeVideoEntity): Promise<PracticeVideoEntity> {
    this.videos.push(video);
    return video;
  }

  async delete(id: string): Promise<void> {
    const index = this.videos.findIndex((video) => video.id === id);
    if (index >= 0) {
      this.videos.splice(index, 1);
    }
  }
}
