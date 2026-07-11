# 地铁跑酷 (Subway Runner)

第一人称视角的网页版地铁跑酷游戏，基于 Three.js，部署在 runner.luobin.hu。

## 本地预览

```sh
npm run dev
```

打开 `http://127.0.0.1:5174/`。

## 操作

| 按键 | 动作 |
|------|------|
| A / ← | 左移 |
| D / → | 右移 |
| W / Space / ↑ | 跳跃 |
| S / ↓ | 滑铲 |
| Enter | 开始/重新开始 |

移动端：左右滑动切换车道，上滑跳跃，下滑滑铲，点击跳跃。

## 自动部署

推送到 `main` 分支自动触发 GitHub Actions 部署到 Cloudflare Pages。
