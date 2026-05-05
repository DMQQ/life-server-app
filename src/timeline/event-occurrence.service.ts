import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventOccurrenceEntity } from './entities/event-occurrence.entity';
import { EventSeriesEntity } from './entities/event-series.entity';
import { OccurrenceTodoEntity, TodoFilesEntity } from './entities/occurrence-todo.entity';
import { OccurrenceFileEntity } from './entities/occurrence-file.entity';
import { EventSeriesService } from './event-series.service';
import { ObservableRepository } from 'src/utils/emitter/observable-repository';
import {
  OccurrenceView,
  OccurrenceTodoView,
  OccurrenceFileView,
  EditOccurrenceInput,
  CreateEventInput,
  RepeatInput,
} from './timeline.schemas';
import {
  expandSeriesDates,
  seriesHasOccurrenceOnDate,
  SeriesRecurrenceConfig,
} from './recurrence-engine';

function excludeSeconds(time: string): string {
  return [...time.split(':').slice(0, 2), '00'].join(':');
}

/** Normalize a Date object or string to YYYY-MM-DD string */
function toDateString(v: string | Date | null): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  // Date object from raw MySQL query
  const d = v as Date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildView(
  occurrence: Pick<
    EventOccurrenceEntity,
    'id' | 'seriesId' | 'date' | 'position' | 'isCompleted' | 'isSkipped'
    | 'titleOverride' | 'descriptionOverride' | 'beginTimeOverride' | 'endTimeOverride'
    | 'isException' | 'todos' | 'images'
  > & { series?: Pick<EventSeriesEntity, 'title' | 'description' | 'beginTime' | 'endTime' | 'isAllDay' | 'isRepeat' | 'tags' | 'priority' | 'reminderBeforeMinutes'> },
): OccurrenceView {
  const series = occurrence.series;
  return {
    id: occurrence.id,
    seriesId: occurrence.seriesId,
    date: occurrence.date,
    position: occurrence.position,
    title: occurrence.titleOverride ?? series?.title ?? '',
    description: occurrence.descriptionOverride ?? series?.description ?? '',
    beginTime: occurrence.beginTimeOverride ?? series?.beginTime ?? null,
    endTime: occurrence.endTimeOverride ?? series?.endTime ?? null,
    isCompleted: occurrence.isCompleted,
    isSkipped: occurrence.isSkipped,
    isAllDay: series?.isAllDay ?? false,
    isRepeat: series?.isRepeat ?? false,
    tags: series?.tags ?? '',
    priority: series?.priority ?? 0,
    reminderBeforeMinutes: series?.reminderBeforeMinutes ?? null,
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

/** Synthetic ID for virtual occurrences: seriesId_date */
function syntheticId(seriesId: string, date: string): string {
  return `${seriesId}_${date}`;
}

function isSyntheticId(id: string): boolean {
  // Real UUIDs have 36 chars (with dashes). Synthetic IDs are longer.
  return id.length > 36 && id.includes('_');
}

function parseSyntheticId(id: string): { seriesId: string; date: string } | null {
  const parts = id.split('_');
  if (parts.length < 2) return null;
  return { seriesId: parts[0], date: parts.slice(1).join('_') };
}

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

  async findByDate(opts: {
    userId: string;
    date?: string;
    endDate?: string;
    query?: string;
    pagination?: { skip: number; take: number };
  }): Promise<OccurrenceView[]> {
    const { date } = opts;
    const rangeEnd = opts.endDate || date;

    // Without a specific date, return only real rows (can't materialize infinite recurrence)
    if (!date) {
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
      return results.map((occ) => buildView(occ));
    }

    // ── Date or date range: expand recurring series + real rows ────────────

    const views: OccurrenceView[] = [];

    // 1. Find ALL series for this user
    const allSeries = await this.seriesRepo.find({
      where: { userId: opts.userId },
      relations: [],
    });

    // 2. Get all real occurrence rows in the date range (including exception rows)
    const realOccurrences = await this.occurrenceRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.todos', 'todos')
      .leftJoinAndSelect('todos.files', 'todoFiles')
      .leftJoinAndSelect('o.images', 'images')
      .where('o.seriesId IN (:...seriesIds)', { seriesIds: allSeries.map((s) => s.id) })
      .andWhere('(o.date >= :date AND o.date <= :rangeEnd)', { date, rangeEnd })
      .orderBy('o.date', 'ASC')
      .addOrderBy('todos.isCompleted', 'ASC')
      .addOrderBy('todos.modifiedAt', 'DESC')
      .addOrderBy('images.createdAt', 'DESC')
      .getMany();

    // Index real rows by seriesId + date for quick lookup
    const realOccMap = new Map<string, EventOccurrenceEntity>();
    for (const occ of realOccurrences) {
      const key = `${occ.seriesId}_${toDateString(occ.date)}`;
      realOccMap.set(key, occ);
    }

    // Load anchor todos for recurring series (so virtual occurrences inherit them)
    const recurringSeriesIds = allSeries.filter((s) => s.isRepeat).map((s) => s.id);
    const anchorTodosMap = new Map<string, OccurrenceTodoEntity[]>();
    if (recurringSeriesIds.length > 0) {
      const anchorOccs = await this.occurrenceRepo
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.todos', 'todos')
        .leftJoinAndSelect('todos.files', 'todoFiles')
        .where('o.seriesId IN (:...ids)', { ids: recurringSeriesIds })
        .andWhere('o.position = 0')
        .orderBy('todos.isCompleted', 'ASC')
        .addOrderBy('todos.modifiedAt', 'DESC')
        .getMany();
      for (const occ of anchorOccs) {
        anchorTodosMap.set(occ.seriesId, occ.todos || []);
      }
    }

    // 3. Build views per series
    for (const series of allSeries) {
      if (!series.isRepeat) {
        // Non-recurring: use real rows
        for (const occ of realOccurrences) {
          if (occ.seriesId === series.id) {
            views.push(buildView({ ...occ, series }));
          }
        }
        continue;
      }

      // Recurring: expand across the date range
      const anchorDate = await this.seriesService.getAnchorDate(series.id);
      if (!anchorDate) continue;

      const config: SeriesRecurrenceConfig = {
        repeatType: series.repeatType || (series.repeatFrequency || 'daily').toUpperCase(),
        repeatInterval: series.repeatInterval || series.repeatEveryNth || 1,
        repeatDaysOfWeek: series.repeatDaysOfWeek || null,
        repeatUntil: series.repeatUntil || null,
      };

      const generatedDates = expandSeriesDates(config, anchorDate, date, rangeEnd);

      for (const gen of generatedDates) {
        const key = `${series.id}_${gen.date}`;
        const realOcc = realOccMap.get(key);

        if (realOcc) {
          if (!realOcc.isSkipped) {
            views.push(buildView({ ...realOcc, series }));
          }
        } else {
          views.push(
            buildView({
              id: syntheticId(series.id, gen.date),
              seriesId: series.id,
              date: gen.date,
              position: gen.position,
              isCompleted: false,
              isSkipped: false,
              isException: false,
              titleOverride: null,
              descriptionOverride: null,
              beginTimeOverride: null,
              endTimeOverride: null,
              todos: anchorTodosMap.get(series.id) || [],
              images: [],
              series,
            }),
          );
        }
      }
    }

    // 4. Apply query filter
    let filtered = views;
    if (opts.query) {
      const q = opts.query.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q),
      );
    }

    // 5. Sort by date ASC, then beginTime ASC
    filtered.sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.beginTime || '').localeCompare(b.beginTime || '');
    });

    // 6. Paginate
    if (opts.pagination) {
      filtered = filtered.slice(
        opts.pagination.skip,
        opts.pagination.skip + opts.pagination.take,
      );
    }

    return filtered;
  }

  async findMonthOccurrences(userId: string, date: string): Promise<{ date: string }[]> {
    const [year, month] = date.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');

    // Real rows (non-recurring + exceptions)
    const realRows = await this.occurrenceRepo
      .createQueryBuilder('o')
      .innerJoin('o.series', 's')
      .select('o.date', 'date')
      .where('s.userId = :userId', { userId })
      .andWhere('o.date >= :startDate', { startDate })
      .andWhere('o.date <= :endDate', { endDate })
      .andWhere('o.isSkipped = false')
      .getRawMany();

    const dateSet = new Set<string>(
      realRows.map((r) => toDateString(r.date)).filter(Boolean),
    );

    // Recurring series — expand across the month
    const recurringSeries = await this.seriesRepo.find({
      where: { userId, isRepeat: true },
      relations: [],
    });

    for (const series of recurringSeries) {
      const anchorDate = await this.seriesService.getAnchorDate(series.id);
      if (!anchorDate) continue;

      const config: SeriesRecurrenceConfig = {
        repeatType: series.repeatType || (series.repeatFrequency || 'daily').toUpperCase(),
        repeatInterval: series.repeatInterval || series.repeatEveryNth || 1,
        repeatDaysOfWeek: series.repeatDaysOfWeek || null,
        repeatUntil: series.repeatUntil || null,
      };

      // Skip if repeatUntil is before the month start
      if (series.repeatUntil && series.repeatUntil < startDate) continue;

      const dates = expandSeriesDates(config, anchorDate, startDate, endDate);

      // Check for skipped exception rows for these dates
      const skippedDates = new Set<string>();
      if (dates.length > 0) {
        const exceptions = await this.occurrenceRepo.find({
          where: {
            seriesId: series.id,
            date: In(dates.map((d) => d.date)),
            isSkipped: true,
          },
        });
        for (const exc of exceptions) {
          if (exc.date) skippedDates.add(toDateString(exc.date));
        }
      }

      for (const d of dates) {
        if (!skippedDates.has(d.date)) {
          dateSet.add(d.date);
        }
      }
    }

    return Array.from(dateSet)
      .map((d) => ({ date: d }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async findById(id: string, userId: string): Promise<OccurrenceView> {
    // Handle synthetic IDs (virtual occurrences)
    if (isSyntheticId(id)) {
      const parsed = parseSyntheticId(id);
      if (!parsed) throw new NotFoundException(`Occurrence ${id} not found`);

      const series = await this.seriesRepo.findOne({
        where: { id: parsed.seriesId, userId },
        relations: [],
      });
      if (!series) throw new NotFoundException(`Series ${parsed.seriesId} not found`);

      // Check if a real row exists (was created as exception)
      const realOcc = await this.occurrenceRepo
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.todos', 'todos')
        .leftJoinAndSelect('todos.files', 'todoFiles')
        .leftJoinAndSelect('o.images', 'images')
        .where('o.seriesId = :seriesId', { seriesId: parsed.seriesId })
        .andWhere('o.date = :date', { date: parsed.date })
        .getOne();

      if (realOcc) {
        const occWithSeries = { ...realOcc, series };
        return buildView(occWithSeries);
      }

      // Virtual occurrence
      const anchorDate = await this.seriesService.getAnchorDate(series.id);
      const config: SeriesRecurrenceConfig = {
        repeatType: series.repeatType || (series.repeatFrequency || 'daily').toUpperCase(),
        repeatInterval: series.repeatInterval || series.repeatEveryNth || 1,
        repeatDaysOfWeek: series.repeatDaysOfWeek || null,
        repeatUntil: series.repeatUntil || null,
      };

      const positions = anchorDate
        ? expandSeriesDates(config, anchorDate, parsed.date, parsed.date)
        : [];
      const pos = positions.length > 0 ? positions[0].position : 0;

      // Load anchor todos to show on virtual occurrences
      const anchorOcc = await this.occurrenceRepo
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.todos', 'todos')
        .leftJoinAndSelect('todos.files', 'todoFiles')
        .where('o.seriesId = :seriesId', { seriesId: series.id })
        .andWhere('o.position = 0')
        .orderBy('todos.isCompleted', 'ASC')
        .addOrderBy('todos.modifiedAt', 'DESC')
        .getOne();

      const virtualOcc = {
        id: syntheticId(series.id, parsed.date),
        seriesId: series.id,
        date: parsed.date,
        position: pos,
        isCompleted: false,
        isSkipped: false,
        isException: false,
        titleOverride: null,
        descriptionOverride: null,
        beginTimeOverride: null,
        endTimeOverride: null,
        todos: anchorOcc?.todos || [],
        images: [],
        series,
      };
      return buildView(virtualOcc);
    }

    // Real ID — existing lookup
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
    return buildView(occ);
  }

  async findByCurrentDate(userId: string): Promise<OccurrenceView[]> {
    const currentDate = dayjs().format('YYYY-MM-DD');
    return this.findByDate({ userId, date: currentDate });
  }

  async editOccurrence(
    id: string,
    userId: string,
    input: EditOccurrenceInput,
    scope: 'THIS_ONLY' | 'ALL',
  ): Promise<OccurrenceView> {
    // Resolve synthetic ID to real row if needed
    let realId = id;
    if (isSyntheticId(id)) {
      const parsed = parseSyntheticId(id);
      if (!parsed) throw new NotFoundException(`Invalid occurrence id ${id}`);
      const occ = await this._ensureOccurrenceRow(parsed.seriesId, parsed.date, 0);
      realId = occ.id;
    }

    const occ = await this.occurrenceRepo
      .createQueryBuilder('o')
      .innerJoinAndSelect('o.series', 's')
      .where('o.id = :id', { id: realId })
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
      overrides.isException = true;
      await this.occurrenceRepo.update({ id: realId }, overrides);
    } else {
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

    return this._loadView(realId);
  }

  async completeOccurrence(id: string, isCompleted: boolean): Promise<OccurrenceView> {
    let realId = id;

    // Virtual occurrence — create a real row first
    if (isSyntheticId(id)) {
      const parsed = parseSyntheticId(id);
      if (!parsed) throw new NotFoundException(`Invalid occurrence id ${id}`);
      const occ = await this._ensureOccurrenceRow(parsed.seriesId, parsed.date, 0);
      realId = occ.id;
    }

    await this.occurrenceRepo.update({ id: realId }, { isCompleted });
    return this._loadView(realId);
  }

  async deleteOccurrence(id: string, userId: string, scope: 'THIS_ONLY' | 'ALL'): Promise<boolean> {
    let realId = id;
    let date: string | null = null;

    // Resolve synthetic ID
    if (isSyntheticId(id)) {
      const parsed = parseSyntheticId(id);
      if (!parsed) throw new NotFoundException(`Invalid occurrence id ${id}`);
      date = parsed.date;

      // Check if a real row already exists
      const existing = await this.occurrenceRepo.findOne({
        where: { seriesId: parsed.seriesId, date: parsed.date },
      });

      if (existing) {
        realId = existing.id;
      } else if (scope === 'THIS_ONLY') {
        // Create an exception row marked as skipped (don't store the occurrence, just skip it)
        const newOcc = await this._ensureOccurrenceRow(parsed.seriesId, parsed.date, 0);
        await this.occurrenceRepo.update({ id: newOcc.id }, { isSkipped: true, isException: true });
        return true;
      } else {
        // ALL scope but no real row — delete the series directly
        const occ = await this.occurrenceRepo.findOne({
          where: { seriesId: parsed.seriesId },
          relations: ['series'],
        });
        if (occ) {
          await this.seriesService.deleteSeries(occ.seriesId);
          return true;
        }
        throw new NotFoundException(`Series ${parsed.seriesId} not found`);
      }
    }

    const occ = await this.occurrenceRepo
      .createQueryBuilder('o')
      .innerJoin('o.series', 's')
      .where('o.id = :id', { id: realId })
      .andWhere('s.userId = :userId', { userId })
      .getOne();

    if (!occ) throw new NotFoundException(`Occurrence ${id} not found`);

    if (scope === 'ALL') {
      await this.seriesService.deleteSeries(occ.seriesId);
    } else {
      await this.occurrenceRepo.delete({ id: realId });
    }

    return true;
  }

  // ─── Copy ───────────────────────────────────────────────────────────────────

  async copyOccurrence(occurrenceId: string, userId: string, newDate?: string): Promise<OccurrenceView> {
    // Handle synthetic ID
    let realId = occurrenceId;
    if (isSyntheticId(occurrenceId)) {
      const parsed = parseSyntheticId(occurrenceId);
      if (parsed) {
        const occ = await this._ensureOccurrenceRow(parsed.seriesId, parsed.date, 0);
        realId = occ.id;
      }
    }

    const source = await this.occurrenceRepo
      .createQueryBuilder('o')
      .innerJoinAndSelect('o.series', 's')
      .leftJoinAndSelect('o.todos', 'todos')
      .leftJoinAndSelect('todos.files', 'todoFiles')
      .leftJoinAndSelect('o.images', 'images')
      .where('o.id = :id', { id: realId })
      .andWhere('s.userId = :userId', { userId })
      .getOne();

    if (!source) throw new NotFoundException(`Occurrence ${occurrenceId} not found`);

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
      isException: false,
    });

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

  async createTodo(occurrenceId: string, title: string): Promise<OccurrenceTodoEntity> {
    let realId = occurrenceId;
    if (isSyntheticId(occurrenceId)) {
      const parsed = parseSyntheticId(occurrenceId);
      if (parsed) {
        const occ = await this._ensureOccurrenceRow(parsed.seriesId, parsed.date, 0);
        realId = occ.id;
      }
    }

    const todo = await this.todoRepo.save({ occurrenceId: realId, title });
    return this.todoRepo.findOne({ where: { id: todo.id }, relations: ['files'] });
  }

  async completeTodo(id: string, isCompleted: boolean, occurrenceId?: string): Promise<OccurrenceTodoEntity> {
    // If the occurrence is virtual (synthetic ID), materialize it first so we
    // complete an independent copy of the todo rather than the anchor's todo.
    if (occurrenceId && isSyntheticId(occurrenceId)) {
      const parsed = parseSyntheticId(occurrenceId);
      if (parsed) {
        // Materialize the row (copies anchor todos into it)
        const realOcc = await this._ensureOccurrenceRow(parsed.seriesId, parsed.date, 0);
        // Find the corresponding copied todo by title (anchor todo id is no longer valid)
        const anchorTodo = await this.todoRepo.findOne({ where: { id } });
        if (anchorTodo) {
          const copiedTodo = await this.todoRepo.findOne({
            where: { occurrenceId: realOcc.id, title: anchorTodo.title },
          });
          if (copiedTodo) {
            await this.todoRepo.update({ id: copiedTodo.id }, { isCompleted });
            return this.todoRepo.findOne({ where: { id: copiedTodo.id }, relations: ['files'] });
          }
        }
      }
    }

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
    // Resolve synthetic IDs
    let sourceId = sourceOccurrenceId;
    if (isSyntheticId(sourceOccurrenceId)) {
      const parsed = parseSyntheticId(sourceOccurrenceId);
      if (parsed) {
        const occ = await this._ensureOccurrenceRow(parsed.seriesId, parsed.date, 0);
        sourceId = occ.id;
      }
    }
    let targetId = targetOccurrenceId;
    if (isSyntheticId(targetOccurrenceId)) {
      const parsed = parseSyntheticId(targetOccurrenceId);
      if (parsed) {
        const occ = await this._ensureOccurrenceRow(parsed.seriesId, parsed.date, 0);
        targetId = occ.id;
      }
    }

    const sourceTodos = await this.todoRepo
      .createQueryBuilder('t')
      .where('t.occurrenceId = :id', { id: sourceId })
      .getMany();

    if (!sourceTodos.length) return false;

    await this.todoRepo.save(
      sourceTodos.map((t) => ({ occurrenceId: targetId, title: t.title, isCompleted: false })),
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

  /**
   * Ensure a real occurrence row exists for a (seriesId, date) pair.
   * Creates one with isException=false if it doesn't exist.
   * Used when a user interacts with a virtual occurrence (complete, skip, edit, add todo).
   */
  private async _ensureOccurrenceRow(
    seriesId: string,
    date: string,
    position: number,
  ): Promise<EventOccurrenceEntity> {
    let occ = await this.occurrenceRepo.findOne({
      where: { seriesId, date },
    });
    if (!occ) {
      occ = await this.occurrenceRepo.save({
        seriesId,
        date,
        position,
        isException: false,
      });

      // Copy anchor todos so this materialized occurrence is self-contained
      const anchorOcc = await this.occurrenceRepo
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.todos', 'todos')
        .leftJoinAndSelect('todos.files', 'todoFiles')
        .where('o.seriesId = :seriesId', { seriesId })
        .andWhere('o.position = 0')
        .andWhere('o.id != :newId', { newId: occ.id })
        .getOne();

      if (anchorOcc?.todos?.length) {
        for (const t of anchorOcc.todos) {
          const newTodo = await this.todoRepo.save({
            occurrenceId: occ.id,
            title: t.title,
            isCompleted: false,
          });
          if (t.files?.length) {
            await this.todoFileRepo.save(
              t.files.map((f) => ({ todoId: newTodo.id, type: f.type, url: f.url })),
            );
          }
        }
      }
    }
    return occ;
  }

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
    return buildView(occ);
  }
}
