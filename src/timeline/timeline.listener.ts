import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntityUpdatePayload } from 'src/utils/emitter/entity-emitter';
import { EventOccurrenceEntity } from './entities/event-occurrence.entity';
import { OccurrenceTodoEntity } from './entities/occurrence-todo.entity';
import { LiveActivityEntity, LiveActivityStatus } from './live-activity.entity';
import { ApnService } from 'src/notifications/apn.service';

@Injectable()
export class TimelineListener {
  constructor(
    @InjectRepository(EventOccurrenceEntity)
    private readonly occurrenceRepo: Repository<EventOccurrenceEntity>,
    @InjectRepository(LiveActivityEntity)
    private readonly liveActivityRepo: Repository<LiveActivityEntity>,
    private readonly apnService: ApnService,
  ) {}

  @OnEvent('occurrence-todo.created', { async: true })
  async onTodoCreated(entity: OccurrenceTodoEntity) {
    await this.syncOccurrenceCompletion(entity.occurrenceId);
  }

  @OnEvent('occurrence-todo.updated', { async: true })
  async onTodoUpdated({ entity }: EntityUpdatePayload<OccurrenceTodoEntity>) {
    await this.syncOccurrenceCompletion(entity.occurrenceId);
  }

  @OnEvent('occurrence-todo.deleted', { async: true })
  async onTodoDeleted(entity: OccurrenceTodoEntity) {
    await this.syncOccurrenceCompletion(entity.occurrenceId);
  }

  @OnEvent('occurrence.updated', { async: true })
  async onOccurrenceUpdated({ entity }: EntityUpdatePayload<EventOccurrenceEntity>) {
    await this.sendLiveActivity(entity.id);
  }

  private async syncOccurrenceCompletion(occurrenceId: string) {
    const occurrence = await this.occurrenceRepo.findOne({
      where: { id: occurrenceId },
      relations: ['todos'],
    });
    if (!occurrence) return;

    const allCompleted = occurrence.todos.length > 0 && occurrence.todos.every((t) => t.isCompleted);
    if (occurrence.isCompleted !== allCompleted) {
      occurrence.isCompleted = allCompleted;
      await this.occurrenceRepo.save(occurrence);
    }

    await this.sendLiveActivity(occurrenceId);
  }

  private async sendLiveActivity(occurrenceId: string) {
    const liveActivity = await this.liveActivityRepo
      .createQueryBuilder('la')
      .where('la.occurrenceId = :id', { id: occurrenceId })
      .andWhere('la.status IN (:...statuses)', { statuses: [LiveActivityStatus.SENT, LiveActivityStatus.UPDATE] })
      .getOne();

    if (!liveActivity?.updateToken) return;

    const occurrence = await this.occurrenceRepo.findOne({
      where: { id: occurrenceId },
      relations: ['todos', 'series'],
    });
    if (!occurrence) return;

    const result = await this.apnService.updateTimelineActivity(liveActivity.updateToken, occurrence);
    if (result.success) {
      await this.liveActivityRepo.update(liveActivity.id, {
        status: LiveActivityStatus.UPDATE,
        lastUpdated: Date.now(),
      });
    }
  }
}
