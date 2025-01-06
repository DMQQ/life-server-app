import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlashCard, Group } from './flashcards.entity';
import {
  CreateFlashCardInput,
  ReviewFlashCardInput,
  UpdateFlashCardInput,
} from './flashcard.types';

@Injectable()
export class FlashCardService {
  constructor(
    @InjectRepository(FlashCard)
    private flashCardRepository: Repository<FlashCard>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
  ) {}

  async create(
    input: CreateFlashCardInput,
    userId: string,
  ): Promise<FlashCard> {
    const group = await this.groupRepository.findOne({
      where: {
        id: input.groupId,
        userId,
      },
    });

    if (!group) {
      throw new NotFoundException(
        `Group with ID ${input.groupId} not found or doesn't belong to user`,
      );
    }

    const flashCard = this.flashCardRepository.create({
      ...input,
      group,
      userId,
    });

    return this.flashCardRepository.save(flashCard);
  }

  async findAll(userId: string, groupId?: string): Promise<FlashCard[]> {
    const where: any = { userId };
    if (groupId) {
      where.group = { id: groupId };
    }

    return this.flashCardRepository.find({
      where,
      relations: ['group'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string, userId: string): Promise<FlashCard> {
    const flashCard = await this.flashCardRepository.findOne({
      where: { id, userId },
      relations: ['group'],
    });

    if (!flashCard) {
      throw new NotFoundException(`FlashCard with ID ${id} not found`);
    }

    return flashCard;
  }

  async update(
    id: string,
    input: UpdateFlashCardInput,
    userId: string,
  ): Promise<FlashCard> {
    const flashCard = await this.findOne(id, userId);
    Object.assign(flashCard, input);
    return this.flashCardRepository.save(flashCard);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    await this.findOne(id, userId); // Verify ownership
    const result = await this.flashCardRepository.delete({ id, userId });
    return result.affected > 0;
  }

  async review(
    input: ReviewFlashCardInput,
    userId: string,
  ): Promise<FlashCard> {
    const flashCard = await this.findOne(input.id, userId);

    flashCard.timesReviewed++;
    if (input.isCorrect) {
      flashCard.correctAnswers++;
    } else {
      flashCard.incorrectAnswers++;
    }

    flashCard.successRate =
      (flashCard.correctAnswers / flashCard.timesReviewed) * 100;
    flashCard.lastReviewedAt = new Date();

    return this.flashCardRepository.save(flashCard);
  }

  async getStats(
    id: string,
    userId: string,
  ): Promise<{
    totalReviewed: number;
    successRate: number;
    lastReviewed: Date;
  }> {
    const flashCard = await this.findOne(id, userId);

    return {
      totalReviewed: flashCard.timesReviewed,
      successRate: flashCard.successRate,
      lastReviewed: flashCard.lastReviewedAt,
    };
  }

  async getGroupStats(groupId: string, userId: string) {
    const cards = await this.findAll(userId, groupId);

    return {
      totalCards: cards.length,
      averageSuccessRate:
        cards.reduce((acc, card) => acc + card.successRate, 0) / cards.length,
      totalReviewed: cards.reduce((acc, card) => acc + card.timesReviewed, 0),
      masteredCards: cards.filter((card) => card.successRate >= 80).length,
    };
  }
}
