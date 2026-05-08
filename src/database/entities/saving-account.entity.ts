import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { SavingDeposit } from './saving-deposit.entity';

@Entity('saving_accounts')
export class SavingAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  member_id: string;

  @ManyToOne(() => User, (user) => user.savingAccounts)
  @JoinColumn({ name: 'member_id' })
  user: User;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  total_balance: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => SavingDeposit, (deposit) => deposit.savingAccount)
  deposits: SavingDeposit[];
}
