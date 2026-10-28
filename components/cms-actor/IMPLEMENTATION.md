# cms-actor 实施说明

> 状态：第一阶段实现，使用合成资源验证；真实 WZ / FSDB 接入仍待验证。
> 范围：Web Component、帧布局与锚点算法、逐帧绘制、合成浏览器预览、Node 内置测试。

## 1. 本次实现的边界

`cms-actor` 是一个只负责呈现的 Web Component。它不读取 WZ、FSDB 文件系统或私有 Content Index，也不决定角色的位置、移动、跳跃和场景切换。运行库通过 `attrs` 提供当前角色状态；游戏侧适配器把已解析的 WZ 外观投影为 `RenderNode.data.avatarPlan`。

本次实现覆盖：

- `stand1`、`walk1`、`jump` 等动作计划的帧选择；
- 按 WZ `delay` 的绝对值推进帧，循环动作循环播放，`jump` 等非循环动作停留在末帧；
- `receiveRenderEvent({ name: "action", data: { action } })` 单次动作播放；完成后恢复当前 `locomotion`；
- 以 `origin` 和 `map` 锚点合成多张画布；
- 按 `zOrder` 从后向前绘制；左右朝向绕人物原点镜像；
- 通过 `PresentationResourceClient.resource(namespace, key, expectedContentVersion)` 读取 PNG，并验证返回的版本和图像尺寸；
- 资源缓存、异步绘制过期结果隔离、断开组件时取消请求并释放 `ImageBitmap`；
- 合成素材浏览器预览与纯函数测试。

本次**不声称**已完成 WZ 解码、UOL 解析、`WzRecordAlias` 候选解析、`islot/vslot` 装备冲突算法、真实 `zmap/smap` 表接入或真实 CMS 079 素材验收。这些应由游戏侧适配层与后续集成测试完成。

## 2. RenderNode 契约

动态状态仍使用字符串 `attrs`：

| 属性 | 含义 |
|---|---|
| `x`, `y` | 人物身体原点在场景中的坐标 |
| `locomotion` | `stand`、`walk`、`jump` 等运行时状态；`stand` / `walk` 默认映射到 `stand1` / `walk1` |
| `facing` | `left` 或 `right` |
| `skin`, `face`, `hair`, `expression`, `equips` | 运行时的外观选择状态，供游戏适配层重建 `avatarPlan`；本组件不直接通过这些编号访问 WZ |

`RenderNode.data` 现在承载一份**已解析、渲染就绪的外观计划**。它不是原始 WZ 树，也不包含文件系统路径：

```js
{
  avatarPlan: {
    formatVersion: 1,
    zOrder: ["hair", "face", "head", "body"],
    locomotionActions: { stand: "stand1", walk: "walk1", jump: "jump" },
    actions: {
      stand1: {
        loop: true,
        frames: [{
          delay: 500,
          move: [0, 0],
          flip: false,
          layers: [/* 按锚点依赖顺序排列的画布 */]
        }]
      }
    }
  }
}
```

每个 layer 的规范形状：

```js
{
  id: "body",
  z: "body",
  resource: {
    namespace: "图",
    key: "Look/00002000/stand1/0/body",
    contentVersion: "sha256:<64 位小写十六进制>"
  },
  width: 27,
  height: 32,
  origin: [19, 32],
  anchors: {
    navel: [-6, -20],
    neck: [-4, -32]
  }
}
```

- `resource` 只含 Content API 逻辑标识和可信版本，不含物理路径或 URL。
- `origin`、`anchors` 均以画布左上角为参考；锚点向量相对 WZ `origin`。
- `frame.layers` 按**锚点依赖顺序**排列：先身体，再头，再脸/头发，再依赖既有锚点的装备。绘制顺序不依赖数组顺序，而由 `zOrder` 决定。
- `zOrder` 表达从前景到背景的顺序；绘制时反向遍历，使后景先画、前景最后画。
- `locomotionActions` 可将 `stand` / `walk` 映射到武器 `info` 所决定的 `stand1` / `stand2`、`walk1` / `walk2`。游戏适配层选择具体后缀；`jump` 通常不带后缀。
- 游戏侧应先解开 UOL、解析动作引用、确定肤色和装备候选，再产生该计划。组件不猜测缺失的 WZ 语义。

