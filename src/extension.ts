import * as vscode from 'vscode';

interface Angles {
    hourHand: number;
    minuteHand: number;
    secondHand: number;
}

const currentAngles: Angles = {
    hourHand: 0,
    minuteHand: 0,
    secondHand: 0
};

type AngleKey = keyof Angles;

export function activate(context: vscode.ExtensionContext) {
    // Command for panel (editor tab)
    let panelDisposable = vscode.commands.registerCommand('analogue-clock.openClock', () => {
        ClockPanel.createOrShow(context.extensionUri);
    });

    // Command for sidebar view
    let sidebarDisposable = vscode.commands.registerCommand('analogue-clock.openClockSidebar', () => {
        vscode.commands.executeCommand('analogue-clock.focusClockSidebar');
    });

    // Register the sidebar provider
    const clockSidebarProvider = new ClockSidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ClockSidebarProvider.viewType, clockSidebarProvider)
    );

    // Optional: focus sidebar view command
    let focusSidebarDisposable = vscode.commands.registerCommand('analogue-clock.focusClockSidebar', () => {
        vscode.commands.executeCommand('workbench.view.extension.clockSidebar');
    });

    context.subscriptions.push(panelDisposable, sidebarDisposable, focusSidebarDisposable);
}

class ClockPanel {
    public static currentPanel: ClockPanel | undefined;
    private static readonly viewType = 'clockView';
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private clockInterval: NodeJS.Timeout | undefined;

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
            "gbraad's Analogue Clock",
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

        this._panel.webview.html = getWebviewContent();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this.startClock();
    }

    private startClock() {
        this.updateClock(true);
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
        }

        setTimeout(() => {
            this.clockInterval = setInterval(() => this.updateClock(), 1000);
            this._panel.webview.postMessage({ command: 'animate' });
        }, 200);

    }

    private updateClock(reinitialize = false) {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        const targetHourAngle = (hours % 12) * 30 + minutes * 0.5;
        const targetMinAngle = minutes * 6;
        const targetSecAngle = seconds * 6;

        if (reinitialize) {
            currentAngles.hourHand = targetHourAngle;
            currentAngles.minuteHand = targetMinAngle;
            currentAngles.secondHand = targetSecAngle;
        }

        this.updateHand('hourHand', targetHourAngle);
        this.updateHand('minuteHand', targetMinAngle);
        this.updateHand('secondHand', targetSecAngle);
    }

    private updateHand(id: AngleKey, targetAngle: number) {
        let currentAngle = currentAngles[id] || 0;
        let angleDiff = targetAngle - (currentAngle % 360);

        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;

        const newAngle = currentAngle + angleDiff;
        currentAngles[id] = newAngle;

        // Send message to webview to update the hand
        this._panel.webview.postMessage({ command: 'rotate', id, newAngle });
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

class ClockSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'analogue-clock.sidebarClock';
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private clockInterval: NodeJS.Timeout | undefined;

    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
        };

        webviewView.webview.html = getWebviewContent();
        this.startClock(webviewView.webview);
    }

    private startClock(webview: vscode.Webview) {
        updateClock(webview, true);
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
        }

        setTimeout(() => {
            this.clockInterval = setInterval(() => updateClock(webview), 1000);
            webview.postMessage({ command: 'animate' });
        }, 200);

    }
}

// Reusable webview content
function getWebviewContent() {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>gbraad's Analogue Clock</title>
            <style>
                body {
                    overflow: hidden;
                    min-height: 100%;
                    margin: 0;
                    background-color: var(--vscode-editor-background);
                }

                html {
                    height: 100%;
                    background: transparent;
                }

                #clockface {
                    height: 96vh;
                    width: 96vw;
                }

                .hand.animate {
                    transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1.2);
                }

                #secondHand.animate {
                    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1.2);
                }
            </style>
        </head>
        <body>
            <div id="clockface">
                <svg xmlns="http://www.w3.org/2000/svg" style="background-color: transparent" width="100%" height="100%"
                     viewBox="0 0 200 200">
                    <!-- Clock face -->
                    <circle cx="100" cy="100" r="98" style="fill: rgb(179, 179, 179); stroke: black; stroke-width: 3.0" />
                    <circle cx="100" cy="100" r="70" style="fill: black; stroke: black; stroke-width: 3.0" />

                    <!-- Clock hands -->
                    <g transform="translate(100, 100)">
                        <g id="hourHand" class="hand">
                            <line x1="0" y1="0" x2="0" y2="-52" style="stroke: white; stroke-width: 5" />
                        </g>
                    </g>

                    <g transform="translate(100, 100)">
                        <g id="minuteHand" class="hand">
                            <line x1="0" y1="0" x2="0" y2="-67" style="stroke: white; stroke-width: 3" />
                        </g>
                    </g>

                    <g transform="translate(100, 100)">
                        <g id="secondHand" class="hand">
                            <line x1="0" y1="0" x2="0" y2="-93" style="stroke: rgb(255, 140, 0); stroke-width: 2" />
                        </g>
                    </g>

                    <!-- Center cap -->
                    <circle cx="100" cy="100" r="4" style="fill: black; stroke: white; stroke-width: 2.0" />
                </svg>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'rotate':
                            updateHand(message.id, message.newAngle);
                            break;
                        case 'animate':
                            addAnimateClass();
                            break;
                    }
                });

                function addAnimateClass() {
                    document.querySelectorAll('.hand').forEach(hand => {
                        hand.classList.add('animate');
                    });
                }

                function updateHand(id, newAngle) {
                    const hand = document.getElementById(id);
                    if (!hand) return;

                    hand.setAttribute("transform", \`rotate(\${newAngle})\`);
                }
            </script>
        </body>
        </html>
    `;
}

function updateClock(webview: vscode.Webview, reinitialize = false) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const targetHourAngle = (hours % 12) * 30 + minutes * 0.5;
    const targetMinAngle = minutes * 6;
    const targetSecAngle = seconds * 6;

    if (reinitialize) {
        currentAngles.hourHand = targetHourAngle;
        currentAngles.minuteHand = targetMinAngle;
        currentAngles.secondHand = targetSecAngle;
    }

    webview.postMessage({ command: 'rotate', id: 'hourHand', newAngle: targetHourAngle });
    webview.postMessage({ command: 'rotate', id: 'minuteHand', newAngle: targetMinAngle });
    webview.postMessage({ command: 'rotate', id: 'secondHand', newAngle: targetSecAngle });
}

export function deactivate() {}