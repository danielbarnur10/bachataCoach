import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { VideoEntity } from './video.entity';
import { UserEntity } from './user.entity';

@Entity('saved_loops')
export class SavedLoopEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  videoId: string;

  @ManyToOne(() => VideoEntity, (video) => video.savedLoops, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'videoId' })
  video: VideoEntity;

  @Column()
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column()
  name: string;

  @Column('decimal', { precision: 10, scale: 2 })
  aTimeSeconds: number;

  @Column('decimal', { precision: 10, scale: 2 })
  bTimeSeconds: number;

  @Column({ default: 1 })
  preferredPlaybackSpeed: number;

  @Column({ default: false })
  mirrorPreference: boolean;

  @Column({ nullable: true })
  relatedFeedbackId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
