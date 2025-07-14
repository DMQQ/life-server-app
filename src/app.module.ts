import { ApolloDriver } from '@nestjs/apollo';
import { Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthenticationModule } from './authentication/authentication.module';
import { TokenMiddleware } from './utils/middlewares/token.middleware';

import { NotificationsModule } from './notifications/notifications.module';
import { TimelineModule } from './timeline/timeline.module';
import { UploadModule } from './upload/upload.module';

import { MulterModule } from '@nestjs/platform-express';
import { HealthController } from './app/app.controller';
import { dataSourceOptions } from './database';
import { FlashCardsModule } from './flashcards/flashcards.module';
import { GoalsModule } from './goals/goals.module';
import { HostsModule } from './hosts/hosts.module';
import { CacheModule } from './utils/services/Cache/cache.module';
import { OpenAIModule } from './utils/services/OpenAI/openai.module';
import { WalletModule } from './wallet/wallet.module';
import { WorkoutModule } from './workout/workout.module';

@Module({
  imports: [
    CacheModule,

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    MulterModule.register({
      dest: './uploads',
    }),

    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async () => ({
        ...dataSourceOptions,
      }),
      inject: [ConfigService],
    }),

    OpenAIModule,

    AuthenticationModule,

    TimelineModule,

    NotificationsModule,

    UploadModule,

    WalletModule,

    WorkoutModule,

    FlashCardsModule,

    GoalsModule,

    HostsModule,

    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: true,
      cache: 'bounded',
      uploads: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxFiles: 5,
      },
      context: ({ req }) => ({ req }),
      bodyParserConfig: {
        limit: '50mb',
      },
    }),
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: any) {
    consumer.apply(TokenMiddleware).forRoutes('*');
  }
}
