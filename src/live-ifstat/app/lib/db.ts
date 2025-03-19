import mysql from 'mysql2/promise';
import { readConfig } from '@/lib/config';

export const getDbConnection = async () => {
  try {
    const config = await readConfig();
    const dbConfig = config.Dhcp4['lease-database'];
    
    return mysql.createConnection({
      socketPath: '/var/run/mysqld/mysqld.sock',
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.name
    });
  } catch (error) {
    console.error('Error connecting to database:', error);
    throw new Error(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}; 