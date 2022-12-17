import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ReminderEntity } from 'src/entities/reminder.entity';
import { User } from 'src/utils/decorators/User';
import { CreateReminder } from './reminder.schemas';
import { ReminderService } from './reminder.service';

@Resolver()
export class ReminderResolver {
  constructor(private reminderService: ReminderService) {}

  @Mutation(() => ReminderEntity)
  async createReminder(
    @User() userId: string,
    @Args('input', { type: () => CreateReminder, nullable: false })
    input: CreateReminder,
  ) {
    const insertResult = await this.reminderService.createReminder({
      ...input,
      userId,
    });

    return this.reminderService.getReminderById(insertResult.identifiers[0].id);
  }
}
