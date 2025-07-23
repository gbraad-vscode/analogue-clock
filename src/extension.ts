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
    const sidebarProvider = new ClockSidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ClockSidebarProvider.viewType, sidebarProvider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('analogue-clock.openClock', () => {
            ClockPanel.createOrShow(context.extensionUri);
        })
    );
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
        updateClock(this._panel.webview, true); // Use global updateClock
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
        }

        setTimeout(() => {
            this.clockInterval = setInterval(() => updateClock(this._panel.webview), 1000);
            this._panel.webview.postMessage({ command: 'animate' });
        }, 200);
    }

    public dispose() {
        ClockPanel.currentPanel = undefined;
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
        }
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

        webviewView.onDidDispose(() => {
            if (this.clockInterval) {
                clearInterval(this.clockInterval);
            }
        });
    }

    private startClock(webview: vscode.Webview) {
        updateClock(webview, true); // Use global updateClock
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
        }

        setTimeout(() => {
            this.clockInterval = setInterval(() => updateClock(webview), 1000);
            webview.postMessage({ command: 'animate' });
        }, 200);

    }
}

function getWebviewContent() {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>gbraad's Analogue Clock</title>
            <style>
                html, body {
                    height: 100%;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                    background-color: transparent;
                }

                body {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                #clockface {
                    /* Use the smaller of the viewport width or height */
                    width: 95vmin;
                    height: 95vmin;
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


/**
 * Calculates the new cumulative angle for a hand and posts the message to the webview.
 * This is the "stateful" logic that prevents the 360-degree jump.
 */
function updateHand(webview: vscode.Webview, id: AngleKey, targetAngle: number) {
    let currentAngle = currentAngles[id] || 0;
    let angleDiff = targetAngle - (currentAngle % 360);

    // Find the shortest path to the new angle
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;

    const newAngle = currentAngle + angleDiff;
    currentAngles[id] = newAngle; // Update the global state

    // Send message to webview to update the hand
    webview.postMessage({ command: 'rotate', id, newAngle });
}

/**
 * The main clock update function, now used by both the panel and the sidebar.
 */
function updateClock(webview: vscode.Webview, reinitialize = false) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const targetHourAngle = (hours % 12) * 30 + minutes * 0.5;
    const targetMinAngle = minutes * 6;
    const targetSecAngle = seconds * 6;

    if (reinitialize) {
        // On first load, set the cumulative angle directly
        currentAngles.hourHand = targetHourAngle;
        currentAngles.minuteHand = targetMinAngle;
        currentAngles.secondHand = targetSecAngle;
    }

    // Use the stateful updateHand function for all updates
    updateHand(webview, 'hourHand', targetHourAngle);
    updateHand(webview, 'minuteHand', targetMinAngle);
    updateHand(webview, 'secondHand', targetSecAngle);
}

export function deactivate() {}