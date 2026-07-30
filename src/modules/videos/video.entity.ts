export class VideoEntity {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly filename: string,
    public readonly uploadedAt: string,
    public readonly mimeType: string,
    public readonly sizeBytes: number,
  ) {}
}
