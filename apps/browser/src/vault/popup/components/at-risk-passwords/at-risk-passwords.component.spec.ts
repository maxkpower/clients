import { Component, Input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";

import { AtRiskPasswordsComponent } from "./at-risk-passwords.component";

@Component({
  standalone: true,
  selector: "popup-header",
  template: `<ng-content></ng-content>`,
})
class MockPopupHeaderComponent {
  @Input() pageTitle: string | undefined;
  @Input() backAction: (() => void) | undefined;
}

@Component({
  standalone: true,
  selector: "popup-page",
  template: `<ng-content></ng-content>`,
})
class MockPopupPageComponent {}

describe("AtRiskPasswordsComponent", () => {
  let component: AtRiskPasswordsComponent;
  let fixture: ComponentFixture<AtRiskPasswordsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AtRiskPasswordsComponent],
      providers: [
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    })
      .overrideComponent(AtRiskPasswordsComponent, {
        remove: {
          imports: [PopupHeaderComponent, PopupPageComponent],
        },
        add: {
          imports: [MockPopupHeaderComponent, MockPopupPageComponent],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AtRiskPasswordsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
