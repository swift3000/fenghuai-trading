# 丰淮商贸采购下单助手 — Git 协作规范

> **配套总纲**：[开发规范.md](./开发规范.md)
> **适用场景**：产品经理（技术小白）+ AI 协作开发
> **核心目标**：让每一次改动都有迹可循，出问题能回退，不丢代码。

---

## 0. 一个类比：Git 是什么？

把 Git 想成**给代码拍照存档的相册**：

| Git 概念 | 类比 | 作用 |
|----------|------|------|
| 仓库 (repository) | 一本相册 | 存所有代码和版本 |
| 提交 (commit) | 拍一张照片 | 记录「这一刻代码长啥样」 |
| 分支 (branch) | 平行宇宙 | 不影响主线，先试试看 |
| 推送 (push) | 上传到云端 | 备份 + 给别人看 |
| 拉取 (pull) | 同步最新 | 拿别人最新的照片 |
| 回退 (revert/reset) | 翻回老照片 | 出问题时回到好的版本 |

**铁律**：代码没提交 = 没存档 = 一断电就没了。**改一点，提一点。**

---

## 1. 仓库初始化

### 1.1 首次初始化（AI 协助执行）

```bash
cd /Volumes/ORICO/项目/餐饮公司
git init
git add .
git commit -m "feat: 初始化项目，包含PRD/TDD/ERD/API文档与原型"
```

### 1.2 远程仓库（推荐）

- 在 GitHub / Gitee / 自建 GitLab 建一个私有仓库
- 关联远程并推送：
```bash
git remote add origin <仓库地址>
git push -u origin main
```
- **私有仓库**，不要公开（涉及业务代码）

### 1.3 .gitignore 必须配置

见 [开发规范.md §4.3](./开发规范.md)。重点是：`node_modules/`、`.env`、`.DS_Store` 绝不提交。

---

## 2. 分支策略（极简版）

技术小白 PM 主导开发，**不需要复杂分支模型**，用两分支足够：

```
main（主线，始终可用）──────────────────────────●────●────●────→
        \                              /
         dev（开发中）  ──●──●──●──●──●
```

| 分支 | 作用 | 规则 |
|------|------|------|
| `main` | 稳定版，能演示给老板看 | 只接受从 dev 合并，不直接改 |
| `dev` | 日常开发 | 你和 AI 在这里改代码 |
| `feat/xxx` | 新功能分支（可选） | 大功能才用，做完合并回 dev |

**小白默认工作流**：直接在 `dev` 上改，改完合并到 `main`。功能分支等熟练了再用。

### 2.1 分支命名

- `feat/功能名`：新功能，如 `feat/order-print`
- `fix/问题名`：修 bug，如 `fix/login-redirect`
- `hotfix/问题名`：线上紧急修复

---

## 3. 提交信息规范（Conventional Commits 简化版）

### 3.1 格式

```
<类型>: <简短描述>

[可选] 详细说明
```

### 3.2 类型（只用这 6 个）

| 类型 | 含义 | 举例 |
|------|------|------|
| `feat` | 新功能 | `feat: 新增订单创建功能` |
| `fix` | 修 bug | `fix: 修复订单列表分页错误` |
| `docs` | 改文档 | `docs: 更新PRD订单模块` |
| `style` | 改样式/格式（不改逻辑） | `style: 调整商品卡片间距` |
| `refactor` | 重构（不改功能） | `refactor: 抽取订单计算逻辑` |
| `chore` | 杂项（配置、依赖） | `chore: 配置ESLint` |

### 3.3 描述写法

- 用中文，一句话说清「做了什么」
- 不超过 50 字
- 不写「update」「fix bug」这种废话

```bash
# ✅ 好
git commit -m "feat: 新增订单创建功能，支持件价零价双轨计价"
git commit -m "fix: 修复客户列表搜索无响应的问题"
git commit -m "docs: 补充ERD中订单快照字段说明"

# ❌ 差
git commit -m "改了点东西"
git commit -m "update"
git commit -m "111"
```

### 3.4 提交粒度

- **一次提交一件事**：一个功能 / 一个 bug / 一类改动
- 不要一次提交 5 个不相关的改动
- 改完一个独立点就提交，不要攒一周再提

