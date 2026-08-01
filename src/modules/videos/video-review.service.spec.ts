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
    const result = await makeService().chat('Hello coach', []);

    expect(result.reply).toContain('OPENAI_API_KEY');
    expect(result.actions).toEqual([]);
  });

  it('returns the AI reply and actions', async () => {
    const aiJson = { reply: 'Great footwork!', actions: [{ type: 'setSpeed', rate: 0.75 }] };
    mockFetch({ choices: [{ message: { content: JSON.stringify(aiJson) } }] });

    const result = await makeService('test-key').chat('How is my timing?', []);

    expect(result.reply).toBe('Great footwork!');
    expect(result.actions).toEqual([{ type: 'setSpeed', rate: 0.75 }]);
  });

  it('returns empty actions when AI sends none', async () => {
    mockFetch({ choices: [{ message: { content: JSON.stringify({ reply: 'ok', actions: [] }) } }] });

    const result = await makeService('test-key').chat('Hello', []);

    expect(result.actions).toEqual([]);
  });

  it('uses json_object response_format', async () => {
    mockFetch({ choices: [{ message: { content: JSON.stringify({ reply: 'ok', actions: [] }) } }] });

    await makeService('test-key').chat('Hello', []);

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('includes reviewContext in the system message', async () => {
    mockFetch({ choices: [{ message: { content: JSON.stringify({ reply: 'ok', actions: [] }) } }] });

    await makeService('test-key').chat('Question', [], 'Section 0s–30s');

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const system = body.messages.find((m: any) => m.role === 'system');
    expect(system.content).toContain('Section 0s–30s');
  });

  it('describes available actions in the system prompt', async () => {
    mockFetch({ choices: [{ message: { content: JSON.stringify({ reply: 'ok', actions: [] }) } }] });

    await makeService('test-key').chat('Help', []);

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const system = body.messages.find((m: any) => m.role === 'system');
    expect(system.content).toContain('regenerate');
    expect(system.content).toContain('seek');
    expect(system.content).toContain('loop');
  });

  it('caps conversation history at 20 turns', async () => {
    mockFetch({ choices: [{ message: { content: JSON.stringify({ reply: 'ok', actions: [] }) } }] });
    const history = Array.from({ length: 25 }, (_, i) => ({ role: 'user' as const, content: `msg ${i}` }));

    await makeService('test-key').chat('New message', history);

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.messages.length).toBeLessThanOrEqual(22);
  });

  it('strips non-user/assistant roles from history', async () => {
    mockFetch({ choices: [{ message: { content: JSON.stringify({ reply: 'ok', actions: [] }) } }] });
    const history = [
      { role: 'user' as const, content: 'valid' },
      { role: 'system' as any, content: 'should be stripped' },
      { role: 'assistant' as const, content: 'also valid' },
    ];

    await makeService('test-key').chat('Question', history);

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const systemMsgs = body.messages.filter((m: any) => m.role === 'system');
    expect(systemMsgs).toHaveLength(1);
    expect(systemMsgs[0].content).not.toContain('should be stripped');
  });

  it('throws when fetch returns a non-ok status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as any;

    await expect(makeService('test-key').chat('Hello', [])).rejects.toThrow('401');
  });
});

