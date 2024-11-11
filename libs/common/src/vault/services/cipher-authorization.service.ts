import { map, Observable, of, shareReplay, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionId } from "@bitwarden/common/types/guid";

import { AccountService } from "../../auth/abstractions/account.service";
import { getUserId } from "../../auth/services/account.service";
import { getByIds } from "../../platform/misc/rxjs-operators";
import { Cipher } from "../models/domain/cipher";
import { CipherView } from "../models/view/cipher.view";

/**
 * Represents either a cipher or a cipher view.
 */
type CipherLike = Cipher | CipherView;

/**
 * Service for managing user cipher authorization.
 */
export abstract class CipherAuthorizationService {
  /**
   * Determines if the user can delete the specified cipher.
   *
   * @param {CipherLike} cipher - The cipher object to evaluate for deletion permissions.
   * @param {CollectionId[]} [allowedCollections] - Optional. The selected collection id from the vault filter.
   * @param {boolean} isAdminConsoleAction - Optional. A flag indicating if the action is being performed from the admin console.
   *
   * @returns {Observable<boolean>} - An observable that emits a boolean value indicating if the user can delete the cipher.
   */
  canDeleteCipher$: (
    cipher: CipherLike,
    allowedCollections?: CollectionId[],
    isAdminConsoleAction?: boolean,
  ) => Observable<boolean>;

  /**
   * Determines if the user can clone the specified cipher.
   *
   * @param {CipherLike} cipher - The cipher object to evaluate for cloning permissions.
   * @param {boolean} isAdminConsoleAction - Optional. A flag indicating if the action is being performed from the admin console.
   *
   * @returns {Observable<boolean>} - An observable that emits a boolean value indicating if the user can clone the cipher.
   */
  canCloneCipher$: (cipher: CipherLike, isAdminConsoleAction?: boolean) => Observable<boolean>;
}

/**
 * {@link CipherAuthorizationService}
 */
export class DefaultCipherAuthorizationService implements CipherAuthorizationService {
  private activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  constructor(
    private collectionService: CollectionService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  /**
   *
   * {@link CipherAuthorizationService.canDeleteCipher$}
   */
  canDeleteCipher$(
    cipher: CipherLike,
    allowedCollections?: CollectionId[],
    isAdminConsoleAction?: boolean,
  ): Observable<boolean> {
    if (cipher.organizationId == null) {
      return of(true);
    }

    return this.organizationService.get$(cipher.organizationId).pipe(
      switchMap((organization) => {
        if (isAdminConsoleAction) {
          // If the user is an admin, they can delete an unassigned cipher
          if (!cipher.collectionIds || cipher.collectionIds.length === 0) {
            return of(organization?.canEditUnassignedCiphers === true);
          }

          if (organization?.canEditAllCiphers) {
            return of(true);
          }
        }

        return this.collectionService.decryptedCollections$(this.activeUserId$).pipe(
          getByIds(cipher.collectionIds),
          map((cipherCollections) => {
            const shouldFilter = allowedCollections?.some(Boolean);

            const collections = shouldFilter
              ? cipherCollections.filter((c) => allowedCollections.includes(c.id as CollectionId))
              : cipherCollections;

            return collections.some((collection) => collection.manage);
          }),
        );
      }),
    );
  }

  /**
   * {@link CipherAuthorizationService.canCloneCipher$}
   */
  canCloneCipher$(cipher: CipherLike, isAdminConsoleAction?: boolean): Observable<boolean> {
    if (cipher.organizationId == null) {
      return of(true);
    }

    return this.organizationService.get$(cipher.organizationId).pipe(
      switchMap((organization) => {
        // Admins and custom users can always clone when in the Admin Console
        if (
          isAdminConsoleAction &&
          (organization.isAdmin || organization.permissions?.editAnyCollection)
        ) {
          return of(true);
        }

        return this.collectionService.decryptedCollections$(this.activeUserId$).pipe(
          getByIds(cipher.collectionIds),
          map((allCollections) => allCollections.some((collection) => collection.manage)),
        );
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }
}
