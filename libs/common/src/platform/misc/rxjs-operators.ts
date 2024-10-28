import { map } from "rxjs";

export const getById = <TId, T extends { id: TId }>(id: TId) =>
  map<T[], T | undefined>((objects) => objects.find((o) => o.id === id));

export const getByIds = <TId, T extends { id: TId }>(ids: TId[]) =>
  map<T[], T[]>((objects) => {
    const idSet = new Set(ids);
    return objects.filter((o) => idSet.has(o.id));
  });
