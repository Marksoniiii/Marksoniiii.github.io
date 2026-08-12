#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "@astrojs/markdown-remark";
import * as yaml from "js-yaml";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..");
const POSTS_DIR = join(ROOT, "src", "content", "posts");
const PUBLIC_DIR = join(ROOT, "public");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".md", ".mdx"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

const mode = process.argv[2] ?? "help";
const args = process.argv.slice(3);

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function postFiles() {
  return walk(POSTS_DIR)
    .filter(file => ALLOWED_EXTENSIONS.has(extname(file).toLowerCase()))
    .filter(
      file =>
        !relative(POSTS_DIR, file)
          .split(/[\\/]/)
          .some(part => part.startsWith("_"))
    );
}

function formatShanghaiDate(date = new Date()) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+08:00`;
}

function asYamlDate(value) {
  if (!validDate(value)) return value;
  return value instanceof Date ? value : new Date(value);
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parsePost(file) {
  const source = readFileSync(file, "utf8");
  const { frontmatter, content } = parseFrontmatter(source);
  return { file, source, data: frontmatter, body: content.trim() };
}

function validDate(value) {
  return value instanceof Date
    ? !Number.isNaN(value.getTime())
    : (typeof value === "string" || typeof value === "number") &&
        !Number.isNaN(new Date(value).getTime());
}

function resolvedLink(file, url) {
  const cleanUrl = url.split(/[?#]/)[0];
  if (cleanUrl.startsWith("/")) {
    return join(PUBLIC_DIR, decodeURIComponent(cleanUrl.slice(1)));
  }
  return resolve(dirname(file), decodeURIComponent(cleanUrl));
}

function shouldResolveLocalLink(link) {
  if (link.image) return true;
  const cleanUrl = link.url.split(/[?#]/)[0];
  // Extension-less URLs are site routes (for example /about/ or ../posts/foo/).
  // Astro validates generated routes during the build; filesystem checks here
  // are reserved for local documents and media files.
  return extname(cleanUrl) !== "";
}

function collectMarkdownLinks(body) {
  const links = [];
  const regex = /(!?)\[([^\]]*)\]\(([^\s)]+)(?:\s+["'][^"']*["'])?\)/g;
  let match;
  while ((match = regex.exec(body)) !== null) {
    links.push({ image: match[1] === "!", label: match[2], url: match[3] });
  }
  return links;
}

function collectHtmlImages(body) {
  const images = [];
  const regex = /<img\b([^>]*)>/gi;
  let match;
  while ((match = regex.exec(body)) !== null) {
    const attributes = match[1];
    const src = attributes.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    const alt = attributes.match(/\balt=["']([^"']*)["']/i)?.[1];
    if (src) images.push({ image: true, label: alt ?? "", url: src });
  }
  return images;
}

function stripFencedCode(body) {
  return body.replace(/^ {0,3}(```|~~~)[^\n]*\n[\s\S]*?^ {0,3}\1\s*$/gm, "");
}

function isExternal(url) {
  return /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(url) && !url.startsWith("/");
}

