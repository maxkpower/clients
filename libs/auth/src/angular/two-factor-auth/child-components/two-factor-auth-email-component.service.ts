export abstract class TwoFactorAuthEmailComponentService {
  /**
   * Optionally shows a warning to the user that they might need to popout the
   * window to complete email 2FA.
   */
  abstract openPopoutIfApprovedForEmail2fa?(): Promise<void>;
}
