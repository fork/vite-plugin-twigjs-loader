A simple vite loader plugin.

1. Installation
```bash
npm install -D vite-plugin-twigjs-loader
```

2. Add to your vite config

```javascript
// vite.config.js
import twig from 'vite-plugin-twigjs-loader';

export default {
  plugins: [
    twig({
      namespaces: { 'projects': __dirname }, // allows imports like this: '{% from "@projects/src/helper.html.twig" import some_helper_function %}'
      strict_variables: true
    })
  ]
};
```

3. Import twig components.

```javascript
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
