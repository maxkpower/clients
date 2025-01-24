// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { InitializerKey } from "@bitwarden/common/key-management/crypto/enums/initializer-key";
import { Decryptable } from "@bitwarden/common/key-management/crypto/interfaces/decryptable.interface";
import { EncString } from "@bitwarden/common/key-management/crypto/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/key-management/crypto/models/domain/symmetric-crypto-key";

import { Utils } from "../../../platform/misc/utils";
import Domain from "../../../platform/models/domain/domain-base";
import { CipherRepromptType } from "../../enums/cipher-reprompt-type";
import { CipherType } from "../../enums/cipher-type";
import { CipherData } from "../data/cipher.data";
import { LocalData } from "../data/local.data";
import { CipherView } from "../view/cipher.view";

import { Attachment } from "./attachment";
import { Card } from "./card";
import { Field } from "./field";
import { Identity } from "./identity";
import { Login } from "./login";
import { Password } from "./password";
import { SecureNote } from "./secure-note";
import { SshKey } from "./ssh-key";

export class Cipher extends Domain implements Decryptable<CipherView> {
  readonly initializerKey = InitializerKey.Cipher;

  id: string;
  organizationId: string;
  folderId: string;
  name: EncString;
  notes: EncString;
  type: CipherType;
  favorite: boolean;
  organizationUseTotp: boolean;
  edit: boolean;
  viewPassword: boolean;
  revisionDate: Date;
  localData: LocalData;
  login: Login;
  identity: Identity;
  card: Card;
  secureNote: SecureNote;
  sshKey: SshKey;
  attachments: Attachment[];
  fields: Field[];
  passwordHistory: Password[];
  collectionIds: string[];
  creationDate: Date;
  deletedDate: Date;
  reprompt: CipherRepromptType;
  key: EncString;

  constructor(obj?: CipherData, localData: LocalData = null) {
    super();
    if (obj == null) {
      return;
    }

    this.buildDomainModel(
      this,
      obj,
      {
        id: null,
        organizationId: null,
        folderId: null,
        name: null,
        notes: null,
        key: null,
      },
      ["id", "organizationId", "folderId"],
    );

    this.type = obj.type;
    this.favorite = obj.favorite;
    this.organizationUseTotp = obj.organizationUseTotp;
    this.edit = obj.edit;
    if (obj.viewPassword != null) {
      this.viewPassword = obj.viewPassword;
    } else {
      this.viewPassword = true; // Default for already synced Ciphers without viewPassword
    }
    this.revisionDate = obj.revisionDate != null ? new Date(obj.revisionDate) : null;
    this.collectionIds = obj.collectionIds;
    this.localData = localData;
    this.creationDate = obj.creationDate != null ? new Date(obj.creationDate) : null;
    this.deletedDate = obj.deletedDate != null ? new Date(obj.deletedDate) : null;
    this.reprompt = obj.reprompt;

    switch (this.type) {
      case CipherType.Login:
        this.login = new Login(obj.login);
        break;
      case CipherType.SecureNote:
        this.secureNote = new SecureNote(obj.secureNote);
        break;
      case CipherType.Card:
        this.card = new Card(obj.card);
        break;
      case CipherType.Identity:
        this.identity = new Identity(obj.identity);
        break;
      case CipherType.SshKey:
        this.sshKey = new SshKey(obj.sshKey);
        break;
      default:
        break;
    }

    if (obj.attachments != null) {
      this.attachments = obj.attachments.map((a) => new Attachment(a));
    } else {
      this.attachments = null;
    }

    if (obj.fields != null) {
      this.fields = obj.fields.map((f) => new Field(f));
    } else {
      this.fields = null;
    }

    if (obj.passwordHistory != null) {
      this.passwordHistory = obj.passwordHistory.map((ph) => new Password(ph));
    } else {
      this.passwordHistory = null;
    }
  }

