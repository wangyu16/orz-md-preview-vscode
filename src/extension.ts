import * as vscode from 'vscode';
import { ThemeManager, THEMES } from './ThemeManager';
import { PreviewManager } from './PreviewManager';
import { renderMarkdownHtml } from './Renderer';

export interface OrzMdPreviewApi {
    renderMarkdownHtml(markdown: string): string;
}

export function activate(context: vscode.ExtensionContext): OrzMdPreviewApi {
    console.log('orz-md-preview activated');

    const themeManager = new ThemeManager(context);
    const previewManager = new PreviewManager(context, themeManager);
    context.subscriptions.push({ dispose: () => previewManager.dispose() });

    // ── Commands ──────────────────────────────────────────────────────────────

    const openPreviewHandler = () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'markdown') { return; }
        previewManager.openOrReveal(editor, vscode.ViewColumn.Beside);
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('orz-md-preview.openPreview', openPreviewHandler)
    );

    // Override built-in markdown preview commands so the built-in toolbar icons
    // also open the custom preview instead of VS Code's default one.
    for (const id of ['markdown.showPreview', 'markdown.showPreviewToSide']) {
        try {
            context.subscriptions.push(vscode.commands.registerCommand(id, openPreviewHandler));
        } catch {
            // Already registered by VS Code's built-in markdown extension; ignore.
        }
    }

    // Shared interactive theme picker — each row has a pin button to set the global default.
    type ThemeItem = vscode.QuickPickItem & { themeIndex: number };

    const PIN_BTN: vscode.QuickInputButton = {
        iconPath: new vscode.ThemeIcon('pin'),
        tooltip: 'Set as global default theme',
    };
    const PINNED_BTN: vscode.QuickInputButton = {
        iconPath: new vscode.ThemeIcon('pinned'),
        tooltip: 'Global default theme (click to re-pin)',
    };

    function openThemePicker(placeholder: string, onAccept: (index: number) => void): void {
        const qp = vscode.window.createQuickPick<ThemeItem>();
        qp.placeholder = placeholder;

        function buildItems(): ThemeItem[] {
            const defaultIdx = themeManager.defaultThemeIndex;
            return THEMES.map((t, index) => ({
                label: `$(symbol-color) ${t.name}`,
                description: t.colorScheme === 'dark' ? 'Dark' : 'Light',
                themeIndex: index,
                buttons: [index === defaultIdx ? PINNED_BTN : PIN_BTN],
            }));
        }

        qp.items = buildItems();
        const activeItem = qp.items.find(i => i.themeIndex === themeManager.activeThemeIndex);
        if (activeItem) { qp.activeItems = [activeItem]; }

        qp.onDidTriggerItemButton(e => {
            const prevActive = qp.activeItems[0];
            themeManager.setDefaultTheme(e.item.themeIndex);
            vscode.window.showInformationMessage(`Default theme set to "${THEMES[e.item.themeIndex].name}".`);
            qp.items = buildItems();
            const restored = prevActive && qp.items.find(i => i.themeIndex === prevActive.themeIndex);
            if (restored) { qp.activeItems = [restored]; }
        });

        qp.onDidAccept(() => {
            const [selected] = qp.activeItems;
            if (selected) { onAccept(selected.themeIndex); }
            qp.dispose();
        });

        qp.onDidHide(() => qp.dispose());
        qp.show();
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('orz-md-preview.selectTheme', () => {
            openThemePicker(
                'Select a preview theme — click $(pin) to set as global default',
                (index) => themeManager.setTheme(index)
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('orz-md-preview.setDefaultTheme', () => {
            openThemePicker(
                'Select the global default theme',
                (index) => {
                    themeManager.setDefaultTheme(index);
                    vscode.window.showInformationMessage(`Default theme set to "${THEMES[index].name}".`);
                }
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('orz-md-preview.fontLarger', () => {
            themeManager.setFontScale(themeManager.fontScale * 1.1);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('orz-md-preview.fontSmaller', () => {
            themeManager.setFontScale(themeManager.fontScale * 0.9);
        })
    );

    // ── Status bar ────────────────────────────────────────────────────────────

    const themeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    themeItem.command = 'orz-md-preview.selectTheme';
    themeItem.tooltip = 'Select Theme (pin button sets global default)';
    context.subscriptions.push(themeItem);

    const fontSmallerItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    fontSmallerItem.text = 'A-';
    fontSmallerItem.command = 'orz-md-preview.fontSmaller';
    fontSmallerItem.tooltip = 'Decrease Font Size';
    context.subscriptions.push(fontSmallerItem);

    const fontLargerItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 98);
    fontLargerItem.text = 'A+';
    fontLargerItem.command = 'orz-md-preview.fontLarger';
    fontLargerItem.tooltip = 'Increase Font Size';
    context.subscriptions.push(fontLargerItem);

    function updateStatusBar(editor: vscode.TextEditor | undefined) {
        if (editor && editor.document.languageId === 'markdown') {
            themeItem.text = `$(symbol-color) ${themeManager.activeTheme.name}`;
            themeItem.show();
            fontSmallerItem.show();
            fontLargerItem.show();
        } else {
            themeItem.hide();
            fontSmallerItem.hide();
            fontLargerItem.hide();
        }
    }

    themeManager.onThemeChanged(() => {
        themeItem.text = `$(symbol-color) ${themeManager.activeTheme.name}`;
    });

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updateStatusBar)
    );

    // Run once for the current editor
    updateStatusBar(vscode.window.activeTextEditor);

    return { renderMarkdownHtml };
}

export function deactivate() {}
