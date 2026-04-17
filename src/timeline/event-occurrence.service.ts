import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventOccurrenceEntity } from './entities/event-occurrence.entity';
import { EventSeriesEntity } from './entities/event-series.entity';
import { OccurrenceTodoEntity, TodoFilesEntity } from './entities/occurrence-todo.entity';
import { OccurrenceFileEntity } from './entities/occurrence-file.entity';
import { EventSeriesService } from './event-series.service';
import { ObservableRepository } from 'src/emitter/observable-repository';
import {
  OccurrenceView,
  OccurrenceTodoView,
  OccurrenceFileView,
  EditOccurrenceInput,
  CreateEventInput,
  RepeatInput,
} from './timeline.schemas';

function excludeSeconds(time: string): string {
  return [...time.split(':').slice(0, 2), '00'].join(':');
}

function buildView(occurrence: EventOccurrenceEntity, series: EventSeriesEntity): OccurrenceView {
  return {
    id: occurrence.id,
    seriesId: occurrence.seriesId,
    date: occurrence.date,
    position: occurrence.position,
    title: occurrence.titleOverride ?? series.title,
    description: occurrence.descriptionOverride ?? series.description,
    beginTime: occurrence.beginTimeOverride ?? series.beginTime,
    endTime: occurrence.endTimeOverride ?? series.endTime,
    isCompleted: occurrence.isCompleted,
    isSkipped: occurrence.isSkipped,
    isAllDay: series.isAllDay,
    isRepeat: series.isRepeat,
    tags: series.tags,
    priority: series.priority,
    todos: (occurrence.todos || []).map((t) => ({
      id: t.id,
      title: t.title,
      isCompleted: t.isCompleted,
      files: t.files || [],
      createdAt: t.createdAt,
      modifiedAt: t.modifiedAt,
    })) as OccurrenceTodoView[],
    images: (occurrence.images || []).map((img) => ({
      id: img.id,
      url: img.url,
      type: img.type,
      name: img.name,
      isPublic: img.isPublic,
    })) as OccurrenceFileView[],
  };
}

const OCCURRENCE_RELATIONS = ['series', 'todos', 'todos.files', 'images'];
const OCCURRENCE_ORDER = {
  todos: { isCompleted: 'ASC' as const, modifiedAt: 'DESC' as const },
  images: { createdAt: 'DESC' as const },
};

@Injectable()
export class EventOccurrenceService {
  private occurrenceRepo: ObservableRepository<EventOccurrenceEntity>;
  private todoRepo: ObservableRepository<OccurrenceTodoEntity>;

  constructor(
    @InjectRepository(EventOccurrenceEntity)
    _occurrenceRepo: Repository<EventOccurrenceEntity>,

    @InjectRepository(EventSeriesEntity)
    private seriesRepo: Repository<EventSeriesEntity>,

    @InjectRepository(OccurrenceTodoEntity)
    _todoRepo: Repository<OccurrenceTodoEntity>,

    @InjectRepository(TodoFilesEntity)
    private todoFileRepo: Repository<TodoFilesEntity>,

    @InjectRepository(OccurrenceFileEntity)
    private fileRepo: Repository<OccurrenceFileEntity>,

    private seriesService: EventSeriesService,

    private eventEmitter: EventEmitter2,
  ) {
    this.occurrenceRepo = new ObservableRepository(_occurrenceRepo, eventEmitter, 'occurrence');
    this.todoRepo = new ObservableRepository(_todoRepo, eventEmitter, 'occurrence-todo');
  }

  // ─── Create ─────────────────────────────────────────────────────────────────

