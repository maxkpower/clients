import { CollectionDetailsResponse } from "@bitwarden/admin-console/common";
import { UserId } from "@bitwarden/common/types/guid";

import { CollectionAccessSelectionView, CollectionAdminView } from "../models";

export abstract class CollectionAdminService {
  getAll: (organizationId: string) => Promise<CollectionAdminView[]>;
  get: (organizationId: string, collectionId: string) => Promise<CollectionAdminView | undefined>;
  save: (collection: CollectionAdminView, userId: UserId) => Promise<CollectionDetailsResponse>;
  delete: (organizationId: string, collectionId: string) => Promise<void>;
  bulkAssignAccess: (
    organizationId: string,
    collectionIds: string[],
    users: CollectionAccessSelectionView[],
    groups: CollectionAccessSelectionView[],
  ) => Promise<void>;
}