---

## 4. 你的标准工作流（PM + AI 协作）

这是你日常最常用的流程，记住这 5 步：

```
1. 改代码（你改 UI/文案，或让 AI 写功能）
2. 说「提交」→ AI 执行 git add + commit
3. （可选）说「推送」→ AI 执行 git push
4. 要发布时 → AI 把 dev 合并到 main
5. 出问题 → AI 帮你回退到上一个好版本
```

### 4.1 日常提交模板（AI 执行）

你说「提交」时，AI 会：
```bash
git status                    # 看改了啥
git diff                      # 看具体改动
git add <相关文件>             # 只加相关文件，不加全部
git commit -m "<类型>: <描述>" # 按规范写信息
git status                    # 确认提交成功
```

**注意**：AI 默认只 `git add` 你这次改的相关文件，不用 `git add .` 全加，避免误提交敏感文件。

### 4.2 推送到远程

你说「推送」时：
```bash
git push origin dev
```

### 4.3 发布到 main

功能在 dev 验证通过，要发布时：
```bash
git checkout main
git merge dev
git push origin main
git checkout dev      # 切回 dev 继续开发
```

---

## 5. 回退与救援

### 5.1 刚改完还没提交，想撤销

```bash
# 撤销工作区改动（永久丢弃，不可恢复）
git checkout -- <文件>
```
⚠️ 这会丢掉你这次的改动，确认后再用。

### 5.2 提交了，但想撤销这次提交

```bash
# 撤销最近一次提交，但保留改动在工作区
git reset --soft HEAD~1
```
**推荐用这个**，不丢代码。

### 5.3 已经推送了，想撤销

用 `revert`（安全，不删历史，生成一个反向提交）：
```bash
git revert <commit-id>
git push origin dev
```
**线上历史不删，只追加「撤销」提交**，这是最安全的做法。

### 5.4 找回丢失的代码

```bash
git reflog   # 看所有操作记录
```
AI 可以帮你从 reflog 里找回误删的提交。

### 5.5 紧急情况找 AI

任何时候代码出问题，把情况告诉 AI，让 AI 来操作 Git。**不要自己乱敲 reset --hard、push --force**，可能把代码搞没。

---

## 6. 禁止事项

| 禁止 | 原因 |
|------|------|
| `git push --force` 到 main | 会覆盖别人提交，历史丢失 |
| 提交 `.env` / 密钥文件 | 泄露风险 |
| 提交 `node_modules/` | 体积巨大，无意义 |
| 一次提交堆 10 个功能 | 无法回退单个功能 |
| 提交信息写「111」「test」 | 三个月后自己都看不懂 |
| 在 main 上直接改大功能 | main 可能进入不可用状态 |

---

## 7. 版本标签（Tag）

发布正式版本时打 tag：

```bash
git tag -a v0.1.0 -m "v0.1.0 核心闭环版：下单/审核/打印/导出"
git push origin v0.1.0
```

对应 [开发规范.md §7.1](./开发规范.md) 的版本号规范。每个里程碑打一个 tag，方便随时回到某个发布版本。

---

## 8. 协作冲突处理

如果未来有其他人加入，或你在两台电脑上改：

```bash
git pull origin dev      # 先拉最新
# 如有冲突，AI 帮你解决冲突
git add <解决后的文件>
git commit -m "merge: 合并远程更新"
git push origin dev
```

**冲突解决交给 AI**，你只需描述「保留我的还是对方的」。

---

## 9. 常用命令速查（贴墙上）

| 场景 | 命令 |
|------|------|
| 看状态 | `git status` |
| 看改了啥 | `git diff` |
| 看提交历史 | `git log --oneline -10` |
| 提交 | `git add <文件> && git commit -m "类型: 描述"` |
| 推送 | `git push origin dev` |
| 拉取 | `git pull origin dev` |
| 切分支 | `git checkout dev` |
| 撤销最近提交（保留改动） | `git reset --soft HEAD~1` |
| 安全撤销已推送 | `git revert <commit-id>` |

**记住**：90% 的时候你只需要说「提交」「推送」，AI 会帮你执行。命令是给 AI 看的，你只需理解原理。
