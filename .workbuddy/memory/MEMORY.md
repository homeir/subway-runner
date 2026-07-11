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

## 游戏功能
- 第一人称视角, 三车道跑酷
- 程序化轨道: chunk系统, 隧道风格场景
- 障碍物: 路障(跳过), 低栏(滑铲), 火车(换道)
- 金币收集系统, 旋转动画
- 速度递增 (12 -> 35), 距离/金币/分数计算
- 最佳分数 localStorage 存储
- 输入: 键盘 (WASD/方向键/空格) + 移动端触控滑动

## 待办
- DNS: 需要在 Cloudflare 控制台添加 CNAME runner.luobin.hu -> subway-runner-dkj.pages.dev
- API Token 没有 DNS:Edit 权限, 需要手动配置或创建新 Token
