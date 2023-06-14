/*
  * Copyright (c) 2021-2023 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdirAsync = promisify(fs.readdir);

let defaultworkspace;

async function setDefaultDir(folderPath) {
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(folderPath));
}

function getDefaultDir() {
    let folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        defaultworkspace = folders[0].uri.fsPath;
        return defaultworkspace;
    } else {
        return null;
    }
}

function isAppDir(dirent) {
    if (dirent.isDirectory()) {
        let appDir = path.join(defaultworkspace, dirent.name)
        let itmAray = fs.readdirSync(appDir)
        if (itmAray.indexOf("package.json") > -1 && itmAray.indexOf("services.json") > -1) {
            dirent.type = "js-service";
            return dirent;
        } else if (itmAray.indexOf("package.json") > -1 && itmAray.indexOf("appinfo.json") > -1) {
            dirent.type = "enact-app";
            return dirent;
        } else if (itmAray.includes("appinfo.json")) {
            dirent.type = "web-app";
            return dirent;
        }
    }
}

async function getAppsList(folderPath, type) {
    let dirArray = [];
    if (folderPath && fs.existsSync(folderPath)) {
        try {
            dirArray = fs.readdirSync(folderPath, { withFileTypes: true })
                .filter(isAppDir)
            if (type && type == "service") {
                dirArray = dirArray.filter(dirent => dirent.type == "js-service")
                    .map(dirent => dirent.name);
            } else if (type && type == "apps") {
                dirArray = dirArray.filter(dirent => dirent.type != "js-service")
                    .map(dirent => dirent.name);
            }
        } catch (err) {
            console.error(err);
            throw err;
        }
        return dirArray;
    } else {
        return null;
    }
}

async function getIpkArray(folderPath) {
    if (folderPath && fs.existsSync(folderPath)) {
        let ipkArray;
        try {
            let files = await readdirAsync(folderPath);
            ipkArray = files.filter(file => path.extname(file) === '.ipk');
        } catch (err) {
            console.error(err);
            throw err;
        }
        return ipkArray;
    } else {
        return null;
    }
}

async function copyDirSync(src, dest) {
    try {
        let exists = fs.existsSync(src);
        let stats = exists && fs.statSync(src);
        let isDirectory = exists && stats.isDirectory();
      
        if (isDirectory) {
            try {
                fs.mkdirSync(dest);
                fs.readdirSync(src).forEach(function (childItemName) {
                    copyDirSync(path.join(src, childItemName),
                        path.join(dest, childItemName));
                });
            } catch (e) {
                console.log(e);
            }
        } else {
            fs.copyFileSync(src, dest);
        }
        return Promise.resolve();
    } catch (err) {
        console.log("Error! Copy Patch files failed.", err);
        return Promise.reject("Error! Copy Patch files failed.");
    }
}

async function updatePackageJson(appDir) {
    try {
        const pkgJsonPath = path.join(appDir, 'package.json');
        const json = require(pkgJsonPath);

        if (!Object.prototype.hasOwnProperty.call(json, 'scripts')) {
            json.scripts = {};
        }
        json.scripts['postinstall'] = 'patch-package';
        await fs.writeFileSync(pkgJsonPath, JSON.stringify(json, null, 4));
        return Promise.resolve();
    } catch (err) {
        console.log("Error! Package file update failed.", err);
        return Promise.reject("Error! Package file update failed.");
    }
}
function getServiceId(serviceDir) {
    let defaultDir = getDefaultDir();
    try {
        let serviceDetails = require(path.join(defaultDir, serviceDir, "services.json"));
        return Promise.resolve(serviceDetails.id);
    } catch (e) {
        return Promise.reject("Error! Not a valid Service directory");
    }
}

function isAppFolder(appDir) {
    let defaultDir = getDefaultDir();
    try {
        if (fs.existsSync(path.join(defaultDir, appDir, "appinfo.json"))) {
            return true;
        }
        // let appInfo = require(path.join(defaultDir, appDir, "appinfo.json"));
        return false;
    } catch (e) {
        return false;
    }
}

function getAppId(appDir) {
    let defaultDir = getDefaultDir();
    try {
        let appInfo = require(path.join(defaultDir, appDir, "appinfo.json"));
        return Promise.resolve(appInfo.id);
    } catch (e) {
        return Promise.reject("Error! Not a valid App directory");
    }
}

async function getSimulatorVersionArray(folderPath) {
    if (folderPath && fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
        const versionArr = [];
        try {
            const simulArr = await readdirAsync(folderPath);
            const simulatorPrefix = `webOS_TV_`;

            for (let i = 0; i < simulArr.length; i++) {
                if (simulArr[i].indexOf(simulatorPrefix) === 0) {
                    if (fs.statSync(path.resolve(folderPath, simulArr[i])).isDirectory()) {
                        // extract version of simulator directory
                        // ex) webOS_TV_22_Simulator_1.0.0
                        const simulNameArr = simulArr[i].split('_');
                        if (!versionArr.includes(simulNameArr[2])) {
                            versionArr.push(simulNameArr[2]);
                        }
                    }
                }
            }
        } catch (err) {
            console.error(err);
            throw err;
        }
        return versionArr;
    } else {
        return null;
    }
}

module.exports = {
    setDefaultDir: setDefaultDir,
    getDefaultDir: getDefaultDir,
    getAppsList: getAppsList,
    getIpkArray: getIpkArray,
    copyDirSync: copyDirSync,
    updatePackageJson: updatePackageJson,
    getServiceId: getServiceId,
    getAppId: getAppId,
    isAppDir: isAppDir,
    isAppFolder: isAppFolder,
    getSimulatorVersionArray: getSimulatorVersionArray
}
