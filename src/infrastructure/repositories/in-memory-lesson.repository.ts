import { Injectable } from '@nestjs/common';
import { Lesson } from '../../domain/entities/lesson.entity';
import { LessonRepository } from '../../domain/repositories/lesson.repository';

@Injectable()
export class InMemoryLessonRepository implements LessonRepository {
  private readonly lessons: Lesson[] = [
    new Lesson(
      'lesson-1',
      'Bachata Basics',
      'Learn the basic steps, posture, and rhythm for your first bachata class.',
      'Beginner',
      20,
    ),
    new Lesson(
      'lesson-2',
      'Dancing with Timing',
      'Improve your timing, musicality, and connection with the beat.',
      'Intermediate',
      25,
    ),
  ];

  async getAll(): Promise<Lesson[]> {
    return [...this.lessons];
  }

  async getById(id: string): Promise<Lesson | null> {
    return this.lessons.find((lesson) => lesson.id === id) ?? null;
  }

  async create(lesson: Lesson): Promise<Lesson> {
    this.lessons.push(lesson);
    return lesson;
  }
}
