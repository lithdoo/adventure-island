# CMS 079 WZ → FSDB 本地验证报告

验证时间：2026-10-27 00:58–04:28（Asia/Shanghai）。转换产物在仓库外的本地 FSDB 目录，没有进入 Git。对照的 `content/DESIGN.md` 是提交 `e95da97`。脚本和中间数据留在 `.work/wz-fsdb-validation/`。本文件是随后提交的报告。

## 1. 测试环境

| 项 | 值 |
|---|---|
| 操作系统 | Windows 10.0.26300 |
| Python | 3.14.4 |
| Node | v24.22.1（Content API 进程使用本机 Cursor agent 自带的 Node） |
| WZ 库 | `.work/tools/wz-python`（`wzpy`），区域 `EMS` |
| IV | `B9 7D 63 E9`，与 `wzpy/crypto.py` 的 EMS 常量一致。16 个包都以该 IV 打开，版本均为 79 |
| 文件头 | 全部为 `PKG1`（`504b4731`） |
| 客户端目录 | `.work/task-001/extracted/冒险岛online` |
| FSDB 实现 | `loom-realm/packages/fsdb` 的 `openFsdb` / `listFsdbEntries` / `openFsdbObject` |
| Content 实现 | `prepareHostraGame`、`prepareDesktopContentView`、`createDesktopContentService`、`createBoundContentClient` |
| 协议依据 | `content/DESIGN.md`；`loom-realm/doc/20-modules/fsdb-content-service/fsdb-layout.md`；`loom-realm/doc/15-contracts/content-api-v1.md`；`packages/subsystem/src/content.ts` |

16 个包的 SHA-256 都与既有研究基线 `baselineMatch = true`。IMG 总数 34,760，与研究记录一致。本报告用的是这次重新计算的哈希，不是把旧统计直接当成预期。

| 包 | 字节 | SHA-256 | 版本 | IMG |
|---|---:|---|---:|---:|
| Base.wz | 8,885 | `8040f3ab36d2fb02b31ae04d794f36699c0f6c58e5cd7b87cd81d361da0aad7d` | 79 | 4 |
| Character.wz | 1,238,707,905 | `d55303588b10a8a5b76f1bd065c238447c708af21c5f55cd319a3ae9db646074` | 79 | 25,565 |
| Effect.wz | 142,666,079 | `46702f06c45a3198c36d810aabc4241ad267ee30346f541b76d802b64078ad82` | 79 | 17 |
| Etc.wz | 19,435,393 | `5177d6ac654aeac1e3db83a1f98445df26c80472bc75fb43e3ea41337e25bc6f` | 79 | 28 |
| Item.wz | 139,053,911 | `0c58678973dbcdd12e5d936e03a060ee606f80416722dbb530797a8584a182d3` | 79 | 475 |
| Map.wz | 835,954,262 | `9e0d2a0fcecac2c99ee3cb15b03c41b5617d7d0637b55fb132f0eeed27155f69` | 79 | 4,614 |
| Mob.wz | 421,628,507 | `6d5503fb78ec5a94f9f714d8712ab36b47257ac0b9ad8640e016e10fe67826ec` | 79 | 1,617 |
| Morph.wz | 35,707,082 | `e9461b90aae1a46e1f41b527a1232974408b8bbb802a5df36868df10f24efe90` | 79 | 182 |
| Npc.wz | 53,772,873 | `19562193d7cb93213110f4a54cc62568ec536251e8b7d546bd3915b3a009df65` | 79 | 1,608 |
| Quest.wz | 3,726,297 | `48716b137d84b7e80dc4e6a4ef7e1cf4f908e90370d48ad4cb9aad9052fbeffe` | 79 | 6 |
| Reactor.wz | 85,233,536 | `68786bf5d7530eca7519d7bdebd0c3dbd6a13a0193c2e984c2e82d12d4a17e20` | 79 | 463 |
| Skill.wz | 74,821,220 | `c23c1409ec801c89b5bbc13308014c202efbfb3002efb4da7f33359f0430323f` | 79 | 75 |
| Sound.wz | 366,212,494 | `d1a9fd213173d531d9710d6f568eb5e4d1a7fa390ed50fa7fcbb35b98f981505` | 79 | 48 |
| String.wz | 9,608,592 | `76aa28a540296c91633f097c9429caa2f16e0f7d0a8d9d0f449192ec51abc510` | 79 | 15 |
| TamingMob.wz | 1,876 | `64756585542455417e2de696395700e430a2510bd45cc1a4c22677cb273953a4` | 79 | 16 |
| UI.wz | 33,744,089 | `f5d804c30a707c968d1d7d1f522935cd7c3fd455e3d02891e996abc7c033848d` | 79 | 27 |

