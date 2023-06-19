/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const path = require('path');
class ExplorerMenuMgr {
    // "webosose.explorermenu.packageApp",
    // "webosose.explorermenu.installApp",
    // "webosose.explorermenu.runApp",
    // "webosose.explorermenu.appPreview",
    // "webosose.explorermenu.debug"

    constructor() { }
    packageApp(resource) {
        vscode.commands.executeCommand('apps.packageApp', this.getAppObject(resource));
    }
    installApp(resource) {
        vscode.commands.executeCommand('apps.installApp', this.getAppObject(resource));
    }
    runApp(resource) {
        vscode.commands.executeCommand('apps.runApp', this.getAppObject(resource));
    }
    runSimulator(resource) {
        let fPath = resource._fsPath==null?resource.fsPath:resource._fsPath;
        vscode.commands.executeCommand('webos.runSimulator', fPath);
    }
    appPreview(resource) {
        vscode.commands.executeCommand('apps.previewApp', this.getAppObject(resource));
    }
    devicePreview(resource) {
        vscode.commands.executeCommand('apps.devicepreviewstart',this.getAppObject(resource));
    }
    debugApp(resource, debugoption) {
        if(debugoption === 'IDE'){
            vscode.commands.executeCommand('apps.debugApp.ide', this.getAppObject(resource));
        }
        else{
            vscode.commands.executeCommand('apps.debugApp.browser', this.getAppObject(resource));
        }
    }
    getAppObject(resource) {
        let fPath = resource._fsPath==null?resource.fsPath:resource._fsPath
        let pathElement = fPath.split(path.sep)
        // let pathElement = resource._fsPath.split(path.sep)
         return { "label": pathElement[pathElement.length - 1].trim() }
    }
}

exports.ExplorerMenuMgr = ExplorerMenuMgr;
