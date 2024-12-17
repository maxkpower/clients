import { firstValueFrom, Observable } from "rxjs";

import { Destination, Link } from "@bitwarden/sdk-internal";

/**
 * A caching wrapper around JS transports
 */
export class IpcLink implements Link {
  constructor(
    private _send: (data: Uint8Array) => Promise<void>,
    private _receive: Observable<Uint8Array>,
    private destinations: Destination[],
  ) {}

  send(data: Uint8Array): Promise<void> {
    return this._send(data);
  }

  receive(): Promise<Uint8Array> {
    return firstValueFrom(this._receive);
  }

  availableDestinations(): Destination[] {
    return this.destinations;
  }
}
