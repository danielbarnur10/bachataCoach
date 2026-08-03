import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('chat_messages')
@Index(['videoId', 'timestamp'])
export class ChatMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  videoId: string;

  @Column()
  role: 'user' | 'assistant';

  @Column('text')
  content: string;

  @Column({ type: 'simple-json', nullable: true })
  actions: object[] | null;

  @CreateDateColumn()
  timestamp: Date;
}
