# WZ → FSDB 修复交接

这份资料给下一位修改转换器的人。它包含当前转换器、11 个键冲突、65 个非法资源路径、UOL 诊断和一组不读取 WZ 的合成测试。

本次没有重跑全量转换，也没有修改已经生成的 FSDB。下面凡是写“此前验证”的结论，都来自 `result/63-wz-fsdb-validation.md` 和当时的 `convert-all.json`，不是这次重新测出来的。

此前验证状态：

- Well-formed：已通过。
- Integrity-valid：未通过。
- 底层 HTTP Group：已通过。
- Subsystem `ContentClient.group()`：未通过。

不需要上传实际转换后的约 140 万个资源文件。

## 1. 转换器入口

入口是 `scripts/wz_fsdb/convert_cms.py` 的 `main`。导入模块不会开始转换，也不会加载 `wzpy`。

| 参数 | 作用 |
|---|---|
| `--scope phase1` 或 `all` | 最小三张地图，或全部 16 个包 |
| `--only Map.wz,String.wz` | 只跑列出的包 |
| `--wz-root` / `WZ_ROOT` | 含 `Base.wz` 等文件的目录 |
| `--wzpy` / `WZPY_ROOT` | 含 `wzpy` 包的目录，不在本仓库里 |
| `--out` | FSDB 输出目录 |
| `--report-dir` / `WZ_FSDB_REPORT_DIR` | 可选的 JSON 摘要目录 |
| `--pixel-log` | 可选的画布宽高和哈希日志 |

`--out`、`--report-dir`、`--pixel-log` 若落在 Git 跟踪目录里会被拒绝。摘要里不写这些绝对路径。

主要函数：

- `load_dependencies`：运行时才导入 Pillow 和 `wzpy`。
- `valid_segment` / `segment_issue`：NameSegment 检查。非法名字被拒绝，不改写。
- `Store.write_struct` / `write_group` / `write_png` / `write_sound`：落盘。键已存在就记入 `collisions` 并丢弃后写的记录。
- `resolve_uol`：UOL 解析。`Codec.serialize` 在失败时调用 `uol_failure_record`。
- `convert_map`、`convert_character`、`convert_item`、`convert_skill`、`convert_string`、`convert_quest`：各包的键映射。
- `string_record_key`、`quest_table`、`quest_key`：字符串和任务的当前键规则。
- `emit_metadata`：写 `.info.meta`、`.desc.meta`、`.extend.meta`。

画布表名是 `CANVAS_RESOURCE_TABLE = "图"`。声音表名目前也是 `SOUND_RESOURCE_TABLE = "图"`。`DESIGN.md` 要求声音进入 `resource.音`。

## 2. 安装依赖

```text
python -m pip install -r scripts/wz_fsdb/requirements.txt
```

合成测试只需要 Pillow。真正转换还要一个本机的 `wzpy` 目录，并用 `--wzpy` 指给它。验证机上的那份在 `.work/tools/wz-python`，被 gitignore，没有放进这次提交。不要把第三方解析库复制进仓库。

## 3. 运行合成测试

在仓库根目录：

```text
python -m unittest discover -s tests/wz_fsdb -v
```

测试不打开 WZ。这次运行结果是 23 个测试里 17 个通过，6 个 `test_repair_*` 失败。失败是修复目标还在，不是夹具坏了。

当前应当失败的测试：

- `test_repair_duplicate_key_preserves_both_sources`
- `test_repair_quest_tables_follow_design`
- `test_repair_extension_conflict_has_its_own_error`
- `test_repair_sixteenth_hop_is_not_labeled_cycle`
- `test_repair_unresolved_uol_keeps_the_link_text`
- `test_repair_sound_table_follows_design`

## 4. 11 个键冲突

清单：`result/64-wz-fsdb-key-collisions.json`。11 个键与此前 `convert-all.json` 的 `collisions` 一致。来源路径是这次对节点名的只读遍历，顺序与 `walk_images` 或 `Effect.img` 子节点顺序一致。`Store.write_struct` 看到文件已存在就返回，所以先出现的来源被留下，后出现的被丢弃。

`struct.Look`，5 个。`convert_character` 用 img 文件名作键。

| 键 | 留下 | 丢弃 |
|---|---|---|
| `01004123` | `Cap/01004123.img` | `Shoes/01004123.img` |
| `01002913` | `Cap/01002913.img` | `Longcoat/01002913.img` |
| `01003561` | `Cap/01003561.img` | `Accessory/01003561.img` |
| `01004397` | `Cap/01004397.img` | `Accessory/01004397.img` |
| `01092090` | `Shield/01092090.img` | `Weapon/01092090.img` |

