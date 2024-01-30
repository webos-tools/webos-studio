/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const path = require('path');
const { fileURLToPath } = require('url');
const { InputController } = require('./lib/inputController');
const { InputChecker } = require('./lib/inputChecker');
const ares = require('./lib/runCommand');
const { getDefaultDir, getIpkArray, getAppsList } = require('./lib/workspaceUtils');
const enactUtils = require('./lib/enactUtils');
const appUtils = require('./lib/appUtil');
const notify = require('./lib/notificationUtils');

module.exports = function packageApp(appSelectedDir, isSkip) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        let defaultDir = getDefaultDir();
        let defaultStr = '';
        let appId = "";
        let serviceList = [];
        let servicePath = "";

        function prepend(value, array) {
            var newArray = array.slice();
            newArray.unshift(value);
            return newArray;
        }
        if (defaultDir) {
            serviceList = await getAppsList(defaultDir, "service");
            serviceList = prepend("--Select Service--", serviceList);
            serviceList.push("Choose a Different Service");
            if (appSelectedDir) {
                defaultDir = path.join(defaultDir, appSelectedDir)
            }
            defaultStr = ` (suggestion: ${defaultDir})`;

        }
        if (isSkip && appSelectedDir && defaultDir) {
            let ipkArray = await getIpkArray(defaultDir);
            if (ipkArray.length > 0) {
                let ipkPath = path.join(defaultDir, ipkArray[0]);
                resolve(ipkPath);
            } else {
                await next();
            }
        } else {
            await next();
        }
        async function next() {
            let controller = new InputController();
            let folderBtn = InputController.FileBrowser;
            folderBtn.bindAction(async function (thisInput) {
                let folder = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true
                });
                if (folder) {
                    thisInput.value = fileURLToPath(folder[0].toString(true));
                }
            });

            controller.addStep({
                title: 'Create Package with App',
                totalSteps: 4,
                step: 1,
                placeholder: `Select App Directory: ${defaultStr}`,
                prompt: 'Enter App Directory Path',
                buttons: [folderBtn],
                validator: function (value) {
                    if (value === '') {
                        if (defaultDir) {
                            value = defaultDir;
                        } else {
                            return 'Please enter the directory to be packaged.';
                        }
                    }
                    let folderError = InputChecker.checkDirectoryExist(value);
                    if (folderError) {
                        return folderError;
                    } else {
                        let appInfoError = InputChecker.checkAppInfoExists(value);
                        if (appInfoError) {
                            return appInfoError;
                        } else {
                            appUtils.getAppId(value, (id) => {
                                appId = id;
                                return null;
                            });
                        }
                    }
                }
            });
            controller.addStep({
                title: 'Service directory to pack with App (Optional)',
                placeholder: `Select Service from workspace / keep blank`,
                items: serviceList.map(label => ({ label })),
                totalSteps: 4,
                step: 2,
                additionalStep: function (value) {
                    // eslint-disable-next-line no-async-promise-executor
                    return new Promise(async (resolve) => {
                        if (value == "Choose a Different Service") {
                            let controller1 = new InputController();
                            controller1.addStep({
                                title: 'Create Package with App',
                                placeholder: `Service Directory if need to packaged with service else leave blank`,
                                prompt: 'Enter Service directory if needed',
                                buttons: [folderBtn],
                                validator: function (value) {
                                    if (value !== '') {
                                        let folderError = InputChecker.checkDirectoryExist(value);
                                        if (folderError) {
                                            return folderError;
                                        } else {
                                            let serviceFileError = InputChecker.checkServiceExists(value);
                                            if (serviceFileError) {
                                                return serviceFileError;
                                            } else {
                                                return InputChecker.checkAppsService(value, appId);
                                            }
                                        }
                                    } else {
                                        return null;
                                    }
                                }
                            });
                            let results = await controller1.start();
                            servicePath = results.shift();
                            resolve(true);
                        } else {
                            resolve(true);
                        }
                    });
                }
            });
            controller.addStep({
                title: 'Create Package with App',
                totalSteps: 4,
                step: 3,
                placeholder: `Output Location${defaultStr}`,
                prompt: 'Enter Output Location',
                buttons: [folderBtn],
                validator: function (value) {
                    if (value === '') {
                        if (defaultDir) {
                            return null;
                        } else {
                            return 'Please enter the directory for output.';
                        }
                    }
                    return InputChecker.checkDirectoryExist(value);
                }
            });
            controller.addStep({
                title: 'Create Package with App',
                totalSteps: 4,
                step: 4,
                placeholder: 'Minify your app?',
                items: ['Yes', 'No'].map(label => ({ label }))
            });

            let results = await controller.start();
            let appDir = results.shift() || defaultDir;
            if (!path.isAbsolute(appDir) && defaultDir) {
                appDir = path.join(defaultDir, appDir);
            }
            let serviceDir = results.shift();
            let isNotLinked = null;
            if (serviceDir) {
                if (serviceDir == '' || serviceDir == "--Select Service--") {
                    serviceDir = "";
                } else if (serviceDir == 'Choose a Different Service') {
                    serviceDir = servicePath;
                } else {
                    isNotLinked = InputChecker.checkAppsService(serviceDir, appId);
                }
                if (serviceDir && !path.isAbsolute(serviceDir) && defaultDir) {
                    let workspace = getDefaultDir();
                    serviceDir = path.join(workspace, serviceDir);
                }
            }
            let outDir = results.shift() || defaultDir;
            if (!path.isAbsolute(outDir) && defaultDir) {
                outDir = path.join(defaultDir, outDir);
            }
            let minify = results.shift();
            if (minify === 'Yes' || minify === 'yes') {
                minify = true;
            } else {
                minify = false;
            }

            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Package App - ${appId}`,
                cancellable: false
            }, async (progress, token) => {
                token.onCancellationRequested(() => {
                    reject("User canceled the long running operation");
                });
                try {
                    if (isNotLinked) {
                        throw isNotLinked;
                    }
                    await notify.showProgress(progress, 10, `Packageing Application started...`);
                    let ipkPath;
                    let isEnact = await enactUtils.isEnactApp(appDir);
                    if (isEnact) {
                        await notify.showProgress(progress, 10, `Build is in progress...`);
                        await enactUtils.pack(appDir, minify)
                            .then(async () => {
                                appDir = path.join(appDir, "dist");
                                await notify.showProgress(progress, 10, `Build Files created.`);
                            }).catch((err) => {
                                throw err;
                            });
                    }
                    await notify.showProgress(progress, 50, `IPK creation is in progress...`);
                    require('./ga4Util').mpGa4Event("PackageApp", {category:"Commands"});
                    await ares.package(appDir, outDir, minify, serviceDir)
                        .then(async (ipkFile) => {
                            await notify.clearProgress(progress, `Success! Created ${ipkFile} at ${outDir}.`);
                            ipkPath = path.join(outDir, ipkFile);
                            resolve(ipkPath);
                        }).catch((err) => {
                            throw err;
                        });
                } catch (err) {
                    let errMsg = 'Failed to package an app.';
                    if (err.includes('Invalid app id')) {
                        errMsg = 'Please check the id format. Only lowercase letters(a-z), digits(0-9), minus signs, and periods are allowed.';
                    } else if (err.includes('Invalid app version')) {
                        errMsg = 'Please check the version format. ex) 1.0.0';
                    } else if (err.includes('has no meta files') || err.includes('Only service packaging')) {
                        errMsg = `Only an app can be packaged. Please make sure the directory includes 'appinfo.json'.`
                    } else {
                        errMsg = err;
                    }
                    vscode.window.showErrorMessage(`ERROR! Packaging App Failed. Details As follows: ${errMsg}`);
                    await notify.clearProgress(progress, `ERROR! Packaging App Failed due to ${errMsg}`);
                }
            });
        }
    });
}
