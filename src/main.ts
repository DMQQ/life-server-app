import { NestFactory } from '@nestjs/core';
import * as compression from 'compression';
import * as express from 'express';
import { AppModule } from './app.module';

import * as dayjs from 'dayjs';
import * as advancedFormat from 'dayjs/plugin/advancedFormat';
import * as isoWeek from 'dayjs/plugin/isoWeek';
import * as isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isoWeek);
dayjs.extend(isSameOrBefore);
dayjs.extend(advancedFormat);

const ADDR = '192.168.1.20';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(
    compression({
      level: 9,
      threshold: 0,
      memLevel: 9,
      chunkSize: 16384,
    }),
  );
  if (process.env.NODE_ENV === 'development') {
    await app.listen(process.env.APP_PORT || 3000, ADDR, () => {
      console.log(`Server is running on http://${ADDR}:${process.env.APP_PORT}/`);
      console.log(`GraphQL is running on http://${ADDR}/graphql`);
    });
  } else {
    await app.listen(process.env.APP_PORT || 3000, process.env.IPV6, () => {
      console.log('Server is running on http://localhost:3000/');
      console.log('GraphQL is running on http://localhost:3000/graphql');
    });
  }
}
bootstrap();