`struct.Item`，2 个。`convert_item` 把长度不少于 7 的数字子节点写成 `struct.Item/{编号}`。

| 键 | 留下 | 丢弃 |
|---|---|---|
| `02520000` | `Consume/0253.img` 的节点 `02520000` | `Consume/0252.img` 的节点 `02520000` |
| `03994081` | `Install/0399.img` 的节点 `03994041/03994081` | 同一 img 的节点 `03994081` |

`struct.MapEffect`，4 个。`convert_map_package` 把 `Effect.img` 的每个子属性写成一条记录。WZ 里没有同名重复；每一对只是大小写不同：

| 留下 | 丢弃 |
|---|---|
| `dragonTiger` | `DragonTiger` |
| `pvp` | `PvP` |
| `spinoff1` | `spinOff1` |
| `event` | `Event` |

丢弃发生在 Windows 上：`path.exists()` 把大小写不同的文件名当成同一个文件。这四个名字按 NameSegment 规则是不同的键。修复要在不区分大小写的文件系统上仍保留两份来源。

## 5. 65 个非法路径

清单：`result/64-wz-fsdb-invalid-paths.json`。判定与 `valid_segment` 相同，且只统计画布和声音节点本身，不解码像素。65 条与此前按包计数一致：Character 5、Etc 1、Item 4、Map 41、Npc 10、Sound 2、UI 2。

| 原因 | 数量 | 例子 |
|---|---|---|
| 尾随空白 | 60 | `Cape/01102670 /info/icon` |
| 非法字符 | 2 | `Obj/etc/coconut/fontTime/:`、`UIWindow/Memo/FontTime/:` |
| 前导空白 | 2 | `Pet/5000011/ rise`、`Pet/5000021/ rise` |
| 前导点 | 1 | `UIWindow/Memo/FontTime/.` |

没有发现前导空白以外的保留设备名出现在这 65 条资源路径里。`String/Item.img` 的 `Con.*` 是记录键问题，不是这 65 条资源路径。

`proposed_key` 全部是 `null`。这次不决定裁剪、替换或编码方式。`DESIGN.md` 要求不做静默 trim、大小写变换或非法名替换。声音两条的当前目标表是 `resource.图`，设计目标表是 `resource.音`。

## 6. UOL

实现是 `resolve_uol`。链接相对 UOL 的父节点：按 `/` 切开，`.` 停留，`..` 向上，其余段区分大小写。同一节点再次出现，或连续 16 跳仍没有落到非 UOL，都返回 `cycle`。父节点缺失或某一段不存在，返回 `dangling`。

`Codec.serialize` 失败时只保存 `uol_failure_record`：`resolved: false` 和状态。原始链接文本没有写入记录。成功时会再次进入目标子树，所以此前日志里的次数是访问次数，不是唯一节点数。

此前 `convert-all.json`：UOL 访问 5,850,889，成功 5,848,940，悬空 1,948，循环 1。

这次只读遍历每个 UOL 节点一次，不解码画布：唯一节点 2,609,373，成功 2,607,614，悬空 1,758，循环 1。1,948 和 1,758 的差来自成功链接再次进入目标子树时重复计数，不是另一次全量转换。

唯一失败 1,759 条都在 `result/64-wz-fsdb-uol-diagnostics.json`。分类：

| 分类 | 数量 | 含义 |
|---|---|---|
| `target_missing` | 1,637 | 按当前相对规则，下一段不存在，改从 UOL 自身或图像根起算也找不到 |
| `path_resolution` | 18 | 同级存在只有大小写不同的名字。当前查找区分大小写 |
| `cycle` | 1 | `Character.wz` `TamingMob/01992018.img` 的 `info/icon`，链接值就是 `icon`，父节点再次取到自己 |
| `unknown` | 103 | 94 条 `..` 走出了图像根；8 条从 UOL 节点自身能找到目标；1 条从图像根能找到目标。不能据此断定客户端规则 |

没有把“解析器认不出的节点类型”算成一类：当前解析器只要 `get` 返回非 UOL，就交给普通序列化，不会因为类型失败。

16 跳的上限有一个边界：第 16 跳即使已经落到普通节点，函数仍返回 `cycle`。15 跳可以成功。合成测试覆盖了这一点。

## 7. 和最新 `content/DESIGN.md` 的差异

对照的是 `main` 上的 `content/DESIGN.md`（`e3b0bd6`）。差异是当前代码和这份设计的差别，不是这次重新导入的结果。

