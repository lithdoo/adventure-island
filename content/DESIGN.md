# WZ 到 FSDB

本地 079 客户端的 WZ 在打包时整包读入，写成 LoomRealm 的 FSDB。研究目录里的 XML 只用来核对节点名，像素和声音字节在客户端 WZ 里，不在那些 XML 里。运行库只通过 Content API 读这份内容。仓库不提交客户端、WZ 或这份全量内容。自动化测试用小型合成 FSDB。

平台准备步骤扫描目录并生成 `fsdb.index.json` 和 `contentVersion`。转换器写表目录，不手写索引。数据库目录是 `[FSDB]cms`。

## 落点

Content 的名字是 `{种类}.{表名}`，键是文件名去掉后缀。

| FSDB 目录 | Content | 用来放 |
|---|---|---|
| `[struct]表/{键}.json` | 记录 `struct.表/{键}` | 一份定义 |
| `[group]表/{键}.jsonl` | 分组 `group.表/{键}` | 同一张图或同一条目下的重复子节点。分组键只能是一段 |
| `[resource]图/...` | 资源 `resource.图/{路径}` | 画布和声音的字节。扩展名不进键 |

坐标和属性值在 JSON 里保持 WZ 的数字或字符串。运行库投影成组件属性时，再把数字转成十进制字符串。

画布解码成 PNG。`origin`、`z`、`delay`、纸娃娃 `map` 锚点、宽高留在指向这张图的记录里。`uol` 写入前解开，多帧可以共用一个资源键。声音节点的字节按 WZ 里的格式写出，键是 `{img 名}/{声音名}`。

名字必须能做 `NameSegment`：不能含 `/ \ : * ? " < > |`，不能以 `.` 或 `$` 开头。对不上的资源让这次导入失败，不另起一个看不出原名的键。

一个 img 里出现过的标量都留下，缺的键不补默认值。下面列出的是这批 079 提取里实际见过的名字。

## 转换后的样子

一张地图是一条 JSON，加上按地图编号分开的 JSONL。画布是 PNG，声音是单独的字节文件。下面用射手村 `100000000` 缩样，层只列第 0 层，每种分组只留一行。

```text
[FSDB]cms/
├── [struct]Map/
│   └── 100000000.json
├── [struct]Tileset/
│   └── woodMarble.json
├── [struct]Physics/
│   └── default.json
├── [struct]Look/
│   └── 00002000.json
├── [group]Back/
│   └── 100000000.jsonl
├── [group]Tile/
│   └── 100000000.jsonl
├── [group]Portal/
│   └── 100000000.jsonl
└── [resource]图/
    ├── Tile/woodMarble/bsc/1.png
    ├── Back/grassySoil/back/0.png
    ├── MiniMap/100000000.png
    └── Look/00002000/walk1/0/body.png
```

`[struct]Map/100000000.json`。这张图的 `info` 里没有 `VR` 和 `link`：

```json
{
  "info": {
    "version": 10,
    "cloud": 0,
    "town": 1,
    "mobRate": 0.4999999,
    "bgm": "Bgm00/FloralLife",
    "returnMap": 100000000,
    "forcedReturn": 999999999,
    "hideMinimap": 0,
    "moveLimit": 0,
    "mapMark": "Henesys",
    "swim": 0,
    "fieldLimit": 0,
    "fly": 0,
    "noMapCmd": 0,
    "onUserEnter": "explorationPoint"
  },
  "miniMap": {
    "width": 7174,
    "height": 1391,
    "centerX": 798,
    "centerY": 661,
    "mag": 4,
    "canvas": "MiniMap/100000000"
  },
  "layers": [
    { "layer": "0", "tileSet": "woodMarble" }
  ]
}
```

`[group]Back/100000000.jsonl`、`[group]Tile/100000000.jsonl`、`[group]Portal/100000000.jsonl` 各一行：

```jsonl
{"bS":"grassySoil","no":0,"x":0,"y":0,"rx":0,"ry":0,"type":3,"cx":0,"cy":0,"a":255,"front":0,"ani":0,"f":0}
{"layer":"0","x":4005,"y":330,"u":"bsc","no":3,"zM":4}
{"pn":"sp","pt":0,"x":112,"y":197,"tm":999999999,"tn":""}
```

`[struct]Tileset/woodMarble.json` 把画布上的 `origin` 和 `z` 留在记录里。瓦片那一行没有 `z`：

```json
{
  "bsc": [
    { "no": 1, "resource": "Tile/woodMarble/bsc/1", "origin": [0, 0], "z": 0, "width": 90, "height": 60 }
  ]
}
```

`[struct]Physics/default.json` 是全游戏一份：

