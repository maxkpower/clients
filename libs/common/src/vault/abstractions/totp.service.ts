export abstract class TotpService {
  abstract getCode(key: string | undefined): Promise<string | undefined>;
  abstract getTimeInterval(key: string): number;
}
