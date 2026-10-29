# LoomRealm empty application scaffold

> 任务：以最小可运行的空应用接入 LoomRealm 平台，为后续集成与回归测试打底。
> 基线：`loom-realm` submodule 固定在 `c5217e47be5a43f974e9e6ce82230077fb639c39`。
> 本文件记录脚手架结构、对 PokeMan 先例的取舍、验证命令与后续 CMS 任务的扩展方式。

## 1. 创建的脚手架

```text
apps/pwa/                      PWA 平台入口（安装根目录，installation root）
  game.json                    Game Entry V1：声明唯一子系统 smoke，initial.input = null
  launch.pwa.json              PWA launch composition：smoke → subsystems/smoke.mjs
  subsystems/smoke.mjs         安装根内的绑定 shim，再导出共享实现
  README.md
apps/hostra/                   Hostra 平台入口（安装根目录，同一空应用）
  game.json                    与 apps/pwa/game.json 完全相同
  launch.hostra.json           Hostra launch composition：smoke → subsystems/smoke.mjs
  subsystems/smoke.mjs         安装根内的绑定 shim，再导出共享实现
  README.md
systems/loomrealm-smoke/       共享无操作（no-op）smoke 子系统 + 冒烟验证套件
  subsystem.mjs                依赖无关的子系统实现（default 导出 SubsystemDefinitionFactory）
  test/smoke.test.mjs          无头冒烟验证（node --test）
  package.json                 仅暴露 npm test 入口，无任何依赖
  README.md
result/loomrealm-empty-app.md  本文件
```

两个平台入口是**同一个空测试应用**：Game Entry 逐字节同构（同一 JSON 文档），绑定同一个子系统键
`smoke`，两个 shim 再导出同一份 `systems/loomrealm-smoke/subsystem.mjs`（测试用 realpath 断言两处
shim 解析到同一物理文件）。

### 最小拓扑的依据

最小拓扑不是从 PokeMan 抄来的，而是由固定版本 LoomRealm 的现行 API 决定的：

- `packages/game-package/src/validate.ts`：`formatVersion`、`initial`（含 `subsystem` 与任意 JSON
  `input`，`null` 合法）、`subsystems` 为必填；`initial.subsystem` 必须在 `subsystems` 中声明；
  `state` 可省略。
- `packages/game-launcher-hostra/src/manifest.ts` 与 `packages/game-launcher-pwa/src/index.ts`：
  launch composition 为 `{ formatVersion: 1, subsystems: [{ key, module }] }`；module 必须是位于
  安装根内的 `.mjs` 相对路径。
- `packages/game-launcher-hostra/src/launch-plan.ts`（`joinBindings`）：Game Entry 与 launch
  manifest 的子系统键集合必须双向一致。
- `packages/game-launcher-hostra/test/e2e.test.mjs`：固定版本自己的端到端测试以
  `initial: { subsystem: "root", input: null }` + 单子系统 + 无 `state` 的安装根跑通真实
  Main + Hostra 启动，子系统模块是**不含任何 import 的普通 .mjs**（default 导出工厂，frame 返回
  `{ type: "completed", value }`）。本脚手架照此采用「一个子系统 + null 输入 + 无 state」的最小拓扑。
- `packages/game-launcher-pwa/src/index.ts`（`buildPwaExecutableIndexV1`）：PWA 可执行模块的 ESM
  图只允许安装内相对导入，不允许裸 `@loomrealm/*` 导入。因此共享子系统实现写成依赖无关模块，
  它本身就是合法的 PWA executable（`imports: []`），无需打包步骤。

### 子系统为何依赖无关

`systems/loomrealm-smoke/subsystem.mjs` 不 import `@loomrealm/subsystem`，而是内联保持同一 ABI：
default 导出 `(scope) => ({ frame() })` 工厂，`frame` 返回与 `completed()` 同形的冻结
`{ type: "completed", value }`。理由：

1. 仓库根目录没有 npm workspace，裸 `@loomrealm/*` 只能在 submodule 构建并安装后解析；
2. 冒烟验证必须在裸 checkout 上确定性地通过（不联网、不构建 submodule、不改动 submodule）；
3. 固定版本的 Hostra e2e 与 PWA executable 规则都以上述「无依赖 .mjs」为合法形态。

当 submodule 已构建时，测试会额外用真实 SDK 交叉验证：`defineSubsystem` 接受该工厂并原样返回，
`completed()` 与本模块的 Frame 输出深度相等。

## 2. 有意复用的 PokeMan 约定

