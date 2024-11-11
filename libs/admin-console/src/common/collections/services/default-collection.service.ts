import {
  combineLatest,
  endWith,
  filter,
  finalize,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  takeWhile,
  tap,
} from "rxjs";

import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider, DerivedState } from "@bitwarden/common/platform/state";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { KeyService } from "@bitwarden/key-management";

import { CollectionService } from "../abstractions/collection.service";
import { Collection, CollectionData, CollectionView } from "../models";

import { DECRYPTED_COLLECTION_DATA_KEY, ENCRYPTED_COLLECTION_DATA_KEY } from "./collection.state";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

const NestingDelimiter = "/";

export class DefaultCollectionService implements CollectionService {
  private decryptedStateCache: Record<UserId, Observable<CollectionView[]>> = {};

  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private i18nService: I18nService,
    protected stateProvider: StateProvider,
    private authService: AuthService,
  ) {}

  encryptedCollections$(userId$: Observable<UserId>) {
    return userId$.pipe(
      switchMap((userId) =>
        combineLatest([
          this.authService.authStatusFor$(userId),
          this.encryptedState(userId).state$,
        ]),
      ),
      takeWhile(([authStatus]) => authStatus !== AuthenticationStatus.LoggedOut),
      filter(([_, collections]) => collections != null),
      map(([_, collections]) => Object.values(collections).map((c) => new Collection(c))),
    );
  }

  decryptedCollections$(userId$: Observable<UserId>) {
    return userId$.pipe(
      switchMap((userId) => this.decryptedState$(userId)),
      map((collections) => collections ?? []),
    );
  }

  async upsert(toUpdate: CollectionData | CollectionData[], userId: UserId): Promise<void> {
    if (toUpdate == null) {
      return;
    }
    await this.encryptedState(userId).update((collections) => {
      if (collections == null) {
        collections = {};
      }
      if (Array.isArray(toUpdate)) {
        toUpdate.forEach((c) => {
          collections[c.id] = c;
        });
      } else {
        collections[toUpdate.id] = toUpdate;
      }
      return collections;
    });
  }

  async replace(collections: Record<CollectionId, CollectionData>, userId: UserId): Promise<void> {
    await this.encryptedState(userId).update(() => collections);
  }

  async delete(id: CollectionId | CollectionId[], userId: UserId): Promise<any> {
    await this.encryptedState(userId).update((collections) => {
      if (collections == null) {
        collections = {};
      }
      if (typeof id === "string") {
        delete collections[id];
      } else {
        (id as CollectionId[]).forEach((i) => {
          delete collections[i];
        });
      }
      return collections;
    });
  }

  async encrypt(model: CollectionView): Promise<Collection> {
    if (model.organizationId == null) {
      throw new Error("Collection has no organization id.");
    }
    const key = await this.keyService.getOrgKey(model.organizationId);
    if (key == null) {
      throw new Error("No key for this collection's organization.");
    }
    const collection = new Collection();
    collection.id = model.id;
    collection.organizationId = model.organizationId;
    collection.readOnly = model.readOnly;
    collection.externalId = model.externalId;
    collection.name = await this.encryptService.encrypt(model.name, key);
    return collection;
  }

  // TODO: this should be private and orgKeys should be required.
  // See https://bitwarden.atlassian.net/browse/PM-12375
  async decryptMany(
    collections: Collection[],
    orgKeys?: Record<OrganizationId, OrgKey>,
  ): Promise<CollectionView[]> {
    if (collections == null || collections.length === 0) {
      return [];
    }
    const decCollections: CollectionView[] = [];

    orgKeys ??= await firstValueFrom(this.keyService.activeUserOrgKeys$);

    const promises: Promise<any>[] = [];
    collections.forEach((collection) => {
      promises.push(
        collection
          .decrypt(orgKeys[collection.organizationId as OrganizationId])
          .then((c) => decCollections.push(c)),
      );
    });
    await Promise.all(promises);
    return decCollections.sort(Utils.getSortFunction(this.i18nService, "name"));
  }

  getAllNested(collections: CollectionView[]): TreeNode<CollectionView>[] {
    const nodes: TreeNode<CollectionView>[] = [];
    collections.forEach((c) => {
      const collectionCopy = new CollectionView();
      collectionCopy.id = c.id;
      collectionCopy.organizationId = c.organizationId;
      const parts = c.name != null ? c.name.replace(/^\/+|\/+$/g, "").split(NestingDelimiter) : [];
      ServiceUtils.nestedTraverse(nodes, 0, parts, collectionCopy, null, NestingDelimiter);
    });
    return nodes;
  }

  /**
   * @deprecated August 30 2022: Moved to new Vault Filter Service
   * Remove when Desktop and Browser are updated
   */
  getNested(collections: CollectionView[], id: string): TreeNode<CollectionView> {
    const nestedCollections = this.getAllNested(collections);
    return ServiceUtils.getTreeNodeObjectFromList(
      nestedCollections,
      id,
    ) as TreeNode<CollectionView>;
  }

  /**
   * @returns a SingleUserState for encrypted collection data.
   */
  private encryptedState(userId: UserId) {
    return this.stateProvider.getUser(userId, ENCRYPTED_COLLECTION_DATA_KEY);
  }

  /**
   * @returns a SingleUserState for decrypted collection data.
   */
  private decryptedState$(userId: UserId): Observable<CollectionView[]> {
    // We complete the stream when the user is locked or logged out because:
    // 1. we cannot update decrypted collections without keys, so this stream cannot produce any further emissions
    // 2. nobody should be accessing decrypted data when a vault is locked or logged out
    if (this.decryptedStateCache[userId] != null) {
      return this.decryptedStateCache[userId];
    }

    this.decryptedStateCache[userId] = combineLatest([
      this.authService.authStatusFor$(userId),
      this.encryptedState(userId).state$,
      this.keyService.orgKeys$(userId),
    ]).pipe(
      takeWhile(([authStatus]) => authStatus === AuthenticationStatus.Unlocked),
      filter(([_, collectionData]) => collectionData != null),
      switchMap(async ([_, collectionData, orgKeys]) => {
        if (orgKeys == null) {
          throw new Error("Unable to decrypt collections: orgKeys are null.");
        }

        const decrypted = Object.values(collectionData)
          .map((c) => new Collection(c))
          .map((c) => c.decrypt(orgKeys[c.organizationId as OrganizationId]));

        return await Promise.all(decrypted);
      }),
      map((collections) => collections.sort(Utils.getSortFunction(this.i18nService, "name"))),
      finalize(() => delete this.decryptedStateCache[userId]),
      shareReplay({
        bufferSize: 1,
        refCount: true,
      }),
    );

    return this.decryptedStateCache[userId];
  }
}
