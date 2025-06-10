import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import * as compression from 'compression';

const ADDR = '10.1.1.105';

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
