# Web Component

第一阶段的画面组件。子系统持有渲染树，Web Projector 按标签创建元素。元素只画当前副本，不决定人物走到哪、场景有没有切换。

资料有两处：

- 地图绘制顺序来自 Task 023 的地图合成。`compose` 先画远景，再画 0 到 7 层的物件和瓦片，然后是生命体、反应堆、传送门，最后是近景。立足线和绳梯只作为编辑辅助线，不进正式画面。
- 人物插层来自 Task 050 的 `SPAWN_PLAYER`。角色被放进 `FieldDispatcher+0x24` 的 avatar layer，不是整张图的最上面。

## 渲染树

```text
cms-scene-view
├── cms-back              back 里 front=0 的远景，每个背景一个
├── cms-map-layer         地图层 0 到 7。瓦片和物件是层上的数组
├── cms-avatar-layer
│   └── cms-actor
├── cms-npc               life 里 type=n。第一阶段不放
├── cms-reactor           第一阶段不放
├── cms-seat              第一阶段不放
├── cms-portal            可见出口，彼此并列
└── cms-back              back 里 front=1 的近景
```

换场景时替换远景、地图层、NPC、反应堆、座位和出口。`cms-actor` 的 key 保持不变。第一阶段的树只有远景、地图层、人物层和出口。

## 组件

| 目录 | 标签 | 第一阶段 |
|---|---|---|
| [cms-scene-view](./cms-scene-view/DESIGN.md) | `cms-scene-view` | 镜头和场景范围 |
| [cms-back](./cms-back/DESIGN.md) | `cms-back` | 远景和近景 |
| [cms-map-layer](./cms-map-layer/DESIGN.md) | `cms-map-layer` | 层 0 到 7 |
| [cms-avatar-layer](./cms-avatar-layer/DESIGN.md) | `cms-avatar-layer` | 人物所在的层 |
| [cms-actor](./cms-actor/DESIGN.md) | `cms-actor` | 纸娃娃。classic script 入口 + 有界 `avatarPlan`；合成算法、LoomRealm 浏览器集成与真实 079 素材（本地、纸娃娃子集）均已过（见 [实施说明](./cms-actor/IMPLEMENTATION.md)） |
| [cms-npc](./cms-npc/DESIGN.md) | `cms-npc` | 不放。`life` 里 `type=n` 的对话 |
| [cms-reactor](./cms-reactor/DESIGN.md) | `cms-reactor` | 不放。箱子、开关、花的点击和受击 |
| [cms-seat](./cms-seat/DESIGN.md) | `cms-seat` | 不放。坐下的坐标 |
| [cms-portal](./cms-portal/DESIGN.md) | `cms-portal` | 场景出口。第一阶段唯一的地图交互 |

## `cms-actor` 实现状态

人物组件以 `RenderNode.attrs` 接收坐标、朝向和移动状态，以 `RenderNode.data.avatarPlan` 接收已解析的帧/画布/锚点/z 顺序与资源版本。Web Component 只通过 LoomRealm 注入的 `PresentationResourceClient` 读取图像，不直接访问 WZ、FSDB 路径或私有 Content Index。

交付物包含 `browser/cms-actor.browser.js`（classic script，`bootstrapWebPresentation()` 可直接加载）与 `presentation.json` 注册声明；`avatarPlan` 有硬边界（序列化 `RenderNode.data` ≤ 262,144 compact 字节等，见 [实施说明](./cms-actor/IMPLEMENTATION.md)）。部署与注册步骤见 [部署说明](./cms-actor/DEPLOYMENT.md)。

三个验收状态：

1. **合成算法测试通过**：`node --test components/cms-actor/test/avatar-model.test.mjs components/cms-actor/test/browser-artifact.test.mjs`。
2. **LoomRealm 正式浏览器集成通过（合成素材）**：`node --test components/cms-actor/test/integration.chromium.test.mjs`，真实 Chromium + 正式 bootstrap/Projector/Content HTTP 形状。
3. **真实 CMS 079 素材验证通过（本地输入，纸娃娃子集）**：`node --test components/cms-actor/test/real-assets.local.test.mjs`，用本地合法 WZ 转出的真实 FSDB 重复同一闭环；无真实输入的环境显式 skip。装备 `islot/vslot` 遮挡、表情独立计时与全量 16 包转换仍是后续任务。详见 `result/66-cms-actor-real-assets.md`。

## 不做成组件的东西

- 立足线、绳梯。碰撞数据。需要看的时候由 `cms-scene-view` 画辅助线。
- 单个瓦片、单个物件。瓦片是像素放置数组 `tiles`。物件是放置数组 `objs`，共 165,125 条，字段是画面和遮挡（含 `zM`），不是点击目标。
- 物件上的交互不由物件组件接收。走进场景用 [cms-portal](./cms-portal/DESIGN.md)，对话用 [cms-npc](./cms-npc/DESIGN.md)，打或点箱子、开关、花用 [cms-reactor](./cms-reactor/DESIGN.md)，坐下用 [cms-seat](./cms-seat/DESIGN.md)。约 11,817 个物件的 `reactor` 字段只表示图跟着反应堆变；约 3,697 个 `name` 只给脚本找图。详见 [cms-map-layer](./cms-map-layer/DESIGN.md)。
- 怪物。同在 `life`，但是 `type=m`。第一阶段不放进树，也还没有单独目录。
- 方向键。沿用 LoomRealm 的 `game-controls-input`，不放在本目录。

`apps/pwa/` 和 `apps/hostra/` 加载同一套组件。