| 约定 | 来源 | 复用方式 |
|---|---|---|
| 安装根内三件套 `game.json` + launch manifest + `subsystems/*.mjs` 目录 | `examples/PokeMan/` 目录布局 | `apps/pwa`、`apps/hostra` 各自成为自包含安装根 |
| Game Entry V1 文档形状（`formatVersion: 1`、`initial`、`subsystems: [{ key }]`） | `examples/PokeMan/game.json` | 同 schema，仅一个子系统 |
| launch composition 形状（`{ formatVersion: 1, subsystems: [{ key, module }] }`，module 为安装根内相对路径） | `examples/PokeMan/launch.pwa.json` / `launch.hostra.json` | 同 schema，仅一个绑定 |
| 逻辑模块路径命名 `subsystems/<key>.mjs` | PokeMan 的 `subsystems/base.mjs` 等 | `subsystems/smoke.mjs` |
| 「PWA 与 Hostra 描述同一逻辑拓扑」的双平台一致性 | PokeMan 两个 launch manifest 同子系统集合 | 两入口共享同一 Game Entry 与同一实现 |
| 无操作子系统的 `frame → completed({ status, subsystem })` 模式 | `examples/PokeMan/subsystems/_empty.mjs` | `SMOKE_FRAME_VALUE = { status: "ok", subsystem: "smoke" }` |
| 无头冒烟测试写法（node:test + 读取安装根 JSON + 校验 manifest 绑定一致性） | `examples/PokeMan/test/map-smoke.test.mjs`、`test/pwa-content.test.mjs` | `test/smoke.test.mjs` 的基础层 |

## 3. 有意省略的 PokeMan / 游戏专用内容

- 不复制 `base + map + dialogue` 拓扑：那是 PokeMan 的产品私有拓扑。空应用只需要一个子系统。
- 不复制任何地图/对话/战斗逻辑：无 `@loomrealm-game/map`、`rpg-dialogue`、`common-controls` 依赖。
- 不含 FSDB Content：没有 `[FSDB]PokeMan/` 类目录、没有 `presentation.json`/`presentation.css`、
  没有 Presentation styles/scripts 引用。
- 不含 PokeMan 的初始输入语义（`mapId/x/y/characterName`）：`initial.input` 为 `null`。
- 不含 `initial.state`（Shared State 初始记录）：空应用不持有任何持久产品状态。
- 不含 `play.bat`、Windows 启动器、presentation 同步脚本、esbuild 打包流水：均服务于 PokeMan 的
  真实内容，空应用用无头验证代替。
- 不含任何 CMS 079 客户端数据：本任务与 `F:\CMS079` 完全无关，验证不读取任何本地专有数据。

## 4. 冒烟验证命令

审阅本脚手架时首选的单一命令（在仓库根目录执行）：

```bash
npm test --prefix systems/loomrealm-smoke
```

它与 `node --test systems/loomrealm-smoke/test/smoke.test.mjs` 完全等价（该 package 的
`test` 脚本就是后一条命令）：确定性、无网络、无浏览器、无 CMS 数据、不构建也不改动
submodule。

**审阅门（review gate）**：裸 checkout 上的验收信号是 `fail 0`；三个深层用例的 skip 不阻塞
审阅。

基础层（始终运行，确定性、无网络、无浏览器、无 CMS 数据、不构建/不改动 submodule）覆盖：

1. 两个平台入口的 `game.json` 解析并按 Game Entry V1 结构校验，且为同一最小文档；
2. `launch.pwa.json` / `launch.hostra.json` 按 launch composition 规则解析，绑定与 Game Entry
   双向一致（`joinBindings` 语义），逻辑模块按 `resolveInstallationModule` 语义解析到安装根内
   真实 `.mjs` 文件，shim 再导出链解析到共享实现；
3. no-op 子系统可导入、可构造、`frame` 返回冻结的 completed 结果且逐帧确定，不触碰任何 scope
   能力、不调用其它子系统；
4. 固定版本 PokeMan 参考文件仍满足同一套结构规则（校验器对参考实现的回验）；
5. 脚手架依赖的固定版本 loom-realm API 源文件都在 checkout 的 submodule 中存在。

深层增强（同一命令自动启用，条件是 submodule 已就地构建：在 `loom-realm/` 内执行
`npm install && npm run build:packages`）额外覆盖：