`TamingMob.wz` 只有 1,876 字节。哈希与基线相同，16 个 img 都写成了 `struct.Taming`。`DESIGN.md` 写 Etc 有 29 个 img，这份客户端实际是 28 个，并且 28 个都有对应的 `struct.Etc*` 表。

C: 剩余空间约 10 GB，全量 PNG 放在 E:。E: 在验证结束时仍有数百 GB 空闲。

## 2. Git 隔离

`git check-ignore -v` 确认 `.work/wz-fsdb-validation/` 命中 `.gitignore` 的 `.work/` 规则。FSDB 写在仓库外的本地目录。

验证结束时：

- `adventure-island` 当前分支 `cursor/cms-loomrealm-design-2923`。`git status --short` 对 `.work` 和 `.raw` 没有输出。
- `loom-realm` 当前分支 `fix/pocket-block-nonstandard-gamepad-111`。未跟踪项只有 `.qualification/`。这次验证没有创建或修改它。
- 验证进行时没有提交。随后只提交本报告。
- `.raw/` 没有读取为写入目标，也没有被修改。
- WZ、PNG、音频和 FSDB 没有送到 GitHub、云存储或远程 API。

## 3. 转换统计

全量转换于 2026-10-27 03:00（Asia/Shanghai）结束。随后只重跑了 `Skill.wz` 和 `String.wz`，并给 `group.Rope` 补上了 WZ 节点名。下表的结构记录数是重跑之后的磁盘计数。画布和声音节点数来自第二次全树遍历（只数节点，不解码像素）。UOL 数来自首轮转换统计。

| 包 | IMG | 落点 | 源画布 | 源声音 | 未写入的非法路径 |
|---|---:|---|---:|---:|---:|
| Base | 4 | `struct.ZMap`、`ZMapCn`、`SMap`、`StandardPDD`（6 条职业记录） | 0 | 0 | 0 |
| Character | 25,565 | `struct.Look` 25,539，`struct.Afterimage` 20 | 1,170,913 | 0 | 5 |
| Effect | 17 | `struct.Effect` 17 | 16,934 | 23 | 0 |
| Etc | 28 | 28 张 `struct.Etc*` | 2,307 | 0 | 1 |
| Item | 475 | `struct.Item` 14,541，`struct.ItemImg` 288 | 63,031 | 0 | 4 |
| Map | 4,614 | `struct.Map` 4,259，图集/背景/物件/世界地图/物理/帮助/区域码，以及地图分组 | 38,757 | 1 | 41 |
| Mob | 1,617 | `struct.Mob` 1,614，`struct.QuestCountGroup` 3 | 49,046 | 0 | 0 |
| Morph | 182 | `struct.Morph` 182 | 5,779 | 0 | 0 |
| Npc | 1,608 | `struct.Npc` 1,608 | 15,952 | 0 | 10 |
| Quest | 6 | `struct.Quest` 的 `Act`、`Check`、`QuestInfo`、`Say`、`Exclusive`、`PQuest` | 0 | 0 | 0 |
| Reactor | 463 | `struct.Reactor` 463 | 4,766 | 0 | 0 |
| Skill | 75 | `struct.Skill` 531，`struct.SkillBook` 74 | 15,217 | 0 | 0 |
| Sound | 48 | `struct.Sound` 48，资源在 `Sound/{img}/{名字}` | 0 | 3,577 | 2 |
| String | 15 | 15 张 `struct.Text*`，共 86,790 条 | 0 | 0 | 0 |
| TamingMob | 16 | `struct.Taming` 16 | 0 | 0 | 0 |
| UI | 27 | `struct.Ui` 27 | 16,978 | 0 | 2 |
| 合计 | 34,760 | 见第 4 节 | 1,399,680 | 3,601 | 65 |

首轮属性节点 58,449,275。UOL 5,850,889：解开 5,848,940，悬空 1,948，循环 1。资源复用 6,130,918 次。超出 2^53 的整数 0 个。声音字节 368,561,913。分组行 1,090,963，分组文件 25,157。

磁盘上的最终数量：结构记录 136,525，分组文件 25,157，资源文件 1,403,450。`openFsdb` 列出的条目是 1,565,132，等于这三项之和。

