import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000, '192.168.0.25', () => {
    console.log('Server is running on http://192.168.0.25:3000/');
    console.log('GraphQL is running on http://192.168.0.25:3000/graphql');
  });
}
bootstrap();
