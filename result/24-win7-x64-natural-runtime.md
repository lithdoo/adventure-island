# Task 024 — Win7 x64 自然运行观察

结论是 **Route D**。Windows 7 x64 安装介质已经识别，客户机没有启动。没有调试器、没有补丁、没有伪造 SoftICE 或 Oreans 的返回值，也没有打开测试签名或关掉驱动签名强制。

## 1. 起点

| 项 | 值 |
| --- | --- |
| 分支 | `main` |
| STARTING_HEAD | `cbcee5e084763751b4f4f36c5492f84d7a2eaaba` |
| 与上次成功同步的 `origin/main` | 相同 |
| 本次 `git fetch` | 失败，`github.com:443` 连接不上 |
| 任务书文件 | 该 HEAD 上没有 `task/024-win7-x64-natural-runtime-observation.md`。步骤按本次请求里的任务书执行 |

跟踪文件没有未提交修改。仓库里原先就有四个未跟踪的 `glm-work/scratch/*.bin`，没有纳入本次结果，也没有删除。

`.raw/` 只读。ISO 曾以只读方式挂载来读取 `install.wim` 的 XML，读完已卸载。没有改包内文件。

## 2. 安装介质

唯一的操作系统映像候选是：

`.raw/cn_windows_7_professional_x64_dvd_x15-65791.iso`

| 项 | 值 |
| --- | --- |
| 类型 | 可引导 UDF 安装 ISO，不是现成 VHD |
| 大小 | 3,341,268,992 字节 |
| SHA-256 | `f94a0db93bc29cbd1cabb91d2f3d2ead7020c030171a0b14c22b6c879e784aba` |
| 文件系统修改时间 | 2026-10-11T20:47:49+08:00 |
| 映像内时间 | 2009-07-14 20:41:43 |
| 卷标 | `GRMCPRXFRER_CN_DVD` |
| `ei.cfg` | EditionID `Professional`，Channel `Retail`，VL `0` |
| `idwbinfo.txt` | `BuildBranch=win7_rtm`，`BuildArch=amd64`，`OfficialBuild=TRUE` |
| `install.wim` | 4 个映像，全部 **6.1.7600.16385，SPLEVEL 0** |
| 会被 `ei.cfg` 选中的映像 | index 3，`Windows 7 PROFESSIONAL`，显示名「Windows 7 专业版」，语言 `zh-CN` |
| Service Pack | **不是 SP1** |

同目录里的两个 `.rar` 是既有客户端和服务端包，不是 Windows 安装映像，没有当作 Win7 候选。

## 3. 为什么没有建虚拟机

宿主是 Windows 10 Pro，构建 26200，64 位，12 逻辑处理器，约 32 GB 内存。

已经在运行的是 Virtual Machine Platform：`vmcompute` 处于 Running，WSL2 里有 `docker-desktop`。这不是 Hyper-V 虚拟机管理器。

| 组件 | 状态 |
| --- | --- |
| Microsoft-Hyper-V-All 及其子功能 | InstallState 2，禁用 |
| `vmms.exe` | 不存在 |
| `Get-VM` | 不可用 |
| VirtualBox / VMware / QEMU | 没有安装 |
| Windows Sandbox | 功能禁用 |

任务书禁止为了完成本项去安装新的 hypervisor、内核驱动或虚拟化平台。因此没有启用 Hyper-V 角色，没有安装 VirtualBox、VMware 或 QEMU，没有建虚拟交换机，没有虚拟磁盘，没有 `win7x64-clean` 快照。

网络保持未创建。没有桥接，也没有为了测试去放行防火墙。

## 4. 没有做的客户机步骤

以下各项都是 **unknown / not observed**，不是“失败”或“成功”：

- 客户机版本、Service Pack、WOW64、防火墙、Oreans / HackShield / SoftICE 服务的只读查询
- `MapleStory.exe` 在客户机内的 SHA-256。宿主上既有结论仍是 `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`，但本任务没有把客户端复制进 Win7，所以没有在客户机里复核
- 无调试器启动、PID、窗口、对话框正文
- 模块清单，包括 `ws2_32.dll`
- `HSUpdate.exe` / `AspINet.dll` 是否加载，以及 Win7 上有没有 `0xC0E90008`
- `\\.\SICE`、`\\.\SIWVID`、`\\.\NTICE` 的自然返回
- `Oreans.vxd`、`oreans32.sys`、`oreansx64.sys` 的服务或驱动尝试
- `HKCU\Software\Wine` 和 WinLicense 键。没有创建这些键
- 私有网络上的 9555 / 7575–7578 / 8600

没有内存转储，没有关闭签名验证，没有把系统日期改到 2010 年。

## 5. 和现代宿主的关系

现代宿主上已经记录的边界仍然有效，但它们不能外推到 Win7：

- `HSUpdate.exe` 加载未签名 `AspINet.dll` 时，Code Integrity 以 `0xC0E90008` / `VerifiedAndReputableDesktop` 拒绝，并带有 Smart App Control 记录。
- 无调试器启动要么在 `CreateProcess` 就返回 740，要么出现标题为 `MapleStory` 的 `#32770` 对话框，采样窗口内没有 9555 连接。
- SoftICE 三个设备名在这台现代宿主上 `CreateFileA` 失败，错误 2。那是设备不存在时的自然返回。

Win7 x64 是否能越过其中任何一条，这次没有证据。逐项对照在 `result/win7x64-compatibility-delta.md`。

## 6. 里程碑和路线

| 里程碑 | 状态 |
| --- | --- |
| M0 识别 Win7 x64 包 | 达到。专业版 x64 RTM，build 7600，**non-SP1** |
| M1 客户机启动并确认 edition/SP/build | 未达到 |
| M2–M9 | 未达到 |

**Route D。** 最早的阻断在环境：没有可用的 Windows 客户机管理器。这不是客户端、HackShield 或 Oreans 的自然阻断点。

Win7 x86 是否仍要作为兼容性基准：**unknown**。x64 客户机没有跑起来，不能判断 x64 架构本身是不是阻断点。

## 7. 产物

```text
result/24-win7-x64-natural-runtime.md
result/win7x64-image-baseline.csv
result/win7x64-vm-environment.csv
result/win7x64-process-module-observations.csv
result/win7x64-protection-events.csv
result/win7x64-network-observations.csv
result/win7x64-compatibility-delta.md
```

没有新增 `scripts/`。没有客户机可验证的观测脚本。临时的 `ei.cfg` 副本在 `.work/task-024/image/`，不提交。
