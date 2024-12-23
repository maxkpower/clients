// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mockReset, mock } from "jest-mock-extended";

import { makeStaticByteArray } from "../../../spec";
import { CsprngArray } from "../../types/csprng";
import { CryptoFunctionService } from "../abstractions/crypto-function.service";
import { LogService } from "../abstractions/log.service";
import { EncryptionType } from "../enums";
import { Utils } from "../misc/utils";
import { EncArrayBuffer } from "../models/domain/enc-array-buffer";
import { EncString } from "../models/domain/enc-string";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";
import { EncryptServiceImplementation } from "../services/cryptography/encrypt.service.implementation";

describe("EncryptService", () => {
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const logService = mock<LogService>();

  let encryptService: EncryptServiceImplementation;

  beforeEach(() => {
    mockReset(cryptoFunctionService);
    mockReset(logService);

    encryptService = new EncryptServiceImplementation(cryptoFunctionService, logService, true);
  });

  describe("encryptToBytes", () => {
    const plainValue = makeStaticByteArray(16, 1);
    const iv = makeStaticByteArray(16, 30);
    const mac = makeStaticByteArray(32, 40);
    const encryptedData = makeStaticByteArray(20, 50);

    it("throws if no key is provided", () => {
      return expect(encryptService.encryptToBytes(plainValue, null)).rejects.toThrow(
        "No encryption key",
      );
    });

    describe("encrypts data", () => {
      beforeEach(() => {
        cryptoFunctionService.randomBytes.calledWith(16).mockResolvedValueOnce(iv as CsprngArray);
        cryptoFunctionService.aesEncrypt.mockResolvedValue(encryptedData);
      });

      it("using a key which supports mac", async () => {
        const key = mock<SymmetricCryptoKey>();
        const encType = EncryptionType.AesCbc128_HmacSha256_B64;
        key.encType = encType;

        key.macKey = makeStaticByteArray(16, 20);

        cryptoFunctionService.hmac.mockResolvedValue(mac);

        const actual = await encryptService.encryptToBytes(plainValue, key);

        expect(actual.encryptionType).toEqual(encType);
        expect(actual.ivBytes).toEqualBuffer(iv);
        expect(actual.macBytes).toEqualBuffer(mac);
        expect(actual.dataBytes).toEqualBuffer(encryptedData);
        expect(actual.buffer.byteLength).toEqual(
          1 + iv.byteLength + mac.byteLength + encryptedData.byteLength,
        );
      });

      it("using a key which doesn't support mac", async () => {
        const key = mock<SymmetricCryptoKey>();
        const encType = EncryptionType.AesCbc256_B64;
        key.encType = encType;

        key.macKey = null;

        const actual = await encryptService.encryptToBytes(plainValue, key);

        expect(cryptoFunctionService.hmac).not.toBeCalled();

        expect(actual.encryptionType).toEqual(encType);
        expect(actual.ivBytes).toEqualBuffer(iv);
        expect(actual.macBytes).toBeNull();
        expect(actual.dataBytes).toEqualBuffer(encryptedData);
        expect(actual.buffer.byteLength).toEqual(1 + iv.byteLength + encryptedData.byteLength);
      });
    });
  });

  describe("decryptToBytes", () => {
    const encType = EncryptionType.AesCbc256_HmacSha256_B64;
    const key = new SymmetricCryptoKey(makeStaticByteArray(64, 100), encType);
    const computedMac = new Uint8Array(1);
    const encBuffer = new EncArrayBuffer(makeStaticByteArray(60, encType));

    beforeEach(() => {
      cryptoFunctionService.hmac.mockResolvedValue(computedMac);
    });

    it("throws if no key is provided", () => {
      return expect(encryptService.decryptToBytes(encBuffer, null)).rejects.toThrow(
        "No encryption key",
      );
    });

    it("throws if no encrypted value is provided", () => {
      return expect(encryptService.decryptToBytes(null, key)).rejects.toThrow(
        "Nothing provided for decryption",
      );
    });

    it("decrypts data with provided key", async () => {
      const decryptedBytes = makeStaticByteArray(10, 200);

      cryptoFunctionService.hmac.mockResolvedValue(makeStaticByteArray(1));
      cryptoFunctionService.compare.mockResolvedValue(true);
      cryptoFunctionService.aesDecrypt.mockResolvedValueOnce(decryptedBytes);

      const actual = await encryptService.decryptToBytes(encBuffer, key);

      expect(cryptoFunctionService.aesDecrypt).toBeCalledWith(
        expect.toEqualBuffer(encBuffer.dataBytes),
        expect.toEqualBuffer(encBuffer.ivBytes),
        expect.toEqualBuffer(key.encKey),
        "cbc",
      );

      expect(actual).toEqualBuffer(decryptedBytes);
    });

    it("compares macs using CryptoFunctionService", async () => {
      const expectedMacData = new Uint8Array(
        encBuffer.ivBytes.byteLength + encBuffer.dataBytes.byteLength,
      );
      expectedMacData.set(new Uint8Array(encBuffer.ivBytes));
      expectedMacData.set(new Uint8Array(encBuffer.dataBytes), encBuffer.ivBytes.byteLength);

      await encryptService.decryptToBytes(encBuffer, key);

      expect(cryptoFunctionService.hmac).toBeCalledWith(
        expect.toEqualBuffer(expectedMacData),
        key.macKey,
        "sha256",
      );

      expect(cryptoFunctionService.compare).toBeCalledWith(
        expect.toEqualBuffer(encBuffer.macBytes),
        expect.toEqualBuffer(computedMac),
      );
    });

    it("returns null if macs don't match", async () => {
      cryptoFunctionService.compare.mockResolvedValue(false);

      const actual = await encryptService.decryptToBytes(encBuffer, key);
      expect(cryptoFunctionService.compare).toHaveBeenCalled();
      expect(cryptoFunctionService.aesDecrypt).not.toHaveBeenCalled();
      expect(actual).toBeNull();
    });

    it("returns null if encTypes don't match", async () => {
      key.encType = EncryptionType.AesCbc256_B64;
      cryptoFunctionService.compare.mockResolvedValue(true);

      const actual = await encryptService.decryptToBytes(encBuffer, key);

      expect(actual).toBeNull();
      expect(cryptoFunctionService.aesDecrypt).not.toHaveBeenCalled();
    });
  });

  describe("rsa", () => {
    const data = makeStaticByteArray(10, 100);
    const encryptedData = makeStaticByteArray(10, 150);
    const publicKey = makeStaticByteArray(10, 200);
    const privateKey = makeStaticByteArray(10, 250);
    const encString = makeEncString(encryptedData);

    function makeEncString(data: Uint8Array): EncString {
      return new EncString(EncryptionType.Rsa2048_OaepSha1_B64, Utils.fromBufferToB64(data));
    }

    describe("rsaEncrypt", () => {
      it("throws if no data is provided", () => {
        return expect(encryptService.rsaEncrypt(null, publicKey)).rejects.toThrow("No data");
      });

      it("throws if no public key is provided", () => {
        return expect(encryptService.rsaEncrypt(data, null)).rejects.toThrow("No public key");
      });

      it("encrypts data with provided key", async () => {
        cryptoFunctionService.rsaEncrypt.mockResolvedValue(encryptedData);

        const actual = await encryptService.rsaEncrypt(data, publicKey);

        expect(cryptoFunctionService.rsaEncrypt).toBeCalledWith(
          expect.toEqualBuffer(data),
          expect.toEqualBuffer(publicKey),
          "sha1",
        );

        expect(actual).toEqual(encString);
        expect(actual.dataBytes).toEqualBuffer(encryptedData);
      });
    });

    describe("rsaDecrypt", () => {
      it("throws if no data is provided", () => {
        return expect(encryptService.rsaDecrypt(null, privateKey)).rejects.toThrow("No data");
      });

      it("throws if no private key is provided", () => {
        return expect(encryptService.rsaDecrypt(encString, null)).rejects.toThrow("No private key");
      });

      it.each([
        EncryptionType.AesCbc256_B64,
        EncryptionType.AesCbc128_HmacSha256_B64,
        EncryptionType.AesCbc256_HmacSha256_B64,
      ])("throws if encryption type is %s", async (encType) => {
        encString.encryptionType = encType;

        await expect(encryptService.rsaDecrypt(encString, privateKey)).rejects.toThrow(
          "Invalid encryption type",
        );
      });

      it("decrypts data with provided key", async () => {
        cryptoFunctionService.rsaDecrypt.mockResolvedValue(data);

        const actual = await encryptService.rsaDecrypt(makeEncString(data), privateKey);

        expect(cryptoFunctionService.rsaDecrypt).toBeCalledWith(
          expect.toEqualBuffer(data),
          expect.toEqualBuffer(privateKey),
          "sha1",
        );

        expect(actual).toEqualBuffer(data);
      });
    });
  });

  describe("resolveLegacyKey", () => {
    it("creates a legacy key if required", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(32), EncryptionType.AesCbc256_B64);
      const encString = mock<EncString>();
      encString.encryptionType = EncryptionType.AesCbc128_HmacSha256_B64;

      const actual = encryptService.resolveLegacyKey(key, encString);

      const expected = new SymmetricCryptoKey(key.key, EncryptionType.AesCbc128_HmacSha256_B64);
      expect(actual).toEqual(expected);
    });

    it("does not create a legacy key if not required", async () => {
      const encType = EncryptionType.AesCbc256_HmacSha256_B64;
      const key = new SymmetricCryptoKey(makeStaticByteArray(64), encType);
      const encString = mock<EncString>();
      encString.encryptionType = encType;

      const actual = encryptService.resolveLegacyKey(key, encString);

      expect(actual).toEqual(key);
    });
  });
});