Quest 顶层键数量与 WZ 子节点数量一致：`QuestInfo` 2,134，`Check` 2,131，`Act` 2,118，`Say` 2,110，`PQuest` 10，`Exclusive` 1。

String 每一张表的文件数等于该 img 的叶子数。`TextItem` 在补写之后是 28,242，与 `Item.img` 的叶子数相同。

## 4. FSDB 目录摘要

根目录名是 `[FSDB]cms`。87 张表，只有 `[struct]`、`[group]`、`[resource]`。没有 `[extend]` 表。`openFsdb` 读到的数据库名是 `cms`。

资源表只有 `[resource]图`。`DESIGN.md` 规定画布和声音都放在这张表里，扩展名不进入键。任务清单里的 `resource.音` 在设计文档中没有单独的表，因此没有另建。

主要记录数：

| 表 | 记录或文件 |
|---|---:|
| `struct.Map` | 4,259 |
| `struct.Look` | 25,539 |
| `struct.Afterimage` | 20 |
| `struct.Item` / `ItemImg` | 14,541 / 288 |
| `struct.Mob` / `QuestCountGroup` | 1,614 / 3 |
| `struct.Npc` | 1,608 |
| `struct.Skill` / `SkillBook` | 531 / 74 |
| `struct.Reactor` | 463 |
| `struct.Tileset` / `Back` / `Obj` | 110 / 112 / 111 |
| `struct.Physics` | 1（键 `default`） |
| `struct.Sound` | 48 |
| `struct.Quest` | 6 |
| `struct.Text*` | 15 张表，86,790 条 |
| `group.Tile` / `Obj` / `Back` / `Portal` / `Foothold` / `Life` / `Rope` | 各 3,107 个文件 |
| `group.Reactor` | 3,032 |
| `[resource]图` | 1,403,450 |

资源前缀计数：`Look` 1,166,763，`Mob` 49,061，`Item` 63,040，`Obj` 22,274，`Effect` 16,959，`Ui` 16,972，`Skill` 15,217，`Npc` 15,944，`MapEffect` 6,553，`Morph` 5,779，`Reactor` 4,766，`Afterimage` 4,337，`Back` 4,404，`Sound` 3,575，`Etc` 2,306，`Tile` 2,348，`MiniMap` 2,278，其余前缀更小。这些前缀之和等于 1,403,450。

每张 `struct` 有 `.info.meta`。每张 `group` 有 `.info.meta` 和 `.desc.meta`。`[resource]图` 根上有 `.desc.meta`。`group.Back` 和 `group.Obj` 有 `.extend.meta`：

- `{"field":"bS","struct":"Back","desc":"背景定义"}`
- `{"field":"oS","struct":"Obj","desc":"物件定义"}`

Schema 把这两个字段写成 `string`，目标表存在。`tileSet`、`bgm`、`link` 在 `struct.Map` 上，没有被写成 Group 行的 extend 字段。`DESIGN.md` 有一句把 `tileSet` 和 `bgm` 也列入 extend。它们不是分组行字段，按 FSDB 规则和本次任务的约束留在地图记录里。

`group` 的 `.info.meta` 类型是 `object`，描述单行。`additionalProperties` 为 true，缺字段不会被 Schema 要求补上。

## 5. 协议验证

