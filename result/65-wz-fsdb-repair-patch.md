# WZ → FSDB 修复补丁与复测交接（PR #1）

> 状态：合成回归已通过；**未重跑本地真实 WZ 全量转换**。本文件记录对 `result/64-wz-fsdb-repair-input.md` 所描述问题的代码修复，不能取代 `result/63-wz-fsdb-validation.md` 的旧产物完整性结论。

## 1. 已修改的转换逻辑

| 问题 | 补丁行为 | 当前验证层级 |
|---|---|---|
| 11 个重名/大小写冲突记录 | `Store.write_struct` 不再丢弃后续记录；在原逻辑 key 已占用时生成带稳定哈希后缀的单段键，并在本地摘要中记录原始 WZ 路径与新键 | 合成 11 组来源均保留 |
| 运行时无法识别碰撞候选 | 完整转换完成时额外生成 `[struct]WzRecordAlias`，保存 `originalKey` 与源记录候选列表；不从编号猜测装备类别 | 生成逻辑待本地全量验证 |
| 65 个非法 Canvas/Sound 路径 | 在资源写入前对非法单段名称进行以 `wz~` 开头的可追溯 UTF-8 编码；超长输入用 SHA-256 key 并保留来源 ledger；不 trim 或静默跳过 | 65 条公开路径 metadata 合成校验通过 |
| Windows 大小写不敏感路径 | 资源目录检测父目录中的 casefold 冲突后生成区分键；resource leaf 冲突也加区分后缀，拒绝覆盖既有文件 | 合成大小写目录冲突通过 |
| 重复 UOL / 16 跳边界 | 真正对象循环才判 `cycle`，超出上限另标 `depth_limit`；失败时保存原始 `value` 文本 | 合成 UOL 测试通过 |
| Sound 与 Canvas 混表 | 声音写入 `[resource]音`，PNG 写入 `[resource]图`；两张表的同文 key 可以合法共存 | 合成双资源 namespace 通过 |
| 不同扩展名占用同一 ResourceKey | 记录 `extension-conflict`，使用新的合法资源 key 保存第二份载荷，避免误报为单纯 digest 差异或静默丢弃 | 合成冲突通过 |
| String 键非法/设备保留名 | 不再截取最后一段编号，而是编码原始完整路径作为单段合法键，保留可追溯来源 | 合成设备名测试通过 |
| Quest 只有 6 个 IMG 记录 | 改为 `QuestAct`、`QuestCheck`、`QuestQuestInfo`、`QuestSay`、`QuestExclusive`、`QuestPQuest`，按 IMG 顶层子节点拆记录 | 目标表名合成测试通过，需核对真实 WZ 数量 |
| 空 bS 强制外键 | 不再为允许空字符串的 `group.Back.bS` 生成无条件 `.extend.meta`；保留原值，运行时可对非空值做业务级检查 | 合成元数据测试通过 |
| 纯 link 地图强加空 layers | 仅真实存在层时写入 `layers`；`struct.Map` 的 schema 不再要求该字段 | 源数据结构待本地复测 |

源数据、转换后的 Canvas/Sound、完整 FSDB 都未提交到本分支。

## 2. 已实际执行的测试

GitHub Actions： [WZ FSDB synthetic regressions](https://github.com/lithdoo/adventure-island/actions/runs/40462528925)

- 运行环境：Python 3.12，Pillow 12.3.0，Ubuntu GitHub-hosted runner。
- 结果：`Ran 26 tests ... OK`。
- 原 `test_repair_*` 六项均已通过；原来专门断言错误旧行为的测试已改为验证正确行为，未通过删除失败用例伪造结果。
- CI 只读取提交的源代码和人工构造的 fixture，没有读取或上传本地 WZ/图片/音频/FSDB 数据。
- 本次测试**不代表**原报告的 `Integrity-valid: FAIL` 已经改变。

## 3. 必须由本地 Agent 完成的复测

**必须新建全新的本地输出目录，不要复用上一次的 `[FSDB]cms`。** 转换器现在会保留重名记录；对旧目录进行增量写入会使来源事实和计数不可比较。

1. 在本地确认 16 个 WZ 的 SHA-256 与 63 号报告相同。
2. 在 Git 忽略区或仓库外执行 `--scope phase1`，验证 `Map 100000000`、`105090321` 的链接、`00002000`、瓦片和音乐，检查 `[resource]音`、`group` 的 metadata。
3. 然后选择性复测三类冲突源（5 个 Look、2 个 Item、4 个 MapEffect），确认原始来源数量等于 FSDB 输出数量，`WzRecordAlias` 能索引所有候选。
4. 对 65 条非法路径全部重新导出，按**解码 RGBA 宽高/像素哈希**和原始声音字节哈希验证。检查 `resourceAliases` ledger 中的原始分段与输出 key。
5. 重新统计悬空/循环/深度超限 UOL；本次补丁只修了已知的深度边界，不把原客户端可能本来就悬空的 1,637 条强行改为成功。
6. 检查 Quest 六类表的单条实体/数字编号数量及 `Exclusive/medal`，以及 String 分类文件数是否与 WZ 对应叶子数一致。
7. 对新全量目录运行 LoomRealm 的 FSDB Well-formed 和独立的 Schema、业务关联验证；记录 `PASS`、`FAIL`、`BLOCKED`，不可把 scanner 扫描通过当成 Integrity-valid。
8. 用正式 Desktop Content API 读取 Map/Group/PNG/音频，确认内容版本；独立记录 `ContentClient.group()` 目前仍缺失，不得绕过接口声称游戏 Subsystem 已能读取。

**交付方式**：把非素材的计数、hash 对照结果、失败路径摘要写成新报告即可，不上传本地 WZ、资源字节、PNG、音频或生成的 FSDB。

## 4. 当前仍未关闭的风险

- FSDB record 的自动区分后缀需要业务端通过 `struct.WzRecordAlias` 或更明确的分类查找策略读取，不应把纯数字 ID 当成唯一实体。
- UOL 绝大多数悬空引用、大小写不匹配、图像根越界等仍要用真实输入验证；修正循环判定不等于自动补齐目标。
- 客户端原本就不存在的图集与特殊 Portal 哨兵值必须与转换错误分开判定。
- 此补丁没有触碰 `loom-realm`：Subsystem `ContentClient.group()` 仍是单独平台工作。
- 大规模多次引用与别名分配的峰值内存、执行时间以及 Windows FSDB 实际扫描仍需用本地全量产物验证。
