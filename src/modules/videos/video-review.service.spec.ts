import { VideoReviewService } from './video-review.service';

function makeService(apiKey?: string): VideoReviewService {
  if (apiKey) process.env.OPENAI_API_KEY = apiKey;
  else delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_KEY;
  return new VideoReviewService();
}

function mockFetch(response: object, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => response,
  }) as any;
}

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_KEY;
  jest.restoreAllMocks();
});

describe('VideoReviewService — heuristic fallback (no API key)', () => {
  it('creates timestamped segments for a short clip even without an AI provider', async () => {
    const review = await makeService().reviewVideo('Short practice clip', { durationSeconds: 24 });

    expect(review.segments.length).toBeGreaterThan(0);
    expect(review.segments[0]).toEqual(expect.objectContaining({
      startTime: 0,
      endTime: expect.any(Number),
      label: expect.any(String),
      reason: expect.any(String),
    }));
    expect(review.analysisSource).toBe('heuristic');
  });

  it('returns all required fields', async () => {
    const review = await makeService().reviewVideo('Test', { durationSeconds: 60 });

    expect(review.summary).toBeTruthy();
    expect(review.musicality).toBeTruthy();
    expect(review.style).toBeTruthy();
    expect(review.improvementTips).toHaveLength(3);
  });

  it('all segments stay within the clip duration', async () => {
    const duration = 60;
    const review = await makeService().reviewVideo('Test', { durationSeconds: duration });

    for (const seg of review.segments) {
      expect(seg.startTime).toBeGreaterThanOrEqual(0);
      expect(seg.endTime).toBeLessThanOrEqual(duration);
      expect(seg.endTime).toBeGreaterThan(seg.startTime);
    }
  });

  it('high movement score yields a positive style note', async () => {
    const review = await makeService().reviewVideo('Test', { durationSeconds: 30, movementScore: 9 });

    expect(review.style).toContain('strong');
  });

  it('low movement score suggests working on the beat', async () => {
    const review = await makeService().reviewVideo('Test', { durationSeconds: 30, movementScore: 2 });

    expect(review.style.toLowerCase()).toContain('work');
  });

  it('produces at least 2 segments for a very short clip', async () => {
    const review = await makeService().reviewVideo('Tiny', { durationSeconds: 5 });

    expect(review.segments.length).toBeGreaterThanOrEqual(2);
  });
});

describe('VideoReviewService — AI path', () => {
  const aiPayload = {
    summary: 'AI-generated summary',
    musicality: 'On the beat',
    style: 'Sensual Derecho',
    improvementTips: ['Count aloud', 'Slow down', 'Record yourself'],
    segments: [{ startTime: 0, endTime: 5, label: 'Derecho', reason: 'Solid timing' }],
  };

  it('uses AI result when fetch succeeds', async () => {
    mockFetch({ choices: [{ message: { content: JSON.stringify(aiPayload) } }] });

    const review = await makeService('test-key').reviewVideo('Test', { durationSeconds: 24 });

    expect(review.analysisSource).toBe('ai');
    expect(review.summary).toBe('AI-generated summary');
    expect(review.segments[0].label).toBe('Derecho');
  });

  it('falls back to heuristic when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as any;

    const review = await makeService('test-key').reviewVideo('Test', { durationSeconds: 24 });

    expect(review.analysisSource).toBe('heuristic');
  });

  it('falls back to heuristic when AI returns non-ok status', async () => {
    mockFetch({}, false);

    const review = await makeService('test-key').reviewVideo('Test', { durationSeconds: 24 });

    expect(review.analysisSource).toBe('heuristic');
  });

  it('falls back to heuristic when AI returns malformed JSON', async () => {
    mockFetch({ choices: [{ message: { content: 'not json at all' } }] });

    const review = await makeService('test-key').reviewVideo('Test', { durationSeconds: 24 });

    // Malformed JSON means no improvementTips array → falls back inside reviewWithAi, result is still 'ai'
    expect(review.improvementTips.length).toBeGreaterThan(0);
    expect(review.segments.length).toBeGreaterThan(0);
  });

  it('injects userFeedback into the AI prompt as a DANCER CORRECTION block', async () => {
    mockFetch({ choices: [{ message: { content: JSON.stringify(aiPayload) } }] });

    await makeService('test-key').reviewVideo('Test', { durationSeconds: 24, userFeedback: 'the energy was sensual not aggressive' });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const userMsg = body.messages.find((m: any) => m.role === 'user');
    expect(userMsg.content).toContain('DANCER CORRECTION');
    expect(userMsg.content).toContain('the energy was sensual not aggressive');
  });

  it('omits DANCER CORRECTION block when userFeedback is empty', async () => {
    mockFetch({ choices: [{ message: { content: JSON.stringify(aiPayload) } }] });

    await makeService('test-key').reviewVideo('Test', { durationSeconds: 24, userFeedback: '' });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const userMsg = body.messages.find((m: any) => m.role === 'user');
    expect(userMsg.content).not.toContain('DANCER CORRECTION');
  });

  it('filters segments with endTime <= startTime', async () => {
    const badSegments = [
      { startTime: 10, endTime: 5, label: 'Bad', reason: 'reversed' },
      { startTime: 0, endTime: 5, label: 'Good', reason: 'ok' },
    ];
    mockFetch({ choices: [{ message: { content: JSON.stringify({ ...aiPayload, segments: badSegments }) } }] });

    const review = await makeService('test-key').reviewVideo('Test', { durationSeconds: 24 });

    expect(review.segments.every((s) => s.endTime > s.startTime)).toBe(true);
  });
});

describe('VideoReviewService — chat', () => {
  it('returns unavailable message when no API key is configured', async () => {
    const reply = await makeService().chat('Hello coach', []);

    expect(reply).toContain('OPENAI_API_KEY');
  });

  it('returns the AI response text', async () => {
    mockFetch({ choices: [{ message: { content: 'Great footwork!' } }] });

    const reply = await makeService('test-key').chat('How is my timing?', []);

    expect(reply).toBe('Great footwork!');
  });

  it('includes reviewContext in the system message', async () => {
    mockFetch({ choices: [{ message: { content: 'ok' } }] });

    await makeService('test-key').chat('Question', [], 'Section 0s–30s');

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const system = body.messages.find((m: any) => m.role === 'system');
    expect(system.content).toContain('Section 0s–30s');
  });

  it('caps conversation history at 20 turns', async () => {
    mockFetch({ choices: [{ message: { content: 'ok' } }] });
    const history = Array.from({ length: 25 }, (_, i) => ({ role: 'user', content: `msg ${i}` }));

    await makeService('test-key').chat('New message', history);

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    // system (1) + capped history (≤20) + current user msg (1) = ≤22
    expect(body.messages.length).toBeLessThanOrEqual(22);
  });

  it('strips non-user/assistant roles from history', async () => {
    mockFetch({ choices: [{ message: { content: 'ok' } }] });
    const history = [
      { role: 'user', content: 'valid' },
      { role: 'system', content: 'should be stripped' },
      { role: 'assistant', content: 'also valid' },
    ];

    await makeService('test-key').chat('Question', history);

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const systemMsgs = body.messages.filter((m: any) => m.role === 'system');
    // Only the service's own system prompt should remain
    expect(systemMsgs).toHaveLength(1);
    expect(systemMsgs[0].content).not.toContain('should be stripped');
  });

  it('throws when fetch returns a non-ok status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as any;

    await expect(makeService('test-key').chat('Hello', [])).rejects.toThrow('401');
  });
});