| 要求 | 结果 | 证据 |
|---|---|---|
| 根目录 `[FSDB]cms` | PASS | `openFsdb` 返回名称 `cms` |
| 表前缀只含 struct / group / resource | PASS | 87 张表，无非法目录 |
| struct 用 `.json`，group 用 `.jsonl`，资源可多层 | PASS | 官方扫描通过 |
| 已写入的键满足 NameSegment | PASS | 审计 0 个非法已写文件名；非法源名被拒绝 |
| struct 有 `.info.meta` | PASS | 87 张表的元数据检查通过 |
| group 有 `.info.meta` 和 `.desc.meta` | PASS | 同上 |
| resource 根有 `.desc.meta` | PASS | 同上 |
| `.extend.meta` 的 field / struct / desc | PASS | 只声明 `bS`、`oS`，类型 string |
| group Schema 描述单条对象 | PASS | `type: object` |
| UTF-8 无 BOM，JSON / JSONL 可解析 | PASS | `scanFsdb` 对全部 struct/group 做了解析，11.4 分钟，无异常 |
| 资源扩展名合法，同一 ResourceKey 不冲突 | PASS | 冲突列表为空；`bin` 在协议里允许 |
| 无符号链接等间接引用 | PASS | 扫描器遇到符号链接会抛错，本次没有 |
| 缺字段保持缺席 | PASS | 射手村 `info` 没有 VR；空 `bS` 仍是空字符串 |
| link 地图不复制目标，且无环 | PASS | 1,152 张 link 图没有分组文件，链上无环 |
| link 地图的 JSON 形状与设计样例一致 | FAIL | 1,152 张 link 图额外带了空数组 `layers`。`105090321` 的顶层键是 `info`、`layers` |
| 命名的 `bS` / `oS` 能找到定义 | PASS | 背景 45,441 行里，非空 `bS` 全部命中；物件 165,125 行全部命中 |
| 空 `bS` | PASS | 254 行的 `bS` 是空字符串，按源值保留 |
| `(tileSet, u, no)` 能找到图集和资源 | FAIL | 453,588 行瓦片中，失败集中在源里不存在的图集 `coalMine`（39 层）和 `toyCastle`（6 层）。`Tile/coalMine.img` 不在这份 `Map.wz` 里 |
| Portal 目标 | FAIL | `999999999` 12,838 行，已存在地图 5,461 行。WZ 里的 `-1` 有 39 行。`925020100` 等图的 `tm` 确实是 `-1`。另有 1 行 `tm = 970033001`，该地图 img 不在客户端中 |
| 每个画布/声音键都有文件 | FAIL | 65 个源路径因 NameSegment 规则没有文件，见第 8 节 |
| 字符串按分类分表且不互相覆盖 | PASS | 15 张 `struct.Text*`，叶子数与文件数一致 |
| `DESIGN.md` 的单表 `struct.Text/{最后编号}` | FAIL | 单表会覆盖跨 img 的同号条目。表内也有重复末段，例如 `Eqp.img` 32 个。实现保留了完整路径。这是设计与样本的冲突，协议文件没有改 |
| Quest 六个 img 都有结果 | PASS | 六个键都在，子节点数与 WZ 一致 |
| 技能编号落到 `struct.Skill/{编号}` | PASS | 7 位及以上编号，以及 `ItemSkill` 的 5 位编号，共 531 条，重跑后 0 冲突 |
| 短索引技能书 | FAIL | `BFSkill`、`MCSkill`、`MCGuardian`、`MobSkill` 的节点名是 `0`、`100` 这类书内索引，多本书会撞键。它们整本留在 `struct.SkillBook` |
| 声音在 `resource.图` | PASS | 与 `DESIGN.md` 一致。`Bgm00/FloralLife` 由 FSDB 读到，MIME `audio/mpeg` |

Well-formed：**PASS**。官方 `openFsdb` 接受了全部 1,565,132 个条目。

Integrity-valid：**FAIL**。目录扫描和绝大多数引用是通的。失败点是：65 个非法名字的资源没写入、11 个键冲突丢了后写的记录、1,948 个悬空 UOL 和 1 个循环、两份源数据里不存在的图集、1 个源数据里不存在的传送目标，以及 link 地图上多出来的空 `layers`。这些不能算成“引用全部正确”。

## 6. 内容保真

抽样对照是重新解码 WZ，再和 PNG / 字节文件比较。全量像素往返只在第一阶段的 4,072 张画布上做过；全量转换关闭了逐张重读，以避免再写一遍 140 万张图。全量覆盖的是节点计数、键计数和引用计数。

| 样本 | 结果 | 实测 |
|---|---|---|
| `Map/100000000` 的 `info` 标量 | PASS | 15 个标量一致，`mobRate = 0.49999991059303284`，无 VR |
| `105090321` 的 `link` | PASS | WZ 类型是字符串 `105090320`，FSDB 相同，没有复制分组 |
| `Tile/woodMarble/bsc/1` | PASS | 90×60，解码 RGBA 的 SHA-256 与 PNG 重读一致，文件 10,500 字节 |
| `Look/00002000/walk1/0/body` | PASS | 27×32，`origin [19, 32]`，`z = body`，RGBA 哈希一致，PNG 874 字节 |
| `00002000` 的 UOL | PASS | 该 img 有 21 个 UOL，首轮统计把解开后的目标记入记录 |
| `Sound/Bgm00/FloralLife` | PASS | 1,376,392 字节与 WZ 载荷逐字节相同，魔数 `fff29040`，扩展名 `.mp3` |
| `Mob/0100100` 的 `info` | PASS | 17 个标量一致 |
| `String/Map` 的 `100000000` | PASS | 键 `victoria.100000000`，字段有 `mapName`、`streetName`、`mapDesc` |
| 射手村绳子 | PASS | 3 行与 WZ 子节点数一致。补 id 之后字段含 `id` |
| 全量瓦片 / 物件 / 命名背景 | PASS | 见第 5 节；失败行另计 |
| 全量像素 | 抽样 | 源画布节点 1,399,680。已写入资源 1,403,450（含声音）。非法名字的 63 张画布没有 PNG |

