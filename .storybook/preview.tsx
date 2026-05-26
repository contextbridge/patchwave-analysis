import './preview.css';
import type { Decorator, Preview } from '@storybook/react-vite';

type Theme = 'system' | 'light' | 'dark';

// Force a color scheme by toggling the .theme-* classes styles.css reacts to.
// A story can pin one via `parameters.theme`; otherwise the toolbar global wins.
const withTheme: Decorator = (Story, ctx) => {
  const theme = (ctx.parameters.theme as Theme | undefined) ?? (ctx.globals.theme as Theme) ?? 'system';
  const root = document.documentElement;
  root.classList.remove('theme-light', 'theme-dark');
  if (theme === 'light') root.classList.add('theme-light');
  if (theme === 'dark') root.classList.add('theme-dark');
  return <Story />;
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
    options: {
      storySort: {
        order: ['Report', ['App', ['Light', 'Dark']]],
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Color scheme',
      defaultValue: 'system',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'system', title: 'System' },
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withTheme],
};

export default preview;
