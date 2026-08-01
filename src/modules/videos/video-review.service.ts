import { Injectable } from '@nestjs/common';

export interface ReviewSegment {
  startTime: number;
  endTime: number;
  label: string;
  reason: string;
}

export interface VideoReviewResult {
  summary: string;
  musicality: string;
  style: string;
  improvementTips: string[];
  segments: ReviewSegment[];
  analysisSource: 'ai' | 'heuristic';
}

export interface ReviewContext {
  durationSeconds?: number;
  title?: string;
  audioBeatCount?: number;
  movementScore?: number;
  userFeedback?: string;
  userContext?: string;
  songInfo?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  actions?: ChatAction[];
}

export type ChatAction =
  | { type: 'regenerate'; feedback?: string }
  | { type: 'seek'; time: number }
  | { type: 'loop'; start: number; end: number }
  | { type: 'stopLoop' }
  | { type: 'setSpeed'; rate: number }
  | { type: 'mirror' };

@Injectable()
export class VideoReviewService {
  private readonly modelApiKey = process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY;
  private readonly modelEndpoint = this.normalizeBaseUrl(process.env.OPENAI_BASE_URL ?? process.env.OPENAI_ENDPOINT ?? 'https://api.openai.com/v1');
  private readonly modelName = process.env.OPENAI_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini';

  async reviewVideo(title: string, context: ReviewContext = {}): Promise<VideoReviewResult> {
    const durationSeconds = context.durationSeconds ?? 24;
    const audioBeatCount = context.audioBeatCount ?? this.estimateBeatCount(durationSeconds);
    const movementScore = context.movementScore ?? this.estimateMovementScore(audioBeatCount);

    if (this.modelApiKey) {
      try {
        return await this.reviewWithAi(title, durationSeconds, audioBeatCount, movementScore, context.userFeedback, context.userContext, context.songInfo);
      } catch (error) {
        console.warn('AI review unavailable, falling back to heuristic analysis.', error);
      }
    }

    return this.reviewWithHeuristics(title, durationSeconds, audioBeatCount, movementScore);
  }

