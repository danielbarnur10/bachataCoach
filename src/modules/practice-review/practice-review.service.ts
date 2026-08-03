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
export class PracticeReviewService {
  private readonly modelApiKey =
    process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY;
  private readonly modelEndpoint = this.normalizeBaseUrl(
    process.env.OPENAI_BASE_URL ??
      process.env.OPENAI_ENDPOINT ??
      'https://api.openai.com/v1',
  );
  private readonly modelName =
    process.env.OPENAI_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini';

  async reviewVideo(
    title: string,
    context: ReviewContext = {},
    apiKey?: string,
  ): Promise<VideoReviewResult> {
    const durationSeconds = context.durationSeconds ?? 24;
    const audioBeatCount =
      context.audioBeatCount ?? this.estimateBeatCount(durationSeconds);
    const movementScore =
      context.movementScore ?? this.estimateMovementScore(audioBeatCount);
    const effectiveApiKey = apiKey ?? this.modelApiKey;

    if (effectiveApiKey) {
      try {
        return await this.reviewWithAi(
          title,
          durationSeconds,
          audioBeatCount,
          movementScore,
          context.userFeedback,
          context.userContext,
          context.songInfo,
          effectiveApiKey,
        );
      } catch (error) {
        console.warn(
          'AI review unavailable, falling back to heuristic analysis.',
          error,
        );
      }
    }

    return this.reviewWithHeuristics(
      title,
      durationSeconds,
      audioBeatCount,
      movementScore,
    );
  }

