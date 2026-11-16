# FeelsLike 当前融合版完整工程 · v14

这是当前已发布版本的固定快照；不是队友原始模型，也没有撤回现有融合。

在线预览（手机 / 远端电脑）：https://westlake-climate-fieldlab.dreamystingray4.chatgpt.site/
版本：v14
提交：6feb6551627f27c4d1c55a1c92e6ae65faa719f5

## 当前已包含

- 西湖融合场景、原包 OSM 路网与地形、场景建筑和植被、共用铺面与碰撞修复。
- 9 个 GLB 可选人物、第三人称 / 人物视角 / 全景、景点跳转与沿路行走。
- v14 断桥—白堤修复：断桥主路落点与朝向、转向意图保留、直角弯通行。
- 气象数据、500 米温度插值彩图、模型树影参与当前位置 UTCI 体感估算。
- 身体与健康资料、现场测温、冷热和心情反馈、穿搭与页面内提醒。
- DeepSeek 服务端健康建议，仪表盘全文、头顶短版可展开；体感与 emoji 同时展示。
- 中英文、色觉友好、彩色高对比和减少动态。

## 包含哪些工程文件

public/：网页源码、所有已纳入当前工程的模型、地图和预计算数据。
server.mjs、api.mjs、ai-health.mjs：本地服务及接口。
dist/：当前发布用的完整 Worker 构建产物。
scripts/、tests/：构建、修复复验工具与测试。
docs/、verification/：技术说明和已保存的验收结果。
.openai/hosting.json：原站点项目配置，另行发布到自己的站点时应换成自己的配置。

源码直接从已发布 Git 提交归档，不含 .git 历史、node_modules、真实 .env 或服务端私钥。队友原始压缩包和其他工作目录没有混入，避免版本混淆。

## 本地启动（电脑）

需要 Node.js 22+。解压后双击“启动本地预览.cmd”，或在工程根目录运行：

    node server.mjs

然后打开 http://127.0.0.1:8791/ 。运行网页不需要安装第三方依赖。
如果配置了 .env，可运行：

    node --env-file=.env server.mjs

本地服务绑定 127.0.0.1。远端和手机预览直接使用上面的 HTTPS 在线链接；不要把 127.0.0.1 当作分享地址。
本地 AI 需要自己的服务端环境变量，参考 .env.example；在线版沿用现有服务端配置。

## 开发与验收

    node --test tests/*.test.mjs
    node scripts/build.mjs
    node scripts/check_baidi_runtime.mjs

最近一次项目测试：111 项通过。断桥—白堤手机按钮和键盘连续行走、断桥与平湖秋月之间双向逐帧接触检查通过。结果见 verification/baidi-runtime.json。

默认 tjweather 为 2026-11-16 下载预报快照，也有 Open-Meteo 在线通道。500 米是彩图插值间距，真实今日客流未接入，页面关闭后不会持续提醒。工程 README.md 含历史更新，本包版本说明和最新 docs 文档优先用于验收。
