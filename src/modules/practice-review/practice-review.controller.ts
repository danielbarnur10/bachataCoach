import {
  Body,
  Controller,
  Delete,
  Get,
  Optional,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { existsSync, mkdirSync, createWriteStream } from 'fs';
import { diskStorage } from 'multer';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { stat } from 'fs/promises';
import axios from 'axios';
import ytdl from 'ytdl-core';
import { PracticeVideoEntity } from './practice-video.entity';
import { InMemoryVideoRepository } from './in-memory-video.repository';
import { PracticeReviewService } from './practice-review.service';
import { ChatHistoryService } from './chat-history.service';
import { SavedReviewService } from './saved-review.service';
import { UsersService } from '../users/users.service';

const execAsync = promisify(exec);

@Controller('videos')
export class PracticeReviewController {
  private readonly uploadDir: string = join(process.cwd(), 'uploads');
  private readonly CHUNK_DURATION_SECONDS = 15;
  private readonly MAX_CHUNK_DURATION_SECONDS = 20;

  constructor(
    private readonly videoRepository: InMemoryVideoRepository,
    private readonly reviewService: PracticeReviewService,
    private readonly chatHistoryService: ChatHistoryService,
    private readonly savedReviewService: SavedReviewService,
    @Optional() private readonly usersService?: UsersService,
  ) {
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  @Get()
  async listVideos(): Promise<PracticeVideoEntity[]> {
    return this.videoRepository.list();
  }

  @Get(':id')
  async getVideo(@Param('id') id: string): Promise<PracticeVideoEntity | null> {
    return this.videoRepository.getById(id);
  }

  @Post(':id/review/start')
  async startReview(
    @Param('id') id: string,
    @Body() body: { aTime?: number; bTime?: number; reviewType?: string },
  ) {
    const video = await this.videoRepository.getById(id);
    if (!video) {
      return { error: 'Video not found' };
    }

    const videoDuration = this.estimateDurationSeconds(video);
    const aTime = body.aTime ?? 0;
    const bTime = body.bTime ?? Math.min(videoDuration, 120);

    if (aTime >= bTime) {
      return { error: 'A time must be before B time' };
    }

    const intervalDuration = bTime - aTime;
    const totalChunks = Math.max(
      1,
      Math.ceil(intervalDuration / this.CHUNK_DURATION_SECONDS),
    );

    return {
      reviewId: randomUUID(),
      aTime,
      bTime,
      intervalDuration,
      totalChunks,
      currentChunk: 1,
      chunkDuration: this.CHUNK_DURATION_SECONDS,
      prompt: `Ready to review your practice. I'll analyze ${totalChunks} chunk${totalChunks > 1 ? 's' : ''} in the ${Math.round(intervalDuration)}s section from ${this.formatTime(aTime)} to ${this.formatTime(bTime)}. Let's start!`,
    };
  }

  @Post(':id/review/regenerate')
  async regenerateReview(
    @Param('id') id: string,
    @Body()
    body: {
      aTime?: number;
      bTime?: number;
      chunkNumber?: number;
      feedback?: string;
      userContext?: string;
      songInfo?: string;
    },
    @Req() req?: Request,
  ) {
    const video = await this.videoRepository.getById(id);
    if (!video) return { error: 'Video not found' };
    const aTime = body.aTime ?? 0;
    const bTime = body.bTime ?? 120;
    const chunkNumber = Math.max(1, body.chunkNumber ?? 1);
    const apiKey = await this.getUserApiKey(req);
    return this.buildChunkReview(
      video,
      aTime,
      bTime,
      chunkNumber,
      body.feedback,
      body.userContext,
      true,
      body.songInfo,
      apiKey,
    );
  }

  @Post(':id/chat')
  async chat(
    @Param('id') id: string,
    @Body() body: { message?: string; reviewContext?: string },
    @Req() req?: Request,
  ) {
    if (!body.message?.trim()) {
      return { error: 'Message is required' };
    }
    try {
      const previousHistory = await this.chatHistoryService.getHistory(id);
      const apiKey = await this.getUserApiKey(req);
      const result = await this.reviewService.chat(
        body.message,
        previousHistory,
        body.reviewContext,
        apiKey,
      );
      await this.chatHistoryService.saveMessage(id, 'user', body.message);
      await this.chatHistoryService.saveMessage(
        id,
        'assistant',
        result.reply,
        result.actions,
      );
      return { reply: result.reply, actions: result.actions };
    } catch (error) {
      return {
        reply:
          'Sorry, there was an error reaching the AI coach. Please try again.',
        actions: [],
      };
    }
  }

  @Get(':id/chat/history')
  async getChatHistory(@Param('id') id: string) {
    return this.chatHistoryService.getHistory(id);
  }

  @Delete(':id/chat/history')
  async clearChatHistory(@Param('id') id: string) {
    await this.chatHistoryService.clearHistory(id);
    return { success: true };
  }

  @Get(':id/review/chunk/:chunkNumber')
  async getChunk(
    @Param('id') id: string,
    @Query('aTime') aTimeStr?: string,
    @Query('bTime') bTimeStr?: string,
    @Param('chunkNumber') chunkNumberStr?: string,
    @Query('userContext') userContext?: string,
    @Query('songInfo') songInfo?: string,
    @Req() req?: Request,
  ) {
    const video = await this.videoRepository.getById(id);
    if (!video) return { error: 'Video not found' };
    const aTime = parseFloat(aTimeStr || '0') || 0;
    const bTime = parseFloat(bTimeStr || '120') || 120;
    const chunkNumber = Math.max(1, parseInt(chunkNumberStr || '1', 10));
    const apiKey = await this.getUserApiKey(req);
    return this.buildChunkReview(
      video,
      aTime,
      bTime,
      chunkNumber,
      undefined,
      userContext,
      false,
      songInfo,
      apiKey,
    );
  }

  @Get(':id/saved-reviews')
  async listSavedReviews(@Param('id') id: string) {
    return this.savedReviewService.findAllForVideo(id);
  }

  private async buildChunkReview(
    video: any,
    aTime: number,
    bTime: number,
    chunkNumber: number,
    userFeedback?: string,
    userContext?: string,
    forceRegenerate = false,
    songInfo?: string,
    apiKey?: string,
  ) {
    const chunkStart = aTime + (chunkNumber - 1) * this.CHUNK_DURATION_SECONDS;
    const chunkEnd = Math.min(bTime, chunkStart + this.CHUNK_DURATION_SECONDS);

    if (chunkStart >= bTime)
      return { error: 'No more chunks in this interval' };

    const chunkDurationSeconds = chunkEnd - chunkStart;
    const totalChunks = Math.max(
      1,
      Math.ceil((bTime - aTime) / this.CHUNK_DURATION_SECONDS),
    );
    const hasNextChunk = chunkNumber < totalChunks;

    // Return cached review if not forcing regeneration
    if (!forceRegenerate && !userFeedback) {
      const saved = await this.savedReviewService.find(
        video.id,
        aTime,
        bTime,
        chunkNumber,
      );
      if (saved) {
        return {
          ...saved.reviewData,
          cached: true,
          cachedAt: saved.updatedAt,
        };
      }
    }

    try {
      const cached = await this.savedReviewService.find(
        video.id,
        aTime,
        bTime,
        chunkNumber,
      );
      const effectiveContext = userContext ?? cached?.userContext ?? undefined;
      const effectiveSongInfo =
        songInfo ?? (cached?.reviewData as any)?.songInfo ?? undefined;
      const review = (await Promise.race([
        this.reviewService.reviewVideo(
          video.title,
          {
            durationSeconds: chunkDurationSeconds,
            title: video.title,
            audioBeatCount: this.estimateBeatCount(video),
            movementScore: this.estimateMovementScore(video),
            userFeedback,
            userContext: effectiveContext,
            songInfo: effectiveSongInfo,
          },
          apiKey,
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI analysis timeout')), 45000),
        ),
      ])) as any;

      let segments = review.segments || [];
      if (!segments.length) {
        segments = [
          {
            startTime: chunkStart,
            endTime: chunkStart + chunkDurationSeconds * 0.5,
            label: 'First half',
            reason: 'Pay attention to timing and positioning',
          },
          {
            startTime: chunkStart + chunkDurationSeconds * 0.5,
            endTime: chunkEnd,
            label: 'Second half',
            reason: 'Watch for consistency through the finish',
          },
        ];
      } else {
        segments = segments.map((seg: any) => ({
          ...seg,
          startTime: chunkStart + seg.startTime,
          endTime: chunkStart + seg.endTime,
        }));
      }

      const result = {
        ...review,
        segments,
        chunkNumber,
        totalChunks,
        chunkStartTime: chunkStart,
        chunkEndTime: chunkEnd,
        chunkDuration: chunkDurationSeconds,
        aTime,
        bTime,
        hasNextChunk,
        nextChunkLabel: hasNextChunk
          ? `Next (${this.formatTime(chunkEnd)} – ${this.formatTime(Math.min(bTime, chunkEnd + this.CHUNK_DURATION_SECONDS))})`
          : 'Review complete',
        prompt: `Chunk ${chunkNumber} of ${totalChunks}${hasNextChunk ? ' — tap Next to continue' : ' — review complete'}`,
        songInfo: effectiveSongInfo,
      };
      // Persist so subsequent requests return instantly
      await this.savedReviewService.upsert(
        video.id,
        aTime,
        bTime,
        chunkNumber,
        result,
        userContext,
      );
      return result;
    } catch (error) {
      console.error('Error analyzing chunk:', error);
      return {
        chunkNumber,
        totalChunks,
        chunkStartTime: chunkStart,
        chunkEndTime: chunkEnd,
        chunkDuration: chunkDurationSeconds,
        aTime,
        bTime,
        hasNextChunk,
        summary: `Section ${this.formatTime(chunkStart)}–${this.formatTime(chunkEnd)}: Review the timing and musicality here.`,
        musicality:
          'Listen carefully to how your steps align with the beat in this section.',
        style:
          'Focus on maintaining your frame and posture throughout this moment.',
        improvementTips: [
          'Count the beats clearly in this section',
          'Practice this specific moment at 0.75x speed',
          'Record another attempt and compare',
        ],
        segments: [
          {
            startTime: chunkStart,
            endTime: chunkStart + chunkDurationSeconds * 0.5,
            label: 'First half',
            reason:
              'Pay attention to your initial positioning and weight transfer',
          },
          {
            startTime: chunkStart + chunkDurationSeconds * 0.5,
            endTime: chunkEnd,
            label: 'Second half',
            reason: 'Watch for consistency and completion of the movement',
          },
        ],
        analysisSource: 'fallback',
        prompt: `Chunk ${chunkNumber} of ${totalChunks} (fallback analysis)`,
      };
    }
  }

  @Get(':id/review')
  async getReview(@Param('id') id: string) {
    const video = await this.videoRepository.getById(id);
    if (!video) {
      return { error: 'Video not found' };
    }

    const videoDuration = this.estimateDurationSeconds(video);

    return {
      videoId: id,
      videoDuration,
      prompt:
        'Select a section to review. Set A and B times, or use the default starting section.',
      defaultA: 0,
      defaultB: Math.min(videoDuration, 120),
      readyForChunks: true,
    };
  }

  @Get(':id/file')
  async streamVideo(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const video = await this.videoRepository.getById(id);
    if (!video) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    const filePath = join(this.uploadDir, video.filename);
    if (!existsSync(filePath)) {
      res.status(404).json({ error: 'Video file not found on disk' });
      return;
    }

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      try {
        res.sendFile(filePath);
        return;
      } catch (error) {
        res
          .status(416)
          .json({ error: 'Unable to stream the requested video range' });
        return;
      }
    }

    res.sendFile(filePath);
  }

  @Post('upload-from-url')
  async uploadFromUrl(@Body() body: { url: string; title?: string }) {
    const url = body.url?.trim();
    if (!url) {
      return { error: 'URL is required' };
    }

    // Check if YouTube or Instagram
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const isInstagram = url.includes('instagram.com');

    if (!isYouTube && !isInstagram) {
      return { error: 'Only YouTube and Instagram URLs are supported' };
    }

    try {
      if (isYouTube) {
        // Download from YouTube
        console.log('Attempting to download from YouTube:', url);

        let videoInfo;
        try {
          videoInfo = await ytdl.getInfo(url);
        } catch (infoError) {
          console.error('Failed to get video info:', infoError);
          return {
            error: 'Cannot access this YouTube video. It might be:',
            reasons: [
              '- Age-restricted or private',
              '- Deleted or removed',
              '- Geographically blocked',
              '- Requires authentication',
            ],
            suggestion: 'Try downloading manually using: https://savefrom.net',
          };
        }

        const videoTitle = videoInfo.videoDetails.title;
        const durationSeconds = parseInt(videoInfo.videoDetails.lengthSeconds);

        if (durationSeconds > 600) {
          return {
            error: 'Video is longer than 10 minutes. Please trim it first.',
          };
        }

        const videoId = randomUUID();
        const fileName = `${videoId}-youtube.mp4`;
        const filePath = join(this.uploadDir, fileName);

        try {
          await new Promise((resolve, reject) => {
            const writeStream = createWriteStream(filePath);
            const videoStream = ytdl(url, {
              quality: '18',
            });

            videoStream.pipe(writeStream);
            writeStream.on('finish', () => resolve(null));
            writeStream.on('error', reject);
            videoStream.on('error', reject);
          });
        } catch (downloadError) {
          console.error('Download failed:', downloadError);
          return {
            error: 'Failed to download video. Common reasons:',
            reasons: [
              '- YouTube is blocking automated downloads',
              '- Network connection issue',
              '- Video file is too large',
            ],
            suggestion:
              'Please download manually from: https://savefrom.net and upload the file',
          };
        }

        // Get file stats
        const fileStats = await stat(filePath);

        // Create practice-video.entity
        const video = new PracticeVideoEntity(
          videoId,
          body.title || videoTitle,
          fileName,
          new Date().toISOString(),
          'video/mp4',
          fileStats.size,
        );

        await this.videoRepository.create(video);

        return {
          success: true,
          message: `✅ Downloaded: ${videoTitle}`,
          video,
          source: 'YouTube',
        };
      } else if (isInstagram) {
        // For Instagram, return helpful message
        return {
          error:
            'Instagram video download requires authentication. Please download manually using:',
          options: [
            '1. Use: https://download.savefrom.net',
            '2. Or: https://igdownloader.app',
            '3. Then upload the MP4 file here',
          ],
        };
      }
    } catch (error) {
      console.error('Error in uploadFromUrl:', error);
      return {
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Please try uploading the file directly instead',
      };
    }
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = join(process.cwd(), 'uploads');
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const safeName = file.originalname.replace(/\s+/g, '-');
          cb(null, `${randomUUID()}-${safeName}`);
        },
      }),
      limits: {
        fileSize: 1024 * 1024 * 1024,
      },
    }),
  )
  async uploadVideo(
    @UploadedFile() file: any,
    @Body() body: { title?: string },
    @Req() req?: Request,
  ) {
    const apiKey = await this.getUserApiKey(req);
    const title = body.title ?? file?.originalname ?? 'Untitled video';
    const fileName = file.filename ?? file.originalname;

    const video = new PracticeVideoEntity(
      randomUUID(),
      title,
      fileName,
      new Date().toISOString(),
      file.mimetype,
      file.size,
    );

    await this.videoRepository.create(video);
    return {
      video,
      message: 'Upload complete. Video is ready to practice.',
      review: await this.reviewService.reviewVideo(
        title,
        {
          durationSeconds: this.estimateDurationSecondsFromBytes(file.size),
          title,
          audioBeatCount: this.estimateBeatCountFromDuration(
            this.estimateDurationSecondsFromBytes(file.size),
          ),
          movementScore: this.estimateMovementScoreFromDuration(
            this.estimateDurationSecondsFromBytes(file.size),
          ),
        },
        apiKey,
      ),
    };
  }

  private async getUserApiKey(req?: Request): Promise<string | undefined> {
    if (!req?.headers.authorization || !this.usersService) {
      return undefined;
    }

    const [scheme, token] = req.headers.authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return undefined;
    }

    return this.usersService.getAgentApiKeyForToken(token);
  }

  private estimateDurationSeconds(video: PracticeVideoEntity): number {
    return this.estimateDurationSecondsFromBytes(video.sizeBytes);
  }

  private estimateDurationSecondsFromBytes(sizeBytes: number): number {
    if (sizeBytes && sizeBytes > 0) {
      const estimatedDuration = Math.max(8, Math.round(sizeBytes / 180000));
      return Math.min(600, estimatedDuration);
    }
    return 600;
  }

  private estimateBeatCount(video: PracticeVideoEntity): number {
    const durationSeconds = this.estimateDurationSeconds(video);
    return this.estimateBeatCountFromDuration(durationSeconds);
  }

  private estimateBeatCountFromDuration(durationSeconds: number): number {
    return Math.max(4, Math.round(durationSeconds / 4));
  }

  private estimateMovementScore(video: PracticeVideoEntity): number {
    const beatCount = this.estimateBeatCount(video);
    return this.estimateMovementScoreFromDuration(beatCount);
  }

  private estimateMovementScoreFromDuration(durationSeconds: number): number {
    return Math.min(10, Math.max(3, Math.round(durationSeconds / 2 + 2)));
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0');
    return `${mins}:${secs}`;
  }

  @Delete(':id')
  async deleteVideo(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.videoRepository.delete(id);
    return { success: true };
  }
}