  private async reviewWithAi(
    title: string,
    durationSeconds: number,
    audioBeatCount: number,
    movementScore: number,
    userFeedback?: string,
    userContext?: string,
    songInfo?: string,
    apiKey?: string,
  ): Promise<VideoReviewResult> {
    const feedbackSection = userFeedback?.trim()
      ? `\n\nIMPORTANT \u2014 DANCER CORRECTION: The dancer provided this feedback on the previous analysis:\n"${userFeedback}"\nAdjust your observations specifically to address this correction.`
      : '';

    const userContextSection = userContext?.trim()
      ? `\n\nDANCER PROFILE & PREFERENCES:\n${userContext}\nTailor your analysis and tips to this dancer.`
      : '';

    const songSection = songInfo?.trim()
      ? `\n\nSONG IDENTIFICATION:\nThe dancer is practicing to: "${songInfo}"\nUsing your knowledge of this song/artist:\n- Identify the bachata subgenre or dance context (Sensual / Urban / Traditional / Fusion / Moderno)\n- Reference the typical BPM, energy, and emotional tone for this specific song\n- Note key structural moments (when does the Mambo hit? where is the Majao section?)\n- Tailor ALL rhythmic observations to this song's specific feel — e.g. a sensual Romeo Santos track demands different body expression than a traditional Frank Reyes or an urban Aventura cut.`
      : '';

  const prompt = `
You are a bachata musicality, rhythm, and partner-dance coach. Analyze this dance clip only from observable evidence.

Evaluate:
1. Timing, rhythm, musicality, and beat alignment.
2. Connection and partner responsiveness when directly visible.
3. Playfulness and flirtatious energy as expressed through timing, teasing, invitations, reactions, eye contact, proximity, and changes in energy. Do not infer private feelings or personality.
4. Body movement as it relates to the music: torso, hips, weight changes, isolations, pauses, dynamics, accents, and rhythmic texture. Ignore attractiveness and generic aesthetics.
5. Song-section identification throughout the entire clip, including the intro.

The clip is ${durationSeconds} seconds long, with approximately ${audioBeatCount} beats and movement intensity of ${movementScore}/10.

BACHATA MUSICAL FRAMEWORKS:
- Intro: The opening arrangement of the song, not a separate bachata rhythm. Identify which framework it uses when audible.
- Derecho: The stable foundational bachata rhythm, commonly heard in instrumental intros and verses. Listen for the regular guira, bongo, bass, and rhythm-guitar pattern.
- Majao: A more rhythmically emphasized bachata framework, commonly heard in choruses or livelier sections. Listen for sparser percussion, stronger downbeats, fuller syncopated bass, and mid-tempo requinto grooves.
- Mambo: The highest-energy instrumental bachata section, usually a vocal break or interlude led by requinto/guitar grooves, improvisation, and percussion influenced by merengue. Do not label a section Mambo only because the dancer moves with high energy.
- Unclear: Use when the audio or visual evidence is insufficient. Do not force a classification.

Derecho, Majao, and Mambo describe the music rhythmic framework, not simply the dancer movement intensity. Identify them from the audible rhythm, percussion, bass, guitar, vocals, and arrangement whenever audio is available. A song may transition between frameworks, and the patterns can overlap. If classification is uncertain, state why and include a confidence value.

Analyze dance fusion separately under danceStyleInfluences. Fusion is not a bachata song rhythm or song section; it may describe the dancer combining traditional bachata with sensual, urban, salsa/mambo, contemporary, or other movement qualities.

Return valid JSON only. Do not include Markdown or commentary.

Required JSON structure (must include these exact top-level keys):
{
  "summary": "string",
  "musicality": "string",
  "style": "string",
  "improvementTips": ["string", "string", "string"],
  "segments": [
    {
      "startTime": 0,
      "endTime": 3,
      "label": "Derecho opening",
      "reason": "Step timing is approximately late on count 1 but recovers by count 5; connection remains responsive."
    }
  ],
  "details": {
    "dominantSongPart": "Intro | Derecho | Majao | Mambo | Unclear",
    "songPartsDetected": ["string"],
    "confidence": 0.0,
    "connection": "string",
    "flirtPlayfulness": "string",
    "bodyMovement": "string",
    "danceStyleInfluences": ["Traditional Bachata | Sensual | Urban | Salsa/Mambo | Contemporary | Other | None | Unclear"]
  }
}

For every segment, identify:
- The likely musical framework: Derecho, Majao, Mambo, or Unclear, plus the arrangement position: Intro, Verse, Chorus, Instrumental Interlude, Outro, or Unclear.
- Whether the dancer is early, late, on time, or mixed.
- Beat-alignment quality and rhythm accuracy.
- Any meaningful connection, playful/flirtatious exchange, or partner responsiveness.
- How body movement supports or misses the musical accents.
- Specific musical moments such as syncopation, breaks, percussion hits, pauses, requinto riffs, or call-and-response.

Give exactly 3 improvement tips. Use approximate timing only when supported by the clip; do not invent precise millisecond values.

Additional song context:
${songSection}

Additional user context:
${userContextSection}

Previous feedback:
${feedbackSection}
`;
    const response = await fetch(this.buildChatUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a bachata rhythm and musicality coach. Focus on timing, rhythm, beat accuracy, and musical interpretation first, while including only observable partner connection/playfulness/body-movement notes that relate to the music. Return valid JSON only.',
          },
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

    const summary = this.pickSummaryText(parsed);
    const musicality = this.pickMusicalityText(parsed);
    const style = this.pickStyleText(parsed);

    return {
      summary,
      musicality,
      style,
      improvementTips: Array.isArray(parsed.improvementTips)
        ? parsed.improvementTips.filter(
            (tip): tip is string => typeof tip === 'string',
          )
        : [
            'Listen for the downbeat and align your steps.',
            'Practice counting: 1-2-3 pause 5-6-7 pause.',
            'Record and playback to hear timing differences.',
          ],
      segments: this.normalizeSegments(
        parsed.segments,
        durationSeconds,
        audioBeatCount,
      ),
      analysisSource: 'ai',
    };
  }

  private reviewWithHeuristics(
    title: string,
    durationSeconds: number,
    audioBeatCount: number,
    movementScore: number,
  ): VideoReviewResult {
    const segmentSize = Math.max(
      4,
      Math.floor(
        durationSeconds /
          Math.max(2, Math.min(6, Math.round(audioBeatCount / 2))),
      ),
    );
    const segments = Array.from(
      { length: Math.max(2, Math.ceil(durationSeconds / segmentSize)) },
      (_, index) => {
        const startTime = index * segmentSize;
        const endTime = Math.min(durationSeconds, startTime + segmentSize);

        // Identify song section
        const sectionIndex = Math.floor((startTime / durationSeconds) * 3);
        const sections = [
          'Derecho (intro)',
          'Majao (syncopated)',
          'Mambo (percussion)',
        ];
        const section = sections[Math.min(sectionIndex, 2)];

        // Timing assessment based on movement score
        const timingQuality =
          movementScore >= 8
            ? 'precise'
            : movementScore >= 5
              ? 'moderate'
              : 'needs work';
        const rhythmFocus = section.includes('syncopated')
          ? 'syncopated accents'
          : section.includes('percussion')
            ? 'percussion hits'
            : 'basic beat';

        const label = section;
        const reason = `${section}: Timing is ${timingQuality}. Focus on hitting ${rhythmFocus} clearly.`;

        return { startTime, endTime, label, reason };
      },
    );

    return {
      summary: `Timing and rhythm analysis: You're dancing through the ${['Derecho', 'Majao', 'Mambo'][Math.floor(durationSeconds / 3)]} section. Focus on beat accuracy.`,
      musicality: `Listen to the ${audioBeatCount} main beats in this section. Align your steps to emphasize count 1 and count 5.`,
      style:
        movementScore >= 7
          ? 'Your rhythm timing is strong - maintain this clarity.'
          : 'Work on hitting the main beats more precisely before adding syncopation.',
      improvementTips: [
        'Count aloud: "1-2-3 pause 5-6-7 pause" to internalize the basic pattern',
        'Listen for the clave rhythm pattern in the music',
        'Practice at 0.75x speed to lock in timing',
      ],
      segments,
      analysisSource: 'heuristic',
    };
  }

