import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { AgentAccessAccessTokensService } from "./agent-access-access-tokens.service";
import { AgentAccessSecretsService } from "./agent-access-secrets.service";

// `AgentAccessSecretsService` pulls in `@bitwarden/generator-legacy`, whose barrel collides with
// the SDK mock in some specs; only the module needs to exist here (the service is mocked).
jest.mock("@bitwarden/generator-legacy", () => ({
  PasswordGenerationServiceAbstraction: class {},
}));

const UserOne = "user-1" as UserId;
const Org = "org-1" as OrganizationId;

const OrgKeyValue = new SymmetricCryptoKey(new Uint8Array(64).fill(1) as CsprngArray) as OrgKey;
const DerivedKey = new SymmetricCryptoKey(new Uint8Array(64).fill(2) as CsprngArray);

/** Stands in for the server-issued half of the token. Must never leave the service except inside
 *  the `value` passed to `createSecret`. */
const SENTINEL_CLIENT_SECRET = "SENTINEL-CLIENT-SECRET";

describe("AgentAccessAccessTokensService", () => {
  let service: AgentAccessAccessTokensService;
  let apiService: MockProxy<ApiService>;
  let encryptService: MockProxy<EncryptService>;
  let keyService: MockProxy<KeyService>;
  let keyGenerationService: MockProxy<KeyGenerationService>;
  let secretsService: MockProxy<AgentAccessSecretsService>;
  let logService: MockProxy<LogService>;
  let material: Uint8Array;

  beforeEach(() => {
    apiService = mock<ApiService>();
    encryptService = mock<EncryptService>();
    keyService = mock<KeyService>();
    keyGenerationService = mock<KeyGenerationService>();
    secretsService = mock<AgentAccessSecretsService>();
    logService = mock<LogService>();

    material = new Uint8Array(16).fill(7);
    keyService.orgKeys$.mockReturnValue(of({ [Org]: OrgKeyValue }));
    keyGenerationService.createKeyWithPurpose.mockResolvedValue({
      salt: "bitwarden-accesstoken",
      material: material as CsprngArray,
      derivedKey: DerivedKey,
    });
    encryptService.encryptString.mockImplementation(
      (async (plaintext: string) => ({ encryptedString: `enc-${plaintext}` }) as EncString) as any,
    );
    secretsService.createSecret.mockResolvedValue("secret-9");

    TestBed.configureTestingModule({
      providers: [
        AgentAccessAccessTokensService,
        { provide: ApiService, useValue: apiService },
        { provide: EncryptService, useValue: encryptService },
        { provide: KeyService, useValue: keyService },
        { provide: KeyGenerationService, useValue: keyGenerationService },
        { provide: AgentAccessSecretsService, useValue: secretsService },
        { provide: LogService, useValue: logService },
      ],
    });
    service = TestBed.inject(AgentAccessAccessTokensService);
  });

  function allLogs(): string {
    return JSON.stringify([
      logService.error.mock.calls,
      logService.warning.mock.calls,
      logService.info.mock.calls,
      logService.debug.mock.calls,
    ]);
  }

  describe("createAccessTokenSecret", () => {
    const expiresAt = new Date("2026-12-01T00:00:00.000Z");

    beforeEach(() => {
      apiService.send.mockImplementation((async (_m: string, path: string) =>
        path.endsWith("/access-tokens")
          ? { Id: "tok-1", ClientSecret: SENTINEL_CLIENT_SECRET, ExpireAt: expiresAt.toISOString() }
          : undefined) as any);
    });

    it("posts the web client's AccessTokenRequest wire shape for the chosen machine account", async () => {
      await service.createAccessTokenSecret(
        Org,
        UserOne,
        "ma-1",
        "proj-1",
        { name: "ci-token", expiresAt },
        "CI_TOKEN",
      );

      expect(keyGenerationService.createKeyWithPurpose).toHaveBeenCalledWith(
        128,
        "sm-access-token",
        "bitwarden-accesstoken",
      );
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/service-accounts/ma-1/access-tokens",
        {
          name: "enc-ci-token",
          encryptedPayload: `enc-${JSON.stringify({ encryptionKey: OrgKeyValue.keyB64 })}`,
          key: `enc-${DerivedKey.keyB64}`,
          expireAt: expiresAt.toISOString(),
        },
        true,
        true,
        null,
        expect.any(Function),
      );
    });

    it("sends expireAt: null for a token that never expires", async () => {
      apiService.send.mockResolvedValue({ Id: "tok-1", ClientSecret: SENTINEL_CLIENT_SECRET });

      const result = await service.createAccessTokenSecret(
        Org,
        UserOne,
        "ma-1",
        null,
        { name: "ci-token" },
        "CI_TOKEN",
      );

      expect(apiService.send.mock.calls[0][2]).toEqual(expect.objectContaining({ expireAt: null }));
      expect(result.expiresAt).toBeUndefined();
    });

    it("stores 0.<id>.<clientSecret>:<key> as the new secret's value and nowhere else", async () => {
      await service.createAccessTokenSecret(
        Org,
        UserOne,
        "ma-1",
        "proj-1",
        { name: "ci-token", expiresAt },
        "CI_TOKEN",
      );

      const expected = `0.tok-1.${SENTINEL_CLIENT_SECRET}:${Utils.fromBufferToB64(
        new Uint8Array(16).fill(7),
      )}`;
      expect(secretsService.createSecret).toHaveBeenCalledTimes(1);
      expect(secretsService.createSecret).toHaveBeenCalledWith(Org, UserOne, "proj-1", {
        name: "CI_TOKEN",
        value: expected,
      });
    });

    it("returns ids and expiry only: the token is in no part of the result", async () => {
      const result = await service.createAccessTokenSecret(
        Org,
        UserOne,
        "ma-1",
        "proj-1",
        { name: "ci-token", expiresAt },
        "CI_TOKEN",
      );

      expect(result).toEqual({
        secretId: "secret-9",
        accessTokenId: "tok-1",
        expiresAt: expiresAt.toISOString(),
      });
      expect(JSON.stringify(result)).not.toContain("SENTINEL");
      expect(JSON.stringify(result)).not.toContain(Utils.fromBufferToB64(material));
    });

    it("writes nothing token-shaped to the log on success", async () => {
      await service.createAccessTokenSecret(
        Org,
        UserOne,
        "ma-1",
        "proj-1",
        { name: "ci-token", expiresAt },
        "CI_TOKEN",
      );

      expect(allLogs()).not.toContain("SENTINEL");
    });

    it("zeroes the key material buffer once the token is assembled", async () => {
      await service.createAccessTokenSecret(
        Org,
        UserOne,
        "ma-1",
        "proj-1",
        { name: "ci-token", expiresAt },
        "CI_TOKEN",
      );

      expect(Array.from(material)).toEqual(new Array(16).fill(0));
    });

    it("revokes the issued token and throws a generic, cause-free error when storing fails", async () => {
      // A lower layer that (wrongly) put the value into its error must not be able to leak it.
      const poisoned = new Error(`boom ${SENTINEL_CLIENT_SECRET}`);
      secretsService.createSecret.mockRejectedValue(poisoned);

      let thrown: Error | undefined;
      try {
        await service.createAccessTokenSecret(
          Org,
          UserOne,
          "ma-1",
          "proj-1",
          { name: "ci-token", expiresAt },
          "CI_TOKEN",
        );
      } catch (e) {
        thrown = e as Error;
      }

      expect(thrown).toBeDefined();
      expect(thrown?.message).not.toContain("SENTINEL");
      expect((thrown as { cause?: unknown }).cause).toBeUndefined();
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/service-accounts/ma-1/access-tokens/revoke",
        { ids: ["tok-1"] },
        true,
        false,
        null,
        expect.any(Function),
      );
      expect(allLogs()).not.toContain("SENTINEL");
    });

    it("still throws the storage error when the best-effort revoke also fails", async () => {
      secretsService.createSecret.mockRejectedValue(new Error("nope"));
      apiService.send.mockImplementation((async (_m: string, path: string) => {
        if (path.endsWith("/revoke")) {
          throw new Error(`revoke failed ${SENTINEL_CLIENT_SECRET}`);
        }
        return { Id: "tok-1", ClientSecret: SENTINEL_CLIENT_SECRET };
      }) as any);

      await expect(
        service.createAccessTokenSecret(Org, UserOne, "ma-1", null, { name: "t" }, "S"),
      ).rejects.toThrow("failed to store");
      expect(logService.error).toHaveBeenCalled();
      expect(allLogs()).not.toContain("SENTINEL");
    });

    it("never creates the secret, and throws generically, when the server refuses the token", async () => {
      apiService.send.mockRejectedValue(new Error(`403 ${SENTINEL_CLIENT_SECRET}`));

      let thrown: Error | undefined;
      try {
        await service.createAccessTokenSecret(Org, UserOne, "ma-1", null, { name: "t" }, "S");
      } catch (e) {
        thrown = e as Error;
      }

      expect(thrown?.message).toBe("Agent Access: failed to create a Secrets Manager access token");
      expect((thrown as { cause?: unknown }).cause).toBeUndefined();
      expect(secretsService.createSecret).not.toHaveBeenCalled();
    });

    it("throws before any network call when the organization key is unavailable", async () => {
      keyService.orgKeys$.mockReturnValue(of({}));

      await expect(
        service.createAccessTokenSecret(Org, UserOne, "ma-1", null, { name: "t" }, "S"),
      ).rejects.toThrow("no organization key");
      expect(apiService.send).not.toHaveBeenCalled();
    });
  });

  describe("listMachineAccounts", () => {
    it("lists and decrypts machine account names, dropping any that fail to decrypt", async () => {
      apiService.send.mockResolvedValue({
        Data: [
          { Id: "ma-1", Name: "2.good" },
          { Id: "ma-2", Name: "2.bad" },
        ],
      });
      encryptService.decryptString.mockImplementation((async (encString: EncString) => {
        const ciphertext = (encString as unknown as { encryptedString: string }).encryptedString;
        if (ciphertext === "2.bad") {
          throw new Error("cannot decrypt");
        }
        return "ci-bot";
      }) as any);

      const accounts = await service.listMachineAccounts(Org, UserOne);

      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        `/organizations/${Org}/service-accounts`,
        null,
        true,
        true,
      );
      expect(accounts).toEqual([{ id: "ma-1", name: "ci-bot" }]);
    });

    it("returns an empty list, without throwing, when the API call fails", async () => {
      apiService.send.mockRejectedValue(new Error("500"));

      expect(await service.listMachineAccounts(Org, UserOne)).toEqual([]);
    });

    it("returns an empty list when the organization key is unavailable", async () => {
      keyService.orgKeys$.mockReturnValue(of({}));

      expect(await service.listMachineAccounts(Org, UserOne)).toEqual([]);
      expect(apiService.send).not.toHaveBeenCalled();
    });
  });
});
