import { VideosController } from './videos.controller';
import { VideoEntity } from './video.entity';

describe('VideosController', () => {
  it('caps the estimated duration at 600 seconds for large files', () => {
    const repository = { getById: jest.fn(), create: jest.fn(), list: jest.fn(), delete: jest.fn() } as any;
    const reviewService = { reviewVideo: jest.fn() } as any;
    const controller = new VideosController(repository, reviewService);

    const duration = (controller as any).estimateDurationSecondsFromBytes(10_000_000_000);

    expect(duration).toBe(600);
  });

  it('returns a JSON error when the video file is missing', async () => {
    const repository = {
      getById: jest.fn().mockResolvedValue(new VideoEntity('video-1', 'Demo', 'missing.mp4', new Date().toISOString(), 'video/mp4', 100)),
    } as any;
    const reviewService = { reviewVideo: jest.fn() } as any;
    const controller = new VideosController(repository, reviewService);

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    } as any;

    await controller.streamVideo('video-1', res, { headers: {} } as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });
});
