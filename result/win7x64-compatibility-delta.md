# Win7 x64 与当前现代宿主的差异

Win7 客户机没有启动。下表右侧全部是 `not observed`。左侧只引用已经写进 `result/` 的现代宿主观察，不把静态字符串当成运行证据。

现代宿主是 Windows 10 Pro 版本 2009、构建 26200、64 位。相关记录在 `result/03-compatibility-passive-capture.md`、`result/code-integrity-findings.md`、`result/hshield-load-chain.md`、`result/task011-passive-runtime-observation.md` 和 `result/normal-environment-probe-observation.md`。

| 项 | 现代宿主 | Win7 x64 |
| --- | --- | --- |
| MapleStory 启动 | 一次 `CreateProcess` 因 WinError 740 没有建进程。另一次提升后的进程 PID 23452、父 PID 15492 出现过 | not observed |
| 进程是否继续存活 | 提升后的进程在采样窗口内仍在，非提升的 `taskkill` 结束不了它 | not observed |
| 窗口 / 对话框 | `#32770`，标题 `MapleStory`，可见子控件是一个 OK。正文没有读到 | not observed |
| HSUpdate 是否运行 | 那次无调试器的 `MapleStory.exe 127.0.0.1 9555` 采样里没有 `HSUpdate.exe`。更早的 Code Integrity 事件记录过 `HSUpdate.exe` 进程 | not observed |
| AspINet 加载尝试 | confirmed。事件里的进程是 `HSUpdate.exe`，映像是 `AspINet.dll` | not observed |
| AspINet 加载结果 | 拒绝。Status `0xC0E90008`，策略 `VerifiedAndReputableDesktop`，签名数量 0，并有 Smart App Control 事件 3118 | not observed |
| Code Integrity 失败 | 有。`VerifiedAndReputablePolicyState` 为 1，策略没有被改 | not observed。Win7 没有这套 Smart App Control 策略，但是本任务没有客户机事件可对照 |
| SoftICE 探针 | `\\.\SICE`、`\\.\SIWVID`、`\\.\NTICE` 的 `CreateFileA` 返回 `0xFFFFFFFF`，`GetLastError` 为 2。这是宿主上设备不存在时的返回，不是脚本写进去的 | not observed |
| Oreans 运行期活动 | 现代宿主的被动运行没有记录到 `oreans32.sys` / `oreansx64.sys` 的服务创建。驱动名目前是静态字符串 | not observed |
| WOW64 | 宿主是 64 位，客户端是 PE32。提升后的进程没有留下模块清单，不能从那次运行单独证明 WOW64 子系统 | not observed |
| 驱动 / 服务尝试 | 没有运行期的 Oreans 服务安装记录 | not observed |
| ws2_32 加载 | 740 那次没有进程。提升后的那次没有做模块枚举，不能记成 confirmed loaded | not observed |
| 9555 尝试 | 采样窗口内没有到 9555 的新套接字 | not observed |
| 9555 建立 | 没有 | not observed |
| 频道 7575–7578 | 没有 | not observed |
| 商城 8600 | 没有 | not observed |
| 子进程 | 提升后的那次没有记录到 `HSUpdate.exe` | not observed |
| 最早的自然边界 | 现代宿主上，已确认的策略阻断是 `HSUpdate.exe` 加载未签名 `AspINet.dll`。无调试器的游戏进程停在 `MapleStory` 对话框，没有连上 9555 | 更早：没有可用的 Windows 虚拟机管理器，客户机没有启动 |

本表不声称 Win7 x64 比现代宿主走得更远，也不声称它停在同一个对话框。那一次比较没有发生。
