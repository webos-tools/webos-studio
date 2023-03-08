/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const path = require('path');
const fs = require('fs');
const { getDefaultDir } = require('./workspaceUtils');

let defaultAppInfo = {
    "id": "com.domain.app",
    "version": "0.0.1",
    "vendor": "My Company",
    "type": "web",
    "main": "index.html",
    "title": "new app",
    "icon": "icon.png",
    "requiredPermissions": [
        "time.query",
        "activity.operation"
    ]
},
    defaultAppInfoFile = 'appinfo.json',
    defaultServiceFile = 'services.json',
    defaultIconCopyPath = path.join(__dirname, "../../media/defaulticon.png");

function getAbsolutePath(value) {
    if (!path.isAbsolute(value)) {
        let defaultDir = getDefaultDir();
        if (defaultDir) {
            return path.join(defaultDir, value);
        } else {
            return null;
        }
    } else {
        return value;
    }
}

function copyFile(src, dest, cb) {
    let readStream = fs.createReadStream(src);
    readStream.once('error', (err) => {
        console.log(err);
    });
    readStream.once('end', () => {
        cb();
    });
    readStream.pipe(fs.createWriteStream(dest));
}

function readJSONfile(filePath) {
    let rawdata = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawdata);
}

let getAppId = (value, cb) => {
    let absolutePath = getAbsolutePath(value);
    let rawdata = fs.readFileSync(path.join(absolutePath, defaultAppInfoFile), 'utf8');
    let appInfo = JSON.parse(rawdata);
    cb(appInfo.id);
}

let getServiceId = (value, cb) => {
    let absolutePath = getAbsolutePath(value);
    let serviceInfo = readJSONfile(path.join(absolutePath, defaultServiceFile));
    cb(serviceInfo.id);
}

async function createAppInfo(prop, projectPath) {
    let absolutePath = getAbsolutePath(projectPath);
  
    let appInfo = defaultAppInfo;
    appInfo.id = prop.id;
    appInfo.version = prop.version;
    appInfo.title = prop.title;
    let data = JSON.stringify(appInfo, null, 4);
    try {
        fs.writeFileSync(path.join(absolutePath, defaultAppInfoFile), data);
        return Promise.resolve();
    } catch (err) {
        console.log(err);
        return Promise.reject("Error: Failed to create app info file")
    }
}

async function copyIcon(projectPath) {
    let absolutePath = getAbsolutePath(projectPath);
    let appIconDir = path.join(absolutePath, "icon.png")
    copyFile(defaultIconCopyPath, appIconDir, () => {
        return Promise.resolve();
    });
}

module.exports = {
    getAppId: getAppId,
    getServiceId: getServiceId,
    createAppInfo: createAppInfo,
    copyIcon: copyIcon
}
