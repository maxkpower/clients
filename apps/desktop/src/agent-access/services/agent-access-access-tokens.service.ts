import { Injectable, inject } from "@angular/core";
import { filter, firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { AgentAccessSecretsService } from "./agent-access-secrets.service";

/** Same header and meaning as in `agent-access-secrets.service.ts`: marks the call as made on an
 *  agent's behalf. It only changes the server's audit event flavor, never authorization. */
const AGENT_MEDIATED_HEADER = "Bitwarden-Agent-Mediated";
const markAgentMediated = (headers: Headers): void => {
  headers.set(AGENT_MEDIATED_HEADER, "1");
};

/** Access-token format version, mirrors `AccessService` in the web SM client. */
const ACCESS_TOKEN_VERSION = "0";

/**
 * One Secrets Manager machine account (server name: service account) the user can see, with its
 * decrypted name. Read-only metadata for the access-token approval dialog's picker; the server
 * does not report per-account write flags on this list, so a machine account the user cannot
 * mint tokens for surfaces as a post-approval failure, not a pre-filtered option.
 */
export interface SmMachineAccountMatch {
  id: string;
  name: string;
}

/** Everything {@link AgentAccessAccessTokensService.createAccessTokenSecret} returns: ids, the
 *  user-approved token name and the expiry only. Deliberately has no field that could hold the
 *  token — callers can neither read nor forward it. */
export interface CreatedAccessTokenSecret {
  secretId: string;
  accessTokenId: string;
  /** ISO 8601 expiry, or `undefined` for a token that never expires. */
  expiresAt?: string;
}

class SmMachineAccountListItemResponse extends BaseResponse {
  id: string;
  /** Encrypted machine account name. */
  name: string;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.name = this.getResponseProperty("Name");
  }
}

/** Wire shape of `GET /organizations/{orgId}/service-accounts` — standard `ListResponse`. */
class SmMachineAccountListResponse extends BaseResponse {
  data: SmMachineAccountListItemResponse[];

  constructor(response: unknown) {
    super(response);
    const data = this.getResponseProperty("Data");
    this.data = Array.isArray(data)
      ? data.map((item: unknown) => new SmMachineAccountListItemResponse(item))
      : [];
  }
}

/**
 * Wire shape of `POST /service-accounts/{id}/access-tokens`. `ClientSecret` is the server-issued
 * half of the token and is returned exactly once. It is read straight into a local in
 * `createAccessTokenSecret`; this class exists only to parse it and must never be returned,
 * stored or logged.
 */
class SmAccessTokenCreationResponse extends BaseResponse {
  id: string;
  clientSecret: string;
  expireAt?: string;

  constructor(response: unknown) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.clientSecret = this.getResponseProperty("ClientSecret");
    this.expireAt = this.getResponseProperty("ExpireAt") ?? undefined;
  }
}

/**
 * Machine-account access-token minting for Agent Access (`accessTokenCreate`). Kept in its own
 * file, separate from `AgentAccessSecretsService`, so the one code path that ever holds a token
 * is small enough to audit in a single read.
 *
 * SECURITY INVARIANT: the agent never sees the token. The token is assembled here, after the
 * user approved, written straight into a new Secrets Manager secret through
 * {@link AgentAccessSecretsService.createSecret} and then dropped. It is never returned from this
 * class, never put on an IPC message, activity row, toast, error message or log line. Every error
 * thrown out of `createAccessTokenSecret` is a fresh generic `Error` with no `cause`, so nothing a
 * lower layer attached can carry token material to a caller's `logService.error(..., e)`.
 *
 * Why this is not "via the SDK": the SDK (`@bitwarden/sdk-internal` in this repo) exposes no
 * machine-account access-token creation (only Send access tokens). The web SM client builds the
 * token client-side from OSS primitives (`KeyGenerationService`, `EncryptService`, `ApiService`);
 * this class reproduces that wire format (`0.<tokenId>.<clientSecret>:<base64 key>`) with the same
 * primitives, because `apps/**` may not import `bitwarden_license/**`.
 *
 * JavaScript cannot zeroize a string. What this code does instead: the token string lives in one
 * function-local `let` for a few awaits, the 128-bit key material buffer is `fill(0)`ed, and the
 * local is overwritten before returning (this limits references; it does not scrub memory the
 * engine may have copied).
 */
@Injectable({
  providedIn: "root",
})
export class AgentAccessAccessTokensService {
  private readonly apiService = inject(ApiService);
  private readonly encryptService = inject(EncryptService);
  private readonly keyService = inject(KeyService);
  private readonly keyGenerationService = inject(KeyGenerationService);
  private readonly secretsService = inject(AgentAccessSecretsService);
  private readonly logService = inject(LogService);

