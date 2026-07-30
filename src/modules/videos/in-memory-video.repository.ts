import { Injectable } from '@nestjs/common';
import { VideoEntity } from './video.entity';
import { VideoRepository } from './video.repository';

@Injectable()
export class InMemoryVideoRepository implements VideoRepository {
  private readonly videos: VideoEntity[] = [];

  async list(): Promise<VideoEntity[]> {
    return [...this.videos];
  }

  async getById(id: string): Promise<VideoEntity | null> {
    return this.videos.find((video) => video.id === id) ?? null;
  }

  async create(video: VideoEntity): Promise<VideoEntity> {
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
