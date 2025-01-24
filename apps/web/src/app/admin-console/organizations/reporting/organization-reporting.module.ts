import { NgModule } from "@angular/core";

import { CipherFormConfigService, DefaultCipherFormConfigService } from "@bitwarden/vault";

import { LooseComponentsModule } from "../../../shared";
import { SharedModule } from "../../../shared/shared.module";
import { ReportsSharedModule } from "../../../tools/reports";
import { RoutedVaultFilterBridgeService } from "../../../vault/individual-vault/vault-filter/services/routed-vault-filter-bridge.service";
import { RoutedVaultFilterService } from "../../../vault/individual-vault/vault-filter/services/routed-vault-filter.service";
import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";

import { OrganizationReportingRoutingModule } from "./organization-reporting-routing.module";
import { ReportsHomeComponent } from "./reports-home.component";

@NgModule({
  imports: [
    SharedModule,
    ReportsSharedModule,
    OrganizationReportingRoutingModule,
    LooseComponentsModule,
  ],
  declarations: [ReportsHomeComponent],
  providers: [
    // {
    //   provide: CipherFormConfigService,
    //   useClass: AdminConsoleCipherFormConfigService,
    // },
    // AdminConsoleCipherFormConfigService,
    // RoutedVaultFilterService,
    // RoutedVaultFilterBridgeService,
  ],
})
export class OrganizationReportingModule {}