function validatePost(post, slugMap) {
  const errors = [];
  const warnings = [];
  const { data, body, file } = post;
  const display = relative(ROOT, file).replaceAll("\\", "/");
  const pushError = message => errors.push(`${display}: ${message}`);
  const pushWarning = message => warnings.push(`${display}: ${message}`);

  if (typeof data.title !== "string" || data.title.trim().length === 0) {
    pushError("缺少非空 title");
  } else if (data.title.trim().length > 120) {
    pushError("title 不得超过 120 个字符");
  }

  if (
    typeof data.description !== "string" ||
    data.description.trim().length === 0
  ) {
    pushError("缺少非空 description");
  } else if (data.description.trim().length > 240) {
    pushError("description 不得超过 240 个字符");
  }

  if (!validDate(data.pubDatetime)) pushError("pubDatetime 不是有效日期时间");
  if (data.modDatetime != null && !validDate(data.modDatetime)) {
    pushError("modDatetime 不是有效日期时间");
  }
  if (data.modDatetime && data.pubDatetime) {
    if (new Date(data.modDatetime) < new Date(data.pubDatetime)) {
      pushError("modDatetime 不能早于 pubDatetime");
    }
  }
  if (data.draft != null && typeof data.draft !== "boolean") {
    pushError("draft 必须是布尔值");
  }
  if (data.featured != null && typeof data.featured !== "boolean") {
    pushError("featured 必须是布尔值");
  }
  if (data.canonicalURL != null && data.canonicalURL !== "") {
    try {
      const canonical = new URL(String(data.canonicalURL));
      if (!new Set(["http:", "https:"]).has(canonical.protocol)) {
        pushError("canonicalURL 只支持 http 或 https 地址");
      }
    } catch {
      pushError("canonicalURL 不是有效的完整 URL");
    }
  }
  if (!Array.isArray(data.tags) || data.tags.length === 0) {
    pushError("tags 至少需要一个标签");
  } else {
    if (data.tags.some(tag => typeof tag !== "string")) {
      pushError("tags 的每一项都必须是文本");
    }
    const normalizedTags = data.tags.map(tag =>
      String(tag).trim().toLowerCase()
    );
    if (normalizedTags.some(tag => tag.length === 0))
      pushError("tags 不能包含空标签");
    if (new Set(normalizedTags).size !== normalizedTags.length) {
      pushError("tags 不能包含重复项");
    }
  }
  if (!body) pushError("正文不能为空");

  const fileSlug = basename(file, extname(file));
  if (fileSlug !== slugify(fileSlug)) {
    pushWarning("文件名建议使用小写字母、数字、连字符或连续中文");
  }
  const route = relative(POSTS_DIR, file)
    .replaceAll("\\", "/")
    .replace(/\.(?:md|mdx)$/i, "")
    .toLowerCase();
  const previous = slugMap.get(route);
  if (previous && previous !== file)
    pushError(`文章路径与 ${relative(ROOT, previous)} 冲突`);
  slugMap.set(route, file);

  const proseBody = stripFencedCode(body);
  const bodyLinks = [
    ...collectMarkdownLinks(proseBody),
    ...collectHtmlImages(proseBody),
  ];
  const frontmatterImages =
    typeof data.ogImage === "string" && data.ogImage.trim()
      ? [{ image: true, label: "分享封面", url: data.ogImage.trim() }]
      : [];

  for (const link of [...bodyLinks, ...frontmatterImages]) {
    if (link.image && !link.label.trim())
      pushError(`图片 ${link.url} 缺少 alt 文本`);
    if (isExternal(link.url)) continue;
    if (!shouldResolveLocalLink(link)) continue;
    let target;
    try {
      target = resolvedLink(file, link.url);
    } catch {
      pushError(`${link.image ? "图片" : "链接"}地址无法解析：${link.url}`);
      continue;
    }
    if (!existsSync(target)) {
      pushError(`${link.image ? "图片" : "链接"}目标不存在：${link.url}`);
      continue;
    }
    if (link.image) {
      const extension = extname(target).toLowerCase();
      if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
        pushError(`不支持的图片格式：${link.url}`);
      }
      if (statSync(target).size > MAX_IMAGE_BYTES) {
        pushError(`图片超过 5 MiB：${link.url}`);
      }
    }
  }

  return { errors, warnings };
}

function validateAll({ quiet = false } = {}) {
  const files = postFiles();
  const slugMap = new Map();
  const errors = [];
  const warnings = [];

  for (const file of files) {
    try {
      const result = validatePost(parsePost(file), slugMap);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    } catch (error) {
      errors.push(
        `${relative(ROOT, file)}: 无法解析 Frontmatter：${error.message}`
      );
    }
  }

  if (!quiet) {
    for (const warning of warnings) process.stderr.write(`WARN  ${warning}\n`);
    for (const error of errors) process.stderr.write(`ERROR ${error}\n`);
    if (errors.length === 0) {
      output.write(
        `内容检查通过：${files.length} 篇文章，${warnings.length} 条提示。\n`
      );
    }
  }
  return { files, errors, warnings };
}

function postStatus() {
  const now = Date.now();
  const groups = { published: [], scheduled: [], draft: [] };
  for (const file of postFiles()) {
    const { data } = parsePost(file);
    const item = `${data.title ?? basename(file)}  (${relative(ROOT, file)})`;
    if (data.draft !== false) groups.draft.push(item);
    else if (
      validDate(data.pubDatetime) &&
      new Date(data.pubDatetime).getTime() > now
    ) {
      groups.scheduled.push(item);
    } else groups.published.push(item);
  }
  const labels = {
    published: "已发布",
    scheduled: "待定时发布",
    draft: "草稿",
  };
  for (const [key, values] of Object.entries(groups)) {
    output.write(`\n${labels[key]} (${values.length})\n`);
    for (const value of values) output.write(`  - ${value}\n`);
  }
}

