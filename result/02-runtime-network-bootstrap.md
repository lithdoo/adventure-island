# Runtime Network Bootstrap

最低成功标准这次没有达到。客户端没有在可观察的状态下连上 `127.0.0.1:9555`，因此没有客户端握手、没有从客户端收发缓冲解出的业务包，也没有 connect caller 的 RVA。

离线封包脚本已经按 Task 002 的算法写好，并且和本机正在运行的登录服、以及 JAR 里的 `MapleAESOFB` 对上了。

## 1. Environment

| 项 | 值 |
| --- | --- |
| 系统 | Microsoft Windows NT 10.0.26200 |
| Python | 3.14.4，64-bit |
| 调试器 | 没有安装 x32dbg / WinDbg。用 64-bit Python 的 WOW64 调试循环观察 32-bit 进程，断点只打在 `ws2_32` 导出上 |
| 客户端清单 | `requestedExecutionLevel level="requireAdministrator"`。未改 `MapleStory.exe` |
| 隔离 | `netsh advfirewall` 添加出站阻断需要管理员。当前代理令牌不是提升后的，规则没有加上 |
| 公网 | 调试器里准备了“非 127.0.0.1 的 connect 只记目标并改写到本机未监听端口”的逻辑。进程在第一次 connect 之前就退出了，所以这条逻辑没有命中 |
| 服务端 | 捆绑的 MySQL 5.5.53 只绑 `127.0.0.1:3306`。`server.Start` 打出登录端口 9555、频道 7575–7578、商城 8600 |
| 账号 | 没有完成登录。没有把账号、口令或 MAC 写入结果 |

启动调试器时，客户端会自己退出。没有对 HackShield、壳或完整性检查做 patch、禁用或绕过。

## 2. Sample Verification

工作副本：`.work/task-001/extracted/冒险岛online/MapleStory.exe`。

SHA-256：`5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`。

和 Task 001 一致。启动参数是 `MapleStory.exe 127.0.0.1 9555`。

## 3. Runtime Module Timeline

调试器从进程创建开始跟踪。主模块基址是 `0x400000`，和 Task 001 的 ImageBase 相同，这次运行没有被 ASLR 挪走。`SizeOfImage` 是 10330112。

`ws2_32.dll` 还没加载，进程的退出码已经变成 `0xFFFF9108`。已加载模块记在 `result/runtime-module-map.txt`。列表里没有 HShield / ehsvc。

没有调试器时，同一个 exe 可以保持运行，窗口标题是 `MapleStory`。`PrintWindow` 得到全黑画面，符合 DirectX 窗口。那次运行在采样时只连了 `127.0.0.1:17890`，没有连 9555。

## 4. Login Connect

没有记录到客户端对 `127.0.0.1:9555` 的 `connect` / `WSAConnect`。

caller VA、caller RVA、调用栈都空着。`candidate_CClientSocket_Connect` 没有地址。

调试器从启动就附着时，进程死在 WinSock 加载之前。对已经跑起来的进程再 `DebugActiveProcess`，只看到一次 64-bit `ntdll` 断点 `0x80000003`，地址 `0x7ffd72343ab0`，随后进程以退出码 0 结束。这不是一个可用的游戏调用栈。

## 5. Handshake

客户端这条连接上的 15 字节握手没有重组到。

登录服本身会发这条握手。用脚本对 `127.0.0.1:9555` 做了一次独立 TCP 连接（不是 MapleStory.exe），一次 `recv` 得到 15 字节：

```text
0D 00 4F 00 00 00 46 72 7A F0 52 30 78 19 04
```

`scripts/maple079_packet.py handshake` 解析为 version 79、locale 4、client-send IV `46727af0`、client-recv IV `52307819`。这次连接随即关闭，没有发登录包。

## 6. Login Packet

没有客户端 `send` / `WSASend` 样本，所以没有解出 `LOGIN_PASSWORD 0x0001`。

## 7. Receive Path

没有客户端 `recv` / `WSARecv` 的业务密文，所以没有解出 `LOGIN_STATUS`、`SERVERLIST`、`CHARLIST` 或 `SERVER_IP`。

## 8. Crypto Anchors

见 `result/runtime-crypto-anchors.md`。客户端内存里没有命中 AES key、IV 表或 IV 种子。

脚本自检：

```text
python scripts/maple079_packet.py selftest
selftest ok
handshake version 79 locale 4
client_send_iv 46727a11
client_recv_iv 5230787a
```

自检覆盖了：IV 更新结果为 4 字节、两个方向的 `decrypt(encrypt(x)) == x`（含 1500 和 3000 字节）、头长度互逆、握手前缀能抽出 version 79 和 locale 4。

另外用捆绑 JRE 跑了 JAR 里的 `MapleCustomEncryption` 和 `MapleAESOFB`，短包结果和脚本逐字节相同。见 crypto anchors 文档。

## 9. Dispatcher

没有。客户端没有跑到读取明文 opcode 的地方。

## 10. Channel Migration

没有。没有 `SERVER_IP`，没有第二次 connect，没有新的握手，没有 `PLAYER_LOGGEDIN 0x0B`，没有 `WARP_TO_MAP 0x81`。

## 11. Function Candidates

`result/client-function-candidates.csv` 只保留了任务里的候选名字。地址列是空的。

## 12. Blockers

1. 客户端清单要求管理员。代理进程本身没有提升，防火墙规则加不上。提升后的调试器可以启动，但游戏进程活不下来。
2. 调试器在启动时附着：退出码 `0xFFFF9108`，当时还没有 `ws2_32.dll`，也没有游戏窗口。
3. 调试器事后附着：进程退出码 0。没有拿到 32-bit 调用栈。
4. 不附着调试器时进程可以留下，采样窗口里的 TCP 只有 `127.0.0.1:17890`（对端进程名 `Dapan.exe`）。没有出现 9555，因此不能做握手重组和解密。没有再分析 `Dapan.exe`。
5. 后续再次以管理员启动客户端时，UAC 确认没有返回，这次没有新的无调试器进程。

没有为了继续任务去隐藏调试器、改 manifest、改 exe，或动 HackShield。

## 13. Recommended Task 004

先解决“客户端能在可观察的网络边界上活着连到 9555”。在那之前扩大 dispatcher 或 `CField` 没有新的运行时证据。

可执行的下一步仍然是这条链，而不是换一个协议版本：

```text
在不修改 MapleStory.exe、不绕过保护的前提下
让 ws2_32!connect 的 127.0.0.1:9555 命中留下 caller RVA
然后用 scripts/maple079_packet.py 解第一条 C->S 和第一条 S->C
```

封包脚本已经可以复用。缺的是客户端调用栈和真实的客户端字节流。
