import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GetLessonByIdUseCase } from './application/use-cases/get-lesson-by-id.use-case';
import { InMemoryLessonRepository } from './infrastructure/repositories/in-memory-lesson.repository';
import { LessonsController } from './presentation/controllers/lessons.controller';
import { HealthController } from './presentation/controllers/health.controller';
import { PracticeReviewController } from './modules/practice-review/practice-review.controller';
import { TypeOrmVideoRepository } from './modules/practice-review/typeorm-video.repository';
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
  CoachProfileEntity,
  ReferenceVideoAnalysisEntity,
} from './database/entities';
import { CoachProfileService } from './modules/practice-review/coach-profile.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const entities = [
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
          CoachProfileEntity,
          ReferenceVideoAnalysisEntity,
        ];

        const databaseType =
          (config.get<string>('DATABASE_TYPE') || 'sqljs').toLowerCase();

        if (databaseType === 'postgres') {
          return {
            type: 'postgres',
            host: config.get<string>('DATABASE_HOST', 'localhost'),
            port: parseInt(config.get<string>('DATABASE_PORT', '5432'), 10),
            username: config.get<string>('DATABASE_USER', 'postgres'),
            password: config.get<string>('DATABASE_PASSWORD', ''),
            database: config.get<string>('DATABASE_NAME', 'bachata_coach'),
            entities,
            synchronize: config.get<string>('NODE_ENV') !== 'production',
            logging: config.get<string>('NODE_ENV') === 'development',
            dropSchema: false,
            retryAttempts: 3,
            retryDelay: 1000,
            ssl:
              config.get<string>('NODE_ENV') === 'production'
                ? { rejectUnauthorized: false }
                : false,
          };
        }

        return {
          type: 'sqljs',
          autoSave: false,
          entities,
          synchronize: true,
          logging: config.get<string>('NODE_ENV') === 'development',
          dropSchema: false,
        };
      },
    }),
    TypeOrmModule.forFeature([
      ChatMessageEntity,
      SavedReviewEntity,
      UserEntity,
      VideoEntity,
      CoachProfileEntity,
      ReferenceVideoAnalysisEntity,
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
    CoachProfileService,
    UsersService,
    {
      provide: 'LessonRepository',
      useClass: InMemoryLessonRepository,
    },
    InMemoryLessonRepository,
    {
      provide: 'VideoRepository',
      useClass: TypeOrmVideoRepository,
    },
  ],
})
export class AppModule {}
