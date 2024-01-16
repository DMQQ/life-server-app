import { ApolloDriver } from '@nestjs/apollo';
import { Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthenticationModule } from './authentication/authentication.module';
import { TokenMiddleware } from './utils/middlewares/TokenMiddleware';

import { TimelineModule } from './timeline/timeline.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UploadModule } from './upload/upload.module';

import { MulterModule } from '@nestjs/platform-express';
import { WalletModule } from './wallet/wallet.module';
import { WorkoutModule } from './workout/workout.module';

@Module({
  imports: [
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
      useFactory: async (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('HOST'),
        port: +configService.get('PORT'),
        username: configService.get('NAME'),
        password: configService.get('PASS'),
        database: configService.get('DATABASE'),

        entities: ['dist/**/*.entity{.ts,.js}'],

        synchronize: true,
        // synchronize: false,
      }),
      inject: [ConfigService],
    }),

    AuthenticationModule,

    TimelineModule,

    NotificationsModule,

    UploadModule,

    WalletModule,

    WorkoutModule,

    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: true,
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: any) {
    consumer.apply(TokenMiddleware).forRoutes('*');
  }
}
