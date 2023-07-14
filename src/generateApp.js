/*
  * Copyright (c) 2021-2023 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const { fileURLToPath } = require('url');
const fs = require('fs');
const path = require('path');
const { InputController } = require('./lib/inputController');
const { InputChecker } = require('./lib/inputChecker');
const templateUtils = require('./lib/templateUtils');
const enactUtils = require('./lib/enactUtils');
const appUtils = require('./lib/appUtil');
const ares = require('./lib/runCommand');
const { getDefaultDir, setDefaultDir, copyDirSync, updatePackageJson, getAppsList } = require('./lib/workspaceUtils');
const notify = require('./lib/notificationUtils');

let defaultId = 'com.domain.app';
let defaultServiceId = 'com.domain.app.service';
let defaultVersion = '0.0.1';
let defaultTitle = 'new app';
let defaultUrl = 'http://developer.lge.com/';
let defaultEnactTemplate = 'sandstone';
let jsServicePatchPath = path.join(__dirname, "../media/patches");

async function _setBasic() {
    let controller = new InputController();
    defaultId = 'com.domain.app';
    controller.addStep({
        title: 'Define App Properties',
        totalSteps: 3,
        step: 1,
        placeholder: `App ID (default: ${defaultId})`,
        prompt: 'Enter App ID',
        validator: InputChecker.checkAppId
    })
    controller.addStep({
        title: 'Define App Properties',
        totalSteps: 3,
        step: 2,
        placeholder: `App Version (default: ${defaultVersion})`,
        prompt: 'Enter App Version',
        validator: InputChecker.checkVersion
    })
    controller.addStep({
        title: 'Define App Properties',
        totalSteps: 3,
        step: 3,
        placeholder: `App Title (default: ${defaultTitle})`,
        prompt: 'Enter App Title'
    })

    let results = await controller.start();
    let prop = {};
    prop.id = results.shift().trim() || defaultId;
    prop.version = results.shift().trim() || defaultVersion;
    prop.title = results.shift().trim() || defaultTitle;

    return prop;
}

async function _setBasicEnact() {
    let controller = new InputController();
    defaultId = 'com.domain.app';
    defaultEnactTemplate = 'sandstone';
    controller.addStep({
        title: 'Define App Properties',
        totalSteps: 4,
        step: 1,
        placeholder: `App ID (default: ${defaultId})`,
        prompt: 'Enter App ID',
        validator: InputChecker.checkAppId
    })
    controller.addStep({
        title: 'Select App Template',
        totalSteps: 4,
        step: 2,
        placeholder: 'Select Enact Template',
        items: enactUtils.getTemplateList().map(label => ({ label }))
    });
    controller.addStep({
        title: 'Define App Properties',
        totalSteps: 4,
        step: 3,
        placeholder: `App Version (default: ${defaultVersion})`,
        prompt: 'Enter App Version',
        validator: InputChecker.checkVersion
    })
    controller.addStep({
        title: 'Define App Properties',
        totalSteps: 4,
        step: 4,
        placeholder: `App Title (default: ${defaultTitle})`,
        prompt: 'Enter App Title'
    })

    let results = await controller.start();
    let prop = {};
    prop.id = results.shift().trim() || defaultId;
    prop.template = results.shift() || defaultEnactTemplate;
    prop.version = results.shift().trim() || defaultVersion;
    prop.title = results.shift().trim() || defaultTitle;

    return prop;
}

async function _setHosted() {
    let controller = new InputController();
    defaultId = 'com.domain.app';
    controller.addStep({
        title: 'Define App Properties',
        totalSteps: 4,
        step: 1,
        placeholder: `App ID (default: ${defaultId})`,
        prompt: 'Enter App ID',
        validator: InputChecker.checkAppId
    })
    controller.addStep({
        title: 'Define App Properties',
        totalSteps: 4,
        step: 2,
        placeholder: `App Version (default: ${defaultVersion})`,
        prompt: 'Enter App Version',
        validator: InputChecker.checkVersion
    })
    controller.addStep({
        title: 'Define App Properties',
        totalSteps: 4,
        step: 3,
        placeholder: `App Title (default: ${defaultTitle})`,
        prompt: 'Enter App Title'
    })
    controller.addStep({
        title: 'Define App Properties',
        totalSteps: 4,
        step: 4,
        placeholder: `Hosted Url (default: ${defaultUrl})`,
        prompt: 'Enter Hosted Url'
    })

    let results = await controller.start();
    let prop = {};
    prop.id = results.shift().trim() || defaultId;
    prop.version = results.shift().trim() || defaultVersion;
    prop.title = results.shift().trim() || defaultTitle;
    prop.url = results.shift().trim() || defaultUrl;

    return prop;
}

function prepend(value, array) {
    var newArray = array.slice();
    newArray.unshift(value);
    return newArray;
}

async function _setServiceId(folderBtn, location) {
    let controller = new InputController(),
        id = "",
        appList = [];
    appList = await getAppsList(location, "apps");
    appList = prepend("--Select App--", appList);
    appList.push("Choose a Different App");

    controller.addStep({
        title: 'Link App to Service (Optional)',
        placeholder: `Select App from workspace / keep blank`,
        items: appList.map(label => ({ label }))
    });

    let results = await controller.start();
    let projectName = results.shift();
    if (projectName == "" || projectName == "--Select App--") {
        return null;
    } else if (projectName == "Choose a Different App") {
        let controller1 = new InputController();
        controller1.addStep({
            title: 'Link App to Service (Optional)',
            placeholder: `Enter path of App to which service need to link / keep blank`,
            prompt: 'Enter App Directory Path',
            buttons: [folderBtn],
            validator: function (value) {
                if (value === '') {
                    return null;
                } else {
                    let folderError = InputChecker.checkDirectoryExist(value);
                    if (folderError) {
                        return folderError;
                    } else {
                        let appInfoError = InputChecker.checkAppInfoExists(value);
                        if (appInfoError) {
                            return appInfoError;
                        } else {
                            appUtils.getAppId(value, (appId) => {
                                id = appId + ".service";
                                return null;
                            });
                        }
                    }
                }
            }
        });
        await controller1.start();
    } else {
        appUtils.getAppId(projectName, (appId) => {
            id = appId + ".service";
            return null;
        });
    }
    return id;
}

async function _setService(defaultId) {
    let prop = {};
    if (defaultId) {
        prop.id = defaultId;
        prop.version = defaultVersion;

        return prop;
    } else {
        let controller = new InputController();
        if (!defaultId)
            defaultId = defaultServiceId;

        controller.addStep({
            title: 'Define Service Properties',
            placeholder: `Suggested Service ID (default: ${defaultId})`,
            prompt: 'Enter Service ID',
            enabled: false,
            validator: InputChecker.checkAppId
        });

        let results = await controller.start();
        prop.id = results.shift().trim() || defaultId;
        prop.version = defaultVersion;

        return prop;
    }
}

async function _setPackage() {
    let controller = new InputController();
    defaultId = 'com.domain';
    controller.addStep({
        title: 'Define Package Properties',
        totalSteps: 2,
        step: 1,
        placeholder: `Package ID (default: ${defaultId})`,
        prompt: 'Enter Package ID',
        validator: InputChecker.checkAppId
    })
    controller.addStep({
        title: 'Define Package Properties',
        totalSteps: 2,
        step: 2,
        placeholder: `Package Version (default: ${defaultVersion})`,
        prompt: 'Enter Package Version',
        validator: InputChecker.checkVersion
    })

    let results = await controller.start();
    let prop = {};
    prop.id = results.shift().trim() || defaultId;
    prop.version = results.shift().trim() || defaultVersion;

    return prop;
}

async function _addWebOS() {
    let controller = new InputController();
    controller.addStep({
        placeholder: 'Add webOS library to project?',
        items: ['Yes', 'No'].map(label => ({ label }))
    });

    let results = await controller.start();
    let answer = results.shift();
    if (answer === 'Yes' || answer === 'yes') {
        return true;
    } else {
        return false;
    }
}

async function generateApp() {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        let defaultStr = '';
        let defaultDir = getDefaultDir();
        if (defaultDir) {
            defaultStr = ` (default: ${defaultDir})`;
        }

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
        let controller = new InputController();
        controller.addStep({
            title: 'Configure Project',
            totalSteps: 2,
            step: 1,
            placeholder: 'Select Project Type',
            items: templateUtils.getTemplateAndDesc() // getTemplateList().map(label => ({ label }))
        });
        controller.addStep({
            title: 'Configure Project',
            totalSteps: 2,
            step: 2,
            placeholder: `Project Location${defaultStr}`,
            prompt: 'Enter Project Location',
            buttons: [folderBtn],
            validator: function (value) {
                if (value === '') {
                    if (defaultDir) {
                        return null;
                    } else {
                        return 'Please enter the project location.';
                    }
                }
                return InputChecker.checkDirectoryExist(value);
            }
        });

        let results = await controller.start();
        let template = results.shift();
        let location = results.shift().trim() || defaultDir;
        if (!path.isAbsolute(location) && defaultDir) {
            location = path.join(defaultDir, location);
        }

        let controller2 = new InputController();
        controller2.addStep({
            title: 'Configure Project (1/1)',
            placeholder: 'Enter Project Name',
            prompt: 'Enter Project Name',
            validator: function (value) {
                // value = value.trim();
                if (value === '') {
                    return 'Please enter the project name.';
                }
                let isNameInvalid = InputChecker.checkDirectoryName(value);
                if (isNameInvalid) {
                    value = value.trim()
                    return isNameInvalid;
                } else {
                    let projectPath = path.join(location, value);
                    if (fs.existsSync(projectPath)) {
                        return `The '${value}' directory already exists. Please specify another name.`;
                    } else {
                        return null;
                    }
                }
            }
        });
        let results2 = await controller2.start();
        let projectName = results2.shift();
        let projectPath = path.join(location, projectName);
        let prop, addOS;

        switch (template) {
            case 'Basic Web App':
                prop = await _setBasic();
                break;
            case 'Basic Enact App':
                prop = await _setBasicEnact();
                addOS = await _addWebOS();
                break;
            case 'Web App Info':
                prop = await _setBasic();
                break;
            case 'Hosted Web App':
                prop = await _setHosted();
                break;
            case 'JS Service':
            case 'JS Service Info': {
                let defaultAppId = await _setServiceId(folderBtn, location);
                prop = await _setService(defaultAppId);
                addOS = await _addWebOS();
                break;
            }
            case 'Package Info':
                prop = await _setPackage();
                break;
            default:
                break;
        }

        let templateId = templateUtils.getTemplateId(template);
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Generate App- ${projectName}`,
            cancellable: false
        }, async (progress, token) => {
            token.onCancellationRequested(() => {
                reject("CANCEL! Process ended by user..");
            });
            // let progress = await notify.initProgress("generate application", true);
            try {
                await notify.showProgress(progress, 20, `${template} generation in progress...`);
                if (templateId == "enact") {
                    await enactUtils.create(prop, projectPath);
                    await notify.showProgress(progress, 20, `Dist folder generation completed...`);
                    await appUtils.createAppInfo(prop, projectPath);
                    await notify.showProgress(progress, 20, `App info details creation completed...`);
                    await appUtils.copyIcon(projectPath);
                } else {
                    await ares.generate(templateId, prop, projectPath);
                }
                if (addOS) {
                    let library;
                    if (templateId == "enact") {
                        library = "@enact/webos";
                    } else {
                        library = "@types/webos-service";
                        await notify.showProgress(progress, 20, `JS Service Patch file adding in progress`);
                        await copyDirSync(jsServicePatchPath, path.join(projectPath, "patches"));
                        await updatePackageJson(projectPath);
                    }
                    await notify.showProgress(progress, 20, `${library} Library adding to project in progress...`);
                    await ares.addLibrary(false, library, projectPath);
                    await ares.addLibrary(false, "", projectPath);
                }
                await notify.clearProgress(progress, `Success! Generated project in ${projectPath}.`);
                await setDefaultDir(location);
                resolve(projectPath);
            } catch (err) {
                let errMsg = err.toString();
                vscode.window.showErrorMessage(`ERROR! Failed to generate ${template} in ${projectPath}. Details As follows: ${errMsg}`);
                await notify.clearProgress(progress, `Error! Failed to generate ${template} in ${projectPath}.`);
                reject(err);
            }
        });
    });
}

async function generateAppFromProjectWizard(template, projectLocation, projectName, prop, addOS, deviceProfile) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
        let defaultDir = getDefaultDir();

        let location = projectLocation || defaultDir;
        if (!path.isAbsolute(location) && defaultDir) {
            location = path.join(defaultDir, location);
        }
        let projectPath = path.join(location, projectName);
        let templateId = templateUtils.getTemplateId(template, deviceProfile);
        if (deviceProfile == 'TV' && templateId == 'webapp') {
            templateId = 'basic';
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Generate App - ${projectName}`,
            cancellable: false
        }, async (progress, token) => {
            token.onCancellationRequested(() => {
                reject("CANCEL! Process ended by user..");
            });
            // let progress = await notify.initProgress("generate application", true);
            try {
                await notify.showProgress(progress, 20, `${template} generation in progress...`);
                if (templateId == "enact") {
                    await enactUtils.create(prop, projectPath);
                    await notify.showProgress(progress, 20, `Dist folder generation completed...`);
                    await appUtils.createAppInfo(prop, projectPath);
                    await notify.showProgress(progress, 20, `App info details creation completed...`);
                    await appUtils.copyIcon(projectPath);
                } else {
                    await ares.generate(templateId, prop, projectPath);
                }
                if (addOS) {
                    let library;
                    if (templateId == "enact") {
                        library = "@enact/webos";
                    } else {
                        library = "@types/webos-service";
                        await notify.showProgress(progress, 20, `JS Service Patch file adding in progress`);
                        await copyDirSync(jsServicePatchPath, path.join(projectPath, "patches"));
                        await updatePackageJson(projectPath);
                    }
                    await notify.showProgress(progress, 20, `${library} Library adding to project in progress...`);
                    await ares.addLibrary(false, library, projectPath);
                    await ares.addLibrary(false, "", projectPath);
                }
                await notify.clearProgress(progress, `Success! Generated project in ${projectPath}.`);
                await setDefaultDir(location);
                resolve(projectPath);

            } catch (err) {
                let errMsg = err.toString();
                vscode.window.showErrorMessage(`ERROR! Failed to generate ${template} in ${projectPath}. Details As follows: ${errMsg}`);
                await notify.clearProgress(progress, `Error! Failed to generate ${template} in ${projectPath}.`);
                reject(err);
            }
        });
    });
}

function _removeAppDir(appDirPath) {
    try {
        if (!fs.existsSync(appDirPath)) {
            return "REMOVE_SUCCESS";
        }

        fs.rmSync(appDirPath, { recursive: true });
        return "REMOVE_SUCCESS";
    } catch(err) {
        return err;
    }
}

async function removeApp(app) {
    await vscode.window
        .showInformationMessage(`This will delete application folder, Do you really want to delete application '${app.label}' ?`, ...["Yes", "No"])
        .then(async (answer) => {
            if (answer === "Yes") {
                return await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                }, async (progress) => {
                    progress.report({ increment: 20, message: `Deleting folder ...` });
                    let folders = vscode.workspace.workspaceFolders;
                    let defaultWorkFolder = folders[0];
                    let serviceDir = path.join(defaultWorkFolder.uri['_fsPath'], app.label);
                    // let workspaceFolderUri = vscode.Uri.parse(serviceDir);
                    let message = _removeAppDir(serviceDir);
                    try {
                        if (message !== "REMOVE_SUCCESS") {
                            vscode.window.showErrorMessage('Error!! ', message);
                            return;
                        }
                        await notify.clearProgress(progress, `Success! Removing application directory in workspace.`);
                    } catch (error) {
                        console.log("Exception ", error);
                        vscode.window.showErrorMessage("Error removing the application folder!");
                    }
                });
            }
        });
}

module.exports = {
    generateApp: generateApp,
    generateAppFromProjectWizard: generateAppFromProjectWizard,
    removeApp: removeApp
};