```json
{
  "walkForce": 140000,
  "walkSpeed": 125,
  "walkDrag": 80000,
  "slipForce": 60000,
  "slipSpeed": 120,
  "floatDrag1": 100000,
  "floatDrag2": 10000,
  "floatCoefficient": 0.01,
  "swimForce": 120000,
  "swimSpeed": 140,
  "flyForce": 120000,
  "flySpeed": 200,
  "gravityAcc": 2000,
  "fallSpeed": 670,
  "jumpSpeed": 555,
  "maxFriction": 2,
  "minFriction": 0.05,
  "swimSpeedDec": 0.9,
  "flyJumpDec": 0.35
}
```

`[struct]Look/00002000.json` 里 `walk1` 第 0 帧的身体画布：

```json
{
  "resource": "Look/00002000/walk1/0/body",
  "origin": [19, 32],
  "z": "body",
  "map": { "navel": [-6, -20], "neck": [-4, -32] }
}
```

运行库按 Content 的名字来取：`struct.Map/100000000` 是地图记录，`group.Tile/100000000` 是瓦片 JSONL，`resource.图/Tile/woodMarble/bsc/1` 是那张 90×60 的 PNG。装备编号不在这些文件里，它在人物元素的 `equips` 属性上。

## Map.wz

### 地图信息

`struct.Map/{九位编号}` 的 `info` 收下该图 `info` 上的全部标量。这批图里出现过：

`version`、`cloud`、`town`、`mobRate`、`bgm`、`returnMap`、`forcedReturn`、`hideMinimap`、`moveLimit`、`mapMark`、`swim`、`fieldLimit`、`fly`、`noMapCmd`、`onUserEnter`、`onFirstUserEnter`、`fs`、`recovery`、`VRLeft`、`VRTop`、`VRRight`、`VRBottom`、`VRLimit`、`link`、`mapDesc`、`mapName`、`streetName`、`help`、`effect`、`fieldType`、`timeLimit`、`decHP`、`decInterval`、`rain`、`snow`、`miniMapOnOff`、`createMobInterval`、`fixedMobCapacity`、`noRegenMap`、`everlast`、`scrollDisable`、`protectItem`、`personalShop`、`entrustedShop`、`lvLimit`、`lvForceMove`、`allMoveCheck`、`damageCheckFree`、`blockPBossChange`、`reactorShuffle`、`reactorShuffleName`、`zakum2Hack`、`PvPWaitingRoom`。

样本 `105090321` 的顶层只有 `info`，`link` 指向 `105090320`。这种图只写 `link`，不复制目标图的放置。运行库要画面时去读被指的那张，场景编号仍用当前键。

`miniMap` 写在同一条记录里：`width`、`height`、`centerX`、`centerY`、`mag`，画布资源键 `MiniMap/{地图编号}`。边界仍由运行库按 VR、小地图、立足线这三条现成规则计算，不把扩边后的矩形写进内容。

`layers` 列出文件里真有的 `"0"` 到 `"7"`，每层带 `tileSet`（`info/tS`）。`tSMag` 有则留下。它不是绘制倍率：`snowyLightrock2` 的 `bsc` 画布已经是 180×120。

一张图上只出现一次的节点，嵌进 `struct.Map`：

| 节点 | 见过的字段 |
|---|---|
| `clock` | `x` `y` `width` `height` |
| `coconut` | `countFalling` `countBombing` `countStopped` `countHit`，四段 `time*`，`effectWin` `effectLose` `soundWin` `soundLose` `eventName` `eventObjectName` |
| `healer` | `x` `yMin` `yMax` `fall` `rise` `healMin` `healMax` `healer` |
| `pulley` | `x` `y` `pulley` |
| `pvp` | `timeDefault` `effectWin` `effectLose` `effectDraw` `soundWin` `soundLose` |
| `snowBall` | 两侧子节点 `0` `1`，以及 `x` `x0` `xMin` `xMax` `dx` `damageSnowBall` `damageSnowMan0` `damageSnowMan1` `recoveryAmount` `snowManHP` `snowManWait` `speed` `section1` `section2` `section3` |
| `snowMan` | `path` |
| `shipObj` | `shipObj` `shipKind` `x` `x0` `y` `z` `tMove` `f` |
| `mobMassacre` | `mapDistance`，以及 `gauge`、`countEffect` 子树 |
| `monsterCarnival` | `mobGenPos`、`mob` 子树，时间四段，胜负效果和音效，`rewardMapWin` `rewardMapLose` `mobGenMax` `mapDivided` `deathCP` `guardianGenMax` `reactorRed` `reactorBlue` |
| `noSkill` | `class` 子树 |
| `BuffZone` | 子树，样本里有 `hill` |

### 地图上的重复节点

分组键是地图编号，一行一个，顺序跟 WZ 子节点一致。

