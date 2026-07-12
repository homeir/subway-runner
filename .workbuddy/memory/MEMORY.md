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

## 游戏功能 (v0.4.0: Subway Surfers 风格大改版)
- 【第三人称】视角: 相机在小人身后上方 (y=3.0, pitch -0.33), 小人在 PLAYER_Z=-4.3
  - 所有碰撞/金币/表面判定都以 PLAYER_Z 为准, 不再是 z=0
- 低多边形小人: 棒球帽+蓝连帽衫+黄书包, 跑步摆臂摆腿/跳跃缩腿/滑铲后仰动画
  - makePart() 用 geo.translate 把旋转轴移到胯/肩, charGroup 挂在 playerHolder 上
- 白天城市场景: 蓝天/棕色路基/枕木/三对铁轨/两侧彩色楼房(随机高度,geometry要dispose)/电线架
- 列车玩法 (核心): 列车是长障碍(TRAIN_LEN=13, ROOF_H=2.6), 60% 尾部带木斜坡(RAMP_LEN=4.2)
  - surfaceHeightAt(px): 脚下表面高度 = 铁轨0 / 斜坡线性渐变 / 车顶2.6
  - 贴地跑时 playerY 直接 snap 到 surface (斜坡自动爬升); 悬空则重力下落 (跑过车头掉下来)
  - 防隧穿: 表面一帧抬升 >1.2m = 撞墙判撞 (v0.5.0 从 0.55 放宽:
    斜坡满速+低帧率一帧合法爬升可达 0.93, 0.55 会误判撞墙上不了车)
  - 带斜坡列车的车顶放金币奖励; 无斜坡列车只能换道绕开
  - 列车四种配色(银/绿/红/蓝) + 挡风玻璃/大灯/红白警示条/侧窗
- 小障碍: 路障(跳)/悬空横梁(铲) 只在地面车道
- 障碍物碰撞按 y 区间判定 (obs.yBottom/yTop):
  - 路障 0~1.0 (跳过) / 低栏悬空 1.15~1.75 (只能滑铲, 跳和站立都撞) / 火车 0~2.6 (换道)
  - v0.1.x 的低栏站着就能穿过 (判定区间 1.9~2.7 高于头顶), 已修复
- 金币收集 (y=0.9 腰部高度), 旋转+浮动动画
- 速度递增 (10 -> 30), FOV 随速度变大增强冲刺感
- 撞击反馈: 镜头震动 + 红色闪屏, 700ms 后弹结算; 新纪录有徽章
- 开始/结算界面背后场景慢速滚动 (画面是活的)
- 输入: Pointer 事件统一鼠标+触屏; 滑动过阈值立即触发; 点按=跳跃
  - 跳跃缓冲 (落地前 0.15s 按跳有效); 空中下滑=快速下坠+落地自动滑铲
  - 左下角虚拟摇杆 (v0.2.2): 拨过触发圈立即执行, 回中重新武装, 按住滚向新方向也触发
    半径按摇杆实际尺寸动态换算; 屏幕其余区域仍可滑动
- chunk 回收 (v0.2.2 修复): 必须等远端 (group.z - CHUNK_LENGTH) 过了相机才回收,
  否则会把眼前 25m 隧道整段删掉 (v0.1~0.2.1 的"隧道一段一段重进"bug); VISIBLE_CHUNKS=6
- 所有 geometry/material 共享, chunk 回收不泄漏; 不再每 chunk 放点光源
- 调试: 控制台 window.__game = { state, camera, chunks, startGame }

## v0.6.0 新增
- 操控大改: 移除虚拟摇杆
  - 陀螺仪换道: 左右倾斜 iPad 选车道 (绝对三区映射: <-12°左道/±7°内中道/>12°右道, 带回滞)
    iOS 需在用户手势里 DeviceOrientationEvent.requestPermission (startGame 里调 requestGyro)
    每局开始把当时角度校准为"水平" (gyroNeutral=null 触发重校准)
    屏幕方向不同轴不同: angle 90 -> beta, -90 -> -beta, 0 -> gamma
  - 左右大按钮: 左下=蹲(橙) 右下=跳(蓝), 96px, 直接拇指按; 滑动/键盘仍保留
- 复活答题: 撞障碍 -> 700ms 后弹答题邀请 (开始答题/结束本局)
  - 题库 src/questions.js: 上海三年级语数英各20题, choice/fill/judge 三种题型
  - 5 题答对 3 题复活; 提前判定 (对满3=过, 错满3=败); 同会话尽量不重复出题 (usedQuestions)
  - 复活: 清空面前 35m 障碍 + 2.5s 无敌(小人闪烁) + 降速40%; 失败 -> 结算
  - 键盘处理在 quiz phase 直接 return (填空要打字); 填空 input keydown stopPropagation
  - bump-version.mjs 已支持 questions.js?v= 缓存戳

## v0.5.0 新增
- 修复斜坡方向反了: ramp rotation.x 必须是【正角度】(-z 端翘起搭上车顶, +z 端贴地朝玩家);
  负角度会变成高的那头朝玩家, 视觉完全反向
- 新地形: 列车车队 = 斜坡列车 + 5m 车顶缺口 + 第二列(无斜坡), 缺口上方弧线金币,
  必须在车顶起跳飞跃缺口; 15% 概率出现且占满整个 chunk (s===0 时判定)
- 音效: WebAudio 现场合成零素材 (tone() 频率滑音+音量包络), sfx.coin/jump/slide/land/crash;
  audioCtx 必须在用户手势里创建 (startGame -> ensureAudio), 否则 iOS 不出声

## 待办
- DNS: 需要在 Cloudflare 控制台添加 CNAME runner.luobin.hu -> subway-runner-dkj.pages.dev
- API Token 没有 DNS:Edit 权限, 需要手动配置或创建新 Token
