import {
  DeepPartial,
  DeleteResult,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  In,
  InsertResult,
  ObjectLiteral,
  Repository,
  UpdateResult,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EntityUpdatePayload } from './entity-emitter';

export class ObservableRepository<T extends ObjectLiteral> {
  constructor(
    readonly repo: Repository<T>,
    private readonly eventEmitter: EventEmitter2,
    private readonly eventPrefix: string,
  ) {}

  get manager() {
    return this.repo.manager;
  }

  get metadata() {
    return this.repo.metadata;
  }

  find(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repo.find(options);
  }

  findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repo.findOne(options);
  }

  findOneOrFail(options: FindOneOptions<T>): Promise<T> {
    return this.repo.findOneOrFail(options);
  }

  findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]> {
    return this.repo.findAndCount(options);
  }

  count(options?: FindManyOptions<T>): Promise<number> {
    return this.repo.count(options);
  }

  createQueryBuilder(alias?: string) {
    return this.repo.createQueryBuilder(alias);
  }

  query(query: string, params?: any[]): Promise<any> {
    return this.repo.query(query, params);
  }

  async save(entities: DeepPartial<T>[]): Promise<T[]>;
  async save(entity: DeepPartial<T>): Promise<T>;
  async save(entityOrEntities: DeepPartial<T> | DeepPartial<T>[]): Promise<T | T[]> {
    if (Array.isArray(entityOrEntities)) {
      return Promise.all(entityOrEntities.map((e) => this._saveSingle(e)));
    }
    return this._saveSingle(entityOrEntities);
  }

  async insert(entity: QueryDeepPartialEntity<T> | QueryDeepPartialEntity<T>[]): Promise<InsertResult> {
    const result = await this.repo.insert(entity);
    for (const identifier of result.identifiers) {
      if (!identifier?.id) continue;
      const inserted = await this.repo.findOne({ where: identifier as FindOptionsWhere<T> }).catch(() => null);
      if (inserted) {
        await this.eventEmitter.emitAsync(`${this.eventPrefix}.created`, inserted);
        await this.eventEmitter.emitAsync(`${this.eventPrefix}.saved`, inserted);
      }
    }
    return result;
  }

  async update(
    criteria: FindOptionsWhere<T> | string | string[],
    partial: QueryDeepPartialEntity<T>,
  ): Promise<UpdateResult> {
    const prevAll = await this._findByCriteria(criteria);
    const result = await this.repo.update(criteria as any, partial);
    for (const previous of prevAll) {
      const updated = await this.repo
        .findOne({ where: { id: (previous as any).id } as FindOptionsWhere<T> })
        .catch(() => null);
      if (!updated) continue;
      const changed = this._diff(partial as Partial<T>, previous);
      const payload: EntityUpdatePayload<T> = { entity: updated, previous, changed };
      await this.eventEmitter.emitAsync(`${this.eventPrefix}.updated`, payload);
      await this.eventEmitter.emitAsync(`${this.eventPrefix}.saved`, updated);
    }
    return result;
  }

  async delete(criteria: FindOptionsWhere<T> | string | string[]): Promise<DeleteResult> {
    const entities = await this._findByCriteria(criteria);
    const result = await this.repo.delete(criteria as any);
    for (const entity of entities) {
      await this.eventEmitter.emitAsync(`${this.eventPrefix}.deleted`, entity);
    }
    return result;
  }

  async remove(entities: T[]): Promise<T[]>;
  async remove(entity: T): Promise<T>;
  async remove(entityOrEntities: T | T[]): Promise<T | T[]> {
    if (Array.isArray(entityOrEntities)) {
      const snapshot = [...entityOrEntities];
      const result = await this.repo.remove(snapshot as any);
      for (const entity of snapshot) {
        await this.eventEmitter.emitAsync(`${this.eventPrefix}.deleted`, entity);
      }
      return result;
    }
    const result = await this.repo.remove(entityOrEntities as any);
    await this.eventEmitter.emitAsync(`${this.eventPrefix}.deleted`, entityOrEntities);
    return result;
  }

  private async _saveSingle(entity: DeepPartial<T>): Promise<T> {
    const id = (entity as any).id;
    const previous = id
      ? await this.repo.findOne({ where: { id } as FindOptionsWhere<T> }).catch(() => null)
      : null;
    const result = await this.repo.save(entity as any);

    if (previous) {
      const changed = this._diff(entity as Partial<T>, previous);
      const payload: EntityUpdatePayload<T> = { entity: result, previous, changed };
      await this.eventEmitter.emitAsync(`${this.eventPrefix}.updated`, payload);
    } else {
      await this.eventEmitter.emitAsync(`${this.eventPrefix}.created`, result);
    }
    await this.eventEmitter.emitAsync(`${this.eventPrefix}.saved`, result);
    return result;
  }

  private async _findByCriteria(criteria: FindOptionsWhere<T> | string | string[]): Promise<T[]> {
    try {
      if (typeof criteria === 'string') {
        return this.repo.find({ where: { id: criteria } as unknown as FindOptionsWhere<T> });
      }
      if (Array.isArray(criteria)) {
        return this.repo.find({ where: { id: In(criteria) } as unknown as FindOptionsWhere<T> });
      }
      return this.repo.find({ where: criteria });
    } catch {
      return [];
    }
  }

  private _diff(incoming: Partial<T>, previous: T): (keyof T)[] {
    return Object.keys(incoming).filter(
      (k) => JSON.stringify(incoming[k as keyof T]) !== JSON.stringify(previous[k as keyof T]),
    ) as (keyof T)[];
  }
}
