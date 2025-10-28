import { EventSubscriber, EntitySubscriberInterface, DataSource, EntityManager } from 'typeorm';
import { TimelineEntity, TimelineTodosEntity } from './timeline.entity';

@EventSubscriber()
export class TimelineSubscriber implements EntitySubscriberInterface<TimelineTodosEntity> {
  listenTo() {
    return TimelineTodosEntity;
  }

  async afterUpdate(event) {
    await this.handleTodoChange(event.manager, event.entity.id);
  }

  async afterInsert(event) {
    await this.handleTodoChange(event.manager, event.entity.id);
  }

  async afterRemove(event) {
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

      const areAllCompleted = timeline.todos.every((t) => t.isCompleted) && timeline.todos.length > 0;

      if (timeline.isCompleted !== areAllCompleted) {
        timeline.isCompleted = areAllCompleted;
        await manager.save(timeline);
      }
    } catch (error) {
      console.error('Error handling todo change:', error);
    }
  }
}