async function scheduledDue(siteUrl) {
  const baseUrl = new URL(siteUrl || "https://marksoniiii.github.io/");
  if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";
  const now = Date.now();
  const duePosts = postFiles()
    .map(parsePost)
    .filter(({ data }) => data.draft === false)
    .filter(({ data }) => validDate(data.pubDatetime))
    .filter(({ data }) => new Date(data.pubDatetime).getTime() <= now);

  let due = false;
  for (const post of duePosts) {
    const slug = relative(POSTS_DIR, post.file)
      .replaceAll("\\", "/")
      .replace(/\.(?:md|mdx)$/i, "")
      .split("/")
      .filter(part => !part.startsWith("_"))
      .map(slugify)
      .join("/");
    const url = new URL(`posts/${slug}/`, baseUrl);
    try {
      const response = await fetch(url, { method: "HEAD", redirect: "follow" });
      if (!response.ok) due = true;
    } catch {
      due = true;
    }
  }

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(githubOutput, `deploy=${due}\n`, "utf8");
  }
  output.write(
    due ? "发现已到期但尚未上线的文章。\n" : "没有待上线的定时文章。\n"
  );
  return due;
}

async function deployNeeded(baseSha) {
  if (!baseSha || /^0+$/.test(baseSha)) {
    if (process.env.GITHUB_OUTPUT) {
      const { appendFileSync } = await import("node:fs");
      appendFileSync(process.env.GITHUB_OUTPUT, "deploy=true\n", "utf8");
    }
    return true;
  }

  let changes;
  try {
    changes = git(["diff", "--name-status", `${baseSha}..HEAD`])
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    // A force push can make the event's previous SHA unavailable. Deploying is
    // safer than guessing whether production output changed.
    if (process.env.GITHUB_OUTPUT) {
      const { appendFileSync } = await import("node:fs");
      appendFileSync(process.env.GITHUB_OUTPUT, "deploy=true\n", "utf8");
    }
    output.write("无法读取完整提交差异，按需要部署处理。\n");
    return true;
  }
  let deploy = changes.length === 0;
  const now = Date.now();

  for (const change of changes) {
    const [status, ...pathParts] = change.split("\t");
    const path = pathParts.at(-1)?.replaceAll("\\", "/") ?? "";
    if (!path.startsWith("src/content/posts/")) {
      deploy = true;
      break;
    }
    if (status.startsWith("D") || status.startsWith("R")) {
      deploy = true;
      break;
    }
    const absolute = join(ROOT, path);
    if (!existsSync(absolute)) {
      deploy = true;
      break;
    }
    try {
      const { data } = parsePost(absolute);
      if (
        data.draft === false &&
        validDate(data.pubDatetime) &&
        new Date(data.pubDatetime).getTime() <= now
      ) {
        deploy = true;
        break;
      }

      // A previously public post that becomes a draft/future post must trigger
      // a deploy so the already-generated page is removed from production.
      const previousSource = git(["show", `${baseSha}:${path}`], {
        allowFailure: true,
      });
      if (previousSource) {
        const { frontmatter: previousData } = parseFrontmatter(previousSource);
        if (
          previousData.draft === false &&
          validDate(previousData.pubDatetime) &&
          new Date(previousData.pubDatetime).getTime() <= now
        ) {
          deploy = true;
          break;
        }
      }
    } catch {
      deploy = true;
      break;
    }
  }

  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${deploy}\n`, "utf8");
  }
  output.write(
    deploy
      ? "本次提交会改变公开网站，需要部署。\n"
      : "本次提交只修改草稿或未来文章，跳过生产部署。\n"
  );
  return deploy;
}

async function createPost() {
  const rl = createInterface({ input, output });
  try {
    const title = (await rl.question("文章标题：")).trim();
    if (!title) throw new Error("标题不能为空");
    const suggestedSlug = slugify(title) || `post-${Date.now()}`;
    const slugInput = (
      await rl.question(`文件名/Slug [${suggestedSlug}]：`)
    ).trim();
    const slug = slugify(slugInput || suggestedSlug);
    if (!slug) throw new Error("无法生成有效文件名");
    const description = (await rl.question("文章摘要：")).trim();
    if (!description) throw new Error("摘要不能为空");
    const tagInput = (await rl.question("标签（逗号分隔）[随笔]：")).trim();
    const tags = (tagInput || "随笔")
      .split(/[,，]/)
      .map(tag => tag.trim())
      .filter(Boolean);
    const path = join(POSTS_DIR, `${slug}.md`);
    if (existsSync(path))
      throw new Error(`文章已存在：${relative(ROOT, path)}`);
    const frontmatter = yaml.dump(
      {
        title,
        description,
        pubDatetime: new Date(),
        modDatetime: null,
        featured: false,
        draft: true,
        tags,
      },
      { lineWidth: 1000, noRefs: true, quotingType: '"' }
    );
    mkdirSync(POSTS_DIR, { recursive: true });
    writeFileSync(path, `---\n${frontmatter}---\n\n从这里开始写作。\n`, "utf8");
    output.write(`\n已创建草稿：${relative(ROOT, path)}\n`);
  } finally {
    rl.close();
  }
}

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} 失败`);
  }
  return result.stdout.trim();
}

