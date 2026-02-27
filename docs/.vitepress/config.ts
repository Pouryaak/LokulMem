import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'LokulMem',
  description: 'Browser-native memory layer for AI apps',
  base: '/LokulMem/',
  lang: 'en-US',
  cleanUrls: true,
  appearance: false,
  lastUpdated: true,
  themeConfig: {
    logo: '🧠',
    siteTitle: 'LokulMem',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/guide/' },
      { text: 'GitHub', link: 'https://github.com/Pouryaak/LokulMem' },
    ],
    sidebar: [
      {
        text: 'Start Here',
        items: [
          { text: 'Overview', link: '/guide/' },
          { text: 'Getting Started', link: '/guide/getting-started' },
        ],
      },
      {
        text: 'Core Concepts',
        items: [
          { text: 'Core API', link: '/guide/core-api' },
          { text: 'Configuration', link: '/guide/configuration' },
          { text: 'Memory Lifecycle', link: '/guide/memory-lifecycle' },
        ],
      },
      {
        text: 'Quality & Operations',
        items: [
          { text: 'Eval Gates & CI', link: '/guide/evals-and-ci' },
          { text: 'Releasing to npm', link: '/guide/releasing' },
          { text: 'Changelog', link: '/guide/changelog' },
          { text: 'Troubleshooting', link: '/guide/troubleshooting' },
        ],
      },
    ],
    search: {
      provider: 'local',
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Pouryaak/LokulMem' },
    ],
    footer: {
      message: 'Built for local-first AI memory.',
      copyright: 'MIT License',
    },
  },
});
