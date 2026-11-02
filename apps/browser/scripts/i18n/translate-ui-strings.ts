#!/usr/bin/env tsx
/**
 * 界面本地化字典生成脚本。
 *
 * 1. 用 TypeScript 编译器 API 从 UI 源码中提取用户可见的英文文案；
 * 2. 过滤 class 名、路径、标识符等非文案；
 * 3. 调用本机 llama.cpp 的 OpenAI 兼容接口批量翻译为简体中文；
 * 4. 输出 `apps/browser/src/ui/i18n/zh.generated.json`，同时打印未翻译列表。
 *
 * 用法：
 *   pnpm exec tsx scripts/i18n/translate-ui-strings.ts --dry-run
 *   pnpm exec tsx scripts/i18n/translate-ui-strings.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');
const browserRoot = path.join(repoRoot, 'apps/browser');
const outputPath = path.join(browserRoot, 'src/ui/i18n/zh.generated.json');
const untranslatedPath = path.join(
  browserRoot,
  'src/ui/i18n/untranslated.json',
);

const ROOTS = [
  path.join(browserRoot, 'src/ui'),
  path.join(browserRoot, 'src/pages'),
  path.join(browserRoot, 'src/shared'),
  path.join(repoRoot, 'packages/stage-ui/src/components'),
  path.join(repoRoot, 'packages/stage-ui/src/lib'),
];

/** 额外文件：整文件提取字符串（导航标签等常量）。 */
const EXTRA_FILES = [path.join(browserRoot, 'src/shared/settings-route.ts')];

const TEXT_PROPS = new Set([
  'placeholder',
  'title',
  'aria-label',
  'ariaLabel',
  'label',
  'description',
  'message',
  'text',
  'tooltip',
  'header',
  'subtitle',
  'emptyText',
  'emptyMessage',
  'noItemsMessage',
  'modelDescription',
  'shortDescription',
  'confirmText',
  'confirmLabel',
  'cancelLabel',
  'pageTitle',
]);

const BRAND_WORDS = new Set([
  'stagewise',
  'OpenAI',
  'Anthropic',
  'Google',
  'DeepSeek',
  'Qwen',
  'Kimi',
  'MiniMax',
  'Mistral',
  'Ollama',
  'OpenRouter',
  'GitHub',
  'Codex',
  'Claude',
  'Gemini',
  'GPT',
  'Zed',
  'Cursor',
  'VSCode',
  'VS Code',
  'JetBrains',
  'X',
  'LinkedIn',
  'Discord',
]);

const ENDPOINT = process.env.LOCAL_LLM_ENDPOINT ?? 'http://127.0.0.1:8001/v1';

function collectFiles(dir: string, acc: string[]) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'generated' ||
        entry.name === 'dist'
      ) {
        continue;
      }
      collectFiles(full, acc);
    } else if (
      /\.(tsx|ts)$/.test(entry.name) &&
      !/\.(test|stories)\./.test(entry.name) &&
      !entry.name.endsWith('.d.ts')
    ) {
      acc.push(full);
    }
  }
}

function isTranslatable(raw: string): boolean {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length < 2 || text.length > 400) return false;
  if (!/[A-Za-z]/.test(text)) return false;
  if (text.includes('${')) return false;
  if (/^(https?|data|mailto|stagewise):/i.test(text)) return false;
  if (text.includes('://')) return false;
  if (/&[a-z]+;/i.test(text)) return false;
  if (
    /^[\w.-]+\.(ts|tsx|js|jsx|json|css|scss|md|mdx|png|svg|ico|html?)$/i.test(
      text,
    )
  )
    return false;
  if (/^[a-z0-9_]+(\.[a-z0-9_]+)+$/i.test(text)) return false;
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(text)) return false;
  if (/^[A-Za-z0-9_]+$/.test(text) && !/^[A-Z]/.test(text)) return false;
  if (/^[a-z0-9]+(?:[A-Z][a-z0-9]*)+$/.test(text)) return false;
  if (/^@/.test(text)) return false;
  if (/^[0-9.]+(px|rem|em|%|ms|s|kb|k)?$/i.test(text)) return false;
  if (/^(true|false|null|undefined|default|none|auto)$/i.test(text))
    return false;
  if (
    /(^|\s)(flex|grid|text-|bg-|size-|w-|h-|min-|max-|p[xytblr]?-|m[xytblr]?-|gap-|rounded|border|ring|shadow|absolute|relative|sticky|fixed|overflow|pointer-|z-|font-|leading-|tracking-|inset|top-|right-|bottom-|left-|translate-|opacity-|transition|duration-|ease-|animate-|hover:|active:|focus:|dark:|data-|group-|peer-|[a-z-]+:)/.test(
      text,
    )
  ) {
    return false;
  }
  if (BRAND_WORDS.has(text)) return false;
  return true;
}

