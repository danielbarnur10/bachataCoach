import { NotFoundException } from '@nestjs/common';
import { Lesson } from '../../domain/entities/lesson.entity';
import { LessonRepository } from '../../domain/repositories/lesson.repository';
import { GetLessonByIdUseCase } from './get-lesson-by-id.use-case';

describe('GetLessonByIdUseCase', () => {
  it('returns a lesson when the id exists', async () => {
    const lesson = new Lesson(
      'lesson-1',
      'Bachata Basics',
      'Learn the fundamental footwork and body movement.',
      'Beginner',
      20,
    );

    const repository: LessonRepository = {
      getAll: jest.fn().mockResolvedValue([lesson]),
      getById: jest.fn().mockResolvedValue(lesson),
      create: jest.fn().mockResolvedValue(lesson),
    };

    const useCase = new GetLessonByIdUseCase(repository);

    await expect(useCase.execute('lesson-1')).resolves.toEqual(
      expect.objectContaining({ id: 'lesson-1', title: 'Bachata Basics' }),
    );
  });

  it('throws a helpful error when the lesson is missing', async () => {
    const repository: LessonRepository = {
      getAll: jest.fn().mockResolvedValue([]),
      getById: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    };

    const useCase = new GetLessonByIdUseCase(repository);

    await expect(useCase.execute('missing-id')).rejects.toThrow(NotFoundException);
  });
});
