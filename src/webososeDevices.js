/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const path = require('path');
const { getDeviceList, getInstalledList, getRunningList,updateDeviceStatus } = require('./lib/deviceUtils');
const { logger } = require('./lib/logger');

class DeviceProvider {
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
        for(let i = 0 ;i<deviceList.length;i++){
            deviceList[i]["isOnline"] = await updateDeviceStatus(deviceList[i].name);
        }
        // deviceList[0]["isOnline"] = true;4
        deviceList.forEach((device) => {
            let description = device.default ? "(default) " : "";
            description += `${device.username}@${device.ip}:${device.port}`
            array.push(new Device(device.name, description,device["isOnline"]));
        });
        if(logger.extInit == false)
            logger.logAny("webOS Studio Initialized successfully.");
        logger.extInit = true;
        return array;
    }

    async _getAppList(label, deviceName) {
        let array = [];
        if (!deviceName) {
            return;
        }
     
        let isOnline = await updateDeviceStatus(deviceName);
        if(!isOnline){
         vscode.window.showErrorMessage(`Unaable to connect device '${deviceName}', device may offline `);
         return[]  
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
            running.forEach((appId) => {
                let idArray = appId.split(/\s+/)
                let id = idArray[0].trim();
                let display = appId.replace(id, "").replace("-", "").trim();
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

    constructor(deviceName, infoStr,isOnline) {
        this.label = deviceName;
        // this.label =isOnline?deviceName:{label:deviceName +" [Offline]",highlights:[[deviceName.length+1,deviceName.length+10]]};// deviceName
        // this.description = infoStr;
        this.description = isOnline?infoStr:"[Offline]"+infoStr;
         
        // this.children = [new AppList('Installed', deviceName), new AppList('Running', deviceName)];
        this.children = isOnline?[new AppList('Installed', deviceName), new AppList('Running', deviceName)]:null;
        this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }

    iconPath = {
        light: path.join(__filename, '..', '..', 'resources', 'light', 'display.svg'),
        dark: path.join(__filename, '..', '..', 'resources', 'dark', 'display.svg')
    };
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

exports.DeviceProvider = DeviceProvider;
