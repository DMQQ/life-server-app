import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: process.env.HOST,
  port: +process.env.PORT,
  username: process.env.NAME,
  password: process.env.PASS,
  database: process.env.DATABASE,
  entities: ['dist/**/*.entity{.ts,.js}'],
  migrations: ['migrations/*.{ts,js}'],
  synchronize: process.env.SYNC === 'true' || process.env.NAME === 'true',
};

export const AppDataSource = new DataSource(dataSourceOptions);
