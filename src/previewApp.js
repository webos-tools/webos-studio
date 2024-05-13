/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const path = require('path');
const { fileURLToPath } = require('url');
const { InputController } = require('./lib/inputController');
const { InputChecker } = require('./lib/inputChecker');
const ares = require('./lib/runCommand');
const { getDefaultDir } = require('./lib/workspaceUtils');
const kill = require('tree-kill');
const enactUtils = require('./lib/enactUtils');
const portfinder = require('portfinder');
const notify = require('./lib/notificationUtils');
const http = require('http');
const ga4Util = require('./ga4Util');
const fs = require('fs');

module.exports = async function previewApp(appSelectedDir, previewPanelInfo, context) {
    ga4Util.mpGa4Event("PreviewApp", { category: "Commands" });
    let defaultDir = getDefaultDir();
    let defaultString = '';
    let appDir;
    if (defaultDir) {
        defaultString = ` (default: ${defaultDir})`;
    }

    let folderBtn = InputController.FileBrowser;
    folderBtn.bindAction(async function (thisInput) {
        let folder = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true
        });
        if (folder) {
            thisInput.value = fileURLToPath(folder[0].toString(true));
        }
    });

    let controller = new InputController();
    controller.addStep({
        title: 'Preview Web Application',
        placeholder: `Web App Directory${defaultString}`,
        prompt: 'Enter Directory Path to Preview',
        buttons: [folderBtn],
        validator: function (value) {
            if (value === '') {
                if (defaultDir) {
                    return null;
                } else {
                    return 'The directory must be specified.';
                }
            }
            return InputChecker.checkDirectoryExist(value);
        }
    });
    if (appSelectedDir) {
        appDir = appSelectedDir;
    } else {
        let results = await controller.start();
        appDir = results.shift() || defaultDir;
    }

    if (!path.isAbsolute(appDir) && defaultDir) {
        appDir = path.join(defaultDir, appDir);
    }

    let appInfo = path.join(appDir, "appinfo.json");
    let appTitle ="App Preview";
    if (fs.existsSync(appInfo)) {
        let rawdata = fs.readFileSync(appInfo, 'utf8');
        let appInfoData = JSON.parse(rawdata);
        if (appInfoData && appInfoData["title"]) {
            appTitle = "App Preview - "+appInfoData["title"]
        }
    }
    let isEnact = await enactUtils.isEnactApp(appDir);
    // const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn + 1 : undefined;

    if (previewPanelInfo.webPanel != null && previewPanelInfo.appDir != appDir) {
        if (previewPanelInfo.childProcess != null) {
            previewPanelInfo.childProcess.stdin.pause();
            kill(previewPanelInfo.childProcess.pid);
        }
        previewPanelInfo.appDir = null;
        previewPanelInfo.childProcess = null;
    }
    if (previewPanelInfo.childProcess == null) {
        portfinder.getPortPromise()
            .then(async (port) => {
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "App Preview",
                    cancellable: false
                }, async (progress) => {
                    await notify.showProgress(progress, 50, `Preparing the app preview. It could take a few seconds...`);
                    await ares.server(appDir, isEnact, port)
                        .then(async ([url, child]) => {
                            if (previewPanelInfo.childProcess == null) {
                                const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn + 1 : undefined;
                                await notify.showProgress(progress, 30, `Launching preview...`);
                                if (previewPanelInfo.webPanel == null) {
                                    previewPanelInfo.webPanel = vscode.window.createWebviewPanel(
                                        'appPreview',
                                        'App Preview',
                                        columnToShowIn,
                                        {
                                            "retainContextWhenHidden": true,
                                            "enableScripts": true,
                                            "enableForms": true
                                        }
                                    );
                                } else {
                                    previewPanelInfo.webPanel.reveal(columnToShowIn);
                                }
                                previewPanelInfo.isEnact = isEnact;
                                previewPanelInfo.appDir = appDir;
                                previewPanelInfo.childProcess = child;
                                previewPanelInfo.webPanel.webview.options = { "enableScripts": true, "enableForms": true, }
                                previewPanelInfo.webPanel.webview.html = getWebviewContent(url, previewPanelInfo.webPanel.webview,appTitle);
                                previewPanelInfo.isProcRunning = true;
                                previewPanelInfo.webPanel.onDidDispose(
                                    () => {
                                        if (previewPanelInfo.childProcess != null) {
                                            previewPanelInfo.childProcess.stdin.pause();
                                            kill(previewPanelInfo.childProcess.pid);
                                        }
                                        previewPanelInfo.isProcRunning = false;
                                        previewPanelInfo.webPanel = null;
                                        previewPanelInfo.appDir = null;
                                        previewPanelInfo.childProcess = null;
                                        previewPanelInfo.isEnact = null;
                                    },
                                    null
                                );

                                await notify.showProgress(progress, 10, `Loading the app preview...`);
                                await isUrlLoadCompleted(url);
                                await notify.showProgress(progress, 10, `Loading the app preview...`);
                            }
                        }).catch((err) => {
                            console.log("process error -", err);
                            previewPanelInfo.webPanel = null
                            vscode.window.showErrorMessage(`Error! Failed to run a local server.`);
                        })
                })
            })
            .catch((err) => {
                console.log(err);
                vscode.window.showErrorMessage(`Error! Failed to get free port`);
            });

    } else {
        const columnToShowIn = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn + 1 : undefined;
        previewPanelInfo.webPanel.reveal(columnToShowIn);
    }
    function isUrlLoadCompleted(url) {
        return new Promise((resolve, reject) => { // eslint-disable-line no-unused-vars
            http.get(url, async (res) => {
                res.on("data", async () => {
                    resolve("");
                });
                res.on("end", async () => {
                    // resolve("");
                });
                res.on("error", async () => {
                    resolve("");
                });
            }).on('error', (e) => {
                console.error(`Got error: ${e.message}`);
                resolve("");
            });
        });
    }

    function getWebviewContent(url, webview,appTitle) {
        // const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'preview.js'));
        const commonJs = webview.asWebviewUri(
            vscode.Uri.joinPath(
                context.extensionUri,
                "media",
                "preview",
                "js",
                "common.js"
            )
        );
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
        const commonCss = webview.asWebviewUri(
            vscode.Uri.joinPath(
                context.extensionUri,
                "media",
                "preview",
                "css",
                "common.css"
            )
        );
        return `<!DOCTYPE html >
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>App Preview</title>
            <link href="${commonCss}" rel="stylesheet">
            <link href="${codiconsUri}" rel="stylesheet">
        
       <script>
       
        </script>
        </head>
        <body style="overflow: auto;" >

            <div id="prv_toolBar" class="prv_toolBar">
                <div id="prv_toolBar_title" class="prv_toolBar_title">${appTitle}</div>
                <div id="prv_toolBarBody" class="prv_toolBarBody">
                    <div class="prv_toolBarMenu" id="prv_toolBarMenu">
                        <span id ="prv_resTitle" class="prv_resTitle">Resolution - Fit to Windows</span>
                        <i id ="prv_ddmenu" title="Menu" class="codicon codicon-menu prv_icon"></i>
                        <i id ="prv_zoomin" title="Zoom-In" class="codicon codicon-zoom-in prv_icon_zoom"></i>
                        <i id ="prv_zoomout" title="Zoom-out" class="codicon codicon-zoom-out prv_icon_zoom"></i>
                    </div>
            
            
                </div>

                <div id="prv_toolBarCtxMenu" class="prv_toolBarCtxMenu" style="display:none">
                    <p class="prv_toolBarCtxMenu_item" id="prv_menu_fitToWindows">Fit to Windows</p>
                    <hr >
                    <p class="prv_toolBarCtxMenu_item" id="prv_menu_fhd">FHD - 1920 X 1080</p>
                    <p class="prv_toolBarCtxMenu_item" id="prv_menu_hd">HD - 1280 X 720</p>
                    <hr >
                    </hr>
                    <p  class="prv_toolBarCtxMenu_item" id="prv_menu_16-9" class="ctxmenu_item_active">16:9</p>
                    <p  class="prv_toolBarCtxMenu_item" id="prv_menu_4-3">4:3</p>
                </div>
            </div>

            <iframe id="previewEle" width="100%" class="webview ready" sandbox="allow-scripts allow-same-origin  allow-forms allow-pointer-lock allow-downloads allow-modals allow-popups allow-orientation-lock" frameborder="0" src="${url}" style="border:none;overflow: auto;margin: 0px;height:100%" ></iframe>

            </body>
            <script type='text/javascript' src="${commonJs}"></script>
        </html>`;
    }
}
