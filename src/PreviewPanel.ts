import * as vscode from 'vscode';
import * as path from 'path';
import { ThemeManager } from './ThemeManager';
import { renderForPreview, renderMarkdownHtml } from './Renderer';
import { debounce } from './util/debounce';

export class PreviewPanel {
    static readonly viewType = 'orz-md-preview';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionPath: string;
    private _disposables: vscode.Disposable[] = [];
    private _lastKnownMarkdown = '';
    private _lastThemeStyleId = '';
    private _lastFontScale = -1;

    constructor(
        ctx: vscode.ExtensionContext,
        public readonly filePath: string,
        private readonly themeManager: ThemeManager,
        existingPanel?: vscode.WebviewPanel
    ) {
        this._extensionPath = ctx.extensionPath;

        if (existingPanel) {
            this._panel = existingPanel;
        } else {
            const fileDirUri = vscode.Uri.file(path.dirname(filePath));
            const workspaceRoots = vscode.workspace.workspaceFolders?.map(f => f.uri) ?? [];
            this._panel = vscode.window.createWebviewPanel(
                PreviewPanel.viewType,
                'Orz Preview',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.file(ctx.extensionPath),
                        fileDirUri,
                        ...workspaceRoots,
                    ]
                }
            );
        }

        const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
        this._panel.title = `Preview: ${fileName}`;
        this._panel.webview.html = this._buildHtml('');

        this.themeManager.onThemeChanged(() => this.update(this._lastKnownMarkdown), null, this._disposables);
        this.themeManager.onFontScaleChanged(() => this.update(this._lastKnownMarkdown), null, this._disposables);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    private _vendorBaseUri(): string {
        return this._panel.webview
            .asWebviewUri(vscode.Uri.file(this._extensionPath + '/out/vendor'))
            .toString();
    }

    private _fileBaseUri(): string {
        return this._panel.webview
            .asWebviewUri(vscode.Uri.file(path.dirname(this.filePath)))
            .toString();
    }

    private _buildHtml(markdown: string): string {
        return renderForPreview(markdown, this.themeManager, this._vendorBaseUri(), this._fileBaseUri());
    }

    private _updateDebounced = debounce((markdown: string) => {
        this._lastKnownMarkdown = markdown;
        const themeStyleId = this.themeManager.activeTheme.styleId;
        const fontScale = this.themeManager.fontScale;

        if (themeStyleId !== this._lastThemeStyleId || fontScale !== this._lastFontScale) {
            // Theme or font scale changed — full reload to update embedded CSS
            this._lastThemeStyleId = themeStyleId;
            this._lastFontScale = fontScale;
            this._panel.webview.html = this._buildHtml(markdown);
        } else {
            // Content-only change — patch the DOM via postMessage to preserve scroll position
            const html = renderMarkdownHtml(markdown);
            this._panel.webview.postMessage({ type: 'update', html });
        }
    }, 400);

    public update(markdown: string) {
        this._updateDebounced(markdown);
    }

    public reveal(viewColumn?: vscode.ViewColumn) {
        this._panel.reveal(viewColumn, true);
    }

    public onDidDispose(callback: () => void): vscode.Disposable {
        return this._panel.onDidDispose(callback);
    }

    public dispose() {
        this._panel.dispose();
        while (this._disposables.length) {
            this._disposables.pop()?.dispose();
        }
    }
}
