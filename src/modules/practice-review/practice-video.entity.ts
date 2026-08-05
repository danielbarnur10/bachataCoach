export type PracticeVideoVisibility = 'private' | 'shared';
export type PracticeVideoPurpose = 'practice' | 'reference';

export class PracticeVideoEntity {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly filename: string,
    public readonly uploadedAt: string,
    public readonly mimeType: string,
    public readonly sizeBytes: number,
    public readonly ownerId: string,
    public readonly ownerDisplayName: string,
    public visibility: PracticeVideoVisibility = 'private',
    public purpose: PracticeVideoPurpose = 'practice',
  ) {}
}
