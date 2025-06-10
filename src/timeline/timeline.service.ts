import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import { TimelineEntity, TimelineFilesEntity, TimelineTodosEntity } from 'src/timeline/timeline.entity';
import { Like, Repository } from 'typeorm';
import { CreateTimelineInput, RepeatableTimeline } from './timeline.schemas';

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

  async findEventsWithDateAndTime(date: string, time: string) {
    return this.timelineRepository.find({
      where: { date: Like(`%${date}%`), beginTime: time },
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
      },
      relations: ['images', 'todos'],
    });
  }

  async findOneById(id: string, userId: string) {
    return this.timelineRepository.findOne({
      where: { id, userId },
      relations: ['images', 'todos'],
      order: {
        images: {
          createdAt: 'DESC',
        },
      },
    });
  }

  async findByCurrentDate(userId: string) {
    const currentDate = dayjs().format('YYYY-MM-DD');
    return this.timelineRepository.find({
      where: { date: Like(`%${currentDate}%`), userId },
      relations: ['images', 'todos'],
    });
  }

  async findOneByDate(date: string) {
    return this.timelineRepository.findOne({
      where: { date: Like(`%${date}%`) },
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

  async completeTimelineTodo(id: string) {
    return this.timelineTodosRepository.update({ id }, { isCompleted: true });
  }

  async findTodoById(id: string) {
    return this.timelineTodosRepository.findOne({ where: { id } });
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
      relations: ['images', 'todos'],
    });
  }
}
