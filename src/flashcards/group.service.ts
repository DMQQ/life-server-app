import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from './flashcards.entity';
import { CreateGroupInput, UpdateGroupInput } from './flashcard.types';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
  ) {}

  async create(input: CreateGroupInput, userId: string): Promise<Group> {
    const group = this.groupRepository.create({
      ...input,
      userId,
    });
    return this.groupRepository.save(group);
  }

  async findAll(userId: string): Promise<Group[]> {
    return this.groupRepository.find({
      where: { userId },
      relations: ['flashcards'],
    });
  }

  async findOne(id: string, userId: string): Promise<Group> {
    const group = await this.groupRepository.findOne({
      where: { id, userId },
      relations: ['flashcards'],
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${id} not found`);
    }

    return group;
  }

  async update(
    id: string,
    input: UpdateGroupInput,
    userId: string,
  ): Promise<Group> {
    const group = await this.findOne(id, userId);
    Object.assign(group, input);
    return this.groupRepository.save(group);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const result = await this.groupRepository.delete({ id, userId });
    return result.affected > 0;
  }
}
