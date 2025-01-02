import {createContext} from '@lit/context';

import { Theme } from "@bitwarden/common/platform/enums";

type ThemeContext = {type: Theme};

export const themeContext = createContext<ThemeContext>(Symbol('theme'));
