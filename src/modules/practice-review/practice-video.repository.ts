import { PracticeVideoEntity } from './practice-video.entity';

export interface VideoRepository {
  list(): Promise<PracticeVideoEntity[]>;
  getById(id: string): Promise<PracticeVideoEntity | null>;
  create(video: PracticeVideoEntity): Promise<PracticeVideoEntity>;
  delete(id: string): Promise<void>;
}
