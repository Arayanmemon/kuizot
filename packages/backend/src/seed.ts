/**
 * Seed script — creates three development users if they don't already exist:
 *   super_admin   super@kuizot.dev   / Password123!
 *   admin         admin@kuizot.dev   / Password123!
 *   owner         owner@kuizot.dev   / Password123!
 *
 * Each user also gets a free-tier Subscription row.
 *
 * Run from packages/backend:
 *   npx ts-node -r tsconfig-paths/register src/seed.ts
 */

import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Subscription } from './entities/subscription.entity';
import { Organization } from './entities/organization.entity';
import { Quiz } from './entities/quiz.entity';
import { Question } from './entities/question.entity';
import { Option } from './entities/option.entity';
import { GameSession } from './entities/game-session.entity';
import { AuditLog } from './entities/audit-log.entity';
import { PaymentRequest } from './entities/payment-request.entity';
import { CreditTransaction } from './entities/credit-transaction.entity';

dotenv.config();

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '12345678',
  database: process.env.DB_DATABASE ?? 'real_time_learning',
  synchronize: false, // tables already exist from the running app
  entities: [
    User,
    Subscription,
    Organization,
    Quiz,
    Question,
    Option,
    GameSession,
    AuditLog,
    PaymentRequest,
    CreditTransaction,
  ],
});

interface SeedUser {
  email: string;
  username: string;
  password: string;
  role: 'super_admin' | 'admin' | 'owner';
}

const SEED_USERS: SeedUser[] = [
  { email: 'super@kuizot.dev', username: 'Super Admin', password: 'Password123!', role: 'super_admin' },
  { email: 'admin@kuizot.dev', username: 'Admin User',  password: 'Password123!', role: 'admin' },
  { email: 'owner@kuizot.dev', username: 'Quiz Owner',  password: 'Password123!', role: 'owner' },
];

async function seed(): Promise<void> {
  await ds.initialize();
  console.log('✔  Connected to database');

  const userRepo = ds.getRepository(User);
  const subRepo  = ds.getRepository(Subscription);

  for (const seed of SEED_USERS) {
    const existing = await userRepo.findOne({ where: { email: seed.email } });

    if (existing) {
      console.log(`⏭  Skipping ${seed.email} — already exists`);
      continue;
    }

    const passwordHash = await bcrypt.hash(seed.password, 10);

    const user = userRepo.create({
      email:        seed.email,
      username:     seed.username,
      passwordHash,
      role:         seed.role,
      refreshToken: null,
      suspended:    false,
    });
    await userRepo.save(user);

    const subscription = subRepo.create({
      user:                   { id: user.id },
      tier:                   'free',
      billingModel:           'payg',
      creditBalance:          100, // give seed users some starting credits
      currentPeriodEnd:       null,
      sessionsUsedThisPeriod: 0,
      status:                 'active',
    });
    await subRepo.save(subscription);

    console.log(`✔  Created ${seed.role.padEnd(11)} → ${seed.email}`);
  }

  console.log('\nSeed complete.\n');
  console.log('  super@kuizot.dev  /  Password123!  (super_admin)');
  console.log('  admin@kuizot.dev  /  Password123!  (admin)');
  console.log('  owner@kuizot.dev  /  Password123!  (owner)\n');

  await ds.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
