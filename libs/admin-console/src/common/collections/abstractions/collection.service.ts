import { Observable } from "rxjs";

import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

import { CollectionData, Collection, CollectionView } from "../models";

export abstract class CollectionService {
  encryptedCollections$: (userId$: Observable<UserId>) => Observable<Collection[]>;
  decryptedCollections$: (userId$: Observable<UserId>) => Observable<CollectionView[]>;
  upsert: (collection: CollectionData | CollectionData[], userId: UserId) => Promise<any>;
  replace: (collections: { [id: string]: CollectionData }, userId: UserId) => Promise<any>;
  delete: (id: string | string[], userId: UserId) => Promise<any>;
  encrypt: (model: CollectionView) => Promise<Collection>;
  /**
   * @deprecated This method will soon be made private, use `decryptedCollections$` instead.
   */
  decryptMany: (
    collections: Collection[],
    orgKeys?: Record<OrganizationId, OrgKey>,
  ) => Promise<CollectionView[]>;
  /**
   * Transforms the input CollectionViews into TreeNodes
   */
  getAllNested: (collections: CollectionView[]) => TreeNode<CollectionView>[];
  /**
   * Transforms the input CollectionViews into TreeNodes and then returns the Treenode with the specified id
   */
  getNested: (collections: CollectionView[], id: string) => TreeNode<CollectionView>;
}
