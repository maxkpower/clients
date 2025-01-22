// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// eslint-disable-next-line import/no-restricted-paths
import { Injectable } from "@angular/core";

import { CipherFormUriService as CipherFormUriServiceAbstraction } from "../abstractions/cipher-form-uri.service";

@Injectable({
  providedIn: "root",
})
export class CipherFormUriService implements CipherFormUriServiceAbstraction {
  private _uri: string = "";

  constructor() {}

  /**
   * Getter for the current URI
   */
  get uri(): string {
    return this._uri;
  }

  /**
   * Setter for the URI
   * @param uri - The new URI to set
   */
  setUri(uri: string): void {
    this._uri = uri;
  }
}