  private normalizeSegments(
    segments: unknown,
    durationSeconds: number,
    audioBeatCount: number,
  ): ReviewSegment[] {
    if (!Array.isArray(segments)) {
      return this.reviewWithHeuristics(
        'clip',
        durationSeconds,
        this.estimateBeatCount(durationSeconds),
        this.estimateMovementScore(durationSeconds),
      ).segments;
    }

    return segments
      .filter(
        (segment): segment is Record<string, unknown> =>
          typeof segment === 'object' && segment !== null,
      )
      .map((segment) => ({
        startTime: this.toNumber(segment.startTime, 0),
        endTime: this.toNumber(segment.endTime, durationSeconds),
        label:
          typeof segment.label === 'string'
            ? segment.label
            : `Beat ${Math.min(audioBeatCount, 1)}`,
        reason:
          typeof segment.reason === 'string'
            ? segment.reason
            : 'Review the movement against the beat.',
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
    return Math.min(
      10,
      Math.max(3, Math.round(this.estimateBeatCount(durationSeconds) / 2 + 2)),
    );
  }

  private parseJsonSafe(content: string): Record<string, unknown> {
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        try {
          return JSON.parse(content.slice(firstBrace, lastBrace + 1)) as Record<
            string,
            unknown
          >;
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

  private pickSummaryText(parsed: Record<string, unknown>): string {
    const direct = this.toText(parsed.summary, '');
    if (direct) return direct;

    if (this.isObject(parsed.summary)) {
      const fromOverall = this.toText(parsed.summary.overall, '');
      if (fromOverall) return fromOverall;
    }

    return 'Timing and rhythm assessment for this section.';
  }

  private pickMusicalityText(parsed: Record<string, unknown>): string {
    const direct = this.toText(parsed.musicality, '');
    if (direct) return direct;

    if (this.isObject(parsed.musicality)) {
      const timing = this.toText(parsed.musicality.timingObservations, '');
      const beat = this.toText(parsed.musicality.beatAlignment, '');
      const accent = this.toText(parsed.musicality.accentInterpretation, '');
      const combined = [timing, beat, accent].filter(Boolean).join(' ');
      if (combined) return combined;
    }

    return 'Stay connected to the beat and respond to musical accents.';
  }

  private pickStyleText(parsed: Record<string, unknown>): string {
    const direct = this.toText(parsed.style, '');
    if (direct) return direct;

    if (this.isObject(parsed.musicality)) {
      const nestedStyle = this.toText(parsed.musicality.style, '');
      if (nestedStyle) return nestedStyle;
    }

    return 'Maintain consistent rhythm throughout.';
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  async chat(
    message: string,
    history: ChatMessage[],
    reviewContext?: string,
    apiKey?: string,
  ): Promise<{ reply: string; actions: ChatAction[] }> {
    const effectiveApiKey = apiKey ?? this.modelApiKey;
    if (!effectiveApiKey) {
      return {
        reply:
          'AI coach is unavailable (no OPENAI_API_KEY). Set it in .env to enable chat.',
        actions: [],
      };
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
        Authorization: `Bearer ${effectiveApiKey}`,
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

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = payload.choices?.[0]?.message?.content ?? '{}';
    const parsed = this.parseJsonSafe(raw) as {
      reply?: unknown;
      actions?: unknown;
    };

    return {
      reply:
        typeof parsed.reply === 'string' && parsed.reply.trim()
          ? parsed.reply
          : 'Sorry, I could not generate a response.',
      actions: Array.isArray(parsed.actions)
        ? (parsed.actions as ChatAction[]).filter(
            (a) => a && typeof (a as any).type === 'string',
          )
        : [],
    };
  }
}
