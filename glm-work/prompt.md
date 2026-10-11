# CMS079 逆向分析执行提示词

你在 `adventure-island` 仓库里继续国服 079（CMS079）怀旧岛 V5 客户端的逆向研究。用中文工作。先读完本文件，再读 `glm-work/reverse-engineering-plan.md`，然后从计划里当前最高优先级的任务开始做，做完一项再进入下一项。

## 可以读的资料

- `README.md`
- `task/` 全部任务书
- `result/` 全部结论、表格、笔记
- `scripts/` 现有分析脚本
- `reference/`
- `.work/` 里已有的中间产物（只读，用来核对证据）
- `glm-work/reverse-engineering-plan.md` 与本目录里你自己写过的进度

`glm-work/` 已加入仓库 `.gitignore`。搜索工具如果跳过被忽略的文件，用明确路径直接读取本目录。

不要把 `.raw/` 里的客户端、压缩包、密钥或账号复制出来。不要在产物里粘贴大段反汇编、内存 dump 或脱壳后的二进制。

## 只能改 `glm-work/`

创建和修改文件只允许发生在 `glm-work/` 内。下面这些位置一律不要改：

- `task/`、`result/`、`scripts/`、`reference/`、`docs/`、`symbols/`
- `README.md`、`.gitignore` 以及其他仓库根目录文件
- `.raw/`、`.work/`、`.git/`

计划原文里写的产物路径（例如 `result/09-....md`、`scripts/maple079_probe_cfg.py`）在这次会话中改写到 `glm-work/` 下，保持同样的文件名和结构：

```text
glm-work/result/     对应计划中的 result 产物
glm-work/scripts/    对应计划中要新增或规范化的脚本
glm-work/analysis/STATUS.md    进度、当前任务、下一步、阻塞点
```

不要 `git add`、`git commit`、`git push`，也不要改写已有提交。

Shell 命令如果必须运行，它的输出文件也只能落在 `glm-work/`。读取仓库和 `.work/` 可以，向它们写入不可以。

## 研究边界

这是证据驱动的分析：协议梳理、结构恢复、函数命名。

- 不制作外挂，不写可用的封包注入或修改器
- 不 patch 客户端，不伪造 API 返回去逼探针走某一边
- 设备不存在、注册表键不存在时的返回值只作为文档里的预期，不注入模拟器
- 没有证据的地址、opcode、哈希、函数名不要编造；不确定的地方标成假设，并写上来源文件
- 引用已有结论时标明 `task/` 或 `result/` 的文件名

## 怎么推进

1. 以 `glm-work/reverse-engineering-plan.md` 为路线图。当前主线是阶段一：从 Task 011 开始（探针窗口静态 CFG，正常边优先），然后 Task 012。
2. 每个任务按计划里的目标、输入、方法、成功标准和回退路线执行。成功标准达不到时，写清不可解析点和降级产物，不要假装完成。
3. 每完成一个任务，更新 `glm-work/analysis/STATUS.md`，并在计划副本或 STATUS 里回填未决问题。不要改 `glm-work/` 以外的计划原文所依赖的仓库文件；如果要修订路线，把修订写进 `glm-work/reverse-engineering-plan.md` 的文末附录，保留原文。
4. 并行轨道（未加壳 Wizet DLL、reference bundle 核对）只有在不阻塞 Task 011/012 时才做，产物同样放在 `glm-work/`。

开始前先用几句话复述：当前边界、你准备做的任务、产物将要写到哪里。然后直接做。
