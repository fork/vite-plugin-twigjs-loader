A simple vite loader plugin - https://www.npmjs.com/package/vite-plugin-twigjs-loader

1. Installation
```bash
npm install -D vite-plugin-twigjs-loader
```

2. Add to your vite config

```javascript
// vite.config.js
import vue from '@vitejs/plugin-vue';
import twig from 'vite-plugin-twigjs-loader';

export default ({ command }) => ({
  plugins: [
    vue(),
    twig({
      namespaces: { '@projects': __dirname }, // // allows imports like this: '{% from "@projects/src/helper.html.twig" import some_helper_function %}'
      strict_variables: true
    }),
  ],
  resolve: {
    alias: {
      '@project': __dirname
    }
  }
});
```

3. Import twig components. This example shows using the plugin in a storybook story.

```javascript
// src/components/your-twig-components/YourTwigComponent.stories.js
// this is a function you can call, that renders to html via twigjs
import YourTwigComponent from './YourTwigComponent.twig';

export default {
  title: 'Components/YourTwigComponentStoryName',
};

const Template = args => ({
  template: YourTwigComponent({
    test: 'This string will be usable as "test" in your twig component'
  })
});

export const StoryName = Template.bind({});
```
