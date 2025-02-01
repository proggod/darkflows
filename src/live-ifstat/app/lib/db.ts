import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';

let sqliteDb: Database;

export async function getSqliteDb(): Promise<Database> {
  if (!sqliteDb) {
    sqliteDb = await open({
      filename: '/etc/pihole/pihole-FTL.db',
      driver: sqlite3.Database,
    });
  }
  return sqliteDb;
} 