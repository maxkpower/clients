import { ContextConsumer, consume } from "@lit/context";
import { LitElement, TemplateResult } from "lit";

// import createCache from '@emotion/cache'
import { themeContext } from "../contexts/theme";

// const contextTheme = new ContextConsumer(this, {context: themeContext, subscribe: true, callback: (ctx) => {console.log('context callback!')}} );

export function define(
  tag: string,
  FunctionalComponent: (props: any) => TemplateResult<1>,
  shadowRootOptions?: ShadowRootInit
) {
  class CustomComponent extends LitElement {
    constructor() {
      super();
    }

    @consume({context: themeContext})
    private contextTheme?: {type: string};

    static shadowRootOptions = {...LitElement.shadowRootOptions, delegatesFocus: true};

    protected render() {
    // render() {
      console.log('this.attributes:', this.attributes);
      console.log('this:', this);
      // console.log('contextTheme', this._contextTheme);
      //  get all attributes
      // const renderRoot = this.renderRoot;

      const attributes = Array.from(this.attributes).reduce(
        (acc: { [key: string]: string }, attribute: Attr) => {
          // if (attribute.name === 'theme') {

          //   acc.theme = attribute.value || this._contextTheme.type;
          // }

          acc[attribute.name] = attribute.value;
          return acc;
        },
        {},
      );

      const component = () => FunctionalComponent({
        ...attributes,
        contextTheme: this.contextTheme,
        children: this.children,
      });

      return component();
    }

    // createRenderRoot() {
    protected createRenderRoot() {
      // createCache({
      //   key: tag,
      //   container: this
      // })
    //   console.log('this', this)

    //   // return this.renderRoot?.querySelector('div') ?? null;
      // return super.createRenderRoot();
      // return shadowRootOptions == null ? this : super.createRenderRoot();
      return this;
    }
  }

  window.customElements.define(tag, CustomComponent);
}
