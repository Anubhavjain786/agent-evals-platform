import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export const DB = Symbol('DB');

/** Migrations live next to the package root in both `src/` (dev) and `dist/` (prod) layouts. */
const MIGRATIONS_DIR = resolve(__dirname, '..', '..', 'drizzle');

export function createDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  // WAL lets the UI read while the scheduler writes; foreign keys enforce cascades.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle({ client: sqlite, schema, casing: 'snake_case' });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db;
}

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        const db = createDatabase(config.databasePath);
        new Logger('Database').log(`SQLite ready at ${config.databasePath}`);
        return db;
      },
    },
  ],
  exports: [DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DB) private readonly db: Db) {}

  onApplicationShutdown(): void {
    this.db.$client.close();
  }
}
