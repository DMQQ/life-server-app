import { createParamDecorator, ExecutionContext, NotFoundException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { DataSource } from 'typeorm';
import dataSource from '../../database';

interface ModelDecoratorOptions {
  nullable?: boolean;
  relations?: string[] | 'all'; // Can be array of relations or 'all' to load everything
  paramName?: string;
}

let connectionPromise: Promise<DataSource> | null = null;

async function getDataSource(): Promise<DataSource> {
  if (dataSource.isInitialized) {
    return dataSource;
  }

  if (!connectionPromise) {
    connectionPromise = dataSource.initialize();
  }

  return connectionPromise;
}

/**
 * Get all relation property names from an entity
 */
function getAllRelations(entity: any): string[] {
  const connection = dataSource;
  const metadata = connection.getMetadata(entity);

  return metadata.relations.map((relation) => relation.propertyName);
}

export const Model = (entity: any, field: string = 'id', options?: ModelDecoratorOptions) =>
  createParamDecorator(async (_data: unknown, ctx: ExecutionContext) => {
    const { nullable = true, relations = 'all', paramName } = options || {};

    const gqlContext = GqlExecutionContext.create(ctx);
    const request = gqlContext.getContext().req;
    const args = gqlContext.getArgs();

    const argKey = paramName || field;
    const value = args[argKey] || request.body?.[argKey] || request.params?.[argKey];

    if (!value) {
      if (nullable) {
        return null;
      }
      throw new NotFoundException(`${argKey} parameter is required`);
    }

    const connection = await getDataSource();
    const repository = connection.getRepository(entity);

    const queryBuilder = repository.createQueryBuilder('entity');

    let relationsToLoad: string[] = [];

    if (relations === 'all') {
      relationsToLoad = getAllRelations(entity);
    } else if (Array.isArray(relations)) {
      relationsToLoad = relations;
    }

    relationsToLoad.forEach((relation) => {
      queryBuilder.leftJoinAndSelect(`entity.${relation}`, relation);
    });

    const model = await queryBuilder.where(`entity.${field} = :value`, { value }).getOne();

    if (!model && !nullable) {
      throw new NotFoundException(`${entity.name} with ${field} '${value}' not found`);
    }

    return model;
  })();
