# glm-work 进度状态

> 更新：2026-10-11（会话 3 续）
> 路线图：`glm-work/reverse-engineering-plan.md`（v1.0 + 附录 E）
> 边界：只创建/修改 `glm-work/` 内文件；产物路径按 prompt.md 映射（`glm-work/result/`、`glm-work/scripts/`、`glm-work/analysis/`）
> **2026-10-11 边界变更记录**：应用户显式指示，`glm-work/result/` 的 16 个产物已逐字节同步（SHA-256 校验一致）到仓库 `result/`——这是对 prompt.md"只改 glm-work"约束的一次性放宽，仅限此次拷贝；未执行任何 git add/commit/push。脚本仍在 `glm-work/scripts/`（glm-work 被 .gitignore，如需入库需另行同步到 `scripts/`）。

## 当前状态

**Task 022（WZ 目录级清单）✅（会话 3，采用成熟库 wz-python）**。此前：Task 011/012/012b ✅、轨道 A 两轮 ✅、轨道 B ✅。主线下一推进点=Task 013（VM，阻塞）或 Tail A 物化触发（阶段二）。

### 会话 3 增量（详见 `glm-work/result/20-wz-inventory.md`）

- **Q11 收口 ✅**：List.wz 完全解码——无独立头；记录=`[类型前缀][dword 名长][UTF-16LE 路径]`；加密=WZ AES 密钥流（私服 IV）**逐串从 0 连续异或**；**1,258 条外链 img 挂载表**（character 513/map 297/mob 184/…），零间隙覆盖全文件。产物 `listwz-entries.csv` + `scripts/maple079_listwz.py`。破题路径：密钥流相位扫描（16B"常量"在相位 0 解出 `characte`）。
- **成熟库接入**：wz-python（MIT，`.work/tools/`，commit `79344c9` 记录在案）——16 个 PKG1 归档全部解析、**version=79** 独立复核；内容级解析验证通过（TamingMob/0001.img 属性树）；客户端↔服务端 String.wz 条目集合一致。
- **私服 IV 定位**：`B9 7D 63 E9`（内置 EMS 值；BMS/GMS 双乱码对照）——后续 WZ 字符串/属性解码的必备参数。
- **目录树全量**：~36,000 张 img（Character 25,565 / Map 4,614 / Mob 1,617 / Npc 1,608 / Reactor 463 / Item 475 …）；Base.wz 15 个链接子目录与其余 15 个 WZ 文件**双向零差**（命名空间树投影验证）。产物 `wz-directory-index.csv`、脚本 `maple079_wz_dir.py`。
- **机制总图**：PKG1 内=固定 IV AES 密钥流（成熟库全覆盖）；List.wz=同一密钥流的逐串复位变体（已破）；NameSpace/PCOM 追的"按名键控"实为命名空间哈希桶机制（`h=h*32+c+1`），非字节密码。

### 会话 2 续增量

- **List.wz 序列化链追踪到底层**（NameSpace↔PCOM 跨 DLL 五跳）：入口 Open=`0x13729` → 宽名散列键 → PCOM 晚绑定（`LoadLibraryA("PCOM.DLL")`+GetProcAddress ×5，解循环导入；坐实 `WS2_32.DLL` 表项同类）→ `PcSerializeString(0x6411)`（键双字高位选路、低两字节=模式标志，`(key,~key)` 选方向）→ 实体 `0x64E3` → **读路径 `0x7575` 族（逐字节变换最终落点）**。修正两处中途误判（GUID≠主密钥、晚绑定≠密码表）。Q11 只剩最后一跃。
- **探针前 resolver 全录**（`scripts/maple079_walker_log.py`，第三次 replay+walker 钩子）：5 次解析全命名——LoadLibraryA×2 / GetLocalTime（wrapper 形态，描述符→校验和管线证实）、**MessageBoxExA（user32，`0x8594FF`）**、**CreateFileA（`0x8595E7`，round-3 明文区——SICE 探针 API 解析点定位）**。字典 **25/25**。
- **PKG1 头布局定案**（文件直析）：`"PKG1"` + dword(每文件异) + 0 + `0x3C`(头长) + 44 字节标识串 `Package file v1.0 Copyright 2002 Wizet, ZMS\0` = 0x3C 字节。
- **List.wz 结构起步**：`05 00 00 00` 头 + 记录流（`ac 52`+计数+16 字节固定签名 × ~370 条、变长载荷）；已知明文攻击（17 文件名 × 12 种简单变换）全部负——解码需反汇编读取封装（下一轮）。
- **NameSpace 挂载机制**（函数 `0x13070` 全解剖）：头校验=流对象虚方法 `[eax+0x18]`（thiscall 读 0x3C 字节，引用点 `0x137BA`）；`PKG%04x.tmp`=**GetTickCount 防冲突暂存文件**（`ERROR_ALREADY_EXISTS/FILE_EXISTS` 换号重试、`./` 回退；wsprintfA 为 IAT 实证，另 4 个 API 走 Wizet 自建 `0x1E7xx` 分发槽）；懒创建（`[this+0x14]==0` 触发）；COM HRESULT 错误纪律。~370 条 List.wz 记录=该暂存机制的输出对象之一（待读取封装反汇编后解码）。

