import { EventSubscriber, EntitySubscriberInterface, EntityManager } from 'typeorm';
import { TimelineEntity, TimelineTodosEntity } from './timeline.entity';

@EventSubscriber()
export class TimelineSubscriber implements EntitySubscriberInterface<TimelineTodosEntity> {
  listenTo() {
    return TimelineTodosEntity;
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
      const [todo] = await manager.queryRunner.query('SELECT * FROM timeline_todos WHERE id = ?', [id]);

      if (!todo) return;

      const timeline = await manager.findOne(TimelineEntity, {
        where: { id: todo.timelineId },
        relations: ['todos'],
      });

      if (!timeline) return;

      const areAllCompleted = timeline.todos.every((t) => t.isCompleted) && timeline.todos.length > 0;

      if (timeline.isCompleted !== areAllCompleted) {
        timeline.isCompleted = areAllCompleted;
        await manager.save(timeline);
      }

      await this.sendLiveActivityUpdate(manager, timeline);
    } catch (error) {
      console.error('Error handling todo change:', error);
    }
  }

  private async sendLiveActivityUpdate(manager: EntityManager, timeline: TimelineEntity) {
    try {
      const liveActivity = await manager
        .createQueryBuilder()
        .select('*')
        .from('live_activities', 'la')
        .where('la.timelineId = :timelineId', { timelineId: timeline.id })
        .andWhere('la.status IN (:...statuses)', { statuses: ['sent', 'update'] })
        .getRawOne();

      if (!liveActivity || !liveActivity.updateToken) {
        console.log(`No active live activity found for timeline ${timeline.id}`);
        return;
      }

      const timelineWithTodos = await manager.findOne(TimelineEntity, {
        where: { id: timeline.id },
        relations: ['todos'],
      });

      // Send APN update notification
      const { ApnService } = await import('../notifications/apn.service');
      const apnService = new ApnService();

      console.log(`Sending Live Activity update for timeline ${timeline.id}`);
      const result = await apnService.updateTimelineActivity(liveActivity.updateToken, timelineWithTodos);

      if (result.success) {
        console.log(`Live Activity update sent successfully for timeline ${timeline.id}`);

        // Update live activity status and timestamp
        await manager
          .createQueryBuilder()
          .update('live_activities')
          .set({
            status: 'update',
            lastUpdated: Date.now(),
          })
          .where('id = :id', { id: liveActivity.id })
          .execute();
      } else {
        console.error(`Failed to send Live Activity update:`, result.error);
      }
    } catch (error) {
      console.error('Error sending Live Activity update:', error);
    }
  }
}
