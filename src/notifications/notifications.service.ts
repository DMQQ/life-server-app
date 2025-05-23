import { NotificationsEntity, NotificationsHistoryEntity } from 'src/notifications/notifications.entity';
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

    @InjectRepository(NotificationsHistoryEntity)
    private notificationHistoryRepository: Repository<NotificationsHistoryEntity>,
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
    const userToken = await this.findUserToken(userId);

    if (userToken) {
      await this.notificationsRepository.update(userToken.id, { token });
    } else {
      await this.notificationsRepository.insert({ token, userId });
    }

    return true;
  }

  findUserToken(userId: any): Promise<NotificationsEntity> {
    return this.notificationsRepository.findOne({ where: { userId } });
  }

  saveNotification(userId: string, message: Record<string, any>) {
    return this.notificationHistoryRepository.insert({
      userId,
      message,
      sendAt: new Date(),
    });
  }

  findNotifications(userId: string, skip = 0, take = 25) {
    return this.notificationHistoryRepository.find({ where: { userId }, skip, take, order: { sendAt: 'desc' } });
  }

  readNotification(id: string) {
    return this.notificationHistoryRepository.update({ id }, { read: true });
  }

  async unreadNotifications(userId: string) {
    return this.notificationHistoryRepository.findAndCount({
      where: { userId, read: false },
    });
  }
}
