import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { VideoEntity } from './video.entity';
import { ReviewEntity } from './review.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  passwordHash!: string | null;

  @Column({ nullable: true })
  displayName!: string | null;

  @Column({ default: 'beginner' })
  experienceLevel!: 'beginner' | 'intermediate' | 'advanced';

  @Column({ default: 'follower' })
  preferredRole!: 'leader' | 'follower' | 'switch';

  @Column({ default: 'en' })
  preferredLanguage!: string;

  @Column({ type: 'json', default: {} })
  notificationSettings!: Record<string, boolean>;

  @Column({ type: 'json', default: { private: true } })
  privacySettings!: Record<string, any>;

  @Column({ nullable: true })
  agentApiKey!: string | null;

  @Column({ nullable: true })
  authTokenHash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  authTokenExpiresAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => VideoEntity, (video) => video.owner)
  videos!: VideoEntity[];

  @OneToMany(() => ReviewEntity, (review) => review.user)
  reviews!: ReviewEntity[];
}