  async createEvent(input: CreateEventInput & { userId: string }, repeat?: RepeatInput): Promise<OccurrenceView> {
    const { series, occurrences } = await this.seriesService.createSeries(input, repeat);

    if (input.todos?.length > 0) {
      await this.todoRepo.save(
        occurrences.flatMap((occ) =>
          input.todos.map((title) => ({
            occurrenceId: occ.id,
            title,
          })),
        ),
      );
    }

    return this._loadView(occurrences[0].id);
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  async findByDate(opts: {
    userId: string;
    date?: string;
    query?: string;
    pagination?: { skip: number; take: number };
  }): Promise<OccurrenceView[]> {
    const qb = this.occurrenceRepo
      .createQueryBuilder('o')
      .innerJoinAndSelect('o.series', 's')
      .leftJoinAndSelect('o.todos', 'todos')
      .leftJoinAndSelect('todos.files', 'todoFiles')
      .leftJoinAndSelect('o.images', 'images')
      .where('s.userId = :userId', { userId: opts.userId })
      .orderBy('COALESCE(o.beginTimeOverride, s.beginTime)', 'DESC')
      .addOrderBy('todos.isCompleted', 'ASC')
      .addOrderBy('todos.modifiedAt', 'DESC');

    if (opts.date) {
      qb.andWhere('(o.date = :date OR o.date IS NULL)', { date: opts.date });
    }

    if (opts.query) {
      qb.andWhere(
        '(COALESCE(o.titleOverride, s.title) LIKE :q OR COALESCE(o.descriptionOverride, s.description) LIKE :q)',
        { q: `%${opts.query}%` },
      );
    }

    if (opts.pagination) {
      qb.skip(opts.pagination.skip).take(opts.pagination.take);
    }

    const results = await qb.getMany();
    return results.map((occ) => buildView(occ, occ.series));
  }

  async findMonthOccurrences(userId: string, date: string): Promise<{ date: string }[]> {
    const [year, month] = date.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');

    const results = await this.occurrenceRepo
      .createQueryBuilder('o')
      .innerJoin('o.series', 's')
      .select('o.date', 'date')
      .where('s.userId = :userId', { userId })
      .andWhere('o.date >= :startDate', { startDate })
      .andWhere('o.date <= :endDate', { endDate })
      .andWhere('o.isSkipped = false')
      .getRawMany();

    return results;
  }

  async findById(id: string, userId: string): Promise<OccurrenceView> {
    const occ = await this.occurrenceRepo
      .createQueryBuilder('o')
      .innerJoinAndSelect('o.series', 's')
      .leftJoinAndSelect('o.todos', 'todos')
      .leftJoinAndSelect('todos.files', 'todoFiles')
      .leftJoinAndSelect('o.images', 'images')
      .where('o.id = :id', { id })
      .andWhere('s.userId = :userId', { userId })
      .orderBy('todos.isCompleted', 'ASC')
      .addOrderBy('todos.modifiedAt', 'DESC')
      .addOrderBy('images.createdAt', 'DESC')
      .getOne();

    if (!occ) throw new NotFoundException(`Occurrence ${id} not found`);
    return buildView(occ, occ.series);
  }

  async findByCurrentDate(userId: string): Promise<OccurrenceView[]> {
    const currentDate = dayjs().format('YYYY-MM-DD');
    return this.findByDate({ userId, date: currentDate });
  }

  // ─── Edit ───────────────────────────────────────────────────────────────────

  async editOccurrence(
    id: string,
    userId: string,
    input: EditOccurrenceInput,
    scope: 'THIS_ONLY' | 'ALL',
  ): Promise<OccurrenceView> {
    const occ = await this.occurrenceRepo
      .createQueryBuilder('o')
      .innerJoinAndSelect('o.series', 's')
      .where('o.id = :id', { id })
      .andWhere('s.userId = :userId', { userId })
      .getOne();

    if (!occ) throw new NotFoundException(`Occurrence ${id} not found`);

    if (scope === 'THIS_ONLY') {
      const overrides: Partial<EventOccurrenceEntity> = {};
      if (input.title !== undefined) overrides.titleOverride = input.title;
      if (input.description !== undefined) overrides.descriptionOverride = input.description;
      if (input.beginTime !== undefined) overrides.beginTimeOverride = excludeSeconds(input.beginTime);
      if (input.endTime !== undefined) overrides.endTimeOverride = excludeSeconds(input.endTime);
      if (input.date !== undefined) overrides.date = input.date;
      await this.occurrenceRepo.update({ id }, overrides);
    } else {
      // ALL: update series, clear all overrides
      await this.seriesService.updateSeriesFields(occ.seriesId, {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.beginTime !== undefined && { beginTime: input.beginTime }),
        ...(input.endTime !== undefined && { endTime: input.endTime }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.priority !== undefined && { priority: input.priority }),
      });
      await this.seriesService.clearAllOverrides(occ.seriesId);
    }

    return this._loadView(id);
  }

  // ─── Complete / Skip ────────────────────────────────────────────────────────

  async completeOccurrence(id: string, isCompleted: boolean): Promise<OccurrenceView> {
    await this.occurrenceRepo.update({ id }, { isCompleted });
    return this._loadView(id);
  }

