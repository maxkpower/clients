import { Injectable } from "@angular/core";

import { BrowserApi } from "../../browser/browserApi";

@Injectable()
export class PopupUtilsService {
  constructor(private privateMode: boolean = false) {}

  inSidebar(win: Window): boolean {
    return win.location.search !== "" && win.location.search.indexOf("uilocation=sidebar") > -1;
  }

  inTab(win: Window): boolean {
    return win.location.search !== "" && win.location.search.indexOf("uilocation=tab") > -1;
  }

  inPopout(win: Window): boolean {
    return win.location.search !== "" && win.location.search.indexOf("uilocation=popout") > -1;
  }

  inPopup(win: Window): boolean {
    return (
      win.location.search === "" ||
      win.location.search.indexOf("uilocation=") === -1 ||
      win.location.search.indexOf("uilocation=popup") > -1
    );
  }

  inPrivateMode(): boolean {
    return this.privateMode;
  }

  getContentScrollY(win: Window, scrollingContainer = "main"): number {
    const content = win.document.getElementsByTagName(scrollingContainer)[0];
    return content.scrollTop;
  }

  setContentScrollY(win: Window, scrollY: number, scrollingContainer = "main"): void {
    if (scrollY != null) {
      const content = win.document.getElementsByTagName(scrollingContainer)[0];
      content.scrollTop = scrollY;
    }
  }

  popOut(win: Window, href: string = null, options: { center?: boolean } = {}): void {
    if (href === null) {
      href = win.location.href;
    }

    if (typeof chrome !== "undefined" && chrome.windows && chrome.windows.create) {
      if (href.indexOf("?uilocation=") > -1) {
        href = href
          .replace("uilocation=popup", "uilocation=popout")
          .replace("uilocation=tab", "uilocation=popout")
          .replace("uilocation=sidebar", "uilocation=popout");
      } else {
        const hrefParts = href.split("#");
        href =
          hrefParts[0] + "?uilocation=popout" + (hrefParts.length > 0 ? "#" + hrefParts[1] : "");
      }

      const bodyRect = document.querySelector("body").getBoundingClientRect();
      const width = Math.round(bodyRect.width ? bodyRect.width + 60 : 375);
      const height = Math.round(bodyRect.height || 600);
      const top = options.center ? Math.round((screen.height - height) / 2) : undefined;
      const left = options.center ? Math.round((screen.width - width) / 2) : undefined;
      chrome.windows.create({
        url: href,
        type: "popup",
        width,
        height,
        top,
        left,
      });

      if (win && this.inPopup(win)) {
        BrowserApi.closePopup(win);
      }
    } else if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
      href = href
        .replace("uilocation=popup", "uilocation=tab")
        .replace("uilocation=popout", "uilocation=tab")
        .replace("uilocation=sidebar", "uilocation=tab");
      chrome.tabs.create({
        url: href,
      });
    }
  }
}
