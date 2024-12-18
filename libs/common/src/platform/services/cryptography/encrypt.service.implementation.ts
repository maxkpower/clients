// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

// eslint-disable-next-line no-restricted-imports -- TODO MDG: fix this
import { SdkPureClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";

import { Utils } from "../../../platform/misc/utils";
import { CryptoFunctionService } from "../../abstractions/crypto-function.service";
import { EncryptService } from "../../abstractions/encrypt.service";
import { LogService } from "../../abstractions/log.service";
import { EncryptionType } from "../../enums";
import { Decryptable } from "../../interfaces/decryptable.interface";
import { Encrypted } from "../../interfaces/encrypted";
import { InitializerMetadata } from "../../interfaces/initializer-metadata.interface";
import { EncArrayBuffer } from "../../models/domain/enc-array-buffer";
import { EncString } from "../../models/domain/enc-string";
import { EncryptedObject } from "../../models/domain/encrypted-object";
import { SymmetricCryptoKey } from "../../models/domain/symmetric-crypto-key";

export class EncryptServiceImplementation implements EncryptService {
  constructor(
    protected readonly sdkPureClientFactory: SdkPureClientFactory,
    protected cryptoFunctionService: CryptoFunctionService,
    protected logService: LogService,
    protected logMacFailures: boolean,
  ) {}

  async encrypt(plainValue: string | Uint8Array, key: SymmetricCryptoKey): Promise<EncString> {
    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    if (plainValue == null) {
      return Promise.resolve(null);
    }

    let plainBuf: Uint8Array;
    if (typeof plainValue === "string") {
      plainBuf = Utils.fromUtf8ToArray(plainValue);
    } else {
      plainBuf = plainValue;
    }

    const encObj = await this.aesEncrypt(plainBuf, key);
    const iv = Utils.fromBufferToB64(encObj.iv);
    const data = Utils.fromBufferToB64(encObj.data);
    const mac = encObj.mac != null ? Utils.fromBufferToB64(encObj.mac) : null;
    return new EncString(encObj.key.encType, data, iv, mac);
  }

  async encryptToBytes(plainValue: Uint8Array, key: SymmetricCryptoKey): Promise<EncArrayBuffer> {
    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    const encValue = await this.aesEncrypt(plainValue, key);
    let macLen = 0;
    if (encValue.mac != null) {
      macLen = encValue.mac.byteLength;
    }

    const encBytes = new Uint8Array(1 + encValue.iv.byteLength + macLen + encValue.data.byteLength);
    encBytes.set([encValue.key.encType]);
    encBytes.set(new Uint8Array(encValue.iv), 1);
    if (encValue.mac != null) {
      encBytes.set(new Uint8Array(encValue.mac), 1 + encValue.iv.byteLength);
    }

    encBytes.set(new Uint8Array(encValue.data), 1 + encValue.iv.byteLength + macLen);
    return new EncArrayBuffer(encBytes);
  }

  async decryptToUtf8(
    encString: EncString,
    key: SymmetricCryptoKey,
    decryptContext: string = "no context",
  ): Promise<string> {
    if (key == null) {
      throw new Error("No key provided for decryption.");
    }

    key = this.resolveLegacyKey(key, encString);

    const pure = await this.sdkPureClientFactory.createPureSdkClient();
    const decrypted = pure.crypto().symmetric_decrypt(encString.encryptedString, key.keyB64);

    return decrypted;
  }

  async decryptToBytes(encThing: Encrypted, key: SymmetricCryptoKey): Promise<Uint8Array> {
    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    if (encThing == null) {
      throw new Error("Nothing provided for decryption.");
    }

    key = this.resolveLegacyKey(key, encThing);

    const pure = await this.sdkPureClientFactory.createPureSdkClient();
    const encString = new EncString(
      encThing.encryptionType,
      Utils.fromBufferToB64(encThing.dataBytes),
      Utils.fromBufferToB64(encThing.ivBytes),
      Utils.fromBufferToB64(encThing.macBytes),
    );
    const decrypted = pure
      .crypto()
      .symmetric_decrypt_to_bytes(encString.encryptedString, key.keyB64);

    return decrypted ?? null;
  }

  async rsaEncrypt(data: Uint8Array, publicKey: Uint8Array): Promise<EncString> {
    if (data == null) {
      throw new Error("No data provided for encryption.");
    }

    if (publicKey == null) {
      throw new Error("No public key provided for encryption.");
    }
    const encrypted = await this.cryptoFunctionService.rsaEncrypt(data, publicKey, "sha1");
    return new EncString(EncryptionType.Rsa2048_OaepSha1_B64, Utils.fromBufferToB64(encrypted));
  }

  async rsaDecrypt(data: EncString, privateKey: Uint8Array): Promise<Uint8Array> {
    if (data == null) {
      throw new Error("[Encrypt service] rsaDecrypt: No data provided for decryption.");
    }

    let algorithm: "sha1" | "sha256";
    switch (data.encryptionType) {
      case EncryptionType.Rsa2048_OaepSha1_B64:
      case EncryptionType.Rsa2048_OaepSha1_HmacSha256_B64:
        algorithm = "sha1";
        break;
      case EncryptionType.Rsa2048_OaepSha256_B64:
      case EncryptionType.Rsa2048_OaepSha256_HmacSha256_B64:
        algorithm = "sha256";
        break;
      default:
        throw new Error("Invalid encryption type.");
    }

    if (privateKey == null) {
      throw new Error("[Encrypt service] rsaDecrypt: No private key provided for decryption.");
    }

    return this.cryptoFunctionService.rsaDecrypt(data.dataBytes, privateKey, algorithm);
  }

  /**
   * @deprecated Replaced by BulkEncryptService (PM-4154)
   */
  async decryptItems<T extends InitializerMetadata>(
    items: Decryptable<T>[],
    key: SymmetricCryptoKey,
  ): Promise<T[]> {
    if (items == null || items.length < 1) {
      return [];
    }

    // don't use promise.all because this task is not io bound
    const results = [];
    for (let i = 0; i < items.length; i++) {
      results.push(await items[i].decrypt(key));
    }
    return results;
  }

  async hash(value: string | Uint8Array, algorithm: "sha1" | "sha256" | "sha512"): Promise<string> {
    const hashArray = await this.cryptoFunctionService.hash(value, algorithm);
    return Utils.fromBufferToB64(hashArray);
  }

  private async aesEncrypt(data: Uint8Array, key: SymmetricCryptoKey): Promise<EncryptedObject> {
    const pure = await this.sdkPureClientFactory.createPureSdkClient();
    const encString = new EncString(
      pure.crypto().symmetric_encrypt(Utils.fromBufferToUtf8(data), key.keyB64),
    );
    const obj = new EncryptedObject();
    obj.key = key;
    obj.iv = encString.ivBytes;
    obj.data = encString.dataBytes;

    if (obj.key.macKey != null) {
      obj.mac = encString.macBytes;
    }
    return obj;
  }

  private logMacFailed(msg: string) {
    if (this.logMacFailures) {
      this.logService.error(msg);
    }
  }

  /**
   * Transform into new key for the old encrypt-then-mac scheme if required, otherwise return the current key unchanged
   * @param encThing The encrypted object (e.g. encString or encArrayBuffer) that you want to decrypt
   */
  resolveLegacyKey(key: SymmetricCryptoKey, encThing: Encrypted): SymmetricCryptoKey {
    if (
      encThing.encryptionType === EncryptionType.AesCbc128_HmacSha256_B64 &&
      key.encType === EncryptionType.AesCbc256_B64
    ) {
      return new SymmetricCryptoKey(key.key, EncryptionType.AesCbc128_HmacSha256_B64);
    }

    return key;
  }
}
