import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql';
import { UserGoal, GoalCategory, GoalEntry } from './goals.entity';
import { GoalService } from './goals.service';
import { InputType, Field, ObjectType } from '@nestjs/graphql';
import { IsString, IsNumber, IsDate, IsOptional } from 'class-validator';
import { UseGuards } from '@nestjs/common';
import { User } from 'src/utils/decorators/User';

// Keep same input types for API compatibility
@InputType()
class CreateGoalsInput {
  @Field()
  @IsString()
  name: string;

  @Field()
  @IsString()
  icon: string;

  @Field()
  @IsString()
  description: string;

  @Field()
  @IsNumber()
  target: number;

  @Field()
  @IsNumber()
  min: number;

  @Field()
  @IsNumber()
  max: number;

  @Field()
  @IsString()
  unit: string;
}

@InputType()
class UpdateGoalsInput {
  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  icon?: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field()
  @IsNumber()
  target: number;

  @Field()
  @IsNumber()
  min: number;

  @Field()
  @IsNumber()
  max: number;
}

@InputType()
class DateRangeInput {
  @Field()
  @IsDate()
  start: Date;

  @Field()
  @IsDate()
  end: Date;
}

// Map old names to new entities
@ObjectType({ description: 'Goal' })
class Goal extends UserGoal {}

@ObjectType({ description: 'Goals' })
class Goals extends GoalCategory {}

@ObjectType({ description: 'GoalStats' })
class GoalStats extends GoalEntry {}

@Resolver(() => Goal)
export class GoalResolver {
  constructor(private goalService: GoalService) {}

  @Query(() => Goal)
  async userGoal(
    @User() userId: string,
    @Args('dateRange', { type: () => DateRangeInput, nullable: true })
    dateRange?: DateRangeInput,
  ) {
    return this.goalService.getUserGoalWithEntries(userId, dateRange);
  }

  @Mutation(() => Goals)
  async createGoals(
    @User() userId: string,
    @Args('input') input: CreateGoalsInput,
  ) {
    const userGoal = await this.goalService.getOrCreateUserGoal(userId);
    return this.goalService.createGoalCategory(userGoal.id, input);
  }

  @Mutation(() => Goals)
  async updateGoals(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateGoalsInput,
  ) {
    return this.goalService.updateGoalCategory(id, input);
  }

  @Mutation(() => Boolean)
  async deleteGoals(@Args('id', { type: () => ID }) id: string) {
    await this.goalService.deleteGoalCategory(id);
    return true;
  }

  @Mutation(() => GoalStats)
  async upsertGoalStats(
    @Args('goalsId', { type: () => ID }) categoryId: string,
    @Args('value', { type: () => Number }) value: number,
    @Args('date', { type: () => Date, nullable: true }) date?: Date,
  ) {
    return this.goalService.upsertGoalEntry(categoryId, value, date);
  }

  @Query(() => [Goals])
  async goals(@User() userId: string) {
    const userGoal = await this.goalService.getUserGoalWithEntries(userId);
    return userGoal.categories;
  }
}
