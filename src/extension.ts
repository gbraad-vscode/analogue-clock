import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('vscode-clock.openClock', () => {
        ClockPanel.createOrShow(context.extensionUri);
    });

    context.subscriptions.push(disposable);
}

class ClockPanel {
    public static currentPanel: ClockPanel | undefined;
    private static readonly viewType = 'clockView';
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ClockPanel.currentPanel) {
            ClockPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            ClockPanel.viewType,
            'Clock',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        ClockPanel.currentPanel = new ClockPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    private _update() {
        this._panel.webview.html = this._getWebviewContent();
    }

    private _getWebviewContent() {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Clock</title>
                <style>
                    body {
                        margin: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        background-color: var(--vscode-editor-background);
                    }

                    .clock {
                        width: 300px;
                        height: 300px;
                    }

                    .clock-face {
                        stroke: var(--vscode-editor-foreground);
                        fill: none;
                    }

                    .clock-hand {
                        stroke: var(--vscode-editor-foreground);
                        stroke-linecap: round;
                    }
                </style>
            </head>
            <body>
                <div class="clock">
                    <svg xmlns="http://www.w3.org/2000/svg"
                        version="1.1"
                        baseProfile="full"
                        width="100%" 
                        height="100%" 
                        viewBox="0 0 200 200">
                    <g id="faceplate">
                        <circle id="faceplateCircle" cx="100" cy="100" r="98" style="fill: rgb(179, 179, 179); stroke: black; stroke-width: 3.0"/>
                    </g>
                    
                    <g id="faceplate">
                        <circle id="faceplateInnerCircle" cx="100" cy="100" r="70" style="fill: black; stroke: black; stroke-width: 3.0"/>
                    </g>

                    <g id="hourHand">
                    <line x1="100" y1="100" x2="100" y2="48" style="stroke: white; stroke-width: 5" />
                    </g>

                    <g id="minuteHand">
                        <line x1="100" y1="100" x2="100" y2="33" style="stroke: white; stroke-width: 3" />
                    </g>

                    <g id="secondHand">
                        <line x1="100" y1="100" x2="100" y2="7" style="stroke: rgb(255, 140, 0); stroke-width: 2" />
                    </g>

                    <g id="axisCover">
                        <circle id="axisCoverCircle" cx="100" cy="100" r="4" style="fill: black; stroke: white; stroke-width: 2.0"/>
                    </g>
                    </svg>
                </div>

                <script>
                    function updateClock() {
                        var now     = new Date();
                        var hours   = now.getHours();
                        var minutes = now.getMinutes();
                        var time    = Math.min(60000, 1.025 * (1000 * now.getSeconds() + now.getMilliseconds()));
                        var seconds = Math.floor(time / 1000);
                        var millis  = time % 1000;
                        rotate('hourHand',   hours * 30 + minutes * 0.5);
                        rotate('minuteHand', minutes * 6);
                        rotate('secondHand', 6 * seconds + 3 * (1 + Math.cos(Math.PI + Math.PI * (0.001 * millis))));
                    }

                    function rotate(id, angle) {
                        var element = document.getElementById(id);
                        if (element) {
                            element.setAttribute('transform', 'rotate(' + angle + ', 100, 100)');
                        }
                    }

                    // Update immediately and then every second
                    updateClock();
                    setInterval(updateClock, 1000);
                </script>
            </body>
            </html>
        `;
    }

    public dispose() {
        ClockPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}

export function deactivate() {}