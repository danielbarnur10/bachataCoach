import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('reference_video_analyses')
@Unique(['ownerId', 'videoId', 'libraryId'])
export class ReferenceVideoAnalysisEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  ownerId!: string;

  @Column({ default: 'default' })
  libraryId!: string;

  @Column()
  videoId!: string;

  @Column()
  videoTitle!: string;

  @Column({ type: 'simple-json' })
  analysis!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
