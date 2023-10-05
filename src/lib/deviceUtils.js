/*
  * Copyright (c) 2021-2023 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const ares = require('./runCommand');
const { getSimulatorDirPath } = require('./configUtils');
const { getSimulatorVersionArray } = require('./workspaceUtils');

let deviceList = [];
let simulatorList = [];

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
            appList = appList.filter(id => id !== '' && !id.includes('[Info]'));
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

async function setCurrentDeviceProfile(profile) {
    let result = false;
    await ares.config(true, profile)
        .then(() => {
            result = true;
        }).catch(err =>{
            console.error(err);
            // vscode.window.showErrorMessage(`Error! Failed to set device profile.`);
        });
    return result;
}

async function getCurrentDeviceProfile() {
    return new Promise((resolve, reject) => {
        ares.config(false)
            .then((data) => {
                resolve(data);
            }).catch((err) => {
                console.error(err);
                // vscode.window.showErrorMessage(`Error! Failed to get current device profile.`);
                reject(err);
            });
    });
}

async function getDefaultDevice() {
    //const defaultDevice = vscode.workspace.getConfiguration(WEBOSTV).get(DEFAULT_DEVICE);
    const defaultDevice = ""; // HACK

    if (defaultDevice) { // if default device exists in configuration
        // check default device is in the device list
        const list = await getDeviceList();
        const deviceNameList = list.map(device => device.name);
        if (!deviceNameList.includes(defaultDevice)) {
            vscode.window.showWarningMessage(`Warning! The default device(${defaultDevice}) is not in the device list.`);
            return null;
        } else {
            return defaultDevice;
        }
    } else {
        return defaultDevice;
    }
}

async function _setSimulatorList() {
    try {
        const simulatorDir = getSimulatorDirPath();
        const versionArray = await getSimulatorVersionArray(simulatorDir);

        if (versionArray && versionArray.length > 0) {
            for (let i = 0; i < versionArray.length; i++) {
                const data = {};
                data.version = versionArray[i];
                data.name = `webOS_TV_${versionArray[i]}_Simulator`;
                simulatorList.push(data);
            }
            simulatorList.sort(_sortByName);
            return;
        } else {
            // err
            return;
        }
    } catch (err) {
        console.error(err);
        vscode.window.showErrorMessage(`Error! Failed to get the simulator list.`);
        return;
    }
}

async function getSimulatorList(withRefresh) {
    if (!!withRefresh || simulatorList.length === 0) {
        simulatorList = [];
        await _setSimulatorList();
    }
    return simulatorList;
}

module.exports = {
    getDeviceList: getDeviceList,
    getInstalledList: getInstalledList,
    getRunningList: getRunningList,
    getDefaultDevice: getDefaultDevice,
    updateDeviceStatus:updateDeviceStatus,
    getSimulatorList: getSimulatorList,
    getCurrentDeviceProfile: getCurrentDeviceProfile,
    setCurrentDeviceProfile: setCurrentDeviceProfile,
}
