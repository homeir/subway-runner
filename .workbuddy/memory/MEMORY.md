# 项目记忆 - subway-runner 地铁跑酷

## 项目概述
- 第一人称视角网页版地铁跑酷游戏
- 技术栈: Three.js 0.164.1 (ESM CDN), 原生 JS, 无构建框架
- 核心文件: src/main.js, src/styles.css, index.html
- 版本: v0.1.0

## 部署架构
- Cloudflare Pages, 项目名 subway-runner, 默认域名 subway-runner-dkj.pages.dev
- 自定义域名: runner.luobin.hu (已添加到 Pages, 待 DNS CNAME 配置)
- 自动部署: GitHub Actions (.github/workflows/deploy.yml), push to main 自动触发
- Git/GitHub: https://github.com/homeir/subway-runner.git (main 分支)
- GitHub Secrets: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (同方块世界)
- Cloudflare 账户: homeirr@gmail.com, Account ID: 0e35c4b70fec717c78a1ae6cfb9f2969
- GitHub 账户: homeir

## 游戏功能 (v0.2.0 大改版)
- 第一人称视角, 三车道跑酷, 人眼高度 1.65m (v0.1.x 是 3.8m 巨人视角, 已修复)
- 程序化轨道: chunk系统, 隧道风格场景, 墙面霓虹广告牌, 速度粒子
- 障碍物碰撞按 y 区间判定 (obs.yBottom/yTop):
  - 路障 0~1.0 (跳过) / 低栏悬空 1.15~1.75 (只能滑铲, 跳和站立都撞) / 火车 0~2.6 (换道)
  - v0.1.x 的低栏站着就能穿过 (判定区间 1.9~2.7 高于头顶), 已修复
- 金币收集 (y=0.9 腰部高度), 旋转+浮动动画
- 速度递增 (10 -> 30), FOV 随速度变大增强冲刺感
- 撞击反馈: 镜头震动 + 红色闪屏, 700ms 后弹结算; 新纪录有徽章
- 开始/结算界面背后场景慢速滚动 (画面是活的)
- 输入: Pointer 事件统一鼠标+触屏; 滑动过阈值立即触发; 点按=跳跃
  - 跳跃缓冲 (落地前 0.15s 按跳有效); 空中下滑=快速下坠+落地自动滑铲
- 所有 geometry/material 共享, chunk 回收不泄漏; 不再每 chunk 放点光源
- 调试: 控制台 window.__game = { state, camera, chunks, startGame }

## 待办
- DNS: 需要在 Cloudflare 控制台添加 CNAME runner.luobin.hu -> subway-runner-dkj.pages.dev
- API Token 没有 DNS:Edit 权限, 需要手动配置或创建新 Token
