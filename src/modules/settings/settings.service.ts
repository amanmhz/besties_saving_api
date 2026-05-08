import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '../../database/entities/system-setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private settingsRepo: Repository<SystemSetting>,
  ) {}

  async findAll() {
    return this.settingsRepo.find();
  }

  async getSetting(key: string) {
    const setting = await this.settingsRepo.findOne({ where: { setting_key: key } });
    if (!setting) {
      throw new NotFoundException(`Setting ${key} not found`);
    }
    return setting;
  }

  async upsertSetting(key: string, value: string, userId: string) {
    let setting = await this.settingsRepo.findOne({ where: { setting_key: key } });
    
    if (setting) {
      setting.setting_value = value;
      setting.updated_by = userId;
    } else {
      setting = this.settingsRepo.create({
        setting_key: key,
        setting_value: value,
        updated_by: userId,
      });
    }
    
    return this.settingsRepo.save(setting);
  }
}
