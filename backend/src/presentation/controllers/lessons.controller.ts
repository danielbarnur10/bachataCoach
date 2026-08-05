import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { GetLessonByIdUseCase } from '../../application/use-cases/get-lesson-by-id.use-case';
import { Lesson } from '../../domain/entities/lesson.entity';
import { LessonRepository } from '../../domain/repositories/lesson.repository';

@Controller('lessons')
export class LessonsController {
  constructor(
    private readonly getLessonByIdUseCase: GetLessonByIdUseCase,
    @Inject('LessonRepository')
    private readonly lessonRepository: LessonRepository,
  ) {}

  @Get()
  async findAll(): Promise<Lesson[]> {
    // This endpoint returns the lesson catalog from the repository abstraction.
    return this.lessonRepository.getAll();
  }

  @Get('summary')
  async getSummary(): Promise<{ total: number; levels: string[] }> {
    // This provides a lightweight summary for the browser UI.
    const lessons = await this.lessonRepository.getAll();
    return {
      total: lessons.length,
      levels: [...new Set(lessons.map((lesson) => lesson.level))],
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Lesson> {
    // The controller stays thin and delegates business logic to the application use case.
    return this.getLessonByIdUseCase.execute(id);
  }

  @Post()
  async create(@Body() lesson: Lesson): Promise<Lesson> {
    // This demonstrates simple input handling while keeping persistence concerns isolated.
    return this.lessonRepository.create(lesson);
  }
}
