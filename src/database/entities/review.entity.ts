import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { UserEntity } from './user.entity';
import { VideoEntity } from './video.entity';
import { ReviewChunkEntity } from './review-chunk.entity';
import { CoachPlanEntity } from './coach-plan.entity';

export type ReviewType = 'solo' | 'jack_and_jill' | 'couple' | 'general';
export type ReviewStatus =
  | 'pending'
  | 'processing'
  | 'awaiting_confirmation'
  | 'paused'
  | 'partially_complete'
  | 'complete'
  | 'failed';

@Entity('reviews')
export class ReviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  videoId: string;

  @ManyToOne(() => VideoEntity, (video) => video.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'videoId' })
  video: VideoEntity;

  @Column()
  userId: string;

  @ManyToOne(() => UserEntity, (user) => user.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column({ default: 'solo' })
  reviewType: ReviewType;

  @Column({ nullable: true })
  targetDancerId: string;

  @Column({ nullable: true })
  targetDancerRole: 'leader' | 'follower' | 'both' | 'switch';

  @Column({ type: 'simple-array', default: [] })
  requestedCategories: string[];

  @Column({ default: 'processing' })
  status: ReviewStatus;

  @Column({ default: false })
  isAwaitingContinuation: boolean;

  @Column({ default: 0 })
  completedChunkCount: number;

  @Column({ default: 0 })
  totalChunkCount: number;

  @Column({ default: 1 })
  analysisVersion: number;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ nullable: true })
  failureReason: string;

  @Column({ nullable: true })
  failureTimestamp: Date;

  @Column({ type: 'json', default: {} })
  metadata: Record<string, any>;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ReviewChunkEntity, (chunk) => chunk.review)
  chunks: ReviewChunkEntity[];

  @OneToMany(() => CoachPlanEntity, (plan) => plan.review)
  coachPlans: CoachPlanEntity[];
}