### 轨道 A 成果（详见 `glm-work/result/19-wizet-dlls.md`，含第二轮 §4）

- 全 10 个未加壳 DLL 清单（`wizet-dll-inventory.json` + `resman-entry-points.csv`，工具 `scripts/maple079_wizet_dlls.py`）。
- 体系=COM 工厂 + PCOM 对象模型（`PcInitModule/PcCreateObject/PcRootNameSpace/PcSerialize*`）。
- **`List.wz` 消费方式定位**（Q11 推进）：PCOM `0x6CC7` 用 exe 目录拼接 `List.wz` 作为资源根；Canvas `0x20BC4` 同引。
- **PKG1 处理器在 NameSpace.dll**（`PKG1`+`Package file v1`+`PKG%04x.tmp`）。
- **WZ 解压链 Canvas→ZLZ 证实**；ZLZ 导出 C++ 签名直读（`ZIStream* ZLZCreateInflator(int,ZIStream*,uint)`）；PDB 路径含 **`ztl`**（官方库词根，连上 ZtlTaskMem*）。
- RTTI 真类名实测（CWzCanvas/CWzRawCanvas）→ RTTI 命名路线可行。
- **WzMss=官网 SOAP 客户端**（负结论：与游戏服协议无关，作种子反判别器）；`PWS2_32.DLL` 定性=序列化组件表条目（九 DLL 全无延迟导入）。

### 轨道 B 成果（详见 `glm-work/result/trackB-seed-readiness.md`）

- 仓库 derived 种子表核对合格（Q13 ✅）；本会话补：就绪度对接文档 + 种子扫描器 `scripts/maple079_seed_scan.py`（冒烟通过：探针窗口 0/33 命中，符合预期）+ 三条新判别器（WzMss 反判别、ztl 词根、RTTI 可行性）。

### Task 012b 成果（详见 `glm-work/result/10b-static-extension.md`）

- **resolver 字典 23/23**（`resolver-api-dictionary.csv`）：直接调用形态的 imm32 即名字校验和（助程 `0x81CEC7` = walker 入口，`edx=[esp+0x28]`）；地面真值法=真 walker 插桩（钩 `0x81D13C/0x81D184`）枚举 kernel32 1669/advapi32 853/user32 1043/ntdll 2517 名。工具：`scripts/maple079_checksum_table.py`。
- **注册表集群五槽命名**：`0x859CE5=RegCreateKeyA`（创建！）、`0x859CE1=RegFlushKey`、`0x81A829=RegSetValueExA`、`0x8191E9=RegCloseKey`、`0x819C95=RegQueryValueExA`——Task 011 形状级判断两处被推翻，干净系统预期反转（创建成功）。
- **Q16 解决**：flag 槽 `0x81BAB5/0x8191F1` 的 7 个写入点全在**命令行开关解析器**（`0x85A5E6–0x85A9AA`，`mov dword [slot],1`）——集群/驱动段 thunk 仅由开关激活，自然路径恒跳过。
- **驱动段 API 名单全解**：事件三件套（XprotEvent）、DeviceIoControl、`HKCU\Software\Wine` 探针=真 RegOpenKeyA、GetWindowsDirectoryA/GetFileSize（Oreans.vxd 已装检查）等。
- **Q15 盲测负结果**：11 个已见变换常数对 `0x862000+`（~700KB）全部无结构涌现；解码器 C 不复用已知常数。
- **VxD 载荷**：`0x85B405` = 386/VxD LE、~10KB（0x27C0）、单对象、设备名 `XPROTVXD`——写入 `%s\Oreans.vxd` 的本体。