`group.Rope` 最初只复制了子字段，WZ 节点名（`1`、`2`、`3`）没有进 `id`。本地脚本已改成与立足线相同的写法，并对 3,107 个绳子文件按节点顺序回填。1,686 个文件补上了 `id`，1,421 个文件里 `id` 已经等于节点名，长度不一致为 0。射手村第一行现在是 `id = 1`，坐标仍是源值。

技能的第一轮把 75 个 img 整本写进 `struct.SkillBook`，因为技能编号在 `skill/` 下面，不在 img 根上。本地脚本改为读取 `skill/` 下长度不少于 7 的编号，并单独处理 `ItemSkill` 的 5 位编号。删掉第一轮技能目录后重跑：75 个 img、531 条 `struct.Skill`、74 条 `struct.SkillBook`、15,217 个资源、0 错误、0 冲突。

`String/Item.img` 里有 975 条键形如 `Con.2000000`。`Con` 在 FSDB 里等于保留设备名 `CON`，不能作为 NameSegment 的点号前一段。这些编号本身没有和已有文件冲突。重跑后它们写成 `struct.TextItem/2000000` 这类设计文档要求的末段键。其余 85,815 条已存在的字符串键保持原文件，没有覆盖。

## 7. Content API

安装根使用仓库外的本地目录，里面只有这一份 `[FSDB]cms`。准备步骤按平台实现给每个条目计算了 `sha256:` 版本，没有手写 `fsdb.index.json`。准备和 HTTP 读取约 48.5 分钟，进程正常退出。

| 读取 | 结果 | contentVersion |
|---|---|---|
| FSDB `struct.Map/100000000` | PASS | `sha256:4afd244adfad86bc6a9c32e45c65d7dc72dee02728bfeddd7a8a344e5e061813` |
| FSDB `group.Tile/100000000` | PASS | `sha256:e1839653557005aa8f20827d7cc559d95a18618c58f1e8ee4023411f02df2404` |
| FSDB `resource.图/Look/00002000/walk1/0/body` | PASS，874 字节，`image/png` | `sha256:df4bfd04ba6fc82f88f8da2276cea6ead3cafb7bdf419f360ec1f0f6c31c0f69` |
| FSDB `resource.图/Sound/Bgm00/FloralLife` | PASS，1,376,392 字节，`audio/mpeg` | `sha256:c19f549e33dfba0b470e21e26fa018b87e161a5ef2caa37c78c1f0bdb17a5c3e` |
| HTTP `GET .../records/struct.Map/100000000` | PASS，200，正文哈希等于响应头 | 与 FSDB 相同 |
| HTTP `GET .../groups/group.Tile/100000000` | PASS，200，45,118 字节 | 与 FSDB 相同 |
| HTTP `GET .../resources/resource.图/Look/00002000/walk1/0/body` | PASS，200，874 字节 | 与 FSDB 相同 |
| 版本格式 `sha256:` + 64 位小写十六进制 | PASS | 上述全部匹配 |
| ETag 为 `"<contentVersion>"` | PASS | 三条 HTTP 响应都成立 |
| `ContentClient.record` / `resource` | PASS | 返回的版本与 HTTP、FSDB 相同 |
| `ContentClient.group` | FAIL | 原型上只有 `record` 和 `resource`。调用 `group()` 得到 `TypeError` |

底层 FSDB 能读 Group。Desktop Content HTTP 能读 Group。Subsystem 的 `ContentClient` 仍然没有 `group()`。`packages/subsystem/src/content.ts` 的接口只有 `record` 和 `resource`。这次没有改 LoomRealm 的契约，也没有绕过 HTTP 去宣称运行库已经能读 Group。

渲染侧如果持有上面的 `contentVersion`，可以用它做 `expectedContentVersion`：这三条成功响应的头、ETag 和正文哈希是同一个值。

## 8. 问题清单

