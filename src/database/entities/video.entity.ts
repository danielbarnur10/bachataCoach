import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { UserEntity } from './user.entity';
import { ReviewEntity } from './review.entity';
import { SavedLoopEntity } from './saved-loop.entity';

export type VideoStatus =
  | 'uploading'
  | 'preparing'
  | 'ready'
  | 'analyzing'
  | 'partially_reviewed'
  | 'review_complete'
  | 'failed'
  | 'deleted';

export type VideoVisibility = 'private' | 'shared' | 'public';

@Entity('videos')
export class VideoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @ManyToOne(() => UserEntity, (user) => user.videos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: UserEntity;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  originalFilename: string;

  @Column()
  storedFilename: string;

  @Column({ nullable: true })
  streamingVersionPath: string;

  @Column({ nullable: true })
  thumbnailPath: string;

  @Column('decimal', { precision: 10, scale: 2 })
  durationSeconds: number;

  @Column('bigint')
  fileSizeBytes: number;

  @Column()
  mimeType: string;

  @Column({ default: 'ready' })
  uploadStatus: 'pending' | 'uploading' | 'completed' | 'failed';

  @Column({ default: 'ready' })
  preparationStatus: 'pending' | 'preparing' | 'completed' | 'failed';

  @Column({ default: 'private' })
  visibility: VideoVisibility;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  lastPlaybackPosition: number;

  @CreateDateColumn()
  uploadedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => ReviewEntity, (review) => review.video)
  reviews: ReviewEntity[];

  @OneToMany(() => SavedLoopEntity, (loop) => loop.video)
  savedLoops: SavedLoopEntity[];
}
