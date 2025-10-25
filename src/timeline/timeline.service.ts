import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import {
  TimelineEntity,
  TimelineFilesEntity,
  TimelineTodosEntity,
  TodoFilesEntity,
} from 'src/timeline/timeline.entity';
import { EntityManager, In, Like, Repository } from 'typeorm';
import { CreateTimelineInput, RepeatableTimeline } from './timeline.schemas';
import { dataSourceOptions } from 'src/database';

interface CreateTimelineProps {
  beginTime: string;
  endTime: string;
  date: string;
  description: string;
  title: string;
}

function excludeSeconds(string: string) {
  return [...string.split(':').slice(0, 2), '00'].join(':');
}

@Injectable()
export class TimelineService {
  constructor(
    @InjectRepository(TimelineEntity)
    private timelineRepository: Repository<TimelineEntity>,

    @InjectRepository(TimelineFilesEntity)
    private timelineFilesRepository: Repository<TimelineFilesEntity>,

    @InjectRepository(TimelineTodosEntity)
    private timelineTodosRepository: Repository<TimelineTodosEntity>,

    @InjectRepository(TodoFilesEntity)
    private todoFilesRepository: Repository<TodoFilesEntity>,
  ) {}

  async findUserMonthEvents(userId: string, date: string) {
    const [year, month] = date.split('-');

    return this.timelineRepository
      .find({
        where: { userId, date: Like(`%${year}-${month}-%%`) },
        order: {
          date: 'ASC',
        },
      })
      .then((t) => {
        let output = [];
        for (const timeline of t) {
          if (!timeline.date.includes(';')) {
            output.push(timeline);
          } else {
            const dates = timeline.date.split(';');
            for (const date of dates) {
              output.push({ ...timeline, date });
            }
          }
        }

        return output;
      });
  }

  async findAllByUserId(opts: {
    userId: string;
    date: string;
    pagination?: { skip: number; take: number };
    query?: string;
  }) {
    return this.timelineRepository.find({
      where: {
        userId: opts.userId,
        date: Like(`%${opts.date}%`),
        ...(opts.query && { title: Like(`%${opts.query}%`) }),
      },
      order: {
        beginTime: 'DESC',
        todos: {
          isCompleted: 'ASC',
          modifiedAt: 'DESC',
        },
      },
      relations: ['images', 'todos', 'todos.files'],
    });
  }

  async findOneById(id: string, userId: string) {
    return this.timelineRepository.findOne({
      where: { id, userId },
      relations: ['images', 'todos', 'todos.files'],
      order: {
        images: {
          createdAt: 'DESC',
        },
        todos: {
          isCompleted: 'ASC',
          modifiedAt: 'DESC',
        },
      },
    });
  }

  async findByCurrentDate(userId: string) {
    const currentDate = dayjs().format('YYYY-MM-DD');
    return this.timelineRepository.find({
      where: { date: Like(`%${currentDate}%`), userId },
      relations: ['images', 'todos', 'todos.files'],
      order: {
        todos: {
          isCompleted: 'ASC',
          modifiedAt: 'DESC',
        },
      },
    });
  }

  async removeTimeline(id: string, userId: string) {
    await this.timelineFilesRepository.delete({
      timelineId: id as any,
    }); // replace it with cascade AND remove files from disk

    await this.timelineTodosRepository.delete({
      timelineId: id as any,
    });

    await this.timelineRepository.delete({ id, userId });
  }

