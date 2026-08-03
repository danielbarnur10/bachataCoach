import { PracticeReviewController } from './practice-review.controller';
import { PracticeVideoEntity } from './practice-video.entity';

function makeVideo(id = 'video-1', filename = 'test.mp4'): PracticeVideoEntity {
  return new PracticeVideoEntity(
    id,
    'Test Video',
    filename,
    new Date().toISOString(),
    'video/mp4',
    10_000_000,
  );
}

function makeController(repoOverrides: any = {}, serviceOverrides: any = {}) {
  const defaultReview = {
    summary: 'Summary',
    musicality: 'Good',
    style: 'Sensual',
    improvementTips: ['t1', 't2', 't3'],
    segments: [],
    analysisSource: 'heuristic' as const,
  };
  const repository = {
    getById: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    list: jest.fn().mockResolvedValue([]),
    delete: jest.fn(),
    ...repoOverrides,
  };
  const reviewService = {
    reviewVideo: jest.fn().mockResolvedValue(defaultReview),
    chat: jest.fn().mockResolvedValue({ reply: 'Great!', actions: [] }),
    ...serviceOverrides,
  };
  const chatHistoryService = {
    getHistory: jest.fn().mockResolvedValue([]),
    saveMessage: jest.fn().mockResolvedValue(undefined),
    clearHistory: jest.fn().mockResolvedValue(undefined),
  };
  const savedReviewService = {
    find: jest.fn().mockResolvedValue(null),
    findAllForVideo: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockResolvedValue(undefined),
  };
  return {
    controller: new PracticeReviewController(
      repository,
      reviewService,
      chatHistoryService as any,
      savedReviewService as any,
    ),
    repository,
    reviewService,
    chatHistoryService,
    savedReviewService,
  };
}

// ─── estimateDurationSecondsFromBytes ────────────────────────────────────────

describe('PracticeReviewController.estimateDurationSecondsFromBytes', () => {
  it('caps the estimated duration at 600 seconds for large files', () => {
    const { controller } = makeController();
    expect(
      (controller as any).estimateDurationSecondsFromBytes(10_000_000_000),
    ).toBe(600);
  });

  it('returns a positive duration for a typical 50 MB video', () => {
    const { controller } = makeController();
    const duration = (controller as any).estimateDurationSecondsFromBytes(
      50_000_000,
    );
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThanOrEqual(600);
  });
});

// ─── listVideos ───────────────────────────────────────────────────────────────

describe('PracticeReviewController.listVideos', () => {
  it('returns empty array when no videos exist', async () => {
    const { controller } = makeController();
    await expect(controller.listVideos()).resolves.toEqual([]);
  });

  it('returns all videos from repository', async () => {
    const { controller } = makeController({
      list: jest.fn().mockResolvedValue([makeVideo('1'), makeVideo('2')]),
    });
    const result = await controller.listVideos();
    expect(result).toHaveLength(2);
  });
});

// ─── streamVideo ─────────────────────────────────────────────────────────────

describe('PracticeReviewController.streamVideo', () => {
  const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
  });

  it('returns 404 when video is not in repository', async () => {
    const { controller } = makeController();
    const r = res();
    await controller.streamVideo(
      'missing-id',
      r as any,
      { headers: {} } as any,
    );
    expect(r.status).toHaveBeenCalledWith(404);
  });

  it('returns a JSON error when the video file is missing from disk', async () => {
    const { controller } = makeController({
      getById: jest.fn().mockResolvedValue(makeVideo('v1', 'no-such-file.mp4')),
    });
    const r = res();
    await controller.streamVideo('v1', r as any, { headers: {} } as any);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(r.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });
});

// ─── startReview ─────────────────────────────────────────────────────────────