function extractStrings(): Map<string, string[]> {
  const files: string[] = [];
  for (const root of ROOTS) collectFiles(root, files);
  for (const extra of EXTRA_FILES) {
    if (fs.existsSync(extra)) files.push(extra);
  }

  const extraFileSet = new Set(EXTRA_FILES.map((file) => path.resolve(file)));
  const found = new Map<string, string[]>();

  function add(raw: string, file: string) {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!isTranslatable(text)) return;
    const existing = found.get(text);
    const relative = path.relative(repoRoot, file);
    if (existing) {
      if (!existing.includes(relative)) existing.push(relative);
    } else {
      found.set(text, [relative]);
    }
  }

  for (const file of files) {
    const isExtraFile = extraFileSet.has(path.resolve(file));
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) {
        add(node.getText(), file);
      } else if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        if (isExtraFile) {
          add(node.text, file);
          ts.forEachChild(node, visit);
          return;
        }
        const parent = node.parent;
        if (ts.isJsxAttribute(parent)) {
          if (TEXT_PROPS.has(parent.name.getText())) add(node.text, file);
        } else if (ts.isJsxExpression(parent)) {
          add(node.text, file);
        } else if (
          ts.isPropertyAssignment(parent) &&
          ts.isIdentifier(parent.name) &&
          TEXT_PROPS.has(parent.name.text)
        ) {
          add(node.text, file);
        } else if (
          ts.isPropertyAssignment(parent) &&
          /^(name|value)$/.test(parent.name.getText()) === false
        ) {
          // 其它对象字段不提取，避免把接口 key 当文案。
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }

  return found;
}

async function fetchModelId(): Promise<string> {
  const response = await fetch(`${ENDPOINT}/models`);
  if (!response.ok) throw new Error(`models: HTTP ${response.status}`);
  const data = (await response.json()) as { data?: Array<{ id?: string }> };
  const id = data.data?.[0]?.id;
  if (!id) throw new Error('no local model id');
  return id;
}

const SYSTEM_PROMPT = `你是资深软件本地化译者，负责把桌面应用 stagewise 的英文界面文案翻译成简体中文。
要求：
1. 输出必须是 JSON 数组，长度与输入数组一致，元素为对应译文，不要有任何解释或 markdown 代码块。
2. 保持简洁、自然、符合中文软件界面习惯；按钮/开关短标签尽量 2-6 个字。
3. 术语统一：agent=智能体，workspace=工作区，context=上下文，session=会话，model=模型，provider=服务商，tool=工具，approval=审批，permission=权限，token 保留原文，skill=技能，plugin=插件，chat=对话，tab=标签页，shell=终端，worktree=工作树。
4. 品牌名、模型名、快捷键（如 Ctrl+Enter）、占位符（如 {name}）保持原样。
5. 原文是术语或专有名词（如 "OpenAI"）时原样返回。`;

function parseJsonArray(content: string): string[] {
  const cleaned = content
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('no JSON array');
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('not an array');
  return parsed.map((item) => String(item));
}