  /**
   * Lists the machine accounts in `organizationId` with decrypted names, for the approval
   * dialog's picker. Never throws: a failed list or an undecryptable name degrades to fewer (or
   * no) options, same convention as `AgentAccessSecretsService.listProjects`.
   */
  async listMachineAccounts(
    organizationId: string,
    userId: UserId,
  ): Promise<SmMachineAccountMatch[]> {
    try {
      const orgKey = await this.resolveOrgKey(organizationId, userId);
      if (orgKey == null) {
        return [];
      }
      let listed: SmMachineAccountListResponse;
      try {
        listed = new SmMachineAccountListResponse(
          await this.apiService.send(
            "GET",
            `/organizations/${organizationId}/service-accounts`,
            null,
            true,
            true,
          ),
        );
      } catch (e) {
        this.logService.error("Agent Access: failed to list Secrets Manager machine accounts", e);
        return [];
      }
      const decrypted = await Promise.all(
        listed.data.map(async (item): Promise<SmMachineAccountMatch | null> => {
          try {
            const name = await this.encryptService.decryptString(new EncString(item.name), orgKey);
            return { id: item.id, name };
          } catch {
            this.logService.error("Agent Access: failed to decrypt a machine account name");
            return null;
          }
        }),
      );
      return decrypted.filter((account): account is SmMachineAccountMatch => account != null);
    } catch (e) {
      this.logService.error("Agent Access: Secrets Manager machine account lookup failed", e);
      return [];
    }
  }

  /**
   * Mints an access token for `machineAccountId` and stores it as the value of a new secret named
   * `secretName` in `projectId` (or project-less, when the caller's admin relaxation allows it).
   * Returns only ids and the expiry; see the class doc for the token's lifetime.
   *
   * If storing the token fails after the server already issued it, the issued token is revoked
   * on a best-effort basis (nobody can ever read it, so leaving it live would be an unusable but
   * valid credential) and a generic error is thrown.
   *
   * Does not swallow failures: the caller denies the request and tells the user.
   */
  async createAccessTokenSecret(
    organizationId: string,
    userId: UserId,
    machineAccountId: string,
    projectId: string | null,
    token: { name: string; expiresAt?: Date },
    secretName: string,
  ): Promise<CreatedAccessTokenSecret> {
    const orgKey = await this.resolveOrgKey(organizationId, userId);
    if (orgKey == null) {
      throw new Error("Agent Access: no organization key available to create an access token");
    }

    let accessTokenId: string;
    let expiresAt: string | undefined;
    // The only variable that ever holds the assembled token. See the class doc.
    let accessToken = "";
    try {
      const generated = await this.keyGenerationService.createKeyWithPurpose(
        128,
        "sm-access-token",
        "bitwarden-accesstoken",
      );
      try {
        const [name, encryptedPayload, key] = await Promise.all([
          this.encryptService.encryptString(token.name, orgKey),
          this.encryptService.encryptString(
            JSON.stringify({ encryptionKey: orgKey.keyB64 }),
            generated.derivedKey,
          ),
          this.encryptService.encryptString(generated.derivedKey.keyB64, orgKey),
        ]);

        const created = new SmAccessTokenCreationResponse(
          await this.apiService.send(
            "POST",
            `/service-accounts/${machineAccountId}/access-tokens`,
            {
              name: name.encryptedString,
              encryptedPayload: encryptedPayload.encryptedString,
              key: key.encryptedString,
              expireAt: token.expiresAt?.toISOString() ?? null,
            },
            true,
            true,
            null,
            markAgentMediated,
          ),
        );
        accessTokenId = created.id;
        expiresAt = created.expireAt ?? token.expiresAt?.toISOString();
        accessToken = `${ACCESS_TOKEN_VERSION}.${created.id}.${created.clientSecret}:${Utils.fromBufferToB64(generated.material)}`;
      } finally {
        generated.material.fill(0);
      }
    } catch {
      // Deliberately no `cause` and no server text: nothing here may carry token material.
      accessToken = "";
      throw new Error("Agent Access: failed to create a Secrets Manager access token");
    }

    try {
      const secretId = await this.secretsService.createSecret(organizationId, userId, projectId, {
        name: secretName,
        value: accessToken,
      });
      return { secretId, accessTokenId, expiresAt };
    } catch {
      await this.revokeBestEffort(machineAccountId, accessTokenId);
      throw new Error("Agent Access: failed to store a Secrets Manager access token");
    } finally {
      accessToken = "";
    }
  }

  /** `POST /service-accounts/{id}/access-tokens/revoke`. Never throws: it runs on a failure
   *  path and the caller is about to report the original failure. */
  private async revokeBestEffort(machineAccountId: string, accessTokenId: string): Promise<void> {
    try {
      await this.apiService.send(
        "POST",
        `/service-accounts/${machineAccountId}/access-tokens/revoke`,
        { ids: [accessTokenId] },
        true,
        false,
        null,
        markAgentMediated,
      );
    } catch {
      this.logService.error(
        "Agent Access: could not revoke an access token that failed to be stored",
      );
    }
  }

  /** The caller's org key for `organizationId`, or `undefined` if the account has none yet. */
  private async resolveOrgKey(organizationId: string, userId: UserId): Promise<OrgKey | undefined> {
    const orgKeys = await firstValueFrom(
      this.keyService.orgKeys$(userId).pipe(filter((keys) => keys != null)),
    );
    return orgKeys[organizationId as OrganizationId];
  }
}
