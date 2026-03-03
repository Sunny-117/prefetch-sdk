---
layout: home

hero:
  name: Prefetch SDK
  text: 通用的预请求解决方案
  tagline: 在 JS 加载前提前发起请求，大幅提升首屏性能
  image:
    src: /logo.svg
    alt: Prefetch SDK
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 查看 API
      link: /api/
    - theme: alt
      text: GitHub
      link: https://github.com/example/prefetch-sdk

features:
  - icon: ⚡
    title: HTML 预请求
    details: 在 HTML head 中内联脚本，JS 加载前就开始请求关键数据，充分利用网络空闲时间
    link: /guide/html-prefetch
    linkText: 了解更多
  - icon: 🔄
    title: SWR 集成
    details: 无缝集成 SWR 数据请求库，预热数据到缓存，组件渲染时直接使用，零等待
    link: /guide/swr-integration
    linkText: 了解更多
  - icon: 💾
    title: 灵活缓存
    details: 支持当天缓存、TTL 缓存等多种策略，可自定义 localStorage/sessionStorage/内存存储
    link: /guide/cache-strategy
    linkText: 了解更多
  - icon: 🎯
    title: 请求池管理
    details: 统一管理多个预请求，支持依赖关系和条件执行，轻松处理复杂场景
    link: /guide/prefetch-pool
    linkText: 了解更多
  - icon: 📦
    title: 轻量无依赖
    details: 核心包零依赖，体积小巧，支持 Tree Shaking，按需引入
  - icon: 🔧
    title: TypeScript 支持
    details: 完整的 TypeScript 类型定义，享受智能提示和类型检查
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #3b82f6 30%, #8b5cf6);
  --vp-home-hero-image-background-image: linear-gradient(-45deg, #3b82f620 50%, #8b5cf620 50%);
  --vp-home-hero-image-filter: blur(44px);
}

.dark {
  --vp-home-hero-image-background-image: linear-gradient(-45deg, #3b82f630 50%, #8b5cf630 50%);
}

@media (min-width: 640px) {
  :root {
    --vp-home-hero-image-filter: blur(56px);
  }
}

@media (min-width: 960px) {
  :root {
    --vp-home-hero-image-filter: blur(68px);
  }
}
</style>
