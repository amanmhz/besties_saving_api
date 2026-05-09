import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
dotenv.config();

import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';
import { UserRole } from './database/entities/user.entity';
import { SettingsService } from './modules/settings/settings.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  const adminEmail = process.env.ADMIN_EMAIL || '';
  const adminPassword = process.env.ADMIN_PASSWORD || '';

  const existingAdmin = await usersService.findByEmail(adminEmail);

  if (!existingAdmin) {
    console.log('🌱 Seeding default SuperAdmin...');
    await usersService.create({
      name: 'Besties Savings',
      email: adminEmail,
      password_hash: adminPassword, // Will be hashed by service
      role: UserRole.SUPER_ADMIN,
      is_active: true,
      phone: ''
    });
    console.log(`✅ Default SuperAdmin created: ${adminEmail}`);
  }

  // Seed default settings
  const settingsService = app.get(SettingsService);
  const existingSavingsRate = await settingsService.findAll().then((res: any[]) => res.find(s => s.setting_key === 'SAVING_INTEREST_RATE'));

  if (!existingSavingsRate && existingAdmin) {
    console.log('🌱 Seeding default interest rates...');
    const adminId = existingAdmin?.id || (await usersService.findByEmail(adminEmail))?.id;
    if (adminId) {
      await settingsService.upsertSetting('SAVING_INTEREST_RATE', '8', adminId);
      await settingsService.upsertSetting('LOAN_INTEREST_RATE', '12', adminId);
      console.log('✅ Default interest rates seeded (Savings: 8%, Loan: 12%)');
    }
  }

  await app.close();
}

bootstrap();