function run(command, commandArgs, { shell = false } = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    stdio: "inherit",
    shell,
  });
  if (result.status !== 0)
    throw new Error(`${command} ${commandArgs.join(" ")} 失败`);
}

function findPost(query) {
  if (!query) throw new Error("请提供文章文件名、路径或标题");
  const normalized = query.toLowerCase();
  const matches = postFiles().filter(file => {
    const rel = relative(ROOT, file).replaceAll("\\", "/").toLowerCase();
    let title = "";
    try {
      title = String(parsePost(file).data.title ?? "").toLowerCase();
    } catch {}
    return rel.includes(normalized) || title.includes(normalized);
  });
  if (matches.length === 0) throw new Error(`找不到文章：${query}`);
  if (matches.length > 1) {
    throw new Error(
      `匹配到多篇文章，请输入更精确的名称：\n${matches.map(file => `- ${relative(ROOT, file)}`).join("\n")}`
    );
  }
  return matches[0];
}

function publishPost(query, options) {
  const branch = git(["branch", "--show-current"]);
  if (!options.noPush && branch !== "main") {
    throw new Error(`当前分支是 ${branch}；一键发布只允许在 main 执行`);
  }
  if (!options.noPush) {
    const staged = git(["diff", "--cached", "--name-only"]);
    if (staged) {
      throw new Error(`暂存区已有其他文件，请先提交或取消暂存：\n${staged}`);
    }
    git(["pull", "--rebase", "--autostash"]);
  }

  const file = findPost(query);
  const parsed = parsePost(file);
  const now = formatShanghaiDate();
  const pubDatetime = options.scheduledAt || parsed.data.pubDatetime || now;
  if (!validDate(pubDatetime)) throw new Error("--at 必须是有效日期时间");
  if (options.updated && new Date(pubDatetime).getTime() > Date.now()) {
    throw new Error("预约发布时不能同时使用 --updated");
  }

  const frontmatter = {
    ...parsed.data,
    modDatetime:
      parsed.data.modDatetime == null
        ? parsed.data.modDatetime
        : asYamlDate(parsed.data.modDatetime),
    pubDatetime: asYamlDate(pubDatetime),
    draft: false,
  };
  if (options.updated) frontmatter.modDatetime = asYamlDate(now);
  const serialized = yaml.dump(frontmatter, {
    lineWidth: 1000,
    noRefs: true,
    quotingType: '"',
  });
  try {
    writeFileSync(file, `---\n${serialized}---\n\n${parsed.body}\n`, "utf8");

    const validation = validateAll();
    if (validation.errors.length > 0) {
      throw new Error("内容检查未通过，未执行发布");
    }
    if (process.env.npm_execpath) {
      run(process.execPath, [process.env.npm_execpath, "run", "build"]);
    } else {
      run("npm", ["run", "build"], { shell: process.platform === "win32" });
    }
  } catch (error) {
    writeFileSync(file, parsed.source, "utf8");
    throw new Error(`发布前检查失败，已恢复原文件：${error.message}`);
  }

  if (options.noPush) {
    output.write(`已准备发布但未推送：${relative(ROOT, file)}\n`);
    return;
  }
  git(["add", "--", relative(ROOT, file)]);
  const mediaPath = relative(ROOT, join(PUBLIC_DIR, "images", "posts"));
  if (existsSync(join(ROOT, mediaPath))) git(["add", "--", mediaPath]);
  const title = String(frontmatter.title ?? basename(file));
  if (git(["diff", "--cached", "--name-only"])) {
    git(["commit", "-m", `content: publish ${title}`]);
  } else {
    output.write("文章已经提交；继续检查是否有本地提交需要推送。\n");
  }
  git(["push", "origin", "main"]);
  output.write(`发布已推送：${title}\n`);
}

