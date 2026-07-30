import { Lesson } from '../entities/lesson.entity';

export interface LessonRepository {
  getAll(): Promise<Lesson[]>;
  getById(id: string): Promise<Lesson | null>;
  create(lesson: Lesson): Promise<Lesson>;
}