- 声音写进 `resource.图`。设计是 `resource.音/Sound/{img}/{名字}`。
- 任务六个 img 各写一条 `struct.Quest/{img 名}`。设计是 `QuestAct`、`QuestCheck`、`QuestQuestInfo`、`QuestSay`、`QuestExclusive`、`QuestPQuest`，并按实体编号拆键。只读遍历看到 `QuestInfo`、`Say`、`Check`、`Act` 各有两千多个数字子节点；`PQuest` 有 10 个数字子节点；`Exclusive` 只有一个非数字子节点 `medal`。设计允许无法拆分的子树另定策略，代码还没有这个策略。
- 字符串表名已经是 `Text{img 名}`。键仍常常是点号路径，而不是设计里的末级 id。`Eqp` 24,328 条全是点号键，其中 32 个末级 id 出现在两条路径，例如 `Eqp/Accessory/1003233` 和 `Eqp/Cap/1003233`。`Item` 有 27 组这样的末级冲突，并有 975 条 `Con.*` 因保留设备名退回末级 id。`ToolTipHelp` 的末级 `0` 出现 337 次，不能直接拿末级 id 当全局键。设计要求同类内部的重复末级 id 使用稳定、可追溯的单段键，不能覆盖。
- 长度不少于 7 的技能编号，以及 `ItemSkill` 里长度不少于 4 的编号，进入 `struct.Skill`。`BFSkill`、`MCSkill`、`MCGuardian`、`MobSkill` 使用会重复的短索引，整本留在 `struct.SkillBook`。`1112`、`1212`、`1312`、`1412`、`1512` 的 `skill/` 目录是空的，整本也留在 `SkillBook`。设计写的是 `struct.Skill/{技能编号}`。
- 非法资源名被丢掉，没有保留原始路径到一条可追溯的键。
- 失败的 UOL 不保留链接文本。
- `ContentClient.group()` 仍然缺失。这是 LoomRealm Subsystem 的接口，不是这个转换器能单独补上的。HTTP Group 在此前验证里已经通过。

## 8. 哪些改代码，哪些必须再看真实 WZ

只靠这次提交就能改的：

- `write_struct` 遇到重复键时保留每一份来源，而不是返回。
- 非法 NameSegment 的可追溯编码。编码规则要先定下来；测试只要求不能静默裁剪。
- 失败 UOL 的记录带上链接值。
- 第 16 跳已经落到普通节点时不要叫 `cycle`。
- 声音目录从 `图` 改到 `音`。
- 相同逻辑键、不同扩展名目前记成 `hash-collision`，`write_sound` 仍返回原来的键，不写第二个文件。修复要把这种情况标成扩展名冲突。

必须在本地真实 WZ 上复核的：

- 11 个冲突修复后，两份来源都能读到，且没有覆盖第三条同键数据。
- 65 个路径在选定编码下都能找到，像素和声音哈希与源节点一致。
- 1,637 条 `target_missing` 是不是源数据里确实没有目标。这次只按当前相对规则判定。
- 18 条大小写不一致的链接，客户端到底区不区分大小写。
- 103 条 `unknown` 要用约定的相对根再判一次。
- 字符串末级冲突和任务拆键的规则定了以后，用真实 img 核对条数。
- 改完后再做一次全量转换，才能重新声称 Integrity-valid。Well-formed 也要在那次产物上再跑。

## 9. 建议的修复顺序

1. 保留 11 个冲突的全部来源。这是已经发生的记录丢失。
2. 为 65 个非法路径定一个不丢信息的键，并让失败 UOL 留下原始链接。
3. 修正 16 跳边界，以及声音表名、扩展名冲突。
4. 再决定字符串、任务和短索引技能书的单段键。`ToolTipHelp` 和 `Exclusive/medal` 说明不能一律取末级名字。
5. 最后用本地 WZ 做全量复核。不要把合成测试通过写成 Integrity-valid。

## 10. 修复后的验收

- 合成测试里现在失败的 `test_repair_*` 通过，现有行为测试不被放宽。
- 11 个冲突键的每个来源都还有记录，清单里的路径没有少。
- 65 个原始路径都能对应到一条 FSDB 键，或者失败报告里保留原始路径；没有静默 trim。
- 失败 UOL 带有链接值。循环样例 `info/icon` → `icon` 仍判定为循环。
- 声音在 `resource.音`，画布仍在 `resource.图`。
- 本地全量产物重新通过 Well-formed。Integrity-valid 只在悬空引用、冲突和非法名都有明确处置后才能改判。
- HTTP Group 与 `ContentClient.group()` 的此前结论不因转换器补丁自动改变。后者仍要等 LoomRealm 的接口。
