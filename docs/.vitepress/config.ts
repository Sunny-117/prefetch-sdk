import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Prefetch SDK',
  description: '通用的预请求 SDK，支持跨项目公用',
  lang: 'zh-CN',
  base: "/prefetch-sdk/",

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Prefetch SDK',

    nav: [
      { text: '指南', link: '/guide/' },
      { text: 'API', link: '/api/' },
      { text: 'GitHub', link: 'https://github.com/example/prefetch-sdk' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '开始',
          items: [
            { text: '介绍', link: '/guide/' },
            { text: '快速开始', link: '/guide/getting-started' },
          ],
        },
        {
          text: '核心概念',
          items: [
            { text: 'HTML 预请求', link: '/guide/html-prefetch' },
            { text: 'SWR 集成', link: '/guide/swr-integration' },
            { text: '缓存策略', link: '/guide/cache-strategy' },
            { text: '请求池', link: '/guide/prefetch-pool' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API 参考',
          items: [
            { text: '@prefetch-sdk/core', link: '/api/core' },
            { text: '@prefetch-sdk/html-script', link: '/api/html-script' },
            { text: '@prefetch-sdk/swr', link: '/api/swr' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/example/prefetch-sdk' },
    ],

    footer: {
      message: '基于 MIT 许可发布',
      copyright: 'Copyright © 2024 Prefetch SDK',
    },

    search: {
      provider: 'local',
    },

    outline: {
      label: '页面导航',
    },

    docFooter: {
      prev: '上一页',
      next: '下一页',
    },

    lastUpdated: {
      text: '最后更新于',
    },

    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
  },
});