  private async reviewWithAi(title: string, durationSeconds: number, audioBeatCount: number, movementScore: number, userFeedback?: string, userContext?: string, songInfo?: string): Promise<VideoReviewResult> {
    const feedbackSection = userFeedback?.trim()
      ? `\n\nIMPORTANT \u2014 DANCER CORRECTION: The dancer provided this feedback on the previous analysis:\n"${userFeedback}"\nAdjust your observations specifically to address this correction.`
      : '';

    const userContextSection = userContext?.trim()
      ? `\n\nDANCER PROFILE & PREFERENCES:\n${userContext}\nTailor your analysis and tips to this dancer.`
      : '';

    const songSection = songInfo?.trim()
      ? `\n\nSONG IDENTIFICATION:\nThe dancer is practicing to: "${songInfo}"\nUsing your knowledge of this song/artist:\n- Identify the bachata subgenre (Sensual / Urban / Traditional / Fusion / Moderno)\n- Reference the typical BPM, energy, and emotional tone for this specific song\n- Note key structural moments (when does the Mambo hit? where is the Majao section?)\n- Tailor ALL rhythmic observations to this song's specific feel — e.g. a sensual Romeo Santos track demands different body expression than a traditional Frank Reyes or an urban Aventura cut.`
      : '';

    const prompt = `You are a bachata musicality and rhythm coach. Analyze this dance clip ONLY for timing, rhythm, and musicality. Ignore posture, aesthetics, or partnership unless directly related to rhythm.

The clip is ${durationSeconds} seconds long with approximately ${audioBeatCount} beats and movement intensity of ${movementScore}/10.

BACHATA SONG STRUCTURE:
- DERECHO (intro/straight section): Basic 8-count timing, foundation
- MAJAO (syncopated section): Syncopated rhythmic accents, call-and-response feel
- MAMBO (percussion-focused): Aggressive rhythmic hits, percussion-driven accents

Return JSON with:
- summary: Which song section this is and overall rhythm quality
- musicality: How well they follow beats and accents
- style: Rhythm interpretation (strict, loose, syncopated, etc)
- improvementTips: Array of 3 timing/rhythm-specific tips
- segments: Array of {startTime, endTime, label, reason} breaking down rhythm moments

For each segment, identify:
- Which PART of the song it seems to be (Derecho/Majao/Mambo)
- Specific timing observations (early/late/on-time)
- Beat alignment quality
- Rhythm accuracy

Example segment:
{"startTime": 0, "endTime": 3, "label": "Derecho opening", "reason": "Step timing is 80ms late on count 1, but recovers by count 5 - good recovery"}

Focus ONLY on rhythm, timing, and musicality. Ignore everything else.${songSection}${userContextSection}${feedbackSection}`;

    const response = await fetch(this.buildChatUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.modelApiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a bachata rhythm and musicality coach. Focus ONLY on timing, rhythm, beat accuracy, and musical interpretation. Return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content ?? '{}';
    const parsed = this.parseJsonSafe(content);

    const summary = this.toText(parsed.summary, `Timing and rhythm assessment for this section.`);
    const musicality = this.toText(parsed.musicality, 'Stay connected to the beat and respond to musical accents.');
    const style = this.toText(parsed.style, 'Maintain consistent rhythm throughout.');

    return {
      summary,
      musicality,
      style,
      improvementTips: Array.isArray(parsed.improvementTips) ? parsed.improvementTips.filter((tip): tip is string => typeof tip === 'string') : [
        'Listen for the downbeat and align your steps.',
        'Practice counting: 1-2-3 pause 5-6-7 pause.',
        'Record and playback to hear timing differences.',
      ],
      segments: this.normalizeSegments(parsed.segments, durationSeconds, audioBeatCount),
      analysisSource: 'ai',
    };
  }

  private reviewWithHeuristics(title: string, durationSeconds: number, audioBeatCount: number, movementScore: number): VideoReviewResult {
    const segmentSize = Math.max(4, Math.floor(durationSeconds / Math.max(2, Math.min(6, Math.round(audioBeatCount / 2)))));
    const segments = Array.from({ length: Math.max(2, Math.ceil(durationSeconds / segmentSize)) }, (_, index) => {
      const startTime = index * segmentSize;
      const endTime = Math.min(durationSeconds, startTime + segmentSize);

      // Identify song section
      const sectionIndex = Math.floor((startTime / durationSeconds) * 3);
      const sections = ['Derecho (intro)', 'Majao (syncopated)', 'Mambo (percussion)'];
      const section = sections[Math.min(sectionIndex, 2)];

      // Timing assessment based on movement score
      const timingQuality = movementScore >= 8 ? 'precise' : movementScore >= 5 ? 'moderate' : 'needs work';
      const rhythmFocus = section.includes('syncopated') ? 'syncopated accents' : section.includes('percussion') ? 'percussion hits' : 'basic beat';

      const label = section;
      const reason = `${section}: Timing is ${timingQuality}. Focus on hitting ${rhythmFocus} clearly.`;

      return { startTime, endTime, label, reason };
    });

    return {
      summary: `Timing and rhythm analysis: You're dancing through the ${['Derecho', 'Majao', 'Mambo'][Math.floor(durationSeconds / 3)]} section. Focus on beat accuracy.`,
      musicality: `Listen to the ${audioBeatCount} main beats in this section. Align your steps to emphasize count 1 and count 5.`,
      style: movementScore >= 7 ? 'Your rhythm timing is strong - maintain this clarity.' : 'Work on hitting the main beats more precisely before adding syncopation.',
      improvementTips: [
        'Count aloud: "1-2-3 pause 5-6-7 pause" to internalize the basic pattern',
        'Listen for the clave rhythm pattern in the music',
        'Practice at 0.75x speed to lock in timing',
      ],
      segments,
      analysisSource: 'heuristic',
    };
  }

  private normalizeSegments(segments: unknown, durationSeconds: number, audioBeatCount: number): ReviewSegment[] {
    if (!Array.isArray(segments)) {
      return this.reviewWithHeuristics('clip', durationSeconds, this.estimateBeatCount(durationSeconds), this.estimateMovementScore(durationSeconds)).segments;
    }

    return segments
      .filter((segment): segment is Record<string, unknown> => typeof segment === 'object' && segment !== null)
      .map((segment) => ({
        startTime: this.toNumber(segment.startTime, 0),
        endTime: this.toNumber(segment.endTime, durationSeconds),
        label: typeof segment.label === 'string' ? segment.label : `Beat ${Math.min(audioBeatCount, 1)}`,
        reason: typeof segment.reason === 'string' ? segment.reason : 'Review the movement against the beat.',
      }))
      .filter((segment) => segment.endTime > segment.startTime)
      .slice(0, 8);
  }

  private toNumber(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  }

  private buildChatUrl(): string {
    return this.modelEndpoint.includes('/chat/completions')
      ? this.modelEndpoint
      : `${this.modelEndpoint.replace(/\/$/, '')}/chat/completions`;
  }

  private normalizeBaseUrl(value: string): string {
    return value.trim().replace(/\/$/, '');
  }

  private estimateBeatCount(durationSeconds: number): number {
    return Math.max(4, Math.round(durationSeconds / 4));
  }

  private estimateMovementScore(durationSeconds: number): number {
    return Math.min(10, Math.max(3, Math.round(this.estimateBeatCount(durationSeconds) / 2 + 2)));
  }

  private parseJsonSafe(content: string): Record<string, unknown> {
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        try {
          return JSON.parse(content.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
        } catch {
          return {};
        }
      }
      return {};
    }
  }

  private toText(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() !== '' ? value : fallback;
  }

  async chat(
    message: string,
    history: ChatMessage[],
    reviewContext?: string,
  ): Promise<{ reply: string; actions: ChatAction[] }> {
    if (!this.modelApiKey) {
      return { reply: 'AI coach is unavailable (no OPENAI_API_KEY). Set it in .env to enable chat.', actions: [] };
    }

    const systemContent = `You are a bachata musicality and rhythm coach with direct control over the video player.

Respond ONLY with valid JSON: {"reply":"...","actions":[...]}
The actions array can be empty. Never include markdown or prose outside the JSON.

Available actions (include only what makes sense for the request):
- {"type":"regenerate","feedback":"correction"} — Re-analyze current section with a specific correction
- {"type":"seek","time":45} — Jump to a timestamp in seconds
- {"type":"loop","start":30,"end":45} — Set and start an A-B loop
- {"type":"stopLoop"} — Stop the current loop
- {"type":"setSpeed","rate":0.75} — Set playback speed (0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0)
- {"type":"mirror"} — Toggle mirror mode

Focus on rhythm, timing, energy, and musicality. Be encouraging and specific.${reviewContext ? `\n\nCurrent state: ${reviewContext}` : ''}`;

    const safeHistory = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-20);

    const response = await fetch(this.buildChatUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.modelApiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemContent },
          ...safeHistory,
          { role: 'user', content: message },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI chat request failed: ${response.status}`);
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = payload.choices?.[0]?.message?.content ?? '{}';
    const parsed = this.parseJsonSafe(raw) as { reply?: unknown; actions?: unknown };

    return {
      reply: typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply : 'Sorry, I could not generate a response.',
      actions: Array.isArray(parsed.actions)
        ? (parsed.actions as ChatAction[]).filter((a) => a && typeof (a as any).type === 'string')
        : [],
    };
  }
}

