import { EVENTS } from "@bitwarden/common/autofill/constants";

import AutofillPageDetails from "../models/autofill-page-details";
import { InlineMenuElements } from "../overlay/abstractions/inline-menu-elements";
import { AutofillOverlayContentService } from "../services/abstractions/autofill-overlay-content.service";
import CollectAutofillContentService from "../services/collect-autofill-content.service";
import DomElementVisibilityService from "../services/dom-element-visibility.service";
import InsertAutofillContentService from "../services/insert-autofill-content.service";
import { sendExtensionMessage } from "../utils";

import {
  AutofillExtensionMessage,
  AutofillExtensionMessageHandlers,
  AutofillInit as AutofillInitInterface,
} from "./abstractions/autofill-init";

class AutofillInit implements AutofillInitInterface {
  private readonly sendExtensionMessage = sendExtensionMessage;
  private readonly autofillOverlayContentService: AutofillOverlayContentService | undefined;
  private readonly inlineMenuElements: InlineMenuElements | undefined;
  private readonly domElementVisibilityService: DomElementVisibilityService;
  private readonly collectAutofillContentService: CollectAutofillContentService;
  private readonly insertAutofillContentService: InsertAutofillContentService;
  private sendCollectDetailsMessageTimeout: number | NodeJS.Timeout | undefined;
  private readonly extensionMessageHandlers: AutofillExtensionMessageHandlers = {
    collectPageDetails: ({ message }) => this.collectPageDetails(message),
    collectPageDetailsImmediately: ({ message }) => this.collectPageDetails(message, true),
    fillForm: ({ message }) => this.fillForm(message),
  };

  /**
   * AutofillInit constructor. Initializes the DomElementVisibilityService,
   * CollectAutofillContentService and InsertAutofillContentService classes.
   *
   * @param autofillOverlayContentService - The autofill overlay content service, potentially undefined.
   * @param inlineMenuElements - The inline menu elements, potentially undefined.
   */
  constructor(
    autofillOverlayContentService?: AutofillOverlayContentService,
    inlineMenuElements?: InlineMenuElements,
  ) {
    this.autofillOverlayContentService = autofillOverlayContentService;
    if (this.autofillOverlayContentService) {
      this.extensionMessageHandlers = Object.assign(
        this.extensionMessageHandlers,
        this.autofillOverlayContentService.extensionMessageHandlers,
      );
    }

    this.inlineMenuElements = inlineMenuElements;
    if (this.inlineMenuElements) {
      this.extensionMessageHandlers = Object.assign(
        this.extensionMessageHandlers,
        this.inlineMenuElements.extensionMessageHandlers,
      );
    }

    this.domElementVisibilityService = new DomElementVisibilityService(this.inlineMenuElements);
    this.collectAutofillContentService = new CollectAutofillContentService(
      this.domElementVisibilityService,
      this.autofillOverlayContentService,
    );
    this.insertAutofillContentService = new InsertAutofillContentService(
      this.domElementVisibilityService,
      this.collectAutofillContentService,
    );
  }

  /**
   * Initializes the autofill content script, setting up
   * the extension message listeners. This method should
   * be called once when the content script is loaded.
   */
  init() {
    this.setupExtensionMessageListeners();
    this.autofillOverlayContentService?.init();
    this.collectPageDetailsOnLoad();
  }

  /**
   * Triggers a collection of the page details from the
   * background script, ensuring that autofill is ready
   * to act on the page.
   */
  private collectPageDetailsOnLoad() {
    const sendCollectDetailsMessage = () => {
      this.clearSendCollectDetailsMessageTimeout();
      this.sendCollectDetailsMessageTimeout = setTimeout(
        () => this.sendExtensionMessage("bgCollectPageDetails", { sender: "autofillInit" }),
        250,
      );
    };

    if (document.readyState === "complete") {
      sendCollectDetailsMessage();
    }

    globalThis.addEventListener(EVENTS.LOAD, sendCollectDetailsMessage);
  }

  /**
   * Collects the page details and sends them to the
   * extension background script. If the `sendDetailsInResponse`
   * parameter is set to true, the page details will be
   * returned to facilitate sending the details in the
   * response to the extension message.
   *
   * @param message - The extension message.
   * @param sendDetailsInResponse - Determines whether to send the details in the response.
   */
  private async collectPageDetails(
    message: AutofillExtensionMessage,
    sendDetailsInResponse = false,
  ): Promise<AutofillPageDetails | void> {
    const pageDetails: AutofillPageDetails =
      await this.collectAutofillContentService.getPageDetails();
    if (sendDetailsInResponse) {
      return pageDetails;
    }

    void chrome.runtime.sendMessage({
      command: "collectPageDetailsResponse",
      tab: message.tab,
      details: pageDetails,
      sender: message.sender,
    });
  }

  /**
   * Fills the form with the given fill script.
   *
   * @param {AutofillExtensionMessage} message
   */
  private async fillForm({ fillScript, pageDetailsUrl }: AutofillExtensionMessage) {
    if ((document.defaultView || window).location.href !== pageDetailsUrl) {
      return;
    }

    this.blurAndRemoveOverlay();
    await this.sendExtensionMessage("updateIsFieldCurrentlyFilling", {
      isFieldCurrentlyFilling: true,
    });
    await this.insertAutofillContentService.fillForm(fillScript);

    setTimeout(
      () =>
        this.sendExtensionMessage("updateIsFieldCurrentlyFilling", {
          isFieldCurrentlyFilling: false,
        }),
      250,
    );
  }

  /**
   * Blurs the most recent overlay field and removes the overlay. Used
   * in cases where the background unlock or vault item reprompt popout
   * is opened.
   */
  private blurAndRemoveOverlay() {
    if (!this.autofillOverlayContentService) {
      return;
    }

    this.autofillOverlayContentService.blurMostRecentOverlayField(true);
  }

  /**
   * Sets up the extension message listeners for the content script.
   */
  private setupExtensionMessageListeners() {
    chrome.runtime.onMessage.addListener(this.handleExtensionMessage);
  }

  /**
   * Handles the extension messages sent to the content script.
   *
   * @param message - The extension message.
   * @param sender - The message sender.
   * @param sendResponse - The send response callback.
   */
  private handleExtensionMessage = (
    message: AutofillExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ): boolean => {
    const command: string = message.command;
    const handler: CallableFunction | undefined = this.extensionMessageHandlers[command];
    if (!handler) {
      return;
    }

    const messageResponse = handler({ message, sender });
    if (!messageResponse) {
      return;
    }

    void Promise.resolve(messageResponse).then((response) => sendResponse(response));
    return true;
  };

  private clearSendCollectDetailsMessageTimeout() {
    if (this.sendCollectDetailsMessageTimeout) {
      clearTimeout(this.sendCollectDetailsMessageTimeout as number);
    }
  }

  /**
   * Handles destroying the autofill init content script. Removes all
   * listeners, timeouts, and object instances to prevent memory leaks.
   */
  destroy() {
    chrome.runtime.onMessage.removeListener(this.handleExtensionMessage);
    this.collectAutofillContentService.destroy();
    this.autofillOverlayContentService?.destroy();
    this.inlineMenuElements?.destroy();
    this.clearSendCollectDetailsMessageTimeout();
  }
}

export default AutofillInit;
