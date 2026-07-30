import { VideoReviewService } from './video-review.service';

describe('VideoReviewService', () => {
  it('creates timestamped segments for a short clip even without an AI provider', async () => {
    const service = new VideoReviewService();

    const review = await service.reviewVideo('Short practice clip', {
      durationSeconds: 24,
    });

    expect(review.segments.length).toBeGreaterThan(0);
    expect(review.segments[0]).toEqual(
      expect.objectContaining({
        startTime: 0,
        endTime: expect.any(Number),
        label: expect.any(String),
        reason: expect.any(String),
      }),
    );
    expect(review.analysisSource).toBeDefined();
  });
});
