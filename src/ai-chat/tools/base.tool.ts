import { DataSource, SelectQueryBuilder } from 'typeorm';
import { OpenAIService } from 'src/utils/services/OpenAI/openai.service';

export interface ToolContext {
  walletId?: string;
  userId: string;
  dataSource: DataSource;
  openAIService: OpenAIService;
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

export abstract class AiTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly fields: Record<string, string>;

  abstract run(params: any, ctx: ToolContext): Promise<any>;

  normalize(data: any): any {
    return data;
  }

  get schema(): string {
    return `${this.name}(params) — ${this.description} | fields: ${Object.keys(this.fields).join(', ')}`;
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
    if ('eq' in v) qb[method](`${colRef} = :${k}_eq`, { [`${k}_eq`]: v.eq });
    if ('ne' in v) qb[method](`${colRef} != :${k}_ne`, { [`${k}_ne`]: v.ne });
    if ('gt' in v) qb[method](`${colRef} > :${k}_gt`, { [`${k}_gt`]: v.gt });
    if ('gte' in v) qb[method](`${colRef} >= :${k}_gte`, { [`${k}_gte`]: v.gte });
    if ('lt' in v) qb[method](`${colRef} < :${k}_lt`, { [`${k}_lt`]: v.lt });
    if ('lte' in v) qb[method](`${colRef} <= :${k}_lte`, { [`${k}_lte`]: v.lte });
    if ('like' in v) qb[method](`${colRef} LIKE :${k}_like`, { [`${k}_like`]: `%${v.like}%` });
    if ('in' in v) qb[method](`${colRef} IN (:...${k}_in)`, { [`${k}_in`]: v.in });
    if ('between' in v) qb[method](`${colRef} BETWEEN :${k}_a AND :${k}_b`, { [`${k}_a`]: v.between[0], [`${k}_b`]: v.between[1] });
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
      const col = fieldMap[g];
      if (col) { qb.addSelect(col, g); qb.addGroupBy(col); }
    }
    for (const agg of params.aggregate ?? []) {
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
    const col = fieldMap[field];
    if (col) applyCondition('andWhere', qb, col, field, value);
  }

  for (const [field, value] of Object.entries(params.having ?? {})) {
    const col = fieldMap[field] ?? field;
    applyCondition('andHaving', qb, col, `h_${field}`, value);
  }

  if (params.orderBy) {
    const field = params.orderBy.field;
    const direction = (params.orderBy.direction?.toUpperCase() ?? 'DESC') as 'ASC' | 'DESC';
    // When aggregating, order by alias (safe for ONLY_FULL_GROUP_BY) if the field is grouped; otherwise use raw col
    const groups = params.groupBy ? (Array.isArray(params.groupBy) ? params.groupBy : [params.groupBy]) : [];
    const isGroupedField = groups.includes(field);
    const col = hasAggregation && isGroupedField ? field : (fieldMap[field] ?? field);
    qb.orderBy(col, direction);
  }

  qb.limit(Math.min(params.limit ?? 20, 100));
  if (params.offset) qb.offset(params.offset);

  return qb;
}
