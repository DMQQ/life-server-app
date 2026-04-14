import { OccurrenceView } from 'src/timeline/timeline.schemas';

export class EventResource {
  static toWidgetPayload(e: OccurrenceView) {
    return {
      id: e.id,
      date: e.date,
      isCompleted: e.isCompleted,
      isSkipped: e.isSkipped,
      title: e.title,
      description: e.description,
      beginTime: e.beginTime,
      endTime: e.endTime,
      isAllDay: e.isAllDay,
      tags: e.tags,
      priority: e.priority,
      isRepeat: e.isRepeat,
    };
  }

  static toAiContext(e: OccurrenceView) {
    return {
      id: e.id,
      date: e.date,
      title: e.title,
      isCompleted: e.isCompleted,
      tags: e.tags,
    };
  }
}
