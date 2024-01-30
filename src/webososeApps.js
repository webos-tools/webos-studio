/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const fs = require('fs');
const { getDefaultDir, getAppsList } = require('./lib/workspaceUtils');
const path = require('path');
const { execAsync } = require('./lib/runCommand');
const ga4Util = require('./ga4Util');

class AppsProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor() { }

    refresh(element, context) {
        ga4Util.mpGa4Event("RefreshAppsInWorkspace", {category:"Commands"});
        if (element) {
            this._onDidChangeTreeData.fire(element);
        } else {
            this._onDidChangeTreeData.fire();
        }
        if (context)
            this.storeContextOnExtnLaunch(context);
    }

    getTreeItem(element) {
        return element;
    }

    getChildren() {
        return Promise.resolve(this._getAppList());
    }

    async _getAppList() {
        let array = [];
        let directory = getDefaultDir();
        if (directory) {
            let appList = await getAppsList(directory);
            appList.forEach((app) => {
                array.push(new Apps(app.name, app.type)); // type is valid and its available
            });
            this.storeSupportedDir(directory, appList)
            return array;
        } else {
            return null;
        }
    }
    storeSupportedDir(directory, appList) {
        let dirList = [];
        let appsList = []
        appList.forEach((app) => {
            dirList.push(path.join(directory, app.name)); // type is valid and its available
            if (app.type == 'web-app' || app.type == 'enact-app') {
                appsList.push(path.join(directory, app.name));
            }
        });
        if (dirList.length > 0) {
            vscode.commands.executeCommand('setContext', 'webosose.supportedFolders', dirList);

        }
        if (appsList.length > 0) {
            vscode.commands.executeCommand('setContext', 'webosose.supportedAppFolders', appsList);
        }
    }
    storeConfigDependancies(directory, appList, context) {
        let appConfig = []
        appList.forEach((app) => {
            if (app.type == "js-service" || app.type == "enact-app")
                appConfig.push({ "configFile": path.join(directory, app.name, "package.json") });
        });

        appConfig.forEach((fileInfo) => {
            try {
                const data = fs.readFileSync(fileInfo.configFile, 'utf8')
                try {
                    let configJson = JSON.parse(data)
                    fileInfo["dependencies"] = configJson["dependencies"] ? configJson["dependencies"] : {};
                    fileInfo["devDependencies"] = configJson["devDependencies"] ? configJson["devDependencies"] : {}
                } catch (err) {
                    fileInfo["dependencies"] = {};
                    fileInfo["devDependencies"] = {}
                }
            } catch (err) {
                console.error(err)
            }
        });

        let storageManager = new LocalStorageService(context.workspaceState);
        storageManager.setValue("webosose.appConfig", appConfig)
    }
    async storeContextOnExtnLaunch(context) {

        let directory = getDefaultDir();
        if (directory) {
            let appList = await getAppsList(directory);
            this.storeSupportedDir(directory, appList)
            this.storeConfigDependancies(directory, appList, context)
        }
    }
    async comparePackageJsonDependancies(context, savingDoc) {
        let storageManager = new LocalStorageService(context.workspaceState);
        let extConfigs = storageManager.getValue("webosose.appConfig")
        for (let i = 0; i < extConfigs.length; i++) {
            if (savingDoc.fileName == extConfigs[i].configFile) {
                let textValues = savingDoc.getText();
                try {
                    let configObj = JSON.parse(textValues)
                    let srcDep = configObj["dependencies"] ? configObj["dependencies"] : {}
                    let srcDevDep = configObj["devDependencies"] ? configObj["devDependencies"] : {}
                    let destDep = extConfigs[i]["dependencies"] ? extConfigs[i]["dependencies"] : {}
                    let destDevep = extConfigs[i]["devDependencies"] ? extConfigs[i]["devDependencies"] : {}
                    if ((!this.compareObj(srcDep, destDep))
                        ||
                        (!this.compareObj(srcDevDep, destDevep))
                    ) {
                        extConfigs[i]["dependencies"] = srcDep;
                        extConfigs[i]["devDependencies"] = srcDevDep;
                        storageManager.setValue("webosose.appConfig", extConfigs);
                        await vscode.window.showInformationMessage(
                            `Node Dependency has been changed in Package.json, Do you want to install the node modules`,
                            ...["Yes", "No"]
                        )
                            .then(async (answer) => {
                                if (answer === "Yes") {
                                    return await vscode.window.withProgress({
                                        location: vscode.ProgressLocation.Notification,
                                    }, async (progress) => {
                                        progress.report({ increment: 50, message: `Installing Node modules ...` });
                                        let option = { cwd: savingDoc.fileName.replace("package.json", "") };
                                        let cmd = `${path.join("npm install")}`;
                                        // eslint-disable-next-line no-unused-vars
                                        return execAsync(cmd, option, (stdout, resolve, reject) => {
                                            if (stdout) {
                                              
                                                // progress.report({ increment: 20, message: `Installing Node modules ...` });
                                                resolve();
                                            }
                                        }).catch((err) => {
                                            console.log("failed", err);
                                        })
                                    })
                                } else {
                                    vscode.window.showInformationMessage(`Please install manually these packages using NPM command`);
                                }
                            });
                    }
                } catch (err) {
                    console.log("error", err)
                }
            }
        }
    }
    compareObj(srcObj, destObj) {
        if (Object.keys(srcObj).length == Object.keys(destObj).length) {
            for (let key in srcObj) {
                if (srcObj[key].trim() == destObj[key].trim()) {
                    continue;
                }
                else {
                    return false;
                }
            }
        }
        else {
            return false;
        }
        return true
    }
}

class LocalStorageService {

    constructor(storage) {
        this.storage = storage;
    }

    getValue(key) {
        return this.storage.get(key);
    }

    setValue(key, value) {
        this.storage.update(key, value);
    }
}

class Apps {
    constructor(folderName, type) {
        this.label = folderName;
        this.contextValue = type; // "web-app","enact-app","js-service"
        this.description = type;
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }

    iconPath = {
        light: '$(run)', // path.join(__filename, '..', '..', 'media', 'app.svg'),
        dark: '$(run)' // path.join(__filename, '..', '..', 'media', 'app.svg')
    };
}

exports.AppsProvider = AppsProvider;
