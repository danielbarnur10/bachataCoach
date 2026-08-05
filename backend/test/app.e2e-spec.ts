import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { HealthController } from '../src/presentation/controllers/health.controller';
import { PracticeReviewController } from '../src/modules/practice-review/practice-review.controller';
import { PracticeReviewService } from '../src/modules/practice-review/practice-review.service';
import { InMemoryVideoRepository } from '../src/modules/practice-review/in-memory-video.repository';

// Minimal module — no TypeORM/PostgreSQL required
async function buildApp(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [AppController, HealthController, PracticeReviewController],
    providers: [AppService, PracticeReviewService, InMemoryVideoRepository],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await buildApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('GET / returns Hello World', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await buildApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('GET /health returns status ok', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
      });
  });
});

describe('PracticeReviewController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await buildApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('GET /videos returns empty array initially', () => {
    return request(app.getHttpServer()).get('/videos').expect(200).expect([]);
  });

  it('GET /videos/:id returns 200 with null for unknown id', async () => {
    const res = await request(app.getHttpServer())
      .get('/videos/unknown-id')
      .expect(200);
    expect(res.body).toBeNull();
  });

  it('POST /videos/:id/review/start returns error for unknown video', () => {
    return request(app.getHttpServer())
      .post('/videos/unknown-id/review/start')
      .send({})
      .expect(201)
      .expect((res) => {
        expect(res.body.error).toBeTruthy();
      });
  });

  it('POST /videos/:id/review/start returns error when aTime >= bTime', async () => {
    // First upload a video so it exists
    const repo = new InMemoryVideoRepository();
    const moduleFixture = await Test.createTestingModule({
      controllers: [PracticeReviewController],
      providers: [
        PracticeReviewService,
        { provide: InMemoryVideoRepository, useValue: repo },
      ],
    }).compile();
    const testApp = moduleFixture.createNestApplication();
    await testApp.init();

    const res = await request(testApp.getHttpServer())
      .post('/videos/any-id/review/start')
      .send({ aTime: 60, bTime: 30 });
    // Video not found → error (covers the guard)
    expect(res.body.error).toBeTruthy();
    await testApp.close();
  });

  it('POST /videos/:id/chat returns error when message is empty', () => {
    return request(app.getHttpServer())
      .post('/videos/any-id/chat')
      .send({ message: '' })
      .expect(201)
      .expect((res) => {
        expect(res.body.error).toBeTruthy();
      });
  });

  it('POST /videos/:id/chat returns reply when no API key (no-key fallback)', () => {
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    return request(app.getHttpServer())
      .post('/videos/any-id/chat')
      .send({ message: 'Hello coach' })
      .expect(201)
      .expect((res) => {
        expect(typeof res.body.reply).toBe('string');
        expect(res.body.reply).toContain('OPENAI_API_KEY');
      })
      .finally(() => {
        if (savedKey) process.env.OPENAI_API_KEY = savedKey;
      });
  });

  it('POST /videos/:id/review/regenerate returns error for unknown video', () => {
    return request(app.getHttpServer())
      .post('/videos/unknown-id/review/regenerate')
      .send({ aTime: 0, bTime: 30, chunkNumber: 1 })
      .expect(201)
      .expect((res) => {
        expect(res.body.error).toBeTruthy();
      });
  });
});
