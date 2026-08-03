import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ReviewEntity } from './review.entity';

@Entity('coach_plans')
export class CoachPlanEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reviewId: string;

  @ManyToOne(() => ReviewEntity, (review) => review.coachPlans, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reviewId' })
  review: ReviewEntity;

  @Column({ default: 1 })
  version: number;

  @Column('text', { nullable: true })
  priorityImprovement: string;

  @Column({ type: 'simple-array', default: [] })
  strengths: string[];

  @Column({ type: 'json', default: [] })
  recommendedDrills: Array<{
    title: string;
    description: string;
    videoInterval?: { startTime: number; endTime: number };
    loopSpeed: number;
  }>;

  @Column({ type: 'json', default: [] })
  supportingTimestamps: number[];

  @Column('text', { nullable: true })
  immediateExercise: string;

  @Column('text', { nullable: true })
  nextFocusArea: string;

  @Column({ type: 'json', default: {} })
  practiceSequence: any;

  @Column({ default: false })
  completedByUser: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
