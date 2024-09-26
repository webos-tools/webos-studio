/*
 * Copyright (c) 2021-2022 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = require('vscode');
const fs = require("fs");
const path = require('path');
const showdown = require('showdown');
const package_json = JSON.parse(fs.readFileSync(path.join(__filename, '..', '..', "package.json"), "utf-8"));
const extensionBasePath = vscode.extensions.getExtension(`${package_json.publisher}.${package_json.name}`).extensionPath;
const { getCurrentDeviceProfile } = require('./lib/deviceUtils');
class HelpItem {
    constructor(label, command, icon) {
        this.label = label;
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        this.command = { command };
        this.iconPath = {
            light: path.join(extensionBasePath, 'media', `${icon}.svg`),
            dark: path.join(extensionBasePath, 'media', `${icon}.svg`)
        };
    }
}

class HelpProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(items) {
        this.items = items;
    }
    async setItems(){
        let profile = await  getCurrentDeviceProfile()
        if(profile =="ose"){
            this.items = [
                { "label": "Resource Monitoring", "onSelectCommand": "webosose.resourceMonitoring", "icon": "resource_monitoring" },
                { "label": "Readme", "onSelectCommand": "quickLauncher.readme", "icon": "info" },
                { "label": "Change Log", "onSelectCommand": "quickLauncher.changeLog", "icon": "versions" }
            ]
        }else{
            this.items = [
                { "label": "Readme", "onSelectCommand": "quickLauncher.readme", "icon": "info" },
                { "label": "Change Log", "onSelectCommand": "quickLauncher.changeLog", "icon": "versions" }
            ]
        }
    }

    refresh(element) {
        if (element) {
            this._onDidChangeTreeData.fire(element);
        } else {
            this._onDidChangeTreeData.fire();
        }
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren() {
        await this.setItems()
        let helpItems = this.items.map((item) => {
            return new HelpItem(item.label, item.onSelectCommand, item.icon);
        });
        return Promise.resolve(helpItems);
    }
}

const getHTMLFromMD = (htmlTitle, md_data, webview) => {
    const converter = new showdown.Converter();
    converter.setFlavor('github');
    const html_data = converter.makeHtml(md_data);

    // Local path to css styles
    const styleResetPath = vscode.Uri.file(path.join(extensionBasePath, 'media', 'reset.css'));
    const stylesPathMainPath = vscode.Uri.file(path.join(extensionBasePath, 'media', 'vscode.css'));

    const stylesResetUri = webview.asWebviewUri(styleResetPath);
    const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);

    return `<!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <link href="${stylesResetUri}" rel="stylesheet">
                    <link href="${stylesMainUri}" rel="stylesheet">
                    <title>${htmlTitle}</title>
                </head>
                <body>${html_data}</body>
            </html>`;
};

const getWebviewPanel = (id, title, columnToShowIn, opts = {}, panelMap) => {
    const viewColumn = columnToShowIn === undefined ?
        (vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn + 1 : undefined)
        : columnToShowIn;

    const webPanel = vscode.window.createWebviewPanel(id, title, viewColumn, opts);
    if (panelMap) {
        webPanel.onDidDispose(() => panelMap.delete(id));
    }
    return webPanel;
}
const renderReadMe = (helpPanels) => {
    if (!helpPanels.has("readme")) {
        const panel = getWebviewPanel("readme", "Readme", vscode.ViewColumn.One, { "retainContextWhenHidden": true }, helpPanels);
        const readmeMD = fs.readFileSync(path.join(extensionBasePath, "README.md"), "utf-8");
        panel.webview.html = getHTMLFromMD("Readme", readmeMD, panel.webview);
        helpPanels.set("readme", panel);
    } else {
        helpPanels.get("readme").reveal();
    }

}

const renderChangeLog = (helpPanels) => {
    if (!helpPanels.has("changelog")) {
        const panel = getWebviewPanel("changelog", "Change Log", vscode.ViewColumn.One, { "retainContextWhenHidden": true }, helpPanels);
        const changeLogMD = fs.readFileSync(path.join(extensionBasePath, "CHANGELOG.md"), "utf-8");
        panel.webview.html = getHTMLFromMD("Change Log", changeLogMD, panel.webview);
        helpPanels.set("changelog", panel);
    } else {
        helpPanels.get("changelog").reveal();
    }

}

exports.HelpProvider = HelpProvider;
exports.renderReadMe = renderReadMe;
exports.renderChangeLog = renderChangeLog;