describe('PracticeReviewController.startReview', () => {
  it('returns error when video is not found', async () => {
    const { controller } = makeController();
    const result = await controller.startReview('missing', {});
    expect(result).toEqual(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('returns error when aTime >= bTime', async () => {
    const { controller } = makeController({
      getById: jest.fn().mockResolvedValue(makeVideo()),
    });
    const result = await controller.startReview('v1', { aTime: 30, bTime: 10 });
    expect(result).toEqual(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('calculates correct totalChunks for a 30-second interval (15s chunks)', async () => {
    const { controller } = makeController({
      getById: jest.fn().mockResolvedValue(makeVideo()),
    });
    const result = (await controller.startReview('v1', {
      aTime: 0,
      bTime: 30,
    })) as any;
    expect(result.totalChunks).toBe(2);
    expect(result.aTime).toBe(0);
    expect(result.bTime).toBe(30);
  });

  it('returns a reviewId', async () => {
    const { controller } = makeController({
      getById: jest.fn().mockResolvedValue(makeVideo()),
    });
    const result = (await controller.startReview('v1', {
      aTime: 0,
      bTime: 30,
    })) as any;
    expect(typeof result.reviewId).toBe('string');
    expect(result.reviewId.length).toBeGreaterThan(0);
  });
});

// ─── getChunk ─────────────────────────────────────────────────────────────────

describe('PracticeReviewController.getChunk', () => {
  it('returns error when video is not found', async () => {
    const { controller } = makeController();
    const result = await controller.getChunk('missing', '0', '30', '1');
    expect(result).toEqual(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('returns error when chunkNumber starts past bTime', async () => {
    const { controller } = makeController({
      getById: jest.fn().mockResolvedValue(makeVideo()),
    });
    // chunk 10 starts at (10-1)*15 = 135s, beyond bTime=30
    const result = await controller.getChunk('v1', '0', '30', '10');
    expect(result).toEqual(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('returns correct chunk metadata for chunk 1', async () => {
    const { controller } = makeController({
      getById: jest.fn().mockResolvedValue(makeVideo()),
    });
    const result = await controller.getChunk('v1', '0', '30', '1');
    expect(result.chunkNumber).toBe(1);
    expect(result.chunkStartTime).toBe(0);
    expect(result.aTime).toBe(0);
    expect(result.bTime).toBe(30);
  });

  it('marks hasNextChunk true for chunk 1 of 2', async () => {
    const { controller } = makeController({
      getById: jest.fn().mockResolvedValue(makeVideo()),
    });
    const result = await controller.getChunk('v1', '0', '30', '1');
    expect(result.hasNextChunk).toBe(true);
  });

  it('marks hasNextChunk false for the last chunk', async () => {
    const { controller } = makeController({
      getById: jest.fn().mockResolvedValue(makeVideo()),
    });
    const result = await controller.getChunk('v1', '0', '30', '2');
    expect(result.hasNextChunk).toBe(false);
  });

  it('calls reviewService.reviewVideo with the chunk duration', async () => {
    const { controller, reviewService } = makeController({
      getById: jest.fn().mockResolvedValue(makeVideo()),
    });
    await controller.getChunk('v1', '0', '15', '1');
    expect(reviewService.reviewVideo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ durationSeconds: expect.any(Number) }),
      undefined,
    );
  });

  it('returns fallback data when reviewService throws', async () => {
    const { controller } = makeController(
      { getById: jest.fn().mockResolvedValue(makeVideo()) },
      { reviewVideo: jest.fn().mockRejectedValue(new Error('AI down')) },
    );
    const result = await controller.getChunk('v1', '0', '30', '1');
    expect(result.summary).toBeTruthy();
    expect(result.segments).toHaveLength(2);
    expect(result.analysisSource).toBe('fallback');
  });
});

// ─── regenerateReview ─────────────────────────────────────────────────────────

describe('PracticeReviewController.regenerateReview', () => {
  it('returns error when video is not found', async () => {
    const { controller } = makeController();
    const result = await controller.regenerateReview('missing', {});
    expect(result).toEqual(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('passes userFeedback to reviewService.reviewVideo', async () => {
    const { controller, reviewService } = makeController({
      getById: jest.fn().mockResolvedValue(makeVideo()),
    });
    await controller.regenerateReview('v1', {
      aTime: 0,
      bTime: 15,
      chunkNumber: 1,
      feedback: 'energy was sensual',
    });
    expect(reviewService.reviewVideo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ userFeedback: 'energy was sensual' }),
      undefined,
    );
  });

  it('returns the same shape as getChunk', async () => {
    const { controller } = makeController({
      getById: jest.fn().mockResolvedValue(makeVideo()),
    });
    const result = await controller.regenerateReview('v1', {
      aTime: 0,
      bTime: 30,
      chunkNumber: 1,
    });
    expect(result).toMatchObject({
      chunkNumber: expect.any(Number),
      totalChunks: expect.any(Number),
      chunkStartTime: expect.any(Number),
      chunkEndTime: expect.any(Number),
      aTime: expect.any(Number),
      bTime: expect.any(Number),
    });
  });
});

// ─── chat ─────────────────────────────────────────────────────────────────────

describe('PracticeReviewController.chat', () => {
  it('returns error when message is empty', async () => {
    const { controller } = makeController();
    const result = await controller.chat('v1', { message: '' });
    expect(result).toEqual(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('returns error when message is whitespace only', async () => {
    const { controller } = makeController();
    const result = await controller.chat('v1', { message: '   ' });
    expect(result).toEqual(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it('delegates to reviewService.chat and wraps the reply', async () => {
    const { controller, reviewService } = makeController();
    (reviewService.chat as jest.Mock).mockResolvedValue({
      reply: 'Great timing!',
      actions: [],
    });
    const result = (await controller.chat('v1', {
      message: 'How is my timing?',
    })) as any;
    expect(result.reply).toBe('Great timing!');
    expect(result.actions).toEqual([]);
  });

  it('includes actions in the response', async () => {
    const { controller, reviewService } = makeController();
    const actions = [{ type: 'seek', time: 30 }];
    (reviewService.chat as jest.Mock).mockResolvedValue({
      reply: 'Jump to 0:30',
      actions,
    });
    const result = (await controller.chat('v1', {
      message: 'Go to 30s',
    })) as any;
    expect(result.actions).toEqual(actions);
  });

  it('uses server-side history from chatHistoryService', async () => {
    const { controller, reviewService, chatHistoryService } = makeController();
    const history = [
      {
        role: 'user' as const,
        content: 'prev',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    ];
    chatHistoryService.getHistory.mockResolvedValue(history);
    await controller.chat('v1', { message: 'New question' });
    expect(reviewService.chat).toHaveBeenCalledWith(
      'New question',
      history,
      undefined,
      undefined,
    );
  });

  it('saves user message and assistant reply after successful chat', async () => {
    const { controller, chatHistoryService } = makeController();
    await controller.chat('v1', { message: 'Hello' });
    expect(chatHistoryService.saveMessage).toHaveBeenCalledWith(
      'v1',
      'user',
      'Hello',
    );
    expect(chatHistoryService.saveMessage).toHaveBeenCalledWith(
      'v1',
      'assistant',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('passes reviewContext to reviewService', async () => {
    const { controller, reviewService } = makeController();
    await controller.chat('v1', {
      message: 'Question',
      reviewContext: '0s–30s',
    });
    expect(reviewService.chat).toHaveBeenCalledWith(
      'Question',
      expect.any(Array),
      '0s–30s',
      undefined,
    );
  });

  it('returns a fallback reply when reviewService throws', async () => {
    const { controller, reviewService } = makeController();
    (reviewService.chat as jest.Mock).mockRejectedValue(
      new Error('Network error'),
    );
    const result = (await controller.chat('v1', { message: 'Help' })) as any;
    expect(typeof result.reply).toBe('string');
    expect(result.reply.length).toBeGreaterThan(0);
  });
});
