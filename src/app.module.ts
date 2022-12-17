import { ApolloDriver } from '@nestjs/apollo';
import { Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthenticationModule } from './authentication/authentication.module';
import { ReminderModule } from './reminder/reminder.module';
import { TokenMiddleware } from './utils/middlewares/TokenMiddleware';
import { WorkoutModule } from './workout/workout.module';
import { ExerciseModule } from './exercises/exercises.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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
        database: 'mylife',

        entities: ['dist/**/*.entity{.ts,.js}'],

        synchronize: true,
      }),
      inject: [ConfigService],
    }),

    AuthenticationModule,

    WorkoutModule,

    ExerciseModule,

    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: true,
    }),

    ReminderModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: any) {
    consumer.apply(TokenMiddleware).forRoutes('*');
  }
}
