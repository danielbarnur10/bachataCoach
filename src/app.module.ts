import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GetLessonByIdUseCase } from './application/use-cases/get-lesson-by-id.use-case';
import { InMemoryLessonRepository } from './infrastructure/repositories/in-memory-lesson.repository';
import { LessonsController } from './presentation/controllers/lessons.controller';
import { HealthController } from './presentation/controllers/health.controller';
import { PracticeReviewController } from './modules/practice-review/practice-review.controller';
import { InMemoryVideoRepository } from './modules/practice-review/in-memory-video.repository';
import { PracticeReviewService } from './modules/practice-review/practice-review.service';
import { ChatHistoryService } from './modules/practice-review/chat-history.service';
import { SavedReviewService } from './modules/practice-review/saved-review.service';
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';
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
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
    }),
    TypeOrmModule.forFeature([
      ChatMessageEntity,
      SavedReviewEntity,
      UserEntity,
    ]),
  ],
  controllers: [
    AppController,
    LessonsController,
    HealthController,
    PracticeReviewController,
    UsersController,
  ],
  providers: [
    AppService,
    GetLessonByIdUseCase,
    PracticeReviewService,
    ChatHistoryService,
    SavedReviewService,
    UsersService,
    {
      provide: 'LessonRepository',
      useClass: InMemoryLessonRepository,
    },
    InMemoryLessonRepository,
    InMemoryVideoRepository,
  ],
})
export class AppModule {}
