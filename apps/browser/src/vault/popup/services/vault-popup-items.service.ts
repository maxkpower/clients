// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable, NgZone } from "@angular/core";
import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  distinctUntilChanged,
  distinctUntilKeyChanged,
  filter,
  map,
  merge,
  MonoTypeOperatorFunction,
  Observable,
  of,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  tap,
  withLatestFrom,
} from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { runInsideAngular } from "../../../platform/browser/run-inside-angular.operator";
import { waitUntil } from "../../util";
import { PopupCipherView } from "../views/popup-cipher.view";

import { VaultPopupAutofillService } from "./vault-popup-autofill.service";
import { MY_VAULT_ID, VaultPopupListFiltersService } from "./vault-popup-list-filters.service";

/**
 * Service for managing the various item lists on the new Vault tab in the browser popup.
 */
@Injectable({
  providedIn: "root",
})
export class VaultPopupItemsService {
  private _searchText$ = new BehaviorSubject<string>("");

  /**
   * Subject that emits whenever new ciphers are being processed/filtered.
   * @private
   */
  private _ciphersLoading$ = new Subject<void>();

  latestSearchText$: Observable<string> = this._searchText$.asObservable();

  private organizations$ = this.accountService.activeAccount$.pipe(
    switchMap((account) => this.organizationService.organizations$(account?.id)),
  );
  /**
   * Observable that contains the list of other cipher types that should be shown
   * in the autofill section of the Vault tab. Depends on vault settings.
   * @private
   */
  private _otherAutoFillTypes$: Observable<CipherType[]> = combineLatest([
    this.vaultSettingsService.showCardsCurrentTab$,
    this.vaultSettingsService.showIdentitiesCurrentTab$,
    this.vaultPopupAutofillService.nonLoginCipherTypesOnPage$,
  ]).pipe(
    map(([showCardsSettingEnabled, showIdentitiesSettingEnabled, nonLoginCipherTypesOnPage]) => {
      const showCards = showCardsSettingEnabled || nonLoginCipherTypesOnPage[CipherType.Card];
      const showIdentities =
        showIdentitiesSettingEnabled || nonLoginCipherTypesOnPage[CipherType.Identity];

      return [
        ...(showCards ? [CipherType.Card] : []),
        ...(showIdentities ? [CipherType.Identity] : []),
      ];
    }),
  );

