/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const ares = require('./lib/runCommand');

function uninstallApp(appId, device) {
    return new Promise((resolve, reject) => {
        require('./ga4Util').mpGa4Event("UninstallApp", {category:"Commands"});
        ares.installRemove(appId, device)
            .then(() => {
                vscode.window.showInformationMessage(`Uninstalled ${appId} on ${device}.`);
                resolve();
            }).catch((err) => {
                let errMsg = `Failed to uninstall ${appId} on ${device}.`
                if (err.includes(`Unknown method "remove" for category "/dev"`)) {
                    errMsg = `Please make sure the 'Developer Mode' is on.`;
                } else if (err.includes(`Connection time out`)) {
                    errMsg = `Please check ${device}'s IP address or port.`
                }
                vscode.window.showErrorMessage(`Error! ${errMsg}`);
                reject();
            });
    })
}

function closeApp(appId, device, dp) {
    return new Promise((resolve, reject) => {
        appId = appId.split(/\s+/)[0];
        require('./ga4Util').mpGa4Event("CloseApp", {category:"Commands"});
        ares.launchClose(appId, device, dp)
            .then(() => {
                vscode.window.showInformationMessage(`Closed ${appId} on ${device}.`);
                resolve();
            }).catch((err) => {
                let errMsg = `Failed to close ${appId} on ${device}.`
                if (err.includes(`Unknown method "closeByAppId" for category "/dev"`)) {
                    errMsg = `Please make sure the 'Developer Mode' is on.`;
                } else if (err.includes(`Connection time out`)) {
                    errMsg = `Please check ${device}'s IP address or port.`
                }
                vscode.window.showErrorMessage(`Error! ${errMsg}`);
                reject();
            });
    })
}

function getDeviceInfo(device) {
    ares.deviceInfo(device)
        .then((info) => {
            vscode.window.showInformationMessage(`${info}`, { modal: true });
        }).catch((err) => {
            let errMsg = `Failed to get ${device}'s information.`;
            if (err.includes(`Connection time out`)) {
                errMsg = `Please check ${device}'s IP address or port.`
            }
            vscode.window.showErrorMessage(`Error! ${errMsg}`);
        })
}

async function setDefaultDevice(deviceLabel) {
    await ares.setDefaultDevice(deviceLabel)
        .then(() => {
            vscode.window.showInformationMessage(`${deviceLabel} is set as the default device.`, { modal: true });
        }).catch((err) => {
            let errMsg = `Failed to set ${deviceLabel} as the default device.`;
            if (err.includes(`Connection time out`)) {
                errMsg = `Please check ${deviceLabel}'s IP address or port.`
            }
            vscode.window.showErrorMessage(`Error! ${errMsg}`);
        })
}

module.exports = {
    uninstallApp: uninstallApp,
    closeApp: closeApp,
    getDeviceInfo: getDeviceInfo,
    setDefaultDevice: setDefaultDevice
};
