import { OverlayButtonWindowMessageHandlers } from "./autofill-overlay-button";
import { OverlayListWindowMessageHandlers } from "./autofill-overlay-list";

type AutofillOverlayPageElementWindowMessageHandlers =
  | OverlayButtonWindowMessageHandlers
  | OverlayListWindowMessageHandlers;

type AutofillOverlayPageElementWindowMessage = {
  [key: string]: any;
  command: string;
  overlayCipherId?: string;
  height?: number;
};

export { AutofillOverlayPageElementWindowMessageHandlers, AutofillOverlayPageElementWindowMessage };