  /**
   * Observable that contains the list of all decrypted ciphers.
   * @private
   */
  private _allDecryptedCiphers$: Observable<CipherView[]> = this.accountService.activeAccount$.pipe(
    map((a) => a?.id),
    filter((userId) => userId != null),
    switchMap((userId) =>
      merge(this.cipherService.ciphers$(userId), this.cipherService.localData$(userId)).pipe(
        runInsideAngular(this.ngZone),
        tap(() => this._ciphersLoading$.next()),
        waitUntilSync(this.syncService),
        switchMap(() => Utils.asyncToObservable(() => this.cipherService.getAllDecrypted(userId))),
        withLatestFrom(this.cipherService.failedToDecryptCiphers$(userId)),
        map(([ciphers, failedToDecryptCiphers]) => [...failedToDecryptCiphers, ...ciphers]),
      ),
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  private _activeCipherList$: Observable<PopupCipherView[]> = this._allDecryptedCiphers$.pipe(
    switchMap((ciphers) =>
      combineLatest([this.organizations$, this.collectionService.decryptedCollections$]).pipe(
        map(([organizations, collections]) => {
          const orgMap = Object.fromEntries(organizations.map((org) => [org.id, org]));
          const collectionMap = Object.fromEntries(collections.map((col) => [col.id, col]));
          return ciphers
            .filter((c) => !c.isDeleted)
            .map(
              (cipher) =>
                new PopupCipherView(
                  cipher,
                  cipher.collectionIds?.map((colId) => collectionMap[colId as CollectionId]),
                  orgMap[cipher.organizationId as OrganizationId],
                ),
            );
        }),
      ),
    ),
  );

  /**
   * Observable that indicates whether there is search text present that is searchable.
   * @private
   */
  private _hasSearchText$ = this._searchText$.pipe(
    switchMap((searchText) => this.searchService.isSearchable(searchText)),
  );

  private _filteredCipherList$: Observable<PopupCipherView[]> = combineLatest([
    this._activeCipherList$,
    this._searchText$,
    this.vaultPopupListFiltersService.filterFunction$,
  ]).pipe(
    map(([ciphers, searchText, filterFunction]): [CipherView[], string] => [
      filterFunction(ciphers),
      searchText,
    ]),
    switchMap(
      ([ciphers, searchText]) =>
        this.searchService.searchCiphers(searchText, null, ciphers) as Promise<PopupCipherView[]>,
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /**
   * List of ciphers that can be used for autofill on the current tab. Includes cards and/or identities
   * if enabled in the vault settings. Ciphers are sorted by type, then by last used date, then by name.
   *
   * See {@link refreshCurrentTab} to trigger re-evaluation of the current tab.
   */
  autoFillCiphers$: Observable<PopupCipherView[]> = combineLatest([
    this._filteredCipherList$,
    this._otherAutoFillTypes$,
    this.vaultPopupAutofillService.currentAutofillTab$,
  ]).pipe(
    switchMap(([ciphers, otherTypes, tab]) => {
      if (!tab) {
        return of([]);
      }
      return this.cipherService.filterCiphersForUrl(ciphers, tab.url, otherTypes);
    }),
    map((ciphers) => ciphers.sort(this.sortCiphersForAutofill.bind(this))),
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  /**
   * List of favorite ciphers that are not currently suggested for autofill.
   * Ciphers are sorted by name.
   */
  favoriteCiphers$: Observable<PopupCipherView[]> = this.autoFillCiphers$.pipe(
    withLatestFrom(this._filteredCipherList$),
    map(([autoFillCiphers, ciphers]) =>
      ciphers.filter((cipher) => cipher.favorite && !autoFillCiphers.includes(cipher)),
    ),
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  /**
   * List of all remaining ciphers that are not currently suggested for autofill or marked as favorite.
   * Ciphers are sorted by name.
   */
  remainingCiphers$: Observable<PopupCipherView[]> = this.favoriteCiphers$.pipe(
    concatMap(
      (
        favoriteCiphers, // concatMap->of is used to make withLatestFrom lazy to avoid race conditions with autoFillCiphers$
      ) =>
        of(favoriteCiphers).pipe(withLatestFrom(this._filteredCipherList$, this.autoFillCiphers$)),
    ),
    map(([favoriteCiphers, ciphers, autoFillCiphers]) =>
      ciphers.filter(
        (cipher) => !autoFillCiphers.includes(cipher) && !favoriteCiphers.includes(cipher),
      ),
    ),
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  /**
   * Observable that indicates whether the service is currently loading ciphers.
   */
  loading$: Observable<boolean> = merge(
    this._ciphersLoading$.pipe(map(() => true)),
    this.remainingCiphers$.pipe(map(() => false)),
  ).pipe(startWith(true), distinctUntilChanged(), shareReplay({ refCount: false, bufferSize: 1 }));

  /**
   * Observable that indicates whether a filter or search text is currently applied to the ciphers.
   */
  hasFilterApplied$ = combineLatest([
    this._hasSearchText$,
    this.vaultPopupListFiltersService.filters$,
  ]).pipe(
    map(([hasSearchText, filters]) => {
      return hasSearchText || Object.values(filters).some((filter) => filter !== null);
    }),
  );

  /**
   * Observable that indicates whether the user's vault is empty.
   */
  emptyVault$: Observable<boolean> = this._activeCipherList$.pipe(
    map((ciphers) => !ciphers.length),
  );

  /**
   * Observable that indicates whether there are no ciphers to show with the current filter.
   */
  noFilteredResults$: Observable<boolean> = this._filteredCipherList$.pipe(
    map((ciphers) => !ciphers.length),
  );

  /** Observable that indicates when the user should see the deactivated org state */
  showDeactivatedOrg$: Observable<boolean> = combineLatest([
    this.vaultPopupListFiltersService.filters$.pipe(distinctUntilKeyChanged("organization")),
    this.organizations$,
  ]).pipe(
    map(([filters, orgs]) => {
      if (!filters.organization || filters.organization.id === MY_VAULT_ID) {
        return false;
      }

      const org = orgs.find((o) => o.id === filters.organization.id);
      return org ? !org.enabled : false;
    }),
  );

  /**
   * Observable that contains the list of ciphers that have been deleted.
   */
  deletedCiphers$: Observable<PopupCipherView[]> = this._allDecryptedCiphers$.pipe(
    switchMap((ciphers) =>
      combineLatest([this.organizations$, this.collectionService.decryptedCollections$]).pipe(
        map(([organizations, collections]) => {
          const orgMap = Object.fromEntries(organizations.map((org) => [org.id, org]));
          const collectionMap = Object.fromEntries(collections.map((col) => [col.id, col]));
          return ciphers
            .filter((c) => c.isDeleted)
            .map(
              (cipher) =>
                new PopupCipherView(
                  cipher,
                  cipher.collectionIds?.map((colId) => collectionMap[colId as CollectionId]),
                  orgMap[cipher.organizationId as OrganizationId],
                ),
            );
        }),
      ),
    ),
    shareReplay({ refCount: false, bufferSize: 1 }),
  );

  constructor(
    private cipherService: CipherService,
    private vaultSettingsService: VaultSettingsService,
    private vaultPopupListFiltersService: VaultPopupListFiltersService,
    private organizationService: OrganizationService,
    private searchService: SearchService,
    private collectionService: CollectionService,
    private vaultPopupAutofillService: VaultPopupAutofillService,
    private syncService: SyncService,
    private accountService: AccountService,
    private ngZone: NgZone,
  ) {}

  applyFilter(newSearchText: string) {
    this._searchText$.next(newSearchText);
  }

  /**
   * Sort function for ciphers to be used in the autofill section of the Vault tab.
   * Sorts by type, then by last used date, and finally by name.
   * @private
   */
  private sortCiphersForAutofill(a: CipherView, b: CipherView): number {
    const typeOrder: Record<CipherType, number> = {
      [CipherType.Login]: 1,
      [CipherType.Card]: 2,
      [CipherType.Identity]: 3,
      [CipherType.SecureNote]: 4,
      [CipherType.SshKey]: 5,
    };

    // Compare types first
    if (typeOrder[a.type] < typeOrder[b.type]) {
      return -1;
    } else if (typeOrder[a.type] > typeOrder[b.type]) {
      return 1;
    }

    // If types are the same, then sort by last used then name
    return this.cipherService.sortCiphersByLastUsedThenName(a, b);
  }
}

/**
 * Operator that waits until the active account has synced at least once before allowing the source to continue emission.
 * @param syncService
 */
const waitUntilSync = <T>(syncService: SyncService): MonoTypeOperatorFunction<T> => {
  return waitUntil(syncService.activeUserLastSync$().pipe(filter((lastSync) => lastSync != null)));
};
