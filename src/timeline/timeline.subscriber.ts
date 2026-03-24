import { EventSubscriber, EntitySubscriberInterface, EntityManager } from 'typeorm';
import { EventOccurrenceEntity } from './entities/event-occurrence.entity';
import { OccurrenceTodoEntity } from './entities/occurrence-todo.entity';

async function sendLiveActivityUpdate(manager: EntityManager, occurrence: EventOccurrenceEntity) {
  try {
    const liveActivity = await manager
      .createQueryBuilder()
      .select('*')
      .from('live_activities', 'la')
      .where('la.occurrenceId = :occurrenceId', { occurrenceId: occurrence.id })
      .andWhere('la.status IN (:...statuses)', { statuses: ['sent', 'update'] })
      .getRawOne();

    if (!liveActivity || !liveActivity.updateToken) {
      console.log(`No active live activity found for occurrence ${occurrence.id}`);
      return;
    }

    const { ApnService } = await import('../notifications/apn.service');
    const apnService = new ApnService();

    console.log(`Sending Live Activity update for occurrence ${occurrence.id}`);
    const result = await apnService.updateTimelineActivity(liveActivity.updateToken, occurrence);

    if (result.success) {
      console.log(`Live Activity update sent successfully for occurrence ${occurrence.id}`);

      await manager
        .createQueryBuilder()
        .update('live_activities')
        .set({ status: 'update', lastUpdated: Date.now() })
        .where('id = :id', { id: liveActivity.id })
        .execute();
    } else {
      console.error(`Failed to send Live Activity update:`, result.error);
    }
  } catch (error) {
    console.error('Error sending Live Activity update:', error);
  }
}

@EventSubscriber()
export class OccurrenceTodosSubscriber implements EntitySubscriberInterface<OccurrenceTodoEntity> {
  listenTo() {
    return OccurrenceTodoEntity;
  }

  async afterUpdate(event: any) {
    await this.handleTodoChange(event.manager, event.entity.id);
  }

  async afterInsert(event: any) {
    await this.handleTodoChange(event.manager, event.entity.id);
  }

  async afterRemove(event: any) {
    await this.handleTodoChange(event.manager, event.entity.id);
  }

  private async handleTodoChange(manager: EntityManager, id: string) {
    try {
      const [todo] = await manager.queryRunner.query('SELECT * FROM occurrence_todos WHERE id = ?', [id]);

      if (!todo) return;

      const occurrence = await manager.findOne(EventOccurrenceEntity, {
        where: { id: todo.occurrenceId },
        relations: ['todos'],
      });

      if (!occurrence) return;

      const areAllCompleted = occurrence.todos.every((t) => t.isCompleted) && occurrence.todos.length > 0;

      if (occurrence.isCompleted !== areAllCompleted) {
        occurrence.isCompleted = areAllCompleted;
        await manager.save(occurrence);
      }

      await sendLiveActivityUpdate(manager, occurrence);
    } catch (error) {
      console.error('Error handling todo change:', error);
    }
  }
}

@EventSubscriber()
export class OccurrenceSubscriber implements EntitySubscriberInterface<EventOccurrenceEntity> {
  listenTo() {
    return EventOccurrenceEntity;
  }

  async afterUpdate(event: any) {
    await this.handleOccurrenceChange(event.manager, event.entity.id);
  }

  private async handleOccurrenceChange(manager: EntityManager, occurrenceId: string) {
    try {
      const occurrence = await manager.findOne(EventOccurrenceEntity, {
        where: { id: occurrenceId },
        relations: ['todos'],
      });

      if (!occurrence) return;

      console.log(`Occurrence ${occurrence.id} updated - sending Live Activity update`);
      await sendLiveActivityUpdate(manager, occurrence);
    } catch (error) {
      console.error('Error handling occurrence change:', error);
    }
  }
}
