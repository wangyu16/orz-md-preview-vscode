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

    context.subscriptions.push(
        vscode.commands.registerCommand('orz-md-preview.selectTheme', async () => {
            const items = THEMES.map((t, index) => ({
                label: `$(symbol-color) ${t.name}`,
                description: t.colorScheme === 'dark' ? 'Dark' : 'Light',
                index,
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a preview theme',
            });
            if (selected) {
                themeManager.setTheme(selected.index);
            }
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
    themeItem.tooltip = 'Select Theme';
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