| 分组 | 一行里的字段 |
|---|---|
| `group.Back` | `bS` `no` `ani` `x` `y` `rx` `ry` `type` `cx` `cy` `f` `a` `front` |
| `group.Tile` | `layer` `x` `y` `u` `no` `zM` |
| `group.Obj` | `layer` `oS` `l0` `l1` `l2` `x` `y` `z` `f` `zM`，有则带 `r` `reactor` `name` `flow` `rx` `ry` `cx` `cy` `force` `forbidFallDown` `tags` `maep` |
| `group.Portal` | `pn` `pt` `x` `y` `tm` `tn` `script`，有则带 `delay` `onlyOnce` `image` `hRange` `vRange` `f` `hideTooltip` `horizontalImpact` |
| `group.Life` | `type` `id` `x` `y` `cy` `fh` `f` `rx0` `rx1` `hide`，有则带 `limitedname` `mobTime` `info` `team` |
| `group.Reactor` | `id` `x` `y` `reactorTime` `f` `name` |
| `group.Seat` | `index` `x` `y` |
| `group.Foothold` | `id` `layer` `platform` `x1` `y1` `x2` `y2` `prev` `next` `force` `forbidFallDown` |
| `group.Rope` | `id` `x` `y1` `y2` `l` `uf` `page` |
| `group.Area` | `x1` `y1` `x2` `y2` |
| `group.SwimArea` | 子节点名（样本是 `sea`）以及 `x1` `y1` `x2` `y2` |
| `group.Weather` | `time` `item` `msg` `option` |
| `group.ToolTip` | 子节点名（样本有 `0` 和 `0char`）以及它下面的标量，矩形样本是 `x1` `y1` `x2` `y2` |
| `group.MapUser` | `user` 下的编号子节点，子树原样 |

立足线以地图节点 `foothold` 为准。瓦片画布上的 `extended/foothold` 记在图集记录里，不另写一套碰撞。类型 `m` 和类型 0 的出口都留下。

### 地图用的图

`struct.Tileset/{图集名}`：每个 `u` / `no` 的资源键、`origin`、`z`、宽高，以及画布上若有的 `extended/foothold`。资源键 `Tile/woodMarble/bsc/0`。

`struct.Back/{bS}`：`back` 与 `ani` 两个目录的帧，资源键、`origin`、`delay`。资源键 `Back/grassySoil/back/0`。

`struct.Obj/{oS}`：`l0/l1/l2` 下的帧。资源键 `Obj/acc5/aquaRoad/fish/0/0`。

`struct.Physics` 一条键 `default`，来自 `Physics.img` 的 19 个小数：`walkForce`、`walkSpeed`、`walkDrag`、`slipForce`、`slipSpeed`、`floatDrag1`、`floatDrag2`、`floatCoefficient`、`swimForce`、`swimSpeed`、`flyForce`、`flySpeed`、`gravityAcc`、`fallSpeed`、`jumpSpeed`、`maxFriction`、`minFriction`、`swimSpeedDec`、`flyJumpDec`。

`struct.WorldMap/{img 名}`：`WorldMap` 目录下 18 个 img 各一条，子树保留，画布进资源。

`struct.MapEffect`：`Map.wz/Effect.img` 的每个分类（`quest`、`aran`、`directionArrow` 等）一条，帧进资源。

`struct.MapHelper`：`portal/game` 的 `pv`、`ph`、`psh`，`portal/editor` 的 13 张图标（`sp` 到 `pcj`），以及 `weather`、`mark`、`worldMap`、`AvatarMegaphone`、`minimap`。游戏出口画 `portal/game`。编辑器图标留下，运行库不把它画成出口。

分组行里的 `tileSet`、`bS`、`oS`、`bgm` 用 `.extend.meta` 指到对应基础表。

## Character.wz

根目录的身体 `00002000`–`00002014` 和头 `00012000` 起，以及这些目录里的每张 img，都是 `struct.Look/{八位编号}`：

`Accessory`、`Bits`、`Cap`、`Cape`、`Coat`、`Face`、`Glove`、`Hair`、`Longcoat`、`Pants`、`PetEquip`、`Ring`、`Shield`、`Shoes`、`SkillSkin`、`TamingMob`、`Weapon`、`MonsterBattle`。

`info` 上的标量都留下。武器 `01302000` 见过 `islot`、`vslot`、`walk`、`stand`、`attack`、`afterImage`、`sfx`、`reqJob`、`reqLevel`、`reqSTR`、`reqDEX`、`reqINT`、`reqLUK`、`incPAD`、`tuc`、`price`、`attackSpeed`、`cash`，以及 `icon`、`iconRaw`。

