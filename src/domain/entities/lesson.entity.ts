export class Lesson {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly description: string,
    public readonly level: string,
    public readonly durationMinutes: number,
  ) {}
}
