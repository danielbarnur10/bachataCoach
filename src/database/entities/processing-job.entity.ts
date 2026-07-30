import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type ProcessingJobType = 'video_prepare' | 'chunk_analyze' | 'feedback_generate' | 'coach_plan_generate';
export type ProcessingJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

@Entity('processing_jobs')
export class ProcessingJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reviewId: string;

  @Column({ nullable: true })
  chunkId: string;

  @Column()
  jobType: ProcessingJobType;

  @Column({ default: 'pending' })
  status: ProcessingJobStatus;

  @Column({ default: 0 })
  priority: number;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  errorCategory: string;

  @Column({ nullable: true })
  idempotencyKey: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
