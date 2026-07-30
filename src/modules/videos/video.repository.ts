import { VideoEntity } from './video.entity';

export interface VideoRepository {
  list(): Promise<VideoEntity[]>;
  getById(id: string): Promise<VideoEntity | null>;
  create(video: VideoEntity): Promise<VideoEntity>;
  delete(id: string): Promise<void>;
}
