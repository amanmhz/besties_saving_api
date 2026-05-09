import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('saving_interest')
export class SavingInterest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', generated: 'increment', unique: true })
  sn: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  amount_in: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  amount_out: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  balance_amount: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  withdraw_type: string; // CASH, ONLINE, TRANSFER_TO_SAVING_ACCOUNT

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ type: 'date' })
  ad_date: Date;

  @Column({ length: 10 })
  bs_date: string;

  @Column({ length: 10 })
  fiscal_year: string;

  @Column({ length: 2 })
  fiscal_quarter: string;

  @Column('uuid')
  created_by: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
