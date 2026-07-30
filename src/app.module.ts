import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GetLessonByIdUseCase } from './application/use-cases/get-lesson-by-id.use-case';
import { InMemoryLessonRepository } from './infrastructure/repositories/in-memory-lesson.repository';
import { LessonsController } from './presentation/controllers/lessons.controller';
import { HealthController } from './presentation/controllers/health.controller';
import { VideosController } from './modules/videos/videos.controller';
import { InMemoryVideoRepository } from './modules/videos/in-memory-video.repository';
import { VideoReviewService } from './modules/videos/video-review.service';
import {
  UserEntity,
  VideoEntity,
  ReviewEntity,
  ReviewChunkEntity,
  FeedbackItemEntity,
  SavedLoopEntity,
  CoachPlanEntity,
  ProcessingJobEntity,
} from './database/entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || '',
      database: process.env.DATABASE_NAME || 'bachata_coach',
      entities: [
        UserEntity,
        VideoEntity,
        ReviewEntity,
        ReviewChunkEntity,
        FeedbackItemEntity,
        SavedLoopEntity,
        CoachPlanEntity,
        ProcessingJobEntity,
      ],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
      dropSchema: false,
      retryAttempts: 3,
      retryDelay: 1000,
    }),
  ],
  controllers: [AppController, LessonsController, HealthController, VideosController],
  providers: [
    AppService,
    GetLessonByIdUseCase,
    VideoReviewService,
    {
      provide: 'LessonRepository',
      useClass: InMemoryLessonRepository,
    },
    InMemoryLessonRepository,
    InMemoryVideoRepository,
  ],
})
export class AppModule {}
