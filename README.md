# Markson's Blog

<https://marksoniiii.github.io/> 的源码。网站使用 Astro 构建、GitHub Pages
托管；Markdown 与 Git 仓库是内容的唯一事实源。

## 发布方式

### 1. 浏览器或手机：Pages CMS

1. 打开 <https://app.pagescms.org/> 并使用 GitHub 登录。
2. 安装 Pages CMS GitHub App 时，**只授权 `Marksoniiii.github.io` 仓库**。
3. 进入“博客文章”，创建文章。新文章默认开启“草稿”。
4. 保存草稿可以持续编辑，但不会改变线上网站。
5. 发布时关闭“草稿”，确认发布时间，然后保存。GitHub Actions
   会自动检查并部署；未来时间的文章会在到期后的定时构建中上线。

Pages CMS 的字段、媒体目录和安全限制定义在 [`.pages.yml`](./.pages.yml)。

### 2. VS Code：Front Matter CMS

安装扩展 `Front Matter CMS`，打开仓库后即可使用内容面板、字段编辑、媒体管理和站点预览。
共享配置位于 [`frontmatter.json`](./frontmatter.json)。本地预览前先运行：

```bash
npm ci
npm run dev
```

### 3. 命令行

```bash
# 交互式创建一篇默认不公开的草稿
npm run post:new

# 检查文章字段、链接、图片和路径冲突
npm run content:check

# 查看草稿、定时文章和已发布文章
npm run post:status

# 检查、构建、提交并推送一篇文章
npm run post:publish -- hello-world

# 设定未来发布时间（ISO 8601，推荐明确写 +08:00）
npm run post:schedule -- hello-world 2026-08-20T20:30:00+08:00

# 文章有实质更新时，同时写入 modDatetime
npm run post:update -- hello-world

# 只在本地准备并验证，不提交、不推送
npm run post:prepare -- hello-world
```

推送类命令会要求二次确认，然后确认暂存区为空、拉取远端更新，再执行完整生产构建。为了避免发布
错误，它们只允许从 `main` 分支直接推送；本地预检 `post:prepare` 不受此限制。

## 内容状态

文章存放在 `src/content/posts/`，有三种状态：

| 状态   | 条件                                 | 生产环境                           |
| ------ | ------------------------------------ | ---------------------------------- |
| 草稿   | `draft: true`                        | 不生成页面、列表、标签、搜索或 RSS |
| 定时   | `draft: false`，`pubDatetime` 在未来 | 到达发布时间前不生成               |
| 已发布 | `draft: false`，发布时间已到         | 正常公开                           |

开发环境会显示三种状态，方便本地预览。生产构建严格使用实际发布时间，不提前发布。

Frontmatter 示例：

```yaml
---
title: "文章标题"
description: "用于文章列表和分享的摘要"
pubDatetime: 2026-08-13T20:30:00+08:00
modDatetime:
featured: false
draft: true
tags:
  - 随笔
---
```

文章图片统一上传到 `public/images/posts/`，Markdown 中使用：

```markdown
![准确描述图片内容的替代文本](/images/posts/example.webp)
```

内容检查会拒绝缺少 Alt 文本、文件不存在、不支持格式或超过 5 MiB 的本地图片。
图片文件本身位于公开目录，不要上传尚未脱敏或不应公开的素材。

## 自动化

| 工作流             | 作用                                                             |
| ------------------ | ---------------------------------------------------------------- |
| `Quality checks`   | Pull Request 和非 `main` 分支执行格式、Lint、内容检查与构建      |
| `Build and deploy` | `main` 的公开内容变更、手动操作或到期定时文章部署到 GitHub Pages |
| `Validate content` | Pages CMS 中的“检查文章”按钮                                     |

纯草稿或尚未到期文章的提交会通过完整构建检查，但不会替换生产站点。定时工作流每小时第
17、47 分钟检查一次，故定时发布通常在目标时间后 30 分钟内上线。GitHub Actions 的计划任务
可能有延迟。

### 手动重部署与回滚

1. 打开 GitHub 仓库的 **Actions → Build and deploy → Run workflow**。
2. 留空 `ref`：重新部署 `main` 最新版本。
3. 填入历史 Commit SHA 或标签：构建并部署该版本，实现回滚。
4. 修复问题后，再用 `main` 重新部署，即可回到最新版本。

构建失败不会替换当前线上版本。部署成功后还会自动检查首页和 RSS 地址。

### 失败通知

在 GitHub **Settings → Notifications → System → Actions** 中选择
“Only notify for failed workflows”，即可通过 GitHub 或邮件接收失败通知。计划任务通知发给最后修改
Cron 配置的用户。

## 订阅

- 订阅说明页：<https://marksoniiii.github.io/subscribe/>
- RSS：<https://marksoniiii.github.io/rss.xml>

RSS 包含文章全文、标签、发布时间和更新时间。邮件列表暂未启用，因此没有订阅者数据库、SMTP
和退订合规方面的额外运维。

## 开发与检查

要求 Node.js 22.22.3+、24.16.0+ 或 26.3.0+（自动化使用 Node.js 24.16.0）；仓库提交了
`package-lock.json`，请使用 npm。`.nvmrc` 可帮助版本管理器选择兼容版本。本机版本低于要求时，
npm 会提示 `EBADENGINE`；请先升级 Node.js 再执行发布命令。

```bash
npm ci
npm run dev
npm run format:check
npm run lint
npm run check
npm run build
npm run preview
```

`npm run build` 会依次执行内容检查、Astro 类型检查、静态构建和 Pagefind 中文搜索索引生成。

## 目录

```text
├── .github/workflows/     # CI、内容检查、部署、定时发布与回滚入口
├── .frontmatter/          # VS Code Front Matter 模板和标签数据
├── public/images/posts/   # Pages CMS 与文章共用图片目录
├── scripts/content.mjs    # 创建、检查、状态和发布工具
├── src/content/posts/     # Markdown / MDX 文章
├── .pages.yml             # Pages CMS 内容模型
└── frontmatter.json       # Front Matter CMS 配置
```