| # | 严重程度 | 证据 | 位置 | 建议 |
|---|---|---|---|---|
| 1 | 阻塞运行库 | `ContentClient` 无 `group()`，调用为 `TypeError`。HTTP `groups` 为 200 | `loom-realm/packages/subsystem/src/content.ts` | 在正式接口增加 `group()`，行为与 HTTP `/groups/` 一致。本次只记录，未改协议 |
| 2 | 高 | 65 个画布/声音路径不能做 NameSegment，文件未写 | 例如 `Cape/01102670 `（img 名含尾随空格）、`Cap/01002697/backDefault `、`Obj/.../ladder `、`Npc/2141000/breath `、`Pet/5000011/ rise`、`UIWindow/Memo/FontTime/.`、`UIWindow/Memo/FontTime/:` | 按设计拒绝并让导入失败。若要保留，需要协议允许的别名规则。不要静默改名 |
| 3 | 高 | 5 个 `struct.Look` 键冲突，后出现的 img 被丢弃 | `01002913` Cap/Longcoat，`01003561` Cap/Accessory，`01004123` Cap/Shoes，`01004397` Cap/Accessory，`01092090` Shield/Weapon | 设计键是 8 位编号。样本里编号不唯一。保留先写入的一份，并在报告中列出丢失的路径 |
| 4 | 中 | 2 个 `struct.Item` 键冲突 | `02520000`、`03994081` | 同编号出现在不同 img。需要确认哪一份是游戏要读的 |
| 5 | 中 | 4 个 `struct.MapEffect` 键冲突 | `DragonTiger`、`PvP`、`spinOff1`、`Event` | `Effect.img` 里有同名分类。后写的子树被丢弃 |
| 6 | 中 | UOL 悬空 1,948，循环 1 | 首轮统计。记录里是 `resolved: false`，节点还在 | 保留失败状态。渲染前要处理悬空引用 |
| 7 | 中 | 字符串键包含分类路径，例如 `victoria.100000000` | `struct.TextMap` 等 | 单表末段键会丢数据。分类分表满足本次任务。与 `DESIGN.md` 的单表写法需要单独决定 |
| 8 | 中 | 短索引技能仍在 `struct.SkillBook` | `BFSkill`、`MobSkill`、`MCSkill`、`MCGuardian` | 索引 `0` 在多本书里重复，不能做全局 `struct.Skill` 键 |
| 9 | 低 | 1,152 张 link 地图带空 `layers` | `105090321.json` 顶层 `info` + `layers: []` | 源 img 没有层时不要写这个数组 |
| 10 | 低 | 图集名在地图里出现，Tile img 不存在 | `coalMine` 39 层，`toyCastle` 6 层。存在的是 `Back/toyCastle*.img` | 这是客户端悬空引用，转换器没有编造图集 |
| 11 | 低 | 一个传送目标地图不在客户端里；`-1` 是源值 | `tm = 970033001` 1 行；`tm = -1` 39 行，已与 `925020100` 的 WZ 对照 | 把 `-1` 和 `999999999` 都视为无目标。`970033001` 保持原值 |
| 12 | 信息 | `DESIGN.md` 写 Etc 29 个 img | 本样本 28 个，哈希与基线相同 | 改设计文档的计数，或注明这份客户端就是 28 |

本地脚本改动（只在 `.work/wz-fsdb-validation/scripts/convert_cms.py`）：

- 技能从 `skill/` 子树提取 7 位及以上编号。
- `Con.*` 这类设备名键退回唯一的原始编号。
- 绳子写入 `id`，并已回填现有 JSONL。
- `--only` 重跑写入单独的 `convert-only-*.json`，避免覆盖全量摘要。

## 9. 结论

16 个 WZ 都完成了转换，FSDB 官方扫描判定目录和文件是 Well-formed。射手村、link 地图、身体帧、木纹瓦片和 `FloralLife` 的值、像素和声音字节与 WZ 一致。HTTP Content API 能读记录、分组和资源，`contentVersion` 等于响应正文的 SHA-256。

这份库还不能直接当作“运行库已经能读分组”的通过结果。Subsystem `ContentClient` 没有 `group()`，游戏子系统如果只拿这个客户端，读不到 `group.Tile`。HTTP 和 `openFsdb` 可以读。

完整性也还不是全库通过：65 个非法文件名的画布或声音没有文件，11 个键冲突丢了后写记录，1,949 个 UOL 没有解开成可用目标，两份图集名和一条传送目标在客户端里不存在。第一阶段场景（射手村、对应图集、`00002000`、`Bgm00/FloralLife`）不落在这些失败项上。阻塞第一阶段运行的是 `ContentClient.group`，不是这张地图的数据缺失。

Well-formed 通过，不等于完整性通过，也不等于 Subsystem 客户端已经能读 Group。
