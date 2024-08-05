import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  if (process.env.NODE_ENV === 'development') {
    await app.listen(process.env.APP_PORT || 3000, '192.168.0.31', () => {
      console.log('Server is running on http://192.168.0.31:3000/');
      console.log('GraphQL is running on http://192.168.0.31/graphql');
    });
  } else {
    await app.listen(process.env.APP_PORT || 3000, () => {
      console.log('Server is running on http://localhost:3000/');
      console.log('GraphQL is running on http://localhost:3000/graphql');
    });
  }
}
bootstrap();