6. 真实 `parseGameEntryV1` / `parsePwaLaunchManifestV1` / `parseHostraLaunchManifest` 校验全部文档；
7. 真实 `prepareHostraGame` 解析 `apps/hostra` 安装根（含物理模块解析与运行时预检）；
8. `buildPwaExecutableIndexV1` 证明共享子系统源码本身就是合法 PWA executable 图（`imports: []`）；
9. 真实 `@loomrealm/subsystem` SDK 与无依赖 ABI 交叉验证；
10. 真实 Main + Hostra 托管启动空应用直到初始 Frame 完成
    （`prepareHostraGame` + `runMain`，结果为 `root-outcome: completed { status: "ok", subsystem: "smoke" }`）。

在本次运行环境（容器 runner `opencode`/`adventure-island`，裸 checkout、submodule 未构建）实测：

```text
node --test systems/loomrealm-smoke/test/smoke.test.mjs
# tests 9  pass 6  fail 0  skipped 3（深层增强因 submodule 未构建而按设计跳过）
```

**`skipped 3` 是预期结果，不是失败**：套件共 9 个用例，其中 3 个「深层 LoomRealm 验证」用例
（对应上文深层增强清单的第 6–10 项：真实 parse/prepare/build API 校验、真实
`@loomrealm/subsystem` SDK ABI 交叉验证、真实 Main + Hostra 托管启动）依赖固定版本 submodule
的构建产物（`loom-realm/packages/*/dist/` 下的 JS 模块）。在裸 checkout、submodule 尚未构建
（即未在 `loom-realm/` 内执行 `npm install && npm run build:packages`）的环境里，这 3 个用例
按设计自动跳过，skip 原因中会注明 `loom-realm packages are not built`。因此裸 checkout 上的
预期输出就是 `pass 6 / fail 0 / skipped 3`：基础层 6 个用例（对应基础层清单的第 1–5 项，含
两平台 Game Entry 与 launch composition 校验、子系统构造、PokeMan 参考回验、submodule 文件
存在性）全部通过即代表脚手架有效；只有出现 `fail` 才需要关注。构建 submodule 后重跑同一命令，
这 3 个用例会自动启用。

关于 submodule 自带的验证：固定版本的 PokeMan 测试（如
`node --test examples/PokeMan/test/map-smoke.test.mjs`）需要 workspace 内解析 `@loomrealm/*` 与
`@loomrealm-game/*`，即必须先在 submodule 内 `npm install` + 构建；在不修改 submodule 的前提下
无法调用，故未在本次验证中运行（上表基础层即为替代的无头验证）。

## 5. 后续 CMS 任务如何扩展

1. **新增真实子系统**：在 `systems/` 下新建目录（如 `systems/cms-map/`），实现
   `SubsystemDefinitionFactory`；后续需要 SDK 时可直接 import `@loomrealm/subsystem`（代价是该
   子系统的验证需要已构建的 submodule；发布为 PWA executable 时需打包，参照 PokeMan 的
   esbuild 产物约束「无裸 `@loomrealm/*` 导入」）。
2. **接入拓扑**：向 `apps/pwa/game.json` 与 `apps/hostra/game.json` 的 `subsystems` 增加键、
   `initial` 改指向新入口子系统并在 `launch.pwa.json` / `launch.hostra.json` 增加对应绑定与
   安装根 shim；两入口继续保持同一 Game Entry。
3. **引入状态**：需要会话事实时给 Game Entry 增加 `state.records`（Shared State 初始记录），并让
   子系统通过 `scope.state` 访问——权威模型按 DESIGN.md 归 Shared State。
4. **引入内容**：需要地图/怪物/物品定义时按 `content/DESIGN.md` 的 FSDB 方案接入 Content，子
   系统经 `scope.content` 读取；合成夹具进仓库，真实 079 客户端内容只在使用者本地打包时进入。
5. **冒烟套件保持有效**：`test/smoke.test.mjs` 的结构校验器已兼容多子系统与 `state` 段；扩展后
   只需更新 `EXPECTED_*` 常量或为其增加独立用例。`systems/loomrealm-smoke` 本身可长期保留，
   作为「空拓扑」回归基线与后续子系统的冒烟模板。
6. **平台差异**：PWA 侧将来接 `loom-realm/apps/pwa` 的安装发布链（executable index + Content）；
   Hostra 侧保持 `prepareHostraGame` 直接可启动。`apps/*/subsystems/*.mjs` shim 是两条链共同的
   安装根锚点。

## 6. 边界确认

- 未修改 `loom-realm/**`、`.github/**`、`task/**`、`scripts/**`、`components/**`、`libs/**` 及
  其它 `systems/**`（`git status --porcelain` 仅显示 Allowed Paths 内新增文件）。
- 未新增 WZ、客户端二进制、档案、凭据或任何专有输入。
- 未读取 `F:\CMS079`；验证全程无浏览器、无外部网络服务。
