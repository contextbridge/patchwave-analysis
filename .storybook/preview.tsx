import './preview.css';
import type { Preview } from '@storybook/react-vite';

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
        order: ['Report', ['App', 'Sample']],
      },
    },
  },
};

export default preview;
