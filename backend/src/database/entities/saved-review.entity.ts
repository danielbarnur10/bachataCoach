import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('saved_reviews')
@Index(['videoId', 'aTime', 'bTime', 'chunkNumber'], { unique: true })
export class SavedReviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  videoId: string;

  @Column('float')
  aTime: number;

  @Column('float')
  bTime: number;

  @Column('int')
  chunkNumber: number;

  @Column({ type: 'simple-json' })
  reviewData: object;

  // Free-text context the user gave before requesting this review
  @Column({ type: 'text', nullable: true })
  userContext: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
