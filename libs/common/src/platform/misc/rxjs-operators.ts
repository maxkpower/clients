import { map } from "rxjs";

type ObjectWithId<TId> = { id: TId };

export const getById = <TId, T extends ObjectWithId<TId>>(id: TId) =>
  map<T[], T>((objects) => objects.find((o) => o.id === id));

export const getByIds = <TId, T extends ObjectWithId<TId>>(ids: TId[]) =>
  map<T[], T[]>((objects) => objects.filter((o) => ids.includes(o.id)));
