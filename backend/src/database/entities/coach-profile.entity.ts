import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export interface CoachProfileData {
  referenceVideoIds: string[];
  referenceSummaries: string[];
  timingPriorities: string[];
  movementPreferences: string[];
  styleInfluences: string[];
  corrections: string[];
  teachingNotes: string[];
}

@Entity('coach_profiles')
@Unique(['ownerId', 'libraryId'])
export class CoachProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  ownerId!: string;

  @Column({ default: 'default' })
  libraryId!: string;

  @Column({ default: 'My Coach' })
  libraryName!: string;

  @Column({ type: 'varchar', nullable: true })
  style!: string | null;

  @Column({ type: 'varchar', nullable: true })
  role!: string | null;

  // simple-json keeps this entity portable between sqljs and PostgreSQL.
  @Column({ type: 'simple-json', default: '{}' })
  profile!: CoachProfileData;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
