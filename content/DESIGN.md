# WZ 到 FSDB

本地 079 客户端里的 WZ 在打包时读入，写成 LoomRealm 的 FSDB。运行库只通过 Content API 读这份内容，再投影成组件的属性和 `data`。仓库不提交客户端、WZ 或这份全量内容。自动化测试用小型合成 FSDB。

平台准备步骤扫描目录并生成 `fsdb.index.json` 和 `contentVersion`。转换器写表目录，不手写索引。

## 三种落点

Content 的名字是 `{种类}.{表名}`，键是文件名去掉后缀。

| FSDB 目录 | Content | 用来放 |
|---|---|---|
| `[struct]表/{键}.json` | 记录 `struct.表/{键}` | 一份定义。地图信息、图集、外观、背景图集 |
| `[group]表/{键}.jsonl` | 分组 `group.表/{键}` | 同一张图上的重复放置。分组键只能是一段，所以用地图编号，层号写进行里 |
| `[resource]图/...png` | 资源 `resource.图/{路径}` | 画布像素。扩展名不进键，同一键不能既有 png 又有 webp |

坐标在 JSON 里用数字。运行库投影成组件属性时再转成十进制字符串。

画布先解码成 PNG。`origin`、`z`、`delay`、纸娃娃的 `map` 锚点留在指向这张图的记录里。`uol` 在写入前解开，帧直接记下目标资源键，多帧可以共用一张图。

样本 `105090321` 的顶层只有 `info`，`link` 指向 `105090320`。这种图只写 `link`，不把目标图的放置复制过来。运行库要画面时去读被指的那张。

名字必须能做 FSDB 的 `NameSegment`：不能含 `/ \ : * ? " < > |`，不能以 `.` 或 `$` 开头。对不上的资源让这次导入失败，不另起一个看不出原名的键。

## 第一刀写哪些表

数据库目录是 `[FSDB]cms`。

### 一张地图

`struct.Map/{九位编号}`：

```json
{
  "link": null,
  "vr": { "left": 0, "top": 0, "right": 0, "bottom": 0 },
  "miniMap": { "width": 0, "height": 0, "centerX": 0, "centerY": 0 },
  "layers": [{ "layer": "0", "tileSet": "woodMarble" }]
}
```

没有 VR 时 `vr` 为 `null`。没有小地图时 `miniMap` 为 `null`。边界仍由运行库按合成器的三条规则算，不把扩边后的矩形写进内容。`layers` 只列文件里真有的层。

同一地图编号下的分组，一行一个对象，顺序跟 WZ 里的子节点顺序：

| 分组 | 一行 |
|---|---|
| `group.Back` | `bS` `no` `ani` `x` `y` `rx` `ry` `type` `cx` `cy` `f` `a` `front` |
| `group.Tile` | `layer` `x` `y` `u` `no` `zM` |
| `group.Obj` | `layer` `oS` `l0` `l1` `l2` `x` `y` `z` `f` `zM`，有则带 `r` `reactor` `name` `flow` `rx` `ry` `cx` `cy` `force` `forbidFallDown` |
| `group.Portal` | `pn` `pt` `x` `y` `tm` `tn` `script`，有则带 `delay` `onlyOnce` `image` `hRange` `vRange` |
| `group.Life` | `type` `id` `x` `y` `cy` `fh` `f` `rx0` `rx1` `hide`，有则带 `limitedname` `mobTime` |
| `group.Reactor` | `id` `x` `y` `reactorTime` `f` `name` |
| `group.Seat` | `index` `x` `y` |
| `group.Foothold` | `id` `layer` `platform` `x1` `y1` `x2` `y2` `prev` `next` `force` `forbidFallDown` |
| `group.Rope` | `id` `x` `y1` `y2` `l` `uf` `page` |

类型 `m` 和 `n` 都留在 `group.Life`。类型 0 的出口也留下，运行库用它放人，不创建 `cms-portal`。

`group.Obj` 里的 `force`、`forbidFallDown` 给移动读。投影成 `cms-map-layer` 的 `objs` 时去掉。`tags` 和 `maep` 不写。

瓦片的 `z` 不在放置行上。它在图集记录里。`tSMag` 不写成缩放倍数：`snowyLightrock2` 的画布已经是 180×120。

立足线以地图节点 `foothold` 为准。瓦片画布上的 `extended/foothold` 不另写一套碰撞。

### 图集和摆设

`struct.Tileset/{图集名}` 列出每个 `u` / `no` 的资源键、`origin`、`z`、宽高。资源键如 `Tile/woodMarble/bsc/0`。

`struct.Back/{bS}` 列出 `back` 与 `ani` 两个目录下的帧：资源键、`origin`、`delay`。资源键如 `Back/grassySoil/back/0`。

`struct.Obj/{oS}` 列出 `l0/l1/l2` 下的帧。资源键如 `Obj/acc5/aquaRoad/fish/0/0`。

`struct.PortalAnim` 的键是 `pv`、`ph`、`psh`，来自 `MapHelper.img/portal/game`。`portal/editor` 的编辑器图标不写。

分组行里的 `tileSet`、`bS`、`oS` 用 `.extend.meta` 声明成对上述基础表的引用。

### 纸娃娃和会动的图

`struct.Look/{八位编号}` 来自 `Character.wz` 的身体、头、脸、头发和装备图。记录 `islot`、`vslot`，武器再记 `walk`、`stand`、`attack`。每个动作是一串帧：

- 有画布的帧：`delay`，以及每张画布的名字、资源键、`origin`、`z`、`group`、`map` 锚点。
- 引用帧：`action`、`frame`、`delay`、可选的 `move` 和 `flip`。没有画布。

资源键如 `Look/00002000/walk1/0/body`。

`struct.Npc/{编号}` 记 `stand`、`move`、`fly` 里实际有的动作和帧。`struct.Reactor/{编号}` 按状态目录 `0`、`1`、`2` 记画布。`group.Reactor` 是地图上的放置，`struct.Reactor` 是这张图怎么画，两种表可以同名。

`struct.ZMap` 一条键 `order`，值是 `Base.wz/zmap.img` 的子节点顺序，靠前的盖住靠后的。用 `zmap.img`，不用 `zmap_cn.img`。`struct.SMap` 一条键 `smap`，值是画布 `z` 到槽位串。

## 运行库怎么读

换场景时读 `struct.Map`。`link` 有值就改去读那张图的分组和图集，场景编号仍用当前键。再按层投影 `cms-back`、`cms-map-layer`、`cms-portal`。立足线和绳子进移动，也作为场景的辅助线数据。

人物外观读 `struct.Look`。穿戴编号来自运行状态里的 `equips` 属性，不写在地图内容里。

## 这一刀不写

- `Quest.wz`、经验表、任务脚本。
- `Item.wz` 的能力数值。纸娃娃用的是 `Character.wz` 里的 `islot`、`vslot` 和武器的 `walk` / `stand`。
- `Mob.wz` 的形象。怪物刷新点已经在 `group.Life`。
- `Skill.wz` 的效果图、`Sound.wz`、`Afterimage`。动作事件要播技能图时再加表。
- 小地图画布、BGM、进图脚本、`fieldLimit`。
