# 65 · cms-actor LoomRealm 浏览器集成验证报告

> 日期：2026-10-28
> 分支：`feat/cms-actor-paper-doll`（PR #2）
> 主题：`cms-actor` 作为 LoomRealm 正式契约下的合成人物渲染组件的可交付闭环
> 输入：全部为运行时生成的合成素材（合成 PNG + 合成 FSDB）；**无任何原版 WZ/PNG/音频/真实 FSDB 参与**

## 1. 验证环境

```text
OS            Windows NT 10.0.26300.0
Node.js       v24.14.1（npm 11.11.0）
Chromium      系统 Edge/Chrome（Playwright 1.63.0 驱动，loom-realm 仓库锁定版本）
loom-realm    子模块 8cf8e2d（heads/main，未修改；已构建 packages/renderer dist）
```

LoomRealm 冻结接口未被修改：`git -C loom-realm status` 干净，测试仅消费其 dist 产物与 Playwright 依赖。

## 2. 三状态结论

| # | 状态 | 结论 |
|---|---|---|
| 1 | 合成算法测试 | **通过**（14 例） |
| 2 | LoomRealm 正式浏览器集成（合成素材） | **通过**（9 例真实 Chromium） |
| 3 | 真实 CMS 079 素材验证 | 后续于 `result/66-cms-actor-real-assets.md` **通过（本地输入，纸娃娃子集）**；无本地 WZ 的环境显式 skip |

## 3. P0：平台集成阻塞的解决方式

| 阻塞 | 解决 |
|---|---|
| LoomRealm 只用 classic `<script src>` 加载业务脚本，不用 `type="module"` | 交付 `browser/cms-actor.browser.js`：`scripts/build.mjs` 从 `src/*.mjs` 确定性打包出的 IIFE（无 import/export），`customElements.define("cms-actor", …)`；`--check` 字节级防漂移（测试强制） |
| 注册声明与 MIME | `presentation.json` 声明 `resource.Presentation/cms-actor/cms-actor.browser.js`；MIME essence `text/javascript`。Node 测试用**真实** `validateWebPresentationConfigV1` / `prepareWebPresentationV1` 验证声明合法、版本为产物 SHA-256、错误 MIME（`application/javascript`）被拒 |
| 资源以正式 Content 逻辑标识 + `expectedContentVersion` 访问 | 组件全部读取走 `PresentationResourceClient.resource(namespace, key, expectedContentVersion)`；计划校验强制 `sha256:<64hex>`；集成测试在底层 `RendererResourceClient` 包装层断言组件请求的 namespace/key/版本与计划逐一吻合。无私有 URL/bearer/FSDB 路径进入组件 |
| `avatarPlan` 无界，可能超出 `RenderNode.data` 262,144 字节 | `validateAvatarPlan` fail-closed：compact JSON 字节预算（有界测量器，超限即中止）+ 结构边界（动作 ≤32、帧 ≤128/动作、layer ≤32/帧、锚点 ≤8、画布 ≤4096px、delay ≤600s、UTF-8 长度上限）；同一 ResourceKey 尺寸声明必须一致。合成计划实测 73 张画布序列化后远低于上限 |
| 构建产物/MIME/部署/注册文档 | 新增 `DEPLOYMENT.md`（FSDB 双扩展名物理名、逻辑 key、MIME、PREPARE/bootstrap 步骤）；CI 两作业分别覆盖算法与浏览器闭环 |

## 4. P1：浏览器闭环覆盖矩阵（`integration.chromium.test.mjs`，全部通过）

| # | 断言 | 结果 |
|---|---|---|
| 1 | 正式 `bootstrapWebPresentation()` 加载 classic 入口；`customElements.get("cms-actor")` 为 function；Projector 注入 Context（`diagnostics().contextInjected`）、投影 9 个 attrs、投递 `avatarPlan`；无 presentation failure | PASS |
| 2 | `resource()` 收到正确 namespace/key/版本：首帧 5 层逐一请求，且所有请求身份 ⊆ 计划身份集合 | PASS |
| 3 | Canvas 像素：身体/头（`neck`）、脸/头发（`brow`）、武器（`hand`）锚点对齐；`weaponOverGlove>hair>face>head>body` 前后序；头发透明窗下脸可见（alpha 合成） | PASS |
| 4 | 左右翻转：武器绕身体原点 x 镜像到左侧，右侧露出头；锚点链翻转后仍对齐 | PASS |
| 5 | `walk1` 4 帧按 180ms 推进并循环（帧号 + 每帧标记色逐帧验证）；`stand1` 2 帧循环；`jump` 单帧停住 | PASS |
| 6 | 一次性 `action` 事件：`brandish1` 三帧播完后回到**当下** `locomotion`；播放中切 `stand` 则回落 `stand1`；快速重复触发从第 0 帧重启且只播完一次；末帧不冻结 | PASS |
| 7 | 慢速资源（1.2s 延迟的 `stand1` 帧 1 身体）迟到的响应被丢弃：画面保持 `walk1` 且 `ready`，无错误帧 | PASS |
| 8 | 版本冲突：计划版本错误 → `data-render-state=error`，诊断含 `CONTENT_CONFLICT` + 资源逻辑标识；画布清空（1px）无残帧；资源缺失 → `CONTENT_NOT_FOUND` + 缺失 key；纠正计划后恢复 `ready` 且像素正确 | PASS |
| 9 | 断开：Projector 移除节点 → in-flight 读取 signal aborted、位图缓存条目归 0、服务端活动请求归 0；重连同 key 生成新实例正常绘制；旧实例保持已释放 | PASS |
| 10 | 缓存边界：73 张去重画布（> 64 条上限）全部解码后，`diagnostics().cache.entries ≤ 64` 且字节数 ≤ 12 MiB | PASS |
| 11 | 合成 FSDB 产出的计划满足冻结字节上限（纯 Node 断言） | PASS |

