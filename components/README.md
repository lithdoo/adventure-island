# Web Component

第一阶段的画面组件。子系统持有渲染树，Web Projector 按标签创建元素。元素只画当前副本，不决定人物走到哪、场景有没有切换。

资料有两处：

- 地图绘制顺序来自 Task 023 的地图合成。`compose` 先画远景，再画 0 到 7 层的物件和瓦片，然后是生命体、反应堆、传送门，最后是近景。立足线和绳梯只作为编辑辅助线，不进正式画面。
- 人物插层来自 Task 050 的 `SPAWN_PLAYER`。角色被放进 `FieldDispatcher+0x24` 的 avatar layer，不是整张图的最上面。

## 渲染树

```text
cms-scene-view
├── cms-back              back 里 front=0 的远景，每个背景一个
├── cms-map-layer         地图层 0
├── cms-map-layer         …
├── cms-map-layer         地图层 7
├── cms-avatar-layer
│   └── cms-actor
├── cms-portal            可见出口，彼此并列
└── cms-back              back 里 front=1 的近景
```

换场景时替换远景、地图层和出口。`cms-actor` 的 key 保持不变，还是同一个元素，只更新坐标。

## 组件

| 目录 | 标签 | 第一阶段 |
|---|---|---|
| [cms-scene-view](./cms-scene-view/DESIGN.md) | `cms-scene-view` | 镜头和场景范围 |
| [cms-back](./cms-back/DESIGN.md) | `cms-back` | 远景和近景 |
| [cms-map-layer](./cms-map-layer/DESIGN.md) | `cms-map-layer` | 层 0 到 7 |
| [cms-avatar-layer](./cms-avatar-layer/DESIGN.md) | `cms-avatar-layer` | 人物所在的层 |
| [cms-actor](./cms-actor/DESIGN.md) | `cms-actor` | 一个能走、能跳的占位人物 |
| [cms-portal](./cms-portal/DESIGN.md) | `cms-portal` | 场景出口 |

## 不做成组件的东西

- 立足线、绳梯。碰撞数据。需要看的时候由 `cms-scene-view` 画辅助线。
- 单个瓦片、单个物件。数量大，画在所属的 `cms-map-layer` 里。
- 怪物、NPC、反应堆。字段在 Task 060 和 Task 050 里已经有，第一阶段不放进树。
- 方向键。沿用 LoomRealm 的 `game-controls-input`，不放在本目录。

`apps/pwa/` 和 `apps/hostra/` 加载同一套组件。
