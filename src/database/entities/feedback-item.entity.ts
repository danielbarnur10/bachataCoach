import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ReviewChunkEntity } from './review-chunk.entity';

export type FeedbackCategory = 'timing' | 'footwork' | 'posture' | 'partnership' | 'musicality' | 'strength' | 'recommendation';
export type FeedbackSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';
export type UserQualityRating = 'helpful' | 'not_helpful' | 'incorrect_timing' | 'cannot_see' | 'too_vague' | 'too_advanced' | 'too_basic';

@Entity('feedback_items')
export class FeedbackItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  chunkId: string;

  @ManyToOne(() => ReviewChunkEntity, (chunk) => chunk.feedbackItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chunkId' })
  chunk: ReviewChunkEntity;

  @Column()
  category: FeedbackCategory;

  @Column({ default: 'medium' })
  severity: FeedbackSeverity;

  @Column('decimal', { precision: 10, scale: 2 })
  startTimeSeconds: number;

  @Column('decimal', { precision: 10, scale: 2 })
  endTimeSeconds: number;

  @Column()
  title: string;

  @Column('text')
  observation: string;

  @Column('text', { nullable: true })
  explanation: string;

  @Column('text', { nullable: true })
  recommendation: string;

  @Column({ type: 'json', default: {} })
  evidence: Record<string, any>;

  @Column('decimal', { precision: 3, scale: 2 })
  confidence: number;

  @Column({ nullable: true })
  userQualityRating: UserQualityRating;

  @Column({ nullable: true })
  userNotes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