（#1–#2 在同一用例内；共 9 个 test 条目，19 项 Node 断言用例另计。）

## 5. 测试执行记录（最终一轮）

```text
node scripts/build.mjs
  → wrote browser/cms-actor.browser.js (34,841 bytes)

node --test components/cms-actor/test/avatar-model.test.mjs components/cms-actor/test/browser-artifact.test.mjs
  → tests 19  pass 19  fail 0

node --test components/cms-actor/test/integration.chromium.test.mjs
  → tests 9  pass 9  fail 0   (duration ≈ 17s, real Chromium)

python -m unittest discover -s tests/wz_fsdb        （回归，确认未受影响）
  → 见 CI；本分支未改动 scripts/wz_fsdb / tests/wz_fsdb
```

## 6. 实际修改文件

**组件（`components/cms-actor/`）**

```text
src/avatar-model.mjs          有界计划校验、有界字节测量、尺寸一致性、跳过层诊断
src/cms-actor.mjs             LRU 位图缓存（64 条/12 MiB，pin 安全）、资源错误码+标识诊断、diagnostics()
browser/cms-actor.browser.js  新增：classic script 入口（入库产物）
scripts/build.mjs             新增：确定性打包器（--check 防漂移）
presentation.json             新增：Web Presentation Config v1 注册声明
DEPLOYMENT.md                 新增：FSDB 放置、MIME、注册步骤、真实素材 BLOCKED 边界
IMPLEMENTATION.md             重写：契约、边界、缓存策略、诊断、测试矩阵、三状态
DESIGN.md                     增补「平台接入」节
preview/index.html,.mjs       改为加载 classic 入口
test/avatar-model.test.mjs    扩至 14 例（边界/字节/一致性/诊断）
test/browser-artifact.test.mjs   新增：产物一致性 + 真实 loom-realm 配置校验（5 例）
test/png.mjs                  新增：无依赖 PNG 编码器
test/synthetic-fsdb.mjs       新增：合成 FSDB 生成器 + Content 索引
test/look-adapter.mjs         新增：游戏侧 Look→avatarPlan 参考适配器（UOL/后缀/钳制/缺件不画）
test/integration.chromium.test.mjs   新增：真实 Chromium 闭环（9 例）
```

**仓库级**

```text
components/README.md          三状态与交付物说明
DESIGN.md                     研究日志一行
.github/workflows/cms-actor-tests.yml  新增 browser-integration 作业（构建 loom-realm dist、安装锁定 Chromium、运行集成测试；含 WZ 素材防提交检查）
```

未修改：`loom-realm/`（子模块指针不变）、`scripts/wz_fsdb/`、`tests/wz_fsdb/`、`content/DESIGN.md`。

## 7. 尚未解决的问题

1. **真实 CMS 079 素材验证（状态 3）BLOCKED**：需要本地 WZ → 转换器 → 真实 FSDB → PREPARE，再重复本闭环。这是 PR 说明中明确保留的验收缺口，不得用合成结果冒充。
2. 真实 `zmap.img` / `smap.img` 数据尚未接入：当前 `zOrder` 由合成 zmap 记录驱动，`islot/vslot` 遮挡规则在适配器侧仍未实现。
3. 表情独立计时（`blink` 等与身体分开的帧钟）未实现；当前脸层跟随身体帧。
4. `WzRecordAlias` 候选解析、技能 `effect` 层、残影/音效不在本组件范围（按 DESIGN）。
5. CI 的 browser-integration 作业在 GitHub ubuntu-latest 上首次运行尚待观察（本地为 Windows + 系统 Edge/Chrome；作业内已按 loom-realm CI 同款方式安装锁定 Chromium）。
6. 缓存字节上限（12 MiB）在合成小图下不会触及，只有条目上限被实测验证；字节路径依赖大图素材，留待真实素材阶段验证。

## 8. PR #2 转 Ready for Review 的评估

满足。理由：

- P0 全部落地：classic script 正式入口（非 module）、presentation.json 注册、MIME essence 规则、Content 逻辑标识 + 版本访问、有界 `avatarPlan`（≤ 262,144 compact 字节并有测试）、构建产物/部署/注册文档；
- P1 全部落地：真实 Chromium 闭环覆盖任务列出的全部场景（bootstrap、注册、Context/attrs/plan 注入、resource 身份、像素/锚点/z 序/翻转、三动作帧推进、一次性动作恢复、快速切换、慢速响应、版本冲突、资源缺失、断开/重连、无错误帧与资源泄漏）、缓存容量与生命周期边界、尺寸一致性校验、过期绘制隔离、可定位诊断；
- 文档与 CI 同步更新，三个验收状态明确区分，第三项如实标 BLOCKED；
- LoomRealm 冻结接口零修改；接口校验未被削弱（fail-closed 全保留并有负面用例）。
