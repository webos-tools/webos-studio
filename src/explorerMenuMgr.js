/*
 * Copyright (c) 2021-2024 LG Electronics Inc.
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
    
    // "onCommand:webosose.explorermenu.removeApp",
    // "onCommand:webosose.explorermenu.runLint",
    // "onCommand:webosose.explorermenu.ClearLint"

    constructor() { }
    removeApp(resource) {
        vscode.commands.executeCommand('apps.removeApp', this.getAppObject(resource));
    }
    runLint(resource) {
        vscode.commands.executeCommand('apps.lintEnactApp', this.getAppObject(resource));
    }
    clearLint(resource) {
        vscode.commands.executeCommand('apps.lintEnactAppDisable', this.getAppObject(resource));
    }
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
    runWithoutInstall(resource) {
        vscode.commands.executeCommand('apps.runWithoutInstall',this.getAppObject(resource));
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
        if(pathElement[pathElement.length-1].trim()=="dist"){
            // return { "label": path.join(pathElement[pathElement.length -2].trim(),pathElement[pathElement.length - 1].trim()) }
            return { "label": pathElement[pathElement.length -2].trim() }
        }else{
            return { "label": pathElement[pathElement.length - 1].trim() }   
        }
         
    }
}

exports.ExplorerMenuMgr = ExplorerMenuMgr;
