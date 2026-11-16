# 健康AI与模型头像更新

2026-11-16。新增POST /api/health-advice，服务端读取DEEPSEEK_API_KEY和DEEPSEEK_MODEL，不向浏览器分发密钥。用户点击按钮才发送已保存健康、医嘱、天气、活动、冷热感受和本次问题。未配置、失败、限流时保留基础健康提醒，AI结果不改写定时器或原始温度。每个来源实例内15秒冷却、每小时12次。

按当前DeepSeek官方API文档默认deepseek-flash，可通过环境变量修改。没有自动推送或多轮历史上传。医嘱和本次问题不保存到localStorage，结果仅当前页面显示。

人物选择改为GLB实际头部正面渲染，透明背景，独立离屏画布、裁去躯干，只在打开选择器时依次生成九张头像；生成后释放模型资源并在内存缓存头像。原始参考图不再作为选择样板。

参考：https://api-docs.deepseek.com/api/create-chat-completion/