  // We are passing the organizationId into the EncString.decrypt() method here, but because the encKey will always be
  // present and so the organizationId will not be used.
  // We will refactor the EncString.decrypt() in https://bitwarden.atlassian.net/browse/PM-3762 to remove the dependency on the organizationId.
  async decrypt(encKey: SymmetricCryptoKey): Promise<CipherView> {
    const model = new CipherView(this);
    let bypassValidation = true;

    if (this.key != null) {
      const encryptService = Utils.getContainerService().getEncryptService();
      const keyBytes = await encryptService.decryptToBytes(
        this.key,
        encKey,
        `Cipher Id: ${this.id}; Content: CipherKey; IsEncryptedByOrgKey: ${this.organizationId != null}`,
      );
      if (keyBytes == null) {
        model.name = "[error: cannot decrypt]";
        model.decryptionFailure = true;
        return model;
      }
      encKey = new SymmetricCryptoKey(keyBytes);
      bypassValidation = false;
    }

    await this.decryptObj(
      model,
      {
        name: null,
        notes: null,
      },
      this.organizationId,
      encKey,
    );

    switch (this.type) {
      case CipherType.Login:
        model.login = await this.login.decrypt(
          this.organizationId,
          bypassValidation,
          `Cipher Id: ${this.id}`,
          encKey,
        );
        break;
      case CipherType.SecureNote:
        model.secureNote = await this.secureNote.decrypt(
          this.organizationId,
          `Cipher Id: ${this.id}`,
          encKey,
        );
        break;
      case CipherType.Card:
        model.card = await this.card.decrypt(this.organizationId, `Cipher Id: ${this.id}`, encKey);
        break;
      case CipherType.Identity:
        model.identity = await this.identity.decrypt(
          this.organizationId,
          `Cipher Id: ${this.id}`,
          encKey,
        );
        break;
      case CipherType.SshKey:
        model.sshKey = await this.sshKey.decrypt(
          this.organizationId,
          `Cipher Id: ${this.id}`,
          encKey,
        );
        break;
      default:
        break;
    }

    if (this.attachments != null && this.attachments.length > 0) {
      const attachments: any[] = [];
      await this.attachments.reduce((promise, attachment) => {
        return promise
          .then(() => {
            return attachment.decrypt(this.organizationId, `Cipher Id: ${this.id}`, encKey);
          })
          .then((decAttachment) => {
            attachments.push(decAttachment);
          });
      }, Promise.resolve());
      model.attachments = attachments;
    }

    if (this.fields != null && this.fields.length > 0) {
      const fields: any[] = [];
      await this.fields.reduce((promise, field) => {
        return promise
          .then(() => {
            return field.decrypt(this.organizationId, encKey);
          })
          .then((decField) => {
            fields.push(decField);
          });
      }, Promise.resolve());
      model.fields = fields;
    }

    if (this.passwordHistory != null && this.passwordHistory.length > 0) {
      const passwordHistory: any[] = [];
      await this.passwordHistory.reduce((promise, ph) => {
        return promise
          .then(() => {
            return ph.decrypt(this.organizationId, encKey);
          })
          .then((decPh) => {
            passwordHistory.push(decPh);
          });
      }, Promise.resolve());
      model.passwordHistory = passwordHistory;
    }

    return model;
  }

  toCipherData(): CipherData {
    const c = new CipherData();
    c.id = this.id;
    c.organizationId = this.organizationId;
    c.folderId = this.folderId;
    c.edit = this.edit;
    c.viewPassword = this.viewPassword;
    c.organizationUseTotp = this.organizationUseTotp;
    c.favorite = this.favorite;
    c.revisionDate = this.revisionDate != null ? this.revisionDate.toISOString() : null;
    c.type = this.type;
    c.collectionIds = this.collectionIds;
    c.creationDate = this.creationDate != null ? this.creationDate.toISOString() : null;
    c.deletedDate = this.deletedDate != null ? this.deletedDate.toISOString() : null;
    c.reprompt = this.reprompt;
    c.key = this.key?.encryptedString;

    this.buildDataModel(this, c, {
      name: null,
      notes: null,
    });

    switch (c.type) {
      case CipherType.Login:
        c.login = this.login.toLoginData();
        break;
      case CipherType.SecureNote:
        c.secureNote = this.secureNote.toSecureNoteData();
        break;
      case CipherType.Card:
        c.card = this.card.toCardData();
        break;
      case CipherType.Identity:
        c.identity = this.identity.toIdentityData();
        break;
      case CipherType.SshKey:
        c.sshKey = this.sshKey.toSshKeyData();
        break;
      default:
        break;
    }

    if (this.fields != null) {
      c.fields = this.fields.map((f) => f.toFieldData());
    }
    if (this.attachments != null) {
      c.attachments = this.attachments.map((a) => a.toAttachmentData());
    }
    if (this.passwordHistory != null) {
      c.passwordHistory = this.passwordHistory.map((ph) => ph.toPasswordHistoryData());
    }
    return c;
  }

  static fromJSON(obj: Jsonify<Cipher>) {
    if (obj == null) {
      return null;
    }

    const domain = new Cipher();
    const name = EncString.fromJSON(obj.name);
    const notes = EncString.fromJSON(obj.notes);
    const revisionDate = obj.revisionDate == null ? null : new Date(obj.revisionDate);
    const deletedDate = obj.deletedDate == null ? null : new Date(obj.deletedDate);
    const attachments = obj.attachments?.map((a: any) => Attachment.fromJSON(a));
    const fields = obj.fields?.map((f: any) => Field.fromJSON(f));
    const passwordHistory = obj.passwordHistory?.map((ph: any) => Password.fromJSON(ph));
    const key = EncString.fromJSON(obj.key);

    Object.assign(domain, obj, {
      name,
      notes,
      revisionDate,
      deletedDate,
      attachments,
      fields,
      passwordHistory,
      key,
    });

    switch (obj.type) {
      case CipherType.Card:
        domain.card = Card.fromJSON(obj.card);
        break;
      case CipherType.Identity:
        domain.identity = Identity.fromJSON(obj.identity);
        break;
      case CipherType.Login:
        domain.login = Login.fromJSON(obj.login);
        break;
      case CipherType.SecureNote:
        domain.secureNote = SecureNote.fromJSON(obj.secureNote);
        break;
      case CipherType.SshKey:
        domain.sshKey = SshKey.fromJSON(obj.sshKey);
        break;
      default:
        break;
    }

    return domain;
  }
}
