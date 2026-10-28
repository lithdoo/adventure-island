# 66 · cms-actor 真实 CMS 079 素材验证报告

> 日期：2026-10-28
> 分支：`feat/cms-actor-paper-doll`（PR #2）
> 前置：`result/65-cms-actor-browser-integration.md`（合成闭环）
> 结论：**真实 CMS 079 素材（纸娃娃子集）通过 LoomRealm 正式浏览器闭环验证**——状态 3 由 BLOCKED 转为通过（本地输入）。仓库仍不提交任何 WZ、真实 PNG、音频或生成的 FSDB。

## 1. 输入与转换（全部本地，不入库）

| 项 | 值 |
|---|---|
| 客户端 WZ | `.raw/怀旧岛079V5客户端.rar` 的本地解压产物 `.work/task-001/extracted/冒险岛online/`（16 包齐全，Character.wz 1.18 GB） |
| WZ 解析库 | 本地 `wzpy` checkout `.work/tools/wz-python/`（转换器 README 约定路径，不入库） |
| 转换器 | `scripts/wz_fsdb/convert_cms.py` @ 分支 `cursor/wz-fsdb-repair-input-2923`（bf7fdeb），物化到 `.work/cms-actor-real/converter/` 使用，未并入本 PR |
| 驱动 | `.work/cms-actor-real/convert_doll.py`：仅转换纸娃娃子集——`Character.wz` 的 00002000（身体）/00012000（头）/00020000（脸）/00030000（头发）/01302000（武器）+ `Base.wz` 的 zmap/zmap_cn/smap |
| 产物 | `.work/cms-actor-real/fsdb/`（真实 FSDB，gitignored）：13,321 节点、335 张真实 PNG、1,033 条 UOL 全部解析成功（uol_ok=1033，0 失败）、14 条 struct 记录 |

## 2. 转换质量与逆向证据交叉核对（测试 1，通过）

真实 `struct.Look` 记录与 Task 050/DESIGN.md 的独立逆向结论逐项吻合：

| 断言 | 结果 |
|---|---|
| 身体 walk1/0：27×32、origin [19,32]、z=body、neck [-4,-32]、navel [-6,-20] | ✅ 与 DESIGN 完全一致 |
| arm 画布 12×17 | ✅ |
| stand1 3 帧 delay 500；walk1 4 帧 delay 180；jump 单帧 delay 200 | ✅ |
| brandish1 七帧引用 swingOF 0–3（-120/120）+ stabOF 0–2（120），总时长 840ms | ✅ 帧引用结构与 DESIGN 逐帧一致 |
| 头 walk1 UOL 解析为 `Look/00012000/front/head`，z=head，带 neck/brow | ✅ |
| 武器 info walk=1/stand=1（决定移动后缀 walk1/stand1），画布带 hand 锚点 | ✅ |
| zmap 149 项完整顺序 | ✅ |

## 3. 浏览器闭环（测试 2+3，通过）

`components/cms-actor/test/real-assets.local.test.mjs`（无真实 FSDB 时明确 skip，CI/合成 checkout 永不伪造）：

- **计划构建**：真实记录 → 有界 AvatarPlanV1（stand1/walk1/jump/brandish1 白名单；引用帧解析——brandish1 各帧取 swingOF/stabOF 的画布，部件跟引用动作与帧号；hairShade 取肤色 0；zOrder 取真实 zmap 顺序过滤到所用 z）。序列化 33,994 字节 ≤ 262,144 ✅；去重画布 50 张（≥40 断言）。
- **正式闭环**：真实 Chromium + 正式 `bootstrapWebPresentation()` + Projector 注入 Context/attrs/avatarPlan；每个 `resource()` 读取的 namespace/key/expectedContentVersion 与计划逐一吻合；无 presentation failure。
- **像素**：身体带与头/发带均有大量不透明像素（真实画作非空）。
- **动画**：walk1 四帧循环、逐帧快照哈希 ≥3 个不同（真实姿态逐帧不同）；jump 单帧停住（650ms 后哈希不变）；brandish1 七帧 840ms 播完回到当前 locomotion，画面与 walk 不同。
- **镜像**：jump 定帧下，左右朝向整幅合成在场景空间逐点互为镜像（768 点网格比对，alpha 精确、RGB ±1 容差——±1 来自 Chromium 翻转光栅化预乘舍入，见下）。
- 计划有界性测试单独通过。

## 4. 过程中发现并修复的真实缺陷

1. **Chromium 负缩放 drawImage 偏移**：`ctx.scale(-1,1)` 下 `drawImage` 的纹元落在解析镜像位置左侧 1 设备像素（最小复现：4×1 位图翻转后纹元顺序整体 -1）。修复：镜像变换后补 `translate(-1, 0)`，翻转纹元精确落在 `2·pivot − x`（`src/cms-actor.mjs`，有注释）。此修复同时让合成套件的镜像更精确。
2. **测试基建 401**：harness 重构时把完整 `Bearer` 头当裸 token 传入页内 client——已修复（服务端选项带完整头，页内剥前缀）。

## 5. 执行记录（最终）

```text
node --test test/avatar-model.test.mjs test/browser-artifact.test.mjs
  → tests 19  pass 19  fail 0
node --test test/integration.chromium.test.mjs          （合成 FSDB 闭环）
  → tests 9   pass 9   fail 0
node --test test/real-assets.local.test.mjs             （真实 FSDB 闭环，本地）
  → tests 3   pass 3   fail 0   （两连跑稳定）
CMS_ACTOR_REAL_FSDB=<不存在路径> node --test test/real-assets.local.test.mjs
  → tests 3   pass 0  skipped 3   （无真实输入时明确跳过，不伪造验收）
```

## 6. 范围与遗留

本次真实验证覆盖：肤色 0 身体 + 头/脸（default 表情）/头发 + 单手剑 01302000 的 stand1/walk1/jump/brandish1 合成、锚点链、真实 zmap 顺序、UOL、引用帧、镜像、动画与资源版本契约。

**仍不在此验收内**（后续任务）：

1. 装备 `islot/vslot` 遮挡（smap）——当前只画单武器，未实现多件装备冲突消解；
2. 表情独立计时（blink 等表情帧钟与身体分开）；
3. 更多肤色后缀（12/13/14 的无身体图分支）、ladder/rope 的 backHead 路径；
4. 全量 16 包转换与 FSDB Integrity-valid 验证（属 `cursor/wz-fsdb-repair-input-2923` 分支的未竟事项，其 README 明言 full conversion still pending）；
5. 高 DPR（>1）下的镜像偏移补偿按 CSS 像素计，设备像素级行为未逐点验证。

## 7. 结论

三状态全部落定：

| # | 状态 | 结论 |
|---|---|---|
| 1 | 合成算法测试 | 通过（19 例） |
| 2 | LoomRealm 正式浏览器集成（合成素材） | 通过（9 例真实 Chromium） |
| 3 | 真实 CMS 079 素材验证 | **通过（本地输入，纸娃娃子集，3 例）**；CI/无素材环境显式 skip |

PR #2 的最后一块验收缺口已用真实数据关闭；仓库边界（不提交 WZ/真实 PNG/生成 FSDB）未突破。
