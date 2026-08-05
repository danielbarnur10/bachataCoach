import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Lesson } from '../../domain/entities/lesson.entity';
import { LessonRepository } from '../../domain/repositories/lesson.repository';

@Injectable()
export class GetLessonByIdUseCase {
  constructor(
    @Inject('LessonRepository')
    private readonly lessonRepository: LessonRepository,
  ) {}

  async execute(id: string): Promise<Lesson> {
    const lesson = await this.lessonRepository.getById(id);

    if (!lesson) {
      throw new NotFoundException(`Lesson with id "${id}" was not found.`);
    }

    return lesson;
  }
}