async function translateBatch(
  model: string,
  texts: string[],
): Promise<string[]> {
  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(texts) },
    ],
    temperature: 0,
    max_tokens: Math.min(4096, 200 + texts.length * 80),
    chat_template_kwargs: { enable_thinking: false },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch(`${ENDPOINT}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`chat: HTTP ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    return parseJsonArray(content);
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const found = extractStrings();
  const texts = [...found.keys()].sort((a, b) => a.localeCompare(b));
  console.log(`extracted ${texts.length} unique UI strings`);

  const tooLong = texts.filter((text) => text.length > 160);
  console.log(`long strings (>160 chars): ${tooLong.length}`);

  if (dryRun) {
    for (const text of texts.slice(0, 120)) console.log(`- ${text}`);
    console.log('...');
    return;
  }

  const model = await fetchModelId();
  console.log(`using local model: ${model}`);

  const dictionary: Record<string, string> = {};
  if (fs.existsSync(outputPath)) {
    try {
      Object.assign(
        dictionary,
        JSON.parse(fs.readFileSync(outputPath, 'utf-8')) as Record<
          string,
          string
        >,
      );
      console.log(`resuming with ${Object.keys(dictionary).length} entries`);
    } catch {
      // ignore corrupt cache
    }
  }
  const untranslated: Array<{ text: string; error: string }> = [];
  const batchSize = 24;
  const pending = texts.filter((text) => !(text in dictionary));

  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    let translations: string[] | null = null;
    let lastError = '';
    for (let attempt = 0; attempt < 2 && !translations; attempt++) {
      try {
        translations = await translateBatch(model, batch);
        if (translations.length !== batch.length) {
          throw new Error(
            `length mismatch ${translations.length}/${batch.length}`,
          );
        }
      } catch (error) {
        lastError = (error as Error).message;
        translations = null;
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    if (!translations) {
      for (const text of batch) untranslated.push({ text, error: lastError });
    } else {
      batch.forEach((text, index) => {
        const value = translations![index]!.trim();
        if (value && value !== text) dictionary[text] = value;
        else untranslated.push({ text, error: 'empty-or-identical' });
      });
    }

    console.log(
      `translated ${Math.min(i + batchSize, pending.length)}/${pending.length} (missing ${untranslated.length})`,
    );

    const sorted = Object.fromEntries(
      Object.entries(dictionary).sort(([a], [b]) => a.localeCompare(b)),
    );
    fs.writeFileSync(outputPath, `${JSON.stringify(sorted, null, 2)}\n`);
    fs.writeFileSync(
      untranslatedPath,
      `${JSON.stringify(untranslated, null, 2)}\n`,
    );
  }

  console.log(`done: ${Object.keys(dictionary).length} translated`);
  console.log(`untranslated: ${untranslated.length} -> ${untranslatedPath}`);

  // 第二轮：失败项改用更小批次重试（模型偶发输出非 JSON）。
  if (untranslated.length > 0) {
    const retryTexts = untranslated.map((item) => item.text);
    const remaining: Array<{ text: string; error: string }> = [];
    for (let i = 0; i < retryTexts.length; i += 6) {
      const batch = retryTexts.slice(i, i + 6);
      try {
        const translations = await translateBatch(model, batch);
        if (translations.length !== batch.length) {
          throw new Error('length mismatch');
        }
        batch.forEach((text, index) => {
          const value = translations[index]!.trim();
          if (value && value !== text) dictionary[text] = value;
          else remaining.push({ text, error: 'empty-or-identical' });
        });
        console.log(
          `retried ${Math.min(i + 6, retryTexts.length)}/${retryTexts.length}`,
        );
      } catch (error) {
        for (const text of batch) {
          remaining.push({ text, error: (error as Error).message });
        }
      }
    }
    const sorted = Object.fromEntries(
      Object.entries(dictionary).sort(([a], [b]) => a.localeCompare(b)),
    );
    fs.writeFileSync(outputPath, `${JSON.stringify(sorted, null, 2)}\n`);
    fs.writeFileSync(
      untranslatedPath,
      `${JSON.stringify(remaining, null, 2)}\n`,
    );
    console.log(
      `after retry: ${Object.keys(dictionary).length} translated, ${remaining.length} untranslated`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
