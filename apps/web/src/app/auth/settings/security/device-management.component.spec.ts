import { DestroyRef } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import { DeviceResponse } from "@bitwarden/common/auth/abstractions/devices/responses/device.response";
import { DeviceView } from "@bitwarden/common/auth/abstractions/devices/views/device.view";
import { DeviceType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogService, ToastService, TableModule, PopoverModule } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

import { DeviceManagementComponent } from "./device-management.component";

jest.mock("@bitwarden/components", () => ({
  ...jest.requireActual("@bitwarden/components"),
  TableDataSource: jest.fn().mockImplementation(() => ({
    data: [],
  })),
}));

describe("DeviceManagementComponent", () => {
  let component: DeviceManagementComponent;
  let fixture: ComponentFixture<DeviceManagementComponent>;
  let devicesService: MockProxy<DevicesServiceAbstraction>;
  let validationService: MockProxy<ValidationService>;
  let i18nService: MockProxy<I18nService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let mockDevices: DeviceView[];
  let destroyRefSpy: { onDestroy: jest.Mock; cleanup: (() => void) | null };

  const createDeviceResponse = (overrides: Partial<DeviceResponse> = {}): DeviceResponse =>
    ({
      id: "default-id",
      userId: "user1",
      name: "Default Device",
      type: DeviceType.Android,
      identifier: "default-identifier",
      creationDate: "2024-01-01",
      revisionDate: "2024-01-01",
      isTrusted: true,
      ...overrides,
    }) as DeviceResponse;

  const mockCurrentDevice = createDeviceResponse({
    id: "current-device",
    name: "Current Device",
    identifier: "current-identifier",
  });

  // Mock ResizeObserver since bit-table-scroll uses it internally
  const mockResizeObserver = jest.fn(function (callback) {
    return {
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    };
  });

  beforeAll(() => {
    global.ResizeObserver = mockResizeObserver;
  });

  afterAll(() => {
    delete (global as any).ResizeObserver;
  });

  beforeEach(async () => {
    jest.useFakeTimers();
    devicesService = mock<DevicesServiceAbstraction>();
    validationService = mock<ValidationService>();
    i18nService = mock<I18nService>();
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    destroyRefSpy = {
      onDestroy: jest.fn((fn: () => void) => {
        destroyRefSpy.cleanup = fn;
      }),
      cleanup: null,
    };

    i18nService.t.mockImplementation((key) => key);

    const device1Response = createDeviceResponse({
      id: "1",
      name: "Device 1",
      identifier: "id1",
    });

    const device2Response = createDeviceResponse({
      id: "2",
      name: "Device 2",
      type: DeviceType.ChromeBrowser,
      identifier: "id2",
      isTrusted: false,
    });

    mockDevices = [new DeviceView(device1Response), new DeviceView(device2Response)];

    devicesService.getCurrentDevice$.mockReturnValue(of(mockCurrentDevice));
    devicesService.getDevices$.mockReturnValue(of(mockDevices));

    await TestBed.configureTestingModule({
      imports: [DeviceManagementComponent, TableModule, PopoverModule, SharedModule],
      providers: [
        {
          provide: DevicesServiceAbstraction,
          useValue: devicesService,
        },
        {
          provide: I18nService,
          useValue: i18nService,
        },
        {
          provide: DialogService,
          useValue: dialogService,
        },
        {
          provide: ToastService,
          useValue: toastService,
        },
        {
          provide: ValidationService,
          useValue: validationService,
        },
        {
          provide: DestroyRef,
          useValue: destroyRefSpy,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceManagementComponent);
    component = fixture.componentInstance;

    jest.advanceTimersByTime(0);
  });

  afterEach(() => {
    if (destroyRefSpy.cleanup) {
      destroyRefSpy.cleanup();
    }
    fixture.destroy();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("creates the component", () => {
    expect(component).toBeTruthy();
  });

  describe("real-time updates", () => {
    const REFRESH_INTERVAL = 10000;

    beforeEach(() => {
      jest.clearAllMocks();
      devicesService.getDevices$.mockReturnValue(of(mockDevices));
      jest.advanceTimersByTime(0);
    });

    it("initializes with current device data", () => {
      expect(component.dataSource.data.length).toBe(2);
      expect(component.loading).toBe(false);
    });

    it("automatically refreshes when new devices are available", () => {
      // Initial state
      expect(component.dataSource.data.length).toBe(2);

      // Simulate new device available after refresh interval
      const updatedDevices = [...mockDevices, mockDevices[0]];
      devicesService.getDevices$.mockReturnValue(of(updatedDevices));

      jest.advanceTimersByTime(REFRESH_INTERVAL);

      expect(component.dataSource.data.length).toBe(3);
    });

    it("handles errors with retry and proper reporting", () => {
      const error = new Error("Test error");
      let errorCount = 0;

      devicesService.getCurrentDevice$.mockImplementation(() => {
        errorCount++;
        return throwError(() => error);
      });

      devicesService.getDevices$.mockReturnValue(of([]));

      fixture = TestBed.createComponent(DeviceManagementComponent);
      component = fixture.componentInstance;

      jest.advanceTimersByTime(0);

      expect(validationService.showError).toHaveBeenCalledWith(error);
      expect(component.loading).toBe(false);

      // Verify refresh
      jest.advanceTimersByTime(REFRESH_INTERVAL);
      expect(validationService.showError).toHaveBeenCalledTimes(3);
      expect(component.loading).toBe(false);

      // Verify retries occurred
      expect(errorCount).toBeGreaterThan(1);
    });

    it("updates device status when a new auth request is received", () => {
      const device2WithAuthResponse = createDeviceResponse({
        id: "device-2",
        name: "Device 2",
        identifier: "identifier-2",
        isTrusted: false,
        devicePendingAuthRequest: {
          id: "auth-1",
          creationDate: "2024-01-01",
        },
      });

      const deviceWithAuthRequest = {
        ...device2WithAuthResponse,
        response: device2WithAuthResponse,
      } as DeviceView;

      const currentDeviceView = {
        ...mockCurrentDevice,
        response: mockCurrentDevice,
      } as DeviceView;

      devicesService.getCurrentDevice$.mockReturnValue(of(mockCurrentDevice));
      devicesService.getDevices$.mockReturnValue(of([currentDeviceView, deviceWithAuthRequest]));

      jest.advanceTimersByTime(REFRESH_INTERVAL);

      // Verify the device has a pending auth request
      const device = component.dataSource.data.find((d) => d.id === "device-2");
      expect(device?.hasPendingAuthRequest).toBe(true);
      expect(device?.devicePendingAuthRequest?.id).toBe("auth-1");
    });
  });
});
