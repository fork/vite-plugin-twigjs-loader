import path from "path";
import Twig from "twig";
import fs from "fs";

/**
 * @params {PluginOptions} options Twig.twig() parameters.
 * @example
 * // vite.config.js
 * import twig from 'vite-plugin-twig-loader';
 * plugins: [
 *   twig({
 *     namespaces: { '@project': rootPath }, // this allows imports like this '{% from "@project/src/helper.html.twig" import some_helper %}'
 *     strict_variables: true
 *   })
 * ]
 */
export default function twigPlugin(options = {}) {
  let viteConfig;
  // INFO: This works around duplicate template registering: 'There is already a template with the ID'. There is probably a better way to do this.
  Twig.cache(false);

  return {
    name: "vite-plugin-storybook-twig",
    enforce: "pre",

    configResolved(resolvedConfig) {
      viteConfig = resolvedConfig;
    },

    async transform(fileContent, id) {
      if (!id.endsWith(".twig")) return null;

      const projectRoot = viteConfig.root;

      const twigOptions = {
        allowInlineIncludes: true,
        ...options,
        rethrow: true,
        id: id,
        path: id,
        data: fileContent,
        namespaces: Object.entries(options.namespaces || {}).reduce(
          (acc, [key, value]) => {
            acc[key] = path.resolve(projectRoot, value);
            return acc;
          },
          {},
        ),
      };

      Twig.extend(function (eTwig) {
        eTwig.compiler.module["vite"] = async function (id, tokensStr) {
          const tokens = JSON.parse(tokensStr);
          const dependencies = new Set();

          const processDependency = async (token) => {
            try {
              const { content, resolvePath } = await resolveDependency(
                token.value,
                viteConfig.root,
                twigOptions.namespaces,
              );

              if (!content) {
                console.warn(`Empty dependency file at ${token.value}`);
                return null;
              }

              let template;

              // Only add valid dependencies to the set
              if (resolvePath && !dependencies.has(resolvePath)) {
                dependencies.add(resolvePath);

                template = Twig.twig({
                  ...twigOptions,
                  id: resolvePath,
                  path: resolvePath,
                  data: content,
                });

                // Process nested dependencies
                for (const depToken of template.tokens) {
                  await processToken(depToken);
                }
              }

              return template?.tokens;
            } catch (error) {
              console.warn(
                `Failed to process dependency ${token.value}:`,
                error,
              );
              return null;
            }
          };

          const processToken = async (token) => {
            if (token.type === "logic" && token.token.type) {
              switch (token.token.type) {
                case "Twig.logic.type.block":
                case "Twig.logic.type.if":
                case "Twig.logic.type.elseif":
                case "Twig.logic.type.else":
                case "Twig.logic.type.for":
                case "Twig.logic.type.spaceless":
                case "Twig.logic.type.setcapture":
                case "Twig.logic.type.macro":
                case "Twig.logic.type.apply":
                  for (const outputToken of token.token.output) {
                    await processToken(outputToken);
                  }
                  break;

                case "Twig.logic.type.extends":
                case "Twig.logic.type.include":
                  if (
                    token.token.stack.every(
                      (token) => token.type === "Twig.expression.type.string",
                    )
                  ) {
                    for (const stackToken of token.token.stack) {
                      await processDependency(stackToken);
                    }
                  }
                  break;

                case "Twig.logic.type.embed":
                  for (const outputToken of token.token.output) {
                    await processToken(outputToken);
                  }
                  for (const stackToken of token.token.stack) {
                    await processDependency(stackToken);
                  }
                  break;

                case "Twig.logic.type.import":
                case "Twig.logic.type.from":
                  if (token.token.expression !== "_self") {
                    for (const stackToken of token.token.stack) {
                      await processDependency(stackToken);
                    }
                  }
                  break;
              }
            }
          };

          // Process all tokens and collect dependencies
          for (const token of tokens) {
            await processToken(token);
          }

          const importStatements = Array.from(dependencies)
            .map(
              (dep, index) =>
                `import { registerTemplate as registerTemplate_${index}} from "${dep}";`,
            )
            .join("\n");

          // INFO: the id currently contains the actual path to the twig template
          // we have to turn that path back into the same path that is used in the twig template for imports.
          // Otherwise twig won't find the included template by its id.
          let twigImportPath = id;
          for (const [namespace, namespacePath] of Object.entries(
            twigOptions.namespaces,
          )) {
            if (id.startsWith(namespacePath)) {
              // Rereplace the namespaced path to get the original twig template path back
              twigImportPath = id.replace(namespacePath, namespace);
              break;
            }
          }

          // Create the template render function
          return `
            import Twig from 'twig';
            Twig.cache(false);
            ${importStatements}

            const registerTemplate = () => {
              ${Array.from(dependencies)
                .map((_dep, index) => `registerTemplate_${index}();`)
                .join("\n")}

              return Twig.twig(${JSON.stringify({
                ...twigOptions,
                path: undefined, // remove the path from the original twigOptions, otherwise twig will try to import from that path instead.
                id: twigImportPath, // we have to make sure this importPath is equal to the actual include paths, as twig will try to load included templates by this id.
                data: tokens,
              })});
            };

            export { registerTemplate };

            export default function render(context = {}) {
              try {
                const template = registerTemplate();
                return template.render(context);
              } catch (error) {
                console.error('Error rendering Twig template in ${id}:', error);
                return '<div style="color: red">Error rendering Twig template in ${id}: ' + error.toString() + '</div>';
              }
            }
          `;
        };
      });

      // Compile the template using the custom vite compiler module above.
      const code = await Twig.twig(twigOptions).compile({
        module: "vite",
        twig: "twig",
      });

      return { code };
    },
  };
}

async function resolveDependency(tokenValue, basePath, namespaces) {
  let resolvePath = tokenValue;

  // Handle namespaced paths
  for (const [namespace, namespacePath] of Object.entries(namespaces)) {
    if (tokenValue.startsWith(namespace)) {
      resolvePath = tokenValue.replace(namespace, namespacePath);
      break;
    }
  }

  // Handle relative paths
  if (resolvePath.startsWith("./") || resolvePath.startsWith("../")) {
    resolvePath = path.resolve(basePath, resolvePath);
  }

  try {
    const content = await fs.promises.readFile(resolvePath, "utf-8");
    return { content, resolvePath };
  } catch (error) {
    throw new Error(
      `Failed to load template: ${resolvePath}\nOriginal path: ${tokenValue}\nError: ${error.message}`,
    );
  }
}
