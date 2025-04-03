import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('analogue-clock.openClock', () => {
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
                    
                            /* Train station clock bounce effect */
                            .hand {
                            /* Fast start, slow end with slight bounce */
                            transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1.2);
                            }
                            
                            #secondHand {
                            /* Faster transition for second hand but same bounce effect */
                            transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1.2);
                            }
                        </style>
                        <script type="text/javascript">
                            // Track current angles for continuous rotation
                            var currentAngles = {
                            hourHand: 0,
                            minuteHand: 0,
                            secondHand: 0
                            };
                            
                            // Initialize the clock
                            document.addEventListener ('DOMContentLoaded', function() {
                            // First update without animation
                            document.querySelectorAll('.hand').forEach(el => el.style.transition = "none");
                            updateClock();
                            setTimeout(() => {
                                document.querySelectorAll('.hand').forEach(el => el.style.transition = "");
                                setInterval(updateClock, 1000);
                            }, 50);
                            });
                    
                            function updateClock() {
                            const now = new Date();
                            const hours = now.getHours();
                            const minutes = now.getMinutes();
                            const seconds = now.getSeconds();
                            
                            // Calculate target angles
                            const targetHourAngle = (hours % 12) * 30 + minutes * 0.5;
                            const targetMinAngle = minutes * 6;
                            const targetSecAngle = seconds * 6;
                            
                            // Update each hand with continuous rotation
                            updateHand('hourHand', targetHourAngle);
                            updateHand('minuteHand', targetMinAngle);
                            updateHand('secondHand', targetSecAngle);
                            }
                    
                            function updateHand(id, targetAngle) {
                            const hand = document.getElementById(id);
                            if (!hand) return;
                            
                            // Calculate the shortest path to the new angle
                            let currentAngle = currentAngles[id] || 0;
                            let angleDiff = targetAngle - (currentAngle % 360);
                            
                            // Adjust for crossing the 0/360 boundary
                            if (angleDiff > 180) angleDiff -= 360;
                            if (angleDiff < -180) angleDiff += 360;
                            
                            // Calculate the new absolute angle (keeps increasing)
                            const newAngle = currentAngle + angleDiff;
                            currentAngles[id] = newAngle;
                            
                            // Apply the rotation
                            hand.setAttribute("transform", \`rotate(\${newAngle})\`);
                            }
                        </script>
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