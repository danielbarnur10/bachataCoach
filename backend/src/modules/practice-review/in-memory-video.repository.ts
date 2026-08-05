import { Injectable } from '@nestjs/common';
import {
  PracticeVideoEntity,
  PracticeVideoVisibility,
} from './practice-video.entity';
import { VideoRepository } from './practice-video.repository';

@Injectable()
export class InMemoryVideoRepository implements VideoRepository {
  private readonly videos: PracticeVideoEntity[] = [];

  async listOwned(ownerId: string): Promise<PracticeVideoEntity[]> {
    return this.videos.filter((video) => video.ownerId === ownerId);
  }

  async listShared(viewerId?: string | null): Promise<PracticeVideoEntity[]> {
    return this.videos.filter(
      (video) =>
        video.visibility === 'shared' &&
        (!viewerId || video.ownerId !== viewerId),
    );
  }

  async getOwnedById(
    id: string,
    ownerId: string,
  ): Promise<PracticeVideoEntity | null> {
    return (
      this.videos.find((video) => video.id === id && video.ownerId === ownerId) ??
      null
    );
  }

  async getAccessibleById(
    id: string,
    viewerId?: string | null,
  ): Promise<PracticeVideoEntity | null> {
    const video = this.videos.find((item) => item.id === id) ?? null;
    if (!video) return null;
    if (viewerId && video.ownerId === viewerId) return video;
    return video.visibility === 'shared' ? video : null;
  }

  async create(video: PracticeVideoEntity): Promise<PracticeVideoEntity> {
    this.videos.push(video);
    return video;
  }

  async setVisibility(
    id: string,
    ownerId: string,
    visibility: PracticeVideoVisibility,
  ): Promise<PracticeVideoEntity | null> {
    const video = await this.getOwnedById(id, ownerId);
    if (!video) return null;
    video.visibility = visibility;
    return video;
  }

  async deleteOwned(id: string, ownerId: string): Promise<boolean> {
    const index = this.videos.findIndex(
      (video) => video.id === id && video.ownerId === ownerId,
    );
    if (index < 0) {
      return false;
    }

    this.videos.splice(index, 1);
    return true;
  }
}
