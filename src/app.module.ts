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
import { ChatHistoryService } from './modules/videos/chat-history.service';
import { SavedReviewService } from './modules/videos/saved-review.service';
import {
  UserEntity,
  VideoEntity,
  ReviewEntity,
  ReviewChunkEntity,
  FeedbackItemEntity,
  SavedLoopEntity,
  CoachPlanEntity,
  ProcessingJobEntity,
  ChatMessageEntity,
  SavedReviewEntity,
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
        ChatMessageEntity,
        SavedReviewEntity,
      ],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
      dropSchema: false,
      retryAttempts: 3,
      retryDelay: 1000,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
    }),
    TypeOrmModule.forFeature([ChatMessageEntity, SavedReviewEntity]),
  ],
  controllers: [AppController, LessonsController, HealthController, VideosController],
  providers: [
    AppService,
    GetLessonByIdUseCase,
    VideoReviewService,
    ChatHistoryService,
    SavedReviewService,
    {
      provide: 'LessonRepository',
      useClass: InMemoryLessonRepository,
    },
    InMemoryLessonRepository,
    InMemoryVideoRepository,
  ],
})
export class AppModule {}
