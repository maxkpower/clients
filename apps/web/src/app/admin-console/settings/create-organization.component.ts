// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { first } from "rxjs/operators";

import { PlanType, ProductTierType, ProductType } from "@bitwarden/common/billing/enums";

import { OrganizationPlansComponent } from "../../billing";
import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

@Component({
  templateUrl: "create-organization.component.html",
  standalone: true,
  imports: [SharedModule, OrganizationPlansComponent, HeaderModule],
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class CreateOrganizationComponent implements OnInit {
  @ViewChild(OrganizationPlansComponent, { static: true })
  orgPlansComponent: OrganizationPlansComponent;

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      if (qParams.plan === "families" || qParams.productTier == ProductTierType.Families) {
        this.orgPlansComponent.plan = PlanType.FamiliesAnnually;
        this.orgPlansComponent.productTier = ProductTierType.Families;
      } else if (qParams.plan === "teams" || qParams.productTier == ProductTierType.Teams) {
        this.orgPlansComponent.plan = PlanType.TeamsAnnually;
        this.orgPlansComponent.productTier = ProductTierType.Teams;
      } else if (
        qParams.plan === "teamsStarter" ||
        qParams.productTier == ProductTierType.TeamsStarter
      ) {
        this.orgPlansComponent.plan = PlanType.TeamsStarter;
        this.orgPlansComponent.productTier = ProductTierType.TeamsStarter;
      } else if (
        qParams.plan === "enterprise" ||
        qParams.productTier == ProductTierType.Enterprise
      ) {
        this.orgPlansComponent.plan = PlanType.EnterpriseAnnually;
        this.orgPlansComponent.productTier = ProductTierType.Enterprise;
      }

      if (qParams.product == ProductType.SecretsManager) {
        await this.waitForPlansToLoad();
        setTimeout(() => {
          if (this.orgPlansComponent.selectedSecretsManagerPlan) {
            this.orgPlansComponent.secretsManagerSubscription.patchValue({
              enabled: true,
              userSeats: 1,
              additionalServiceAccounts: 0,
            });
          }
        });
      }
    });
  }

  private async waitForPlansToLoad(): Promise<void> {
    return new Promise<void>((resolve) => {
      const checkPlans = () => {
        if (
          this.orgPlansComponent.passwordManagerPlans?.length > 0 &&
          this.orgPlansComponent.secretsManagerPlans?.length > 0
        ) {
          resolve();
        } else {
          setTimeout(checkPlans, 100);
        }
      };
      checkPlans();
    });
  }
}
