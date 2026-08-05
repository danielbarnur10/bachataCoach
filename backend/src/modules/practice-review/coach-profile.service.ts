import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CoachProfileData,
  CoachProfileEntity,
} from '../../database/entities/coach-profile.entity';
import { ReferenceVideoAnalysisEntity } from '../../database/entities/reference-video-analysis.entity';

const emptyProfile = (): CoachProfileData => ({
  referenceVideoIds: [],
  referenceSummaries: [],
  timingPriorities: [],
  movementPreferences: [],
  styleInfluences: [],
  corrections: [],
  teachingNotes: [],
});

@Injectable()
export class CoachProfileService {
  constructor(
    @InjectRepository(CoachProfileEntity)
    private readonly profileRepository: Repository<CoachProfileEntity>,
    @InjectRepository(ReferenceVideoAnalysisEntity)
    private readonly analysisRepository: Repository<ReferenceVideoAnalysisEntity>,
  ) {}

  async getOrCreate(ownerId: string, libraryId = 'default', libraryName = 'My Coach') {
    let entity = await this.profileRepository.findOne({ where: { ownerId, libraryId } });
    if (!entity) {
      entity = this.profileRepository.create({ ownerId, libraryId, libraryName, profile: emptyProfile() });
      entity = await this.profileRepository.save(entity);
    }
    entity.profile = { ...emptyProfile(), ...(entity.profile ?? {}) };
    return entity;
  }

  async list(ownerId: string) {
    const profiles = await this.profileRepository.find({ where: { ownerId }, order: { createdAt: 'ASC' } });
    if (!profiles.length) await this.getOrCreate(ownerId);
    return this.profileRepository.find({ where: { ownerId }, order: { createdAt: 'ASC' } });
  }

  async get(ownerId: string, libraryId = 'default') {
    const profile = await this.getOrCreate(ownerId, libraryId);
    const analyses = await this.analysisRepository.find({
      where: { ownerId, libraryId },
      order: { createdAt: 'ASC' },
    });
    return { profile: profile.profile, analyses };
  }

  async addReferenceAnalysis(
    ownerId: string,
    videoId: string,
    videoTitle: string,
    libraryId = 'default',
    analysis: Record<string, unknown>,
  ) {
    let saved = await this.analysisRepository.findOne({ where: { ownerId, videoId, libraryId } });
    if (saved) {
      saved.analysis = analysis;
      saved.videoTitle = videoTitle;
    } else {
      saved = this.analysisRepository.create({ ownerId, videoId, libraryId, videoTitle, analysis });
    }
    await this.analysisRepository.save(saved);

    const profile = await this.getOrCreate(ownerId, libraryId);
    const data = profile.profile;
    data.referenceVideoIds = Array.from(new Set([...data.referenceVideoIds, videoId]));
    const summary = String(analysis.summary ?? `${videoTitle}: reference analysis saved.`);
    data.referenceSummaries = Array.from(new Set([...data.referenceSummaries, summary]));
    data.styleInfluences = this.merge(data.styleInfluences, analysis.style);
    data.timingPriorities = this.merge(data.timingPriorities, analysis.musicality);
    data.teachingNotes = this.merge(data.teachingNotes, analysis.improvementTips);
    await this.profileRepository.save(profile);
    return this.get(ownerId, libraryId);
  }

  async addCorrection(ownerId: string, correction: string, libraryId = 'default') {
    const profile = await this.getOrCreate(ownerId, libraryId);
    profile.profile.corrections = this.merge(profile.profile.corrections, correction);
    await this.profileRepository.save(profile);
    return this.get(ownerId, libraryId);
  }

  async createLibrary(ownerId: string, name: string, style?: string, role?: string) {
    const libraryId = randomUUID();
    const profile = await this.getOrCreate(ownerId, libraryId, name.trim());
    profile.libraryName = name.trim();
    profile.style = style?.trim() || null;
    profile.role = role?.trim() || null;
    await this.profileRepository.save(profile);
    return profile;
  }

  async update(ownerId: string, patch: Partial<CoachProfileData>, libraryId = 'default') {
    const profile = await this.getOrCreate(ownerId, libraryId);
    profile.profile = { ...profile.profile, ...patch };
    await this.profileRepository.save(profile);
    return this.get(ownerId, libraryId);
  }

  private merge(existing: string[], value: unknown): string[] {
    const additions = Array.isArray(value) ? value : value ? [String(value)] : [];
    return Array.from(new Set([...existing, ...additions.map(String).filter(Boolean)])).slice(-30);
  }
}
