import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { ReviewEntity } from './review.entity';
import { FeedbackItemEntity } from './feedback-item.entity';

export type ChunkStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped';

@Entity('review_chunks')
export class ReviewChunkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reviewId: string;

  @ManyToOne(() => ReviewEntity, (review) => review.chunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reviewId' })
  review: ReviewEntity;

  @Column()
  sequenceNumber: number;

  @Column('decimal', { precision: 10, scale: 2 })
  startTimeSeconds: number;

  @Column('decimal', { precision: 10, scale: 2 })
  endTimeSeconds: number;

  @Column({ default: 'queued' })
  status: ChunkStatus;

  @Column({ default: 0 })
  attemptCount: number;

  @Column({ type: 'json', default: {} })
  measurements: Record<string, any>;

  @Column({ type: 'json', default: {} })
  generatedFeedback: Record<string, any>;

  @Column('decimal', { precision: 3, scale: 2, default: 0 })
  confidenceScore: number;

  @Column({ default: 1 })
  processingVersion: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => FeedbackItemEntity, (feedback) => feedback.chunk)
  feedbackItems: FeedbackItemEntity[];
}
