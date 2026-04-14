import * as vscode from 'vscode';
import { PreviewPanel } from './PreviewPanel';
import { ThemeManager } from './ThemeManager';

type PanelEntry = {
    panel: PreviewPanel;
    docChangeSub: vscode.Disposable;
};

export class PreviewManager {
    private readonly entries = new Map<string, PanelEntry>();
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly ctx: vscode.ExtensionContext,
        private readonly themeManager: ThemeManager
    ) {}

    /** Open or reveal a preview for the given editor document. */
    public openOrReveal(editor: vscode.TextEditor, viewColumn = vscode.ViewColumn.Beside): void {
        const key = editor.document.uri.toString();
        const existing = this.entries.get(key);

        if (existing) {
            existing.panel.reveal(viewColumn);
            return;
        }

        const panel = new PreviewPanel(this.ctx, editor.document.uri.fsPath, this.themeManager);

        const docChangeSub = vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.toString() === key) {
                const entry = this.entries.get(key);
                entry?.panel.update(e.document.getText());
            }
        });

        const entry: PanelEntry = { panel, docChangeSub };
        this.entries.set(key, entry);

        panel.onDidDispose(() => {
            const e = this.entries.get(key);
            if (e) {
                e.docChangeSub.dispose();
                this.entries.delete(key);
            }
        });

        // Initial render
        panel.update(editor.document.getText());
    }

    public dispose() {
        for (const entry of this.entries.values()) {
            entry.docChangeSub.dispose();
            entry.panel.dispose();
        }
        this.entries.clear();
        while (this._disposables.length) {
            this._disposables.pop()?.dispose();
        }
    }
}