### 既有成果索引

- Task 012：`result/10-post-probe-stage.md`（M2=解码器 A/B+驱动段 `0x85FCC0` 152 块；**round 3 定案** producer `0x8593E3`、`dst=((src+0x3DDF4CA1+0x1C39E09C)&0xFFFFFFFF)^0x61799419`、span `0x85941A–0x85FA3D` 6537 dword 全验证；scripts：`maple079_post_probe_scan.py`/`maple079_wide_capture.py`/`maple079_write_logger.py`）
- Task 011：`result/09-probe-cluster-full-cfg.md`（探针窗口 CFG/调用点全表 + 勘误；`probe-window-cfg.csv`/`probe-call-sites.csv`/`maple079_probe_cfg.py`；其 §4 已追加 012b 字典更新节）

### 对仓库既有结论的修正登记（仓库文件未动）

- Task 011：NTICE 测试/miss 边 RVA ×5 文件；WLkt 根键；`0x859EBE` 性质；集群值写形状"same shape"说法。
- Task 012：span1 SHA 时点（解码器 A 后中间态，B 会改写重叠区 `0x85AA4B–0x860293`）；"driver body 未走"；"`\\.\oreans32` callsite unresolved"；探针前解码链缺 round3。

## 下一步（阶段一收尾评估 → G1/G2）

1. **G1 判定**：已达成（静态到达非探针阶段——驱动安装段）。按路线图评估阶段二入口；Tail A materializer 未在任何可读区出现。
2. **Task 013（兼容环境自然观测）**：受轨道 C（Win7 x86 VM 介质）阻塞，维持不可行；本会话不推进。
3. **建议 Task 012b（低成本静态延伸，下一会话）**：① 对 T2 块 `0x862000–0x912000` 做 round-3 同族常数盲测（add/add/xor、xor/xor/sub 组合）；② walker 描述符立即数字典化——Task 009 已恢复名字校验和（首字符门 + AX/BX 混合 xor 0x5041/0x5449），可枚举候选 API 名静态求解 ~20 个描述符；③ flag 槽 `0x81BAB5`/`0x8191F1` 写入者搜索。
4. 并行轨道 A（未加壳 Wizet DLL）/轨道 B（reference bundle，v95 材料 6 个 commit 已在库）不阻塞主线，可随时插入。

## 阻塞点

- 无新方法论阻塞；静态路线已达"探针停点捕获 + 离线确定性解码"方法论极限，深入需上述三项静态延伸或 VM 自然观测。
- 既有环境阻塞不变（Smart App Control 拒 AspINet、无名对话框、无 VM 介质——Task 005/010 记录）。

## 未决问题回填（计划 §4.3）

- Q1 探针集群控制流/收敛：✅ Task 011。
- Q2 注册表集群语义：✅ **完全解决**（Task 012b 字典：五槽命名 + 预期反转 + 开关激活机制）。
- Q3 探针后新解码轮：✅ 探针前 round 3 定案（Task 012）；探针后 A/B 已录；`0x862000+` 后续轮盲测排除已见常数（Task 012b 负结果）。
- Q4 Tail A materializer：❌ 未出现（两次 replay 复核全零；无地址形成）。
- Q14 task-011 起步脚本：✅。
- Q15 `0x862000+` 解码轮：❌ 盲测负结果；需运行态（VM）或新思路。
- Q16 flag 槽写入者：✅ 开关表解析器（`0x85A5E6–0x85A9AA`，mov [slot],1）。
- Q17（新）resolver 描述符字典：✅ 直接形态 imm=校验和已证；walker 插桩法可即时命名任何未来 imm（工具 `maple079_checksum_table.py`）。遗留：wrapper `0x821750` 形态（描述符游标式，`push imm; jmp`）尚未解码——已知 5 个训练对可后续攻。
