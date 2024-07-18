/*
 * Copyright (c) 2021-2024 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = require('vscode');
const path = require('path');
const { getInstanceList, } = require('./lib/vboxUtils');

class VboxInstanceProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor() { }

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

    getChildren() {
        return Promise.resolve(this._getVboxInstanceList());
    }
    async _getVboxInstanceList() {
        let array = [];
        let instanceList = await getInstanceList();
        instanceList.forEach((instance) => {
            array.push(new VboxInstance(instance.name, instance.uuid, instance.isRunning, instance.attachedVMDK, instance.state, instance.configFile)); // type is valid and its available
        });
        if (array.length > 0) {
            return array;
        } else {
            return [];
        }
    }
    getChildren_WebView() {
        return Promise.resolve(this._getVboxInstanceList());
    }
}

class VboxInstance {
    contextValue = 'vboxInsance';

    constructor(instanceName, uuid, isRunning, attachedVMDK, state, configFile) {
        this.label = instanceName;
        this.description = isRunning ? "Running" : "";
        this.isRunning = isRunning;
        this.uuid = uuid;
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        this.attachedVMDK = attachedVMDK;
        this.state = state;
        this.configFile = configFile;
    }

    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'display.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'display.svg')
    };
}

exports.VboxInstanceProvider = VboxInstanceProvider;
