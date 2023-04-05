import { NotificationsEntity } from 'src/entities/notifications.entity';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class NotificationsService {
  expo: Expo;

  constructor(
    @InjectRepository(NotificationsEntity)
    private notificationsRepository: Repository<NotificationsEntity>,
  ) {
    this.expo = new Expo();
  }

  async sendChunkNotifications(messages: ExpoPushMessage[]) {
    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error(error);
      }
    }

    return tickets;
  }

  findAll(): Promise<NotificationsEntity[]> {
    return this.notificationsRepository.find();
  }

  findOne(id: string): Promise<NotificationsEntity> {
    return this.notificationsRepository.findOne({ where: { id } });
  }

  async remove(id: string): Promise<void> {
    await this.notificationsRepository.delete(id);
  }

  async create(token: string, userId: string) {
    const isIn = await this.notificationsRepository.findOne({
      where: { userId },
    });

    if (isIn) {
      return this.notificationsRepository.update(
        { id: isIn.id },
        {
          token,
        },
      );
    }
    return this.notificationsRepository.insert({
      token,
      userId,
    });
  }

  findUserToken(userId: any): Promise<NotificationsEntity> {
    return this.notificationsRepository.findOne({ where: { userId } });
  }
}