## 3. 锚点布局

算法先独立计算位置，再按 `zOrder` 排序绘制：

1. 第一张画布（身体）的 `origin` 放在人物原点 `(x, y)`；当前帧的 `move` 只作用于本帧，不累计到下一帧。
2. 后续画布按 `navel → neck → hand → brow → handMove` 的优先级，寻找同时存在于当前画布和已建立锚点表的名称。
3. 匹配时将同名锚点重合，并只登记尚不存在的新锚点。例如头通过 `neck` 对齐身体，并提供后续脸/头发使用的 `brow`。
4. 带锚点但找不到任何既有锚点的画布会被跳过，并通过 `data-skipped-layers` 暴露诊断信息，避免静默绘制在错误位置。
5. 所有画布定位完成后，按 `zOrder` 从后向前绘制。朝向镜像和帧的 `flip` 组合为 XOR，绕身体原点翻转整套合成结果。

## 4. 动画与事件

- 身体帧是时间轴；一帧中的所有 layer 一起切换。
- `delay` 按毫秒解释，负值使用绝对值作为显示时长；缺失或为零的 `delay` 表示停留。
- `action.loop === true` 且有多个有时长的帧时循环；非循环动作结束后停在最后一帧。
- `action` Render Event 只触发一次播放，不写入 `attrs` 或 retained `RenderNode.data`。单次动作播完后重新读取当时的 `locomotion`，所以播放期间发生的走/站状态更新不会被旧状态覆盖。
- 新的 `action` 事件会从第 0 帧开始并替代当前单次动作。
- 本组件不把 Render Event 重放到新建或重连的元素；事件交付语义由 LoomRealm Web Presentation API v1 管理。

## 5. 资源生命周期与失败策略

资源按 `(namespace, key, expectedContentVersion)` 缓存。读取结果必须满足：

- 返回的 `contentVersion` 与请求的版本完全一致；
- MIME 属于 `image/*`；
- 解码后的像素尺寸与计划中声明的 `width/height` 一致。

任何一张当前帧的资源失败时，当前帧不做部分合成；画布清空并写入 `data-render-state="error"` 与 `data-render-error`。异步返回如果属于旧绘制轮次会被丢弃。组件断开时取消资源请求、停止动画循环并释放已创建的 `ImageBitmap`；重新连接后按需要重新加载。

## 6. 本地验证

无需安装依赖：

```bash
node --test components/cms-actor/test/*.test.mjs
```

浏览器预览：

```bash
python -m http.server 8000
# 浏览器打开 http://localhost:8000/components/cms-actor/preview/
```

预览在浏览器运行时生成合成 PNG，使用仅存在于预览内存中的 ResourceClient。它验证组件的资源调用形状、锚点、绘制顺序、左右翻转、移动与动作播放；不代表真实 FSDB 或 CMS 079 素材已经通过验证。

## 7. 后续集成顺序

1. 由游戏侧 Look 适配器把 `struct.Look` 中的帧、Canvas、`origin`、`map` 锚点、`z` 与资源版本转换成 `avatarPlan`。
2. 接入 `struct.ZMap/order` 与 `struct.SMap/smap`，用真实表驱动层顺序和装备遮挡；不得在组件中按文件名推断槽位。
3. 接入 `WzRecordAlias` 和编码后的资源 key，验证脸、头发、身体及装备候选均可准确查找。
4. 用本地真实 WZ 生成少量角色样本，与已知帧的 PNG 尺寸、锚点和叠放结果做对照。
5. 最后再扩展表情、更多装备、动作引用、技能效果和声音；这些不是本次合成测试通过的隐含结论。
