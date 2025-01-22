import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { BitwardenClient } from "@bitwarden/sdk-internal";

import { SdkService } from "../../platform/abstractions/sdk/sdk.service";

import { TotpService } from "./totp.service";

describe("TotpService", () => {
  let totpService: TotpService;

  const sdkService = mock<SdkService>();
  const mockBitwardenClient = {
    vault: () => ({
      totp: () => ({
        generate_totp: jest.fn().mockResolvedValue({
          code: "123456",
          period: 30,
        }),
      }),
    }),
  };

  beforeEach(() => {
    sdkService.client$ = of(mockBitwardenClient as unknown as BitwardenClient);

    totpService = new TotpService(sdkService);

    // TOTP is time-based, so we need to mock the current time
    jest.useFakeTimers({
      now: new Date("2023-01-01T00:00:00.000Z"),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("should return undefined if key is undefined", async () => {
    const result = await totpService.getCode(undefined);
    expect(result).toBeUndefined();
  });

  it("should return TOTP response when is provided", async () => {
    const result = await totpService.getCode("WQIQ25BRKZYCJVYP");
    expect(result).toEqual({ code: "123456", period: 30 });
  });

  it("should throw error when SDK is undefined", async () => {
    sdkService.client$ = of(undefined);
    await expect(totpService.getCode("WQIQ25BRKZYCJVYP")).rejects.toThrow("SDK is undefined");
  });
});
