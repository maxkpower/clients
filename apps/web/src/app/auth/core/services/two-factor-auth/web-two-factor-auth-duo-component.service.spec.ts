import { MockProxy, mock } from "jest-mock-extended";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { WebTwoFactorAuthDuoComponentService } from "./web-two-factor-auth-duo-component.service";

describe("WebTwoFactorAuthDuoComponentService", () => {
  let webTwoFactorAuthDuoComponentService: WebTwoFactorAuthDuoComponentService;

  let platformUtilsService: MockProxy<PlatformUtilsService>;

  let mockBroadcastChannel: jest.Mocked<BroadcastChannel>;

  beforeEach(() => {
    jest.clearAllMocks();

    platformUtilsService = mock<PlatformUtilsService>();

    mockBroadcastChannel = {
      name: "duoResult",
      postMessage: jest.fn().mockImplementation(function (this: BroadcastChannel, data) {
        // Simulate the message being posted by calling onmessage with the data
        if (this.onmessage) {
          this.onmessage({
            data,
            lastEventId: "",
            origin: "",
            ports: [],
            source: null,
            currentTarget: null,
            bubbles: false,
            cancelable: false,
            cancelBubble: false,
            composed: false,
            defaultPrevented: false,
            eventPhase: 0,
            isTrusted: false,
            returnValue: false,
            srcElement: null,
            target: null,
            timeStamp: Date.now(),
            type: "message",
            composedPath: function () {
              return [];
            },
            initEvent: function (type: string, bubbles?: boolean, cancelable?: boolean): void {
              throw new Error("Function not implemented.");
            },
            preventDefault: function (): void {
              throw new Error("Function not implemented.");
            },
            stopImmediatePropagation: function (): void {
              throw new Error("Function not implemented.");
            },
            stopPropagation: function (): void {
              throw new Error("Function not implemented.");
            },
            NONE: 0,
            CAPTURING_PHASE: 1,
            AT_TARGET: 2,
            BUBBLING_PHASE: 3,
            initMessageEvent: function (
              type: string,
              bubbles?: boolean,
              cancelable?: boolean,
              data?: any,
              origin?: string,
              lastEventId?: string,
              source?: MessageEventSource,
              ports?: MessagePort[],
            ): void {
              throw new Error("Function not implemented.");
            },
          });
        }
      }),
      close: jest.fn(),
      onmessage: jest.fn(),
      onmessageerror: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };

    global.BroadcastChannel = jest.fn(() => mockBroadcastChannel);

    webTwoFactorAuthDuoComponentService = new WebTwoFactorAuthDuoComponentService(
      platformUtilsService,
    );
  });

  afterEach(() => {
    // reset global object
    jest.restoreAllMocks();
  });

  describe("listenForDuo2faResult$", () => {
    // TODO: figure out how to test this
    // it("should return an observable that emits a duo 2FA result when a duo result message is received", (done) => {
    //   const expectedResult: Duo2faResult = {
    //     code: "123456",
    //     state: "verified",
    //     token: "123456|verified",
    //   };
    //   const mockMessageEvent = new MessageEvent("message", {
    //     data: {
    //       code: "123456",
    //       state: "verified",
    //     },
    //     lastEventId: "",
    //     origin: "",
    //     ports: [],
    //     source: null,
    //   });
    //   webTwoFactorAuthDuoComponentService.listenForDuo2faResult$().subscribe((result) => {
    //     expect(result).toEqual(expectedResult);
    //     done();
    //   });
    //   // Trigger the message event
    //   mockBroadcastChannel.postMessage(mockMessageEvent.data);
    // });
  });

  describe("launchDuoFrameless", () => {
    it("should launch the duo frameless URL", async () => {
      const duoFramelessUrl = "https://duo.com/frameless";
      await webTwoFactorAuthDuoComponentService.launchDuoFrameless(duoFramelessUrl);

      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(duoFramelessUrl);
    });
  });
});