每个动作一串帧。有画布的帧记 `delay` 和每张画布的名字、资源键、`origin`、`z`、`group`、`map` 锚点。引用帧记 `action`、`frame`、`delay`，有则带 `move`、`flip`。资源键 `Look/00002000/walk1/0/body`。

`struct.Afterimage/{名字}` 来自 `Afterimage` 目录，帧同样进资源。纸娃娃元素不画残影，数据仍留下。

## 其余包

| WZ | FSDB | 记录里有什么 |
|---|---|---|
| `Item.wz` 的 `Cash`、`Consume`、`Etc`、`Install`、`Pet`、`Special` | `struct.Item/{八位编号}` | 该物品节点下的标量。消耗品 `02000000` 见过 `price`、`hp`。图标进资源。装备的 `incPAD` 等在 `struct.Look.info`，不在这个包 |
| `String.wz` 的 `Map`、`Eqp`、`Etc`、`Consume`、`Ins`、`Cash`、`Pet`、`Mob`、`Npc`、`Skill`、`Item`、`MonsterBook`、`PetDialog`、`ToolTipHelp`、`EULA` | `struct.Text/{包内路径最后的编号}`，同一 img 的分类目录不进键 | 该条目下的字符串。地图条目见过 `streetName`、`mapName` |
| `Mob.wz` | `struct.Mob/{七位编号}` | `info` 标量，以及 `move`、`stand`、`hit1`、`die1` 和其他动作目录的帧。`0100100` 的 `info` 见过 `bodyAttack`、`level`、`maxHP`、`maxMP`、`speed`、`PADamage`、`PDDamage`、`MADamage`、`MDDamage`、`acc`、`eva`、`exp`、`undead`、`pushed`、`fs`、`summonType`、`mobType`。`QuestCountGroup` 单独一张表 |
| `Npc.wz` | `struct.Npc/{编号}` | `info` 里见过 `dcLeft`、`dcTop`、`dcRight`、`dcBottom`。动作目录有哪些就写哪些，`1012000` 只有 `stand` |
| `Reactor.wz` | `struct.Reactor/{编号}` | 状态目录 `0`、`1`、`2`… 的画布，以及 `event`、`hit`。地图放置仍是 `group.Reactor` |
| `Skill.wz` 的 75 个职业 img | `struct.Skill/{技能编号}` | 图标三张：`icon`、`iconMouseOver`、`iconDisabled`。`level` 下每个等级的标量都留下；`11111004` 见过 `hs`、`mpCon`、`damage`、`mobCount`、`attackCount`。`action`、`effect`、`hit`、`finalAttack` 以及该技能还有的其他子树。效果帧进资源 |
| `Sound.wz` | `struct.Sound/{img 名}` 加资源 `Sound/{img 名}/{声音名}` | `Bgm00` 见过 `SleepyWood`、`FloralLife`、`GoPicnic`。字节来自客户端 WZ |
| `Effect.wz` | `struct.Effect/{img 名}` | 17 个 img，如 `BasicEff` 的 `LevelUp`、`QuestClear`。帧进资源 |
| `Morph.wz` | `struct.Morph/{编号}` | `info` 见过 `speed`、`jump`、`fs`、`swim`，动作有 `walk`、`stand`、`jump`、`prone`、`ladder`、`rope`、`fly` |
| `TamingMob.wz` | `struct.Taming/{编号}` | `info` 见过 `speed`、`jump`、`fs`、`swim`、`fatigue`，有动作目录就一并写 |
| `UI.wz` | `struct.Ui/{img 名}` | 27 个 img，如 `StatusBar`、`Login`、`UIWindow`、`NameTag`。帧进资源 `Ui/{img 名}/…` |
| `Base.wz` | `struct.ZMap` 键 `order`；`struct.ZMapCn` 同样一条；`struct.SMap` 键 `smap`；`struct.StandardPDD/{0…5}` | `zmap.img` 的子节点顺序，靠前的盖住靠后的。纸娃娃读 `zmap.img`。`smap` 是画布 `z` 到槽位串。`StandardPDD` 是职业基础表，不是纸娃娃。包名目录是空的，不写 |
| `Etc.wz` | 每个 img 一张 `struct.Etc{img 名}` | 29 个 img 都留下，包括 `MakeCharInfo`、`ForbiddenName`、`ItemMake`、`NpcLocation`、`RecommendSkill`、`Commodity`、`CashPackage`、`QuestCategory` |

## 运行库第一阶段读哪些

换场景读 `struct.Map`，顺着 `link` 取分组，再读图集、背景、物件和 `struct.Physics`。人物读 `struct.Look`。穿戴编号在运行状态的 `equips` 属性里，不写进地图。

任务怎么做、现金商城卖什么，不执行 `Quest.wz` 和 `Commodity` 里的规则。这两份表仍然导入，避免内容库里缺文件。
