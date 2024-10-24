import type { Plugin } from "vite";
import type { Parameter as TwigParameter } from "twig";

export interface PluginOptions extends TwigParameter {}
declare function twigPlugin(options?: PluginOptions): Plugin;

export default twigPlugin;
