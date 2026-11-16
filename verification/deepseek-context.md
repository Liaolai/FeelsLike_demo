# DeepSeek 出行建议输入

点击“获取我的建议”时收集当前访客快照，服务端白名单筛选后发送，页面固定标明“非专业医疗建议”。

输入：虚拟人物经纬度/邻近景点/所选道路，活动，原始区域天气/有效建议天气/预警参考天气及时间、来源、快照/过期标志，未来最多24小时已有预报，现场测温记录和有效性，自报冷热和有效期，当前或演示太阳位置与几何遮阴，UTCI/辐射估算与来源，已保存身高体重年龄性别及静息消耗估算，健康选择/其他描述/限水/医嘱，心情、虚拟穿搭，饮水打卡与提醒开关/上次提醒，路线状态及已有提醒、客流数据可用状态、地图显示模式与问题。

未知值保留为空；演示时间、过期反馈、过期测温和未知客流不能当作实时测量；虚拟位置不当作真人GPS。不能从人物外观推断健康情况。

请求参数：model=deepseek-v4-flash，thinking.type=enabled，reasoning_effort=medium，max_tokens=8192。官方兼容策略：旧模型名当前由DeepSeek-V4.1-Flash-1017承接；medium映射为high。API响应记录requestedModel、实际返回model、requested/effective reasoning及disclaimer，不暴露reasoning_content。

来源：https://api-docs.deepseek.com/quick_start/pricing/ 与 https://api-docs.deepseek.com/guides/thinking_mode/。

验证：92项单测通过，覆盖前后端全字段传递、预览与快照语义、白名单、过期反馈、模型/思考参数以及推理内容不返回浏览器。