  async createTimeline(input: CreateTimelineProps & { userId: string }) {
    try {
      const response = await this.timelineRepository.insert({
        ...input,
        beginTime: excludeSeconds(input.beginTime),
        endTime: excludeSeconds(input.endTime),
      });

      return this.timelineRepository.findOne({
        where: {
          id: response.identifiers[0].id,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }

  async completeTimeline(id: string, userId: string) {
    return this.timelineRepository.update({ id, userId }, { isCompleted: true });
  }

  async createTimelineTodos(
    input: {
      timelineId: string;
      title: string;
    }[],
  ) {
    return this.timelineTodosRepository.insert(input);
  }

  async removeTimelineTodo(id: string) {
    return this.timelineTodosRepository.delete({ id });
  }

  async completeTimelineTodo(id: string, isCompleted: boolean) {
    return this.timelineTodosRepository.update({ id }, { isCompleted });
  }

  async findTodoById(id: string) {
    return this.timelineTodosRepository.findOne({
      where: { id },
      relations: ['files'],
    });
  }

  private _generateDates(input: RepeatableTimeline, dayjsType: dayjs.ManipulateType) {
    let dates = [] as string[];

    for (let i = 0; i < input.reapeatCount; i++) {
      dates.push(
        dayjs(input.startDate)
          .add(i * input.repeatEveryNth, dayjsType)
          .format('YYYY-MM-DD'),
      );
    }
    return dates;
  }

  async createRepeatableTimeline(
    input: CreateTimelineProps & { userId: string },

    repeat?: RepeatableTimeline,
  ) {
    let dates = [] as string[];

    if (typeof repeat.repeatOn === 'undefined' || repeat.repeatOn === null) {
      return this.createTimeline(input);
    }

    if (repeat.repeatOn === 'daily') {
      dates = this._generateDates(repeat, 'days');
    } else if (repeat.repeatOn === 'weekly') {
      dates = this._generateDates(repeat, 'weeks');
    }

    const joinDates = dates.join(';');

    const insert = await this.timelineRepository.insert({
      ...input,
      beginTime: excludeSeconds(input.beginTime),
      endTime: excludeSeconds(input.endTime),
      date: joinDates,
      isRepeat: true,
    });

    return this.timelineRepository.findOne({
      where: {
        id: insert.identifiers[0].id,
      },
    });
  }

  async editTimeline(input: Partial<CreateTimelineInput>, timelineId: string) {
    await this.timelineRepository.update(
      {
        id: timelineId,
      },
      {
        ...input,
        ...(input.beginTime && { beginTime: excludeSeconds(input.beginTime) }),
        ...(input.endTime && { endTime: excludeSeconds(input.endTime) }),
      },
    );

    return this.timelineRepository.findOne({
      where: { id: timelineId },
      relations: ['images', 'todos', 'todos.files'],
      order: {
        todos: {
          isCompleted: 'ASC',
          modifiedAt: 'DESC',
        },
      },
    });
  }

  async addTodoFile(todoId: string, type: string, url: string) {
    return this.todoFilesRepository.save({
      todoId,
      type,
      url,
    });
  }

  async removeTodoFile(fileId: string) {
    return this.todoFilesRepository.delete({ id: fileId });
  }

  async getTodoFileById(fileId: string) {
    return this.todoFilesRepository.findOne({ where: { id: fileId } });
  }

  async getTodo(id: string) {
    return this.timelineTodosRepository.findOne({ where: { id }, relations: ['files'] });
  }
  async transferTodos(sourceTimelineId: string, targetTimelineId: string) {
    const sourceTodos = await this.timelineTodosRepository
      .createQueryBuilder('todo')
      .where('todo.timelineId = :sourceId', { sourceId: sourceTimelineId })
      .getMany();

    if (sourceTodos.length === 0) {
      return { affected: 0 };
    }

    const todosToTransfer = sourceTodos.map((todo) => ({
      timelineId: targetTimelineId,
      title: todo.title,
      isCompleted: false,
    }));

    const r = await this.timelineTodosRepository.insert(todosToTransfer);

    return !!r.identifiers.length;
  }

  async copyTimeline(timelineId: string, userId: string, newDate?: string) {
    // Find the original timeline with all relations
    const originalTimeline = await this.timelineRepository.findOne({
      where: { id: timelineId, userId },
      relations: ['images', 'todos', 'todos.files'],
    });

    if (!originalTimeline) {
      throw new Error('Timeline not found');
    }

    // Create new timeline with copied properties
    const timelineData = {
      title: originalTimeline.title,
      description: originalTimeline.description,
      beginTime: originalTimeline.beginTime,
      endTime: originalTimeline.endTime,
      date: newDate || originalTimeline.date,
      tags: originalTimeline.tags,
      userId: userId,
      isAllDay: originalTimeline.isAllDay,
      notification: originalTimeline.notification,
      isPublic: originalTimeline.isPublic,
      isRepeat: false, // Reset repeat for copied timeline
      isCompleted: false, // Reset completion status
    };

    // Insert new timeline
    const insertResult = await this.timelineRepository.insert(timelineData);
    const newTimelineId = insertResult.identifiers[0].id;

    // Copy timeline files
    if (originalTimeline.images && originalTimeline.images.length > 0) {
      const filesToCopy = originalTimeline.images.map((file) => ({
        timelineId: newTimelineId,
        name: file.name,
        type: file.type,
        url: file.url,
        isPublic: file.isPublic,
      }));

      await this.timelineFilesRepository.insert(filesToCopy);
    }

    // Copy todos and their files
    if (originalTimeline.todos && originalTimeline.todos.length > 0) {
      for (const originalTodo of originalTimeline.todos) {
        // Insert todo
        const todoResult = await this.timelineTodosRepository.insert({
          timelineId: newTimelineId,
          title: originalTodo.title,
          isCompleted: false, // Reset completion status
        });

        const newTodoId = todoResult.identifiers[0].id;

        // Copy todo files if they exist
        if (originalTodo.files && originalTodo.files.length > 0) {
          const todoFilesToCopy = originalTodo.files.map((file) => ({
            todoId: newTodoId,
            type: file.type,
            url: file.url,
          }));

          await this.todoFilesRepository.insert(todoFilesToCopy);
        }
      }
    }

    // Return the new timeline with all relations
    return this.timelineRepository.findOne({
      where: { id: newTimelineId },
      relations: ['images', 'todos', 'todos.files'],
      order: {
        todos: {
          isCompleted: 'ASC',
          modifiedAt: 'DESC',
        },
      },
    });
  }
}
