import path from "path";

/**
 * @params {PluginOptions} options Twig.twig() parameters.
 * @example
 * // vite.config.js
 * import twig from 'vite-plugin-twig-loader';
 * plugins: [
 *   twig({
 *     namespaces: { 'project': rootPath }, // this allows imports like this '{% from "@project/src/helper.html.twig" import some_helper %}'
 *     strict_variables: true
 *   })
 * ]
 */
export default function twigPlugin(options = {}) {
  let viteConfig;

  return {
    name: "vite-plugin-storybook-twig",
    enforce: "pre",

    configResolved(resolvedConfig) {
      viteConfig = resolvedConfig;
    },

    async transform(_, id) {
      if (!id.endsWith(".twig")) return null;

      const projectRoot = viteConfig.root;

      const twigOptions = {
        allowInlineIncludes: true,
        ...options,
        rethrow: true,
        // INFO: id is a filesystem path. We make it relative, since twig tries to load it as a url in the browser.
        href: path.relative(projectRoot, id),
        namespaces: Object.entries(options.namespaces || {}).reduce(
          (acc, [key, value]) => {
            acc[key] = path.relative(projectRoot, value);
            return acc;
          },
          {},
        ),
      };

      const renderFunction = `
          import Twig from 'twig';
          export default function render(context = {}) {
            try {
              const template = Twig.twig(${JSON.stringify(twigOptions)});
              return template.render(context);
            } catch (error) {
              console.error('Error rendering Twig template: in ${id}', error);
              return '<div style="color: red"> Error rendering Twig template: in ${id}. ' + error.toString() + '</div>';
            }
          }
        `;

      return {
        code: renderFunction,
      };
    },
  };
}
