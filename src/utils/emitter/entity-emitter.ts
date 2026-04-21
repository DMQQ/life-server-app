export interface EntityUpdatePayload<T> {
  entity: T;
  previous: T;
  changed: (keyof T)[];
}
