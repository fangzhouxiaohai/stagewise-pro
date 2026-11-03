import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUiTranslator } from './translator';

const dictionary: Record<string, string> = {
  'Keep app awake while agents work': '在智能体工作时保持应用唤醒',
  'Always allow': '始终允许',
  Save: '保存',
  Rename: '重命名',
};

const translate = (text: string) => dictionary[text] ?? text;

function renderBody(html: string) {
  document.body.innerHTML = html;
}

describe('createUiTranslator', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('翻译文本节点并保留首尾空白', () => {
    renderBody('<div>  Always allow  </div>');
    const translator = createUiTranslator(translate);
    translator.start();

    expect(document.body.textContent).toBe('  始终允许  ');
    translator.stop();
    expect(document.body.textContent).toBe('  Always allow  ');
  });

  it('翻译 placeholder / title / aria-label 属性并在停止后恢复', () => {
    renderBody('<button title="Save" aria-label="Always allow">Save</button>');
    const translator = createUiTranslator(translate);
    translator.start();

    const button = document.querySelector('button')!;
    expect(button.getAttribute('title')).toBe('保存');
    expect(button.getAttribute('aria-label')).toBe('始终允许');
    expect(button.textContent).toBe('保存');

    translator.stop();
    expect(button.getAttribute('title')).toBe('Save');
    expect(button.getAttribute('aria-label')).toBe('Always allow');
    expect(button.textContent).toBe('Save');
  });

  it('跳过 data-i18n-skip、代码与可编辑区域', () => {
    renderBody(
      '<div data-i18n-skip>Always allow</div><code>Save</code><div contenteditable="true">Save</div>',
    );
    const translator = createUiTranslator(translate);
    translator.start();

    expect(document.body.textContent).toContain('Always allow');
    expect(document.body.textContent).toContain('Save');
    translator.stop();
  });

  it('用户交互后重扫并翻译新插入的节点', () => {
    vi.useFakeTimers();
    renderBody('<div id="root"></div>');
    const translator = createUiTranslator(translate);
    translator.start();

    const node = document.createElement('span');
    node.textContent = 'Save';
    document.getElementById('root')!.appendChild(node);

    // 无 MutationObserver：交互前保持原文。
    expect(node.textContent).toBe('Save');

    document.body.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    vi.advanceTimersByTime(1_000);

    expect(node.textContent).toBe('保存');
    translator.stop();
    vi.useRealTimers();
  });

  it('弹层挂载时立即翻译菜单项', async () => {
    renderBody('<div id="root"></div>');
    const translator = createUiTranslator(translate);
    translator.start();

    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    const item = document.createElement('button');
    item.textContent = 'Rename';
    menu.appendChild(item);
    document.getElementById('root')!.appendChild(menu);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(item.textContent).toBe('重命名');
    translator.stop();
  });
});