  async skipOccurrence(id: string): Promise<OccurrenceView> {
    await this.occurrenceRepo.update({ id }, { isSkipped: true });
    return this._loadView(id);
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  async deleteOccurrence(id: string, userId: string, scope: 'THIS_ONLY' | 'ALL'): Promise<boolean> {
    const occ = await this.occurrenceRepo
      .createQueryBuilder('o')
      .innerJoin('o.series', 's')
      .where('o.id = :id', { id })
      .andWhere('s.userId = :userId', { userId })
      .getOne();

    if (!occ) throw new NotFoundException(`Occurrence ${id} not found`);

    if (scope === 'ALL') {
      await this.seriesService.deleteSeries(occ.seriesId);
    } else {
      await this.occurrenceRepo.delete({ id });
    }

    return true;
  }

  // ─── Copy ───────────────────────────────────────────────────────────────────

  async copyOccurrence(occurrenceId: string, userId: string, newDate?: string): Promise<OccurrenceView> {
    const source = await this.occurrenceRepo
      .createQueryBuilder('o')
      .innerJoinAndSelect('o.series', 's')
      .leftJoinAndSelect('o.todos', 'todos')
      .leftJoinAndSelect('todos.files', 'todoFiles')
      .leftJoinAndSelect('o.images', 'images')
      .where('o.id = :id', { id: occurrenceId })
      .andWhere('s.userId = :userId', { userId })
      .getOne();

    if (!source) throw new NotFoundException(`Occurrence ${occurrenceId} not found`);

    // Create a new non-repeating series
    const newSeries = await this.seriesRepo.save({
      title: source.titleOverride ?? source.series.title,
      description: source.descriptionOverride ?? source.series.description,
      beginTime: source.beginTimeOverride ?? source.series.beginTime,
      endTime: source.endTimeOverride ?? source.series.endTime,
      tags: source.series.tags,
      userId,
      isAllDay: source.series.isAllDay,
      isRepeat: false,
    });

    const newOcc = await this.occurrenceRepo.save({
      seriesId: newSeries.id,
      date: newDate || source.date,
      position: 0,
    });

    // Copy images
    if (source.images?.length > 0) {
      await this.fileRepo.save(
        source.images.map((img) => ({
          occurrenceId: newOcc.id,
          name: img.name,
          type: img.type,
          url: img.url,
          isPublic: img.isPublic,
        })),
      );
    }

    // Copy todos and their files
    for (const todo of source.todos || []) {
      const newTodo = await this.todoRepo.save({
        occurrenceId: newOcc.id,
        title: todo.title,
        isCompleted: false,
      });

      if (todo.files?.length > 0) {
        await this.todoFileRepo.save(
          todo.files.map((f) => ({
            todoId: newTodo.id,
            type: f.type,
            url: f.url,
          })),
        );
      }
    }

    return this._loadView(newOcc.id);
  }

  // ─── Todos ──────────────────────────────────────────────────────────────────

  async createTodo(occurrenceId: string, title: string): Promise<OccurrenceTodoEntity> {
    const todo = await this.todoRepo.save({ occurrenceId, title });
    return this.todoRepo.findOne({ where: { id: todo.id }, relations: ['files'] });
  }

  async completeTodo(id: string, isCompleted: boolean): Promise<OccurrenceTodoEntity> {
    await this.todoRepo.update({ id }, { isCompleted });
    return this.todoRepo.findOne({ where: { id }, relations: ['files'] });
  }

  async removeTodo(id: string): Promise<boolean> {
    const todo = await this.todoRepo.findOne({ where: { id } });
    if (todo) await this.todoRepo.remove(todo);
    return true;
  }

  async getTodo(id: string): Promise<OccurrenceTodoEntity> {
    return this.todoRepo.findOne({ where: { id }, relations: ['files'] });
  }

  async transferTodos(sourceOccurrenceId: string, targetOccurrenceId: string): Promise<boolean> {
    const sourceTodos = await this.todoRepo
      .createQueryBuilder('t')
      .where('t.occurrenceId = :id', { id: sourceOccurrenceId })
      .getMany();

    if (!sourceTodos.length) return false;

    await this.todoRepo.save(
      sourceTodos.map((t) => ({ occurrenceId: targetOccurrenceId, title: t.title, isCompleted: false })),
    );

    return true;
  }

  // ─── Files ──────────────────────────────────────────────────────────────────

  async addTodoFile(todoId: string, type: string, url: string): Promise<TodoFilesEntity> {
    return this.todoFileRepo.save({ todoId, type, url });
  }

  async removeTodoFile(fileId: string): Promise<boolean> {
    await this.todoFileRepo.delete({ id: fileId });
    return true;
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private async _loadView(id: string): Promise<OccurrenceView> {
    const occ = await this.occurrenceRepo
      .createQueryBuilder('o')
      .innerJoinAndSelect('o.series', 's')
      .leftJoinAndSelect('o.todos', 'todos')
      .leftJoinAndSelect('todos.files', 'todoFiles')
      .leftJoinAndSelect('o.images', 'images')
      .where('o.id = :id', { id })
      .orderBy('todos.isCompleted', 'ASC')
      .addOrderBy('todos.modifiedAt', 'DESC')
      .addOrderBy('images.createdAt', 'DESC')
      .getOne();

    if (!occ) throw new NotFoundException(`Occurrence ${id} not found`);
    return buildView(occ, occ.series);
  }
}
