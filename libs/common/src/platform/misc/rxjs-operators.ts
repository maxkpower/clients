import { map } from "rxjs";

export const getById = <TId, T extends { id: TId }>(id: TId) =>
  map<T[], T>((objects) => objects.find((o) => o.id === id));

export const getByIds = <TId, T extends { id: TId }>(ids: TId[]) =>
  map<T[], T[]>((objects) => objects.filter((o) => ids.includes(o.id)));
