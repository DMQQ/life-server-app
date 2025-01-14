import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const ADDR = '172.20.10.2';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  if (process.env.NODE_ENV === 'development') {
    await app.listen(process.env.APP_PORT || 3000, ADDR, () => {
      console.log(
        `Server is running on http://${ADDR}:${process.env.APP_PORT}/`,
      );
      console.log(`GraphQL is running on http://${ADDR}/graphql`);
    });
  } else {
    await app.listen(process.env.APP_PORT || 3000, () => {
      console.log('Server is running on http://localhost:3000/');
      console.log('GraphQL is running on http://localhost:3000/graphql');
    });
  }
}
bootstrap();
