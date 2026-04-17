import { DataSource, SelectQueryBuilder } from 'typeorm';
import { OpenAIService } from 'src/utils/services/OpenAI/openai.service';
import { z } from 'zod';
export { ZodError } from 'zod';
import { tool } from '@openai/agents';

export interface ToolContext {
  walletId?: string;
  userId: string;
  dataSource: DataSource;
  openAIService: OpenAIService;

  toolDataCache?: Record<string, any>;
}

type WhereValue =
  | string
  | number
  | boolean
  | {
      eq?: any;
      ne?: any;
      gt?: number | string;
      gte?: number | string;
      lt?: number | string;
      lte?: number | string;
      like?: string;
      in?: any[];
      between?: [any, any];
    };

export interface UniversalQueryParams {
  where?: Record<string, WhereValue>;
  select?: string[];
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  groupBy?: string | string[];
  aggregate?: Array<{ fn: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX'; field: string; alias?: string }>;
  having?: Record<string, WhereValue>;
  limit?: number;
  offset?: number;
}

export const baseParamsSchema = z.object({
  where: z.record(z.string(), z.any()).nullish(),
  select: z.array(z.string()).nullish(),
  orderBy: z.object({ field: z.string(), direction: z.enum(['asc', 'desc']) }).nullish(),
  groupBy: z.union([z.string(), z.array(z.string())]).nullish(),
  aggregate: z
    .array(
      z.object({
        fn: z.enum(['SUM', 'COUNT', 'AVG', 'MIN', 'MAX']),
        field: z.string(),
        alias: z.string().nullish(),
      }),
    )
    .nullish(),
  having: z.record(z.string(), z.any()).nullish(),
  limit: z.number().max(100).nullish(),
  offset: z.number().nullish(),
});

export abstract class AiTool {
  abstract readonly name: string;
  abstract readonly description: string;
  readonly fields: Record<string, string> = {};

  abstract run(params: any, ctx: ToolContext): Promise<any>;

  normalize(data: any): any {
    return data;
  }

  get zodSchema(): z.ZodObject<any, any> {
    return baseParamsSchema;
  }

  validateParams(params: any): UniversalQueryParams {
    return this.zodSchema.parse(params) as UniversalQueryParams;
  }

  get schema(): string {
    return `${this.name}(params) — ${this.description} | fields: ${Object.keys(this.fields).join(', ')}`;
  }

  getToolDefinition(ctx: ToolContext) {
    return tool({
      name: this.name,
      description: this.description,
      parameters: this.zodSchema,
      execute: async (params) => {
        try {
          const safeParams = this.validateParams(params);
          const data = await this.run(safeParams, ctx);

          if (ctx.toolDataCache) {
            ctx.toolDataCache[this.name] = data;
          }

          const response = JSON.stringify(this.normalize(data));

          return response;
        } catch (error) {
          return `[TOOL_ERROR ${this.name}]: ${(error as Error).message}. Fix parameters and try again.`;
        }
      },
    });
  }
}

function applyCondition(
  method: 'andWhere' | 'andHaving',
  qb: SelectQueryBuilder<any>,
  colRef: string,
  key: string,
  value: WhereValue,
) {
  const k = key.replace(/[^a-zA-Z0-9]/g, '_');

  if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
    const v = value as any;
    if (v.eq !== undefined && v.eq !== null) qb[method](`${colRef} = :${k}_eq`, { [`${k}_eq`]: v.eq });
    if (v.ne !== undefined && v.ne !== null) qb[method](`${colRef} != :${k}_ne`, { [`${k}_ne`]: v.ne });
    if (v.gt !== undefined && v.gt !== null) qb[method](`${colRef} > :${k}_gt`, { [`${k}_gt`]: v.gt });
    if (v.gte !== undefined && v.gte !== null) qb[method](`${colRef} >= :${k}_gte`, { [`${k}_gte`]: v.gte });
    if (v.lt !== undefined && v.lt !== null) qb[method](`${colRef} < :${k}_lt`, { [`${k}_lt`]: v.lt });
    if (v.lte !== undefined && v.lte !== null) qb[method](`${colRef} <= :${k}_lte`, { [`${k}_lte`]: v.lte });
    if (v.like !== undefined && v.like !== null)
      qb[method](`${colRef} LIKE :${k}_like`, { [`${k}_like`]: `%${v.like}%` });
    if (v.in !== undefined && v.in !== null) qb[method](`${colRef} IN (:...${k}_in)`, { [`${k}_in`]: v.in });
    if (v.between !== undefined && v.between !== null)
      qb[method](`${colRef} BETWEEN :${k}_a AND :${k}_b`, { [`${k}_a`]: v.between[0], [`${k}_b`]: v.between[1] });
  } else {
    qb[method](`${colRef} = :${k}`, { [k]: value });
  }
}

export function buildStandardQuery(
  qb: SelectQueryBuilder<any>,
  params: UniversalQueryParams,
  fieldMap: Record<string, string>,
): SelectQueryBuilder<any> {
  const hasAggregation = params.groupBy || params.aggregate?.length;

  if (hasAggregation) {
    qb.select([]);
    const groups = params.groupBy ? (Array.isArray(params.groupBy) ? params.groupBy : [params.groupBy]) : [];
    for (const g of groups) {
      if (g === null) continue;
      const col = fieldMap[g];
      if (col) {
        qb.addSelect(col, g);
        qb.addGroupBy(col);
      }
    }
    for (const agg of params.aggregate ?? []) {
      if (!agg || agg.field === null) continue;
      const col = agg.field === '*' ? '*' : fieldMap[agg.field];
      if (!col && agg.field !== '*') continue;
      const al = agg.alias ?? `${agg.fn.toLowerCase()}_${agg.field}`;
      qb.addSelect(`${agg.fn}(${col ?? '*'})`, al);
    }
  } else {
    qb.select([]);
    const cols = params.select?.filter((f) => fieldMap[f]) ?? Object.keys(fieldMap);
    for (const f of cols) qb.addSelect(fieldMap[f], f);
  }

  for (const [field, value] of Object.entries(params.where ?? {})) {
    if (value === null || value === undefined) continue;
    const col = fieldMap[field];
    if (col) applyCondition('andWhere', qb, col, field, value);
  }

  for (const [field, value] of Object.entries(params.having ?? {})) {
    if (value === null || value === undefined) continue;
    const col = fieldMap[field] ?? field;
    applyCondition('andHaving', qb, col, `h_${field}`, value);
  }

  if (params.orderBy && params.orderBy.field !== null) {
    const field = params.orderBy.field;
    const direction = (params.orderBy.direction?.toUpperCase() ?? 'DESC') as 'ASC' | 'DESC';
    const groups = params.groupBy ? (Array.isArray(params.groupBy) ? params.groupBy : [params.groupBy]) : [];
    const isGroupedField = groups.includes(field);
    const col = hasAggregation && isGroupedField ? field : (fieldMap[field] ?? field);
    qb.orderBy(col, direction);
  }

  qb.limit(Math.min(params.limit ?? 20, 100));
  if (params.offset) qb.offset(params.offset);

  return qb;
}
