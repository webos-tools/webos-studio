/*
 * Copyright (c) 2021-2024 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = require('vscode');
const chokidar = require('chokidar');
const { getDeviceList, getInstalledList, getRunningList, updateDeviceStatus, getSimulatorList, getProfile } = require('./lib/deviceUtils');

const { getSimulatorDirPath } = require('./lib/configUtils');
const ga4Util = require('./ga4Util');

class DeviceProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor() { }

    refresh(element) {
        ga4Util.mpGa4Event("RefreshKnownDevice", { category: "Commands" });
        if (element) {
            this._onDidChangeTreeData.fire(element);
        } else {
            this._onDidChangeTreeData.fire();
        }
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (element) {
            if (element.contextValue === 'appList') {
                return Promise.resolve(this._getAppList(element.label, element.deviceName));
            }
            return element.children;
        } else {
            return Promise.resolve(this._getDeviceList());
        }
    }

    async _getDeviceList() {
        let array = [];
        let deviceList = await getDeviceList();
        for (let i = 0; i < deviceList.length; i++) {
            deviceList[i]["isOnline"] = await updateDeviceStatus(deviceList[i].name);
        }
        deviceList.forEach((device) => {
            let description = device.default ? "(default) " : "";
            description += `${device.username}@${device.ip}:${device.port}`
            array.push(new Device(device.name, description, device["isOnline"]));
        });

        return array;
    }

    async _getAppList(label, deviceName) {
        let array = [];
        if (!deviceName) {
            return;
        }

        let isOnline = await updateDeviceStatus(deviceName);
        if (!isOnline) {
            vscode.window.showErrorMessage(`Unable to connect device '${deviceName}', device may be offline.`);
            return []
        }
        if (label === 'Installed') {
            let installed = await getInstalledList(deviceName);
            installed.forEach((appId) => {
                if (!appId.includes("[Info]")) {
                    array.push(new AppId(appId, 'installed', deviceName, ""));
                }
            });
        } else if (label === 'Running') {
            let running = await getRunningList(deviceName);
            const profile = getProfile();
            console.log("Hit profile =" + profile);
            running.forEach((appId) => {
                let idArray = appId.split(/\s+/)
                let id = idArray[0].trim();
                const display = (profile === 'tv') ? '' : appId.replace(id, "").replace("-", "").trim();
                if (!id.includes("[Info]")) {
                    array.push(new AppId(id, 'running', deviceName, display));
                }

            });
        }
        return array;
    }
}

class Device {
    contextValue = 'device';

    constructor(deviceName, infoStr, isOnline) {
        this.label = deviceName;
        this.description = isOnline ? infoStr : "[Offline]" + infoStr;
        this.children = isOnline ? [new AppList('Installed', deviceName), new AppList('Running', deviceName)] : null;
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        this.iconPath = new vscode.ThemeIcon('device-desktop');

    }

}

class AppList {
    contextValue = 'appList';
    constructor(listName, deviceName) {
        this.label = listName;
        this.children = [];
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        this.deviceName = deviceName;
    }
}
class AppId {
    constructor(appId, contextValue, deviceName, display) {
        this.label = appId;
        this.contextValue = contextValue;
        this.deviceName = deviceName;
        this.description = display;
    }
}

const simulatorDirPath = getSimulatorDirPath();
class Simulator {
    contextValue = 'simulator';

    constructor(simulatorName, version) {
        this.label = simulatorName;
        this.version = version;
        this.iconPath = new vscode.ThemeIcon('device-desktop');
    }

    refresh(element) {
        ga4Util.mpGa4Event("RefreshSimulator", { category: "Commands" });
        if (element) {
            this._onDidChangeTreeData.fire(element);
        } else {
            this._onDidChangeTreeData.fire();
        }
    }

}
class SimulatorProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor() {
        if (simulatorDirPath) {
            chokidar.watch(simulatorDirPath).on('all', (event, dirPath) => {
                if (event === 'change' || event === 'unlink') {
                    console.log(`${event}: ${dirPath}`);
                    this.refresh();
                }
            });
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

    getChildren() {
        return Promise.resolve(this._getSimulatorList());
    }

    async _getSimulatorList() {
        const array = [];
        const simulatorList = await getSimulatorList(true);
        simulatorList.forEach((device) => {
            array.push(new Simulator(device.name, device.version));
        });
        return array;
    }
}

exports.DeviceProvider = DeviceProvider;
exports.SimulatorProvider = SimulatorProvider;