function parseOptions(values) {
  const options = { noPush: false, updated: false, scheduledAt: undefined };
  const positional = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--no-push") options.noPush = true;
    else if (value === "--updated") options.updated = true;
    else if (value === "--at") {
      const scheduledAt = values[++index];
      if (!scheduledAt || scheduledAt.startsWith("--")) {
        throw new Error("--at 后需要提供 ISO 8601 日期时间");
      }
      options.scheduledAt = scheduledAt;
    } else if (value.startsWith("--")) {
      throw new Error(`未知选项：${value}`);
    } else positional.push(value);
  }
  return { query: positional.join(" "), options };
}

async function confirmPush() {
  if (!input.isTTY) {
    throw new Error("推送操作需要在交互式终端确认");
  }
  const rl = createInterface({ input, output });
  try {
    const answer = (
      await rl.question("将创建 Git 提交并推送到 origin/main，继续？[y/N]：")
    )
      .trim()
      .toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

async function publishFromMode(publishMode, values) {
  if (publishMode === "publish") {
    if (!(await confirmPush())) {
      output.write("已取消，没有修改文章。\n");
      return;
    }
    publishPost(values.join(" "), {
      noPush: false,
      updated: false,
      scheduledAt: undefined,
    });
    return;
  }
  if (publishMode === "prepare") {
    publishPost(values.join(" "), {
      noPush: true,
      updated: false,
      scheduledAt: undefined,
    });
    return;
  }
  if (publishMode === "update") {
    if (!(await confirmPush())) {
      output.write("已取消，没有修改文章。\n");
      return;
    }
    publishPost(values.join(" "), {
      noPush: false,
      updated: true,
      scheduledAt: undefined,
    });
    return;
  }

  const scheduledAt = values.at(-1);
  const query = values.slice(0, -1).join(" ");
  if (!validDate(scheduledAt)) {
    throw new Error(
      "定时发布需要在文章名后提供 ISO 8601 日期时间，例如 2026-08-20T20:30:00+08:00"
    );
  }
  if (new Date(scheduledAt).getTime() <= Date.now()) {
    throw new Error("定时发布时间必须晚于当前时间");
  }
  if (!(await confirmPush())) {
    output.write("已取消，没有修改文章。\n");
    return;
  }
  publishPost(query, {
    noPush: false,
    updated: false,
    scheduledAt,
  });
}

try {
  if (mode === "check") {
    const result = validateAll();
    if (result.errors.length > 0) process.exitCode = 1;
  } else if (mode === "new") {
    await createPost();
  } else if (mode === "status") {
    postStatus();
  } else if (["publish", "prepare", "schedule", "update"].includes(mode)) {
    if (args.some(value => value.startsWith("--"))) {
      const { query, options } = parseOptions(args);
      if (!options.noPush && !(await confirmPush())) {
        output.write("已取消，没有修改文章。\n");
        process.exitCode = 0;
      } else {
        publishPost(query, options);
      }
    } else {
      await publishFromMode(mode, args);
    }
  } else if (mode === "publish-advanced") {
    const { query, options } = parseOptions(args);
    publishPost(query, options);
  } else if (mode === "scheduled-due") {
    await scheduledDue(args[0]);
  } else if (mode === "deploy-needed") {
    await deployNeeded(args[0]);
  } else {
    output.write(
      `用法：\n  npm run post:new\n  npm run content:check\n  npm run post:status\n  npm run post:prepare -- <文章>\n  npm run post:publish -- <文章>\n  npm run post:schedule -- <文章> <ISO日期>\n  npm run post:update -- <文章>\n`
    );
  }
} catch (error) {
  process.stderr.write(`ERROR ${error.message}\n`);
  process.exitCode = 1;
}
