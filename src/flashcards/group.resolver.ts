import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { GroupsService } from './group.service';
import { Group } from './flashcards.entity';
import { CreateGroupInput, UpdateGroupInput } from './flashcard.types';
import { User } from '../utils/decorators/User';

@Resolver(() => Group)
export class GroupsResolver {
  constructor(private readonly groupsService: GroupsService) {}

  @Query(() => [Group])
  async groups(@User() userId: string): Promise<Group[]> {
    return this.groupsService.findAll(userId);
  }

  @Query(() => Group)
  async group(
    @Args('id', { type: () => ID }) id: string,
    @User() userId: string,
  ): Promise<Group> {
    return this.groupsService.findOne(id, userId);
  }

  @Mutation(() => Group)
  async createGroup(
    @Args('createGroupInput') input: CreateGroupInput,
    @User() userId: string,
  ): Promise<Group> {
    return this.groupsService.create(input, userId);
  }

  @Mutation(() => Group)
  async updateGroup(
    @Args('updateGroupInput') input: UpdateGroupInput,
    @User() userId: string,
  ): Promise<Group> {
    return this.groupsService.update(input.id, input, userId);
  }

  @Mutation(() => Boolean)
  async removeGroup(
    @Args('id', { type: () => ID }) id: string,
    @User() userId: string,
  ): Promise<boolean> {
    return this.groupsService.remove(id, userId);
  }
}
