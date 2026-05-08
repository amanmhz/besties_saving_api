import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  setting_key: string;

  @Column('text')
  setting_value: string;

  @Column('uuid')
  updated_by: string;

  @UpdateDateColumn()
  updated_at: Date;
}
