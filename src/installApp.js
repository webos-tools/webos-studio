/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const path = require('path');
const { fileURLToPath } = require('url');
const { InputController } = require('./lib/inputController');
const { InputChecker } = require('./lib/inputChecker');
const { getDefaultDir, getIpkArray } = require('./lib/workspaceUtils');
const ares = require('./lib/runCommand');
const notify = require('./lib/notificationUtils');
const ga4Util = require('./ga4Util');

const folderBtn = InputController.FileBrowser;
folderBtn.bindAction(async function (thisInput) {
    let file = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false
    });
    if (file) {
        thisInput.value = fileURLToPath(file[0].toString(true));
    }
});

function _install(appFilePath, device) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Install Application",
            cancellable: false
        }, async (progress, token) => {
            token.onCancellationRequested(() => {
                console.log("User canceled the long running operation");
                reject("CANCEL! Process ened by user..");
            });
            // let progress = await notify.initProgress("generate application", true);
            await notify.showProgress(progress, 20, `Installation of IPK to device in progress...`);
            ga4Util.mpGa4Event("InstallApp", {category:"Commands"});
            await ares.install(appFilePath, device)
                .then(async () => {
                    await notify.clearProgress(progress, `Success! Installed ${appFilePath} on ${device}.`);
                    let appId = path.basename(appFilePath, '.ipk');
                    let index = appId.indexOf('_');
                    if (index > -1) {
                        appId = appId.slice(0, index);
                    }
                    resolve({ appId: appId, device: device });
                }).catch(async (err) => {
                    let errMsg = `Failed to install ${appFilePath} on ${device}.`
                    if (err.includes(`Unknown method "install" for category "/dev"`)) {
                        errMsg = `Please make sure the 'Developer Mode' is on.`;
                    } else if (err.includes(`Connection time out`)) {
                        errMsg = `Please check ${device}'s IP address or port.`
                    }
                    await notify.clearProgress(progress, `ERROR! ${errMsg}`);
                    let erMsg = err.toString();
                    vscode.window.showErrorMessage(`ERROR! ${errMsg}. Details As follows: ${erMsg}`);
                    reject(err);
                });
        });
    })
}

const selectMsg = '[Select from File Browser]';
async function _selectAgain() {
    let controller = new InputController();
    controller.addStep({
        title: 'Install Application',
        placeholder: 'Enter App File Path',
        prompt: 'Enter App File Path',
        buttons: [folderBtn],
        validator: InputChecker.checkIpkFile
    });

    let results = await controller.start();
    let appFilePath = results.shift();
    let defaultDir = getDefaultDir();
    if (!path.isAbsolute(appFilePath) && defaultDir) {
        appFilePath = path.join(defaultDir, appFilePath);
    }

    return appFilePath;
}

module.exports = function installApp(ipkPath, deviceName) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        let appFilePath = ipkPath;
        let device = deviceName;
        if (!device && !appFilePath) {
            // called by command palette without default device
            let controller = new InputController();

            // Commented the below part for WRO-7045
            /*
           controller.addStep({
               title: 'Install Application',
               totalSteps: 2,
               step: 1,
               placeholder: 'Select Target Device',
               items: deviceList.map(device => `${device.name} (${device.username}@${device.ip}:${device.port})`).map(label => ({ label }))
           });
           */
            let defaultDir = getDefaultDir();
            getIpkArray(defaultDir).then(async val => {
                let ipkArray = val;
                if (ipkArray && ipkArray.length > 0) {
                    ipkArray.push(selectMsg);
                    controller.addStep({
                        title: 'Install Application',
                        totalSteps: 1,
                        step: 1,
                        placeholder: 'Select App File',
                        items: ipkArray.map(label => ({ label }))
                    });
                } else {
                    controller.addStep({
                        title: 'Install Application',
                        totalSteps: 1,
                        step: 1,
                        placeholder: 'Enter App File Path',
                        prompt: 'Enter App File Path',
                        buttons: [folderBtn],
                        validator: InputChecker.checkIpkFile
                    });
                }
                let results = await controller.start();
                // Commented the below part for WRO-7045
                /*
                device = results.shift()
                device = device.slice(0, device.indexOf(' ('));
                */
                appFilePath = results.shift();
                if (appFilePath === selectMsg) {
                    appFilePath = await _selectAgain();
                }
                if (!path.isAbsolute(appFilePath) && defaultDir) {
                    appFilePath = path.join(defaultDir, appFilePath);
                }

                _install(appFilePath, device)
                    .then(() => {
                        resolve();
                    }).catch((err) => {
                        reject(err)
                    });
            });
        } else if (device && !appFilePath) {
            // called by tree view menu
            // or called by command palette with default device
            let defaultDir = getDefaultDir();
            let controller = new InputController();
            getIpkArray(defaultDir)
                .then(async val => {
                    let ipkArray = val;
                    if (ipkArray && ipkArray.length > 0) {
                        ipkArray.push(selectMsg);
                        controller.addStep({
                            title: 'Install Application',
                            placeholder: 'Select App File',
                            items: ipkArray.map(label => ({ label }))
                        });
                    } else {
                        controller.addStep({
                            title: 'Install Application',
                            placeholder: 'Enter App File Path',
                            prompt: 'Enter App File Path',
                            buttons: [folderBtn],
                            validator: InputChecker.checkIpkFile
                        });
                    }

                    let results = await controller.start();
                    appFilePath = results.shift();
                    if (appFilePath === selectMsg) {
                        appFilePath = await _selectAgain();
                    }
                    if (!path.isAbsolute(appFilePath) && defaultDir) {
                        appFilePath = path.join(defaultDir, appFilePath);
                    }

                    _install(appFilePath, device)
                        .then(() => {
                            resolve();
                        }).catch((err) => {
                            reject(err)
                        });
                });
        } else if (!device && appFilePath) {
            // called by explorer context menu

            // Commented the below part for WRO-7045

            /*
            let controller = new InputController();
            controller.addStep({
                title: 'Install Application',
                placeholder: 'Select Target Device',
                items: deviceList.map(device => `${device.name} (${device.username}@${device.ip}:${device.port})`).map(label => ({ label }))
            });

            let results = await controller.start();
            device = results.shift();
            device = device.slice(0, device.indexOf(' ('));
            */

            _install(appFilePath, device)
                .then((obj) => {
                    resolve(obj);
                }).catch((err) => {
                    reject(err)
                });
        } else {
            // called by runApp
            // or called by explorer context menu with default device
            _install(appFilePath, device)
                .then((obj) => {
                    resolve(obj);
                }).catch((err) => {
                    reject(err)
                });
        }
    })
}
