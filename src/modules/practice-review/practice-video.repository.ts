import {
  PracticeVideoEntity,
  PracticeVideoVisibility,
} from './practice-video.entity';

export interface VideoRepository {
  listOwned(ownerId: string): Promise<PracticeVideoEntity[]>;
  listShared(viewerId?: string | null): Promise<PracticeVideoEntity[]>;
  getOwnedById(id: string, ownerId: string): Promise<PracticeVideoEntity | null>;
  getAccessibleById(
    id: string,
    viewerId?: string | null,
  ): Promise<PracticeVideoEntity | null>;
  create(video: PracticeVideoEntity): Promise<PracticeVideoEntity>;
  setVisibility(
    id: string,
    ownerId: string,
    visibility: PracticeVideoVisibility,
  ): Promise<PracticeVideoEntity | null>;
  deleteOwned(id: string, ownerId: string): Promise<boolean>;
}
