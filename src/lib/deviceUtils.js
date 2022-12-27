/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const ares = require('./runCommand');

let deviceList = [];

function _sortByName(a, b) {
    return a.name > b.name ? 1 : -1;
}

async function _setDeviceList() {
    await ares.setupDeviceList()
        .then((data) => {
            deviceList = [];
            let fullList;
            try {
                fullList = JSON.parse(data);
            } catch (e) {
                vscode.window.showErrorMessage(`Error! Crossed buffer limit, Please remove some devices.`);
            }
            if (Array.isArray(fullList)) {
                for (let i in fullList) {
                    let data = {};
                    data.name = fullList[i].name;
                    data.ip = fullList[i].deviceinfo.ip;
                    data.port = fullList[i].deviceinfo.port;
                    data.username = fullList[i].deviceinfo.user;
                    data.default = fullList[i].default;
                    deviceList.push(data);
                }
                deviceList.sort(_sortByName);
                return;
            } else {
                console.error(`ares-setup-device -F ERR! *** Result is not array.`);
                vscode.window.showErrorMessage(`Error! Failed to get the device list.`);
            }
        }).catch((err) => {
            console.error(err);
            vscode.window.showErrorMessage(`Error! Failed to get the device list.`);
        })
}

async function getDeviceList() {
    await _setDeviceList();
    return deviceList;
}
async function updateDeviceStatus(device) {
   
    let isOnline = false;
    await ares.checkDeviceOnline(device)
        .then(() => {
            isOnline = true;
        }).catch(err => { // eslint-disable-line no-unused-vars
            isOnline = false;
        });

    return isOnline;
}
async function getInstalledList(device) {
    let appList = [];

    await ares.installList(device)
        .then(value => {
            appList = value.split(/\r?\n/);
            appList = appList.filter(id => id !== '');
        }).catch(err => {
            let errMsg = `Failed to list the applications installed on ${device}`;
            if (err.includes(`Unknown method "running" for category "/dev"`)) {
                errMsg = `Please make sure the 'Developer Mode' is on.`;
            } else if (err.includes(`Connection time out`)) {
                errMsg = `Please check ${device}'s IP address or port.`
            }
            vscode.window.showErrorMessage(`Error! ${errMsg}`);
        });

    return appList;
}

async function getRunningList(device) {
    let appList = [];

    await ares.launchRunning(device)
        .then(value => {
            appList = value.split(/\r?\n/);
            appList = appList.filter(id => id !== '');
        }).catch(err => {
            let errMsg = `Failed to list the applications running on ${device}`;
            if (err.includes(`Unknown method "listApps" for category "/dev"`)) {
                errMsg = `Please make sure the 'Developer Mode' is on.`;
            } else if (err.includes(`Connection time out`)) {
                errMsg = `Please check ${device}'s IP address or port.`
            }
            vscode.window.showErrorMessage(`Error! ${errMsg}`);
        });

    return appList;
}

module.exports = {
    getDeviceList: getDeviceList,
    getInstalledList: getInstalledList,
    getRunningList: getRunningList,
    updateDeviceStatus:updateDeviceStatus
}
