/*
  * Copyright (c) 2021-2023 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const fs = require('fs');
const { fileURLToPath } = require('url');
const { InputController } = require('./inputController');
const { InputChecker } = require('./inputChecker');
const path = require('path');

const WEBOSOSE = 'webosose';
const BROWSER_PATH = 'chromeExecutable';

function getCliPath() {
    let cliPath = "";
    return cliPath;
}

async function getBrowserPath() {
    let browserPath = vscode.workspace.getConfiguration(WEBOSOSE).get(BROWSER_PATH);
    if (!fs.existsSync(browserPath)) {
        let folderBtn = InputController.FileBrowser;
        folderBtn.bindAction(async function (thisInput) {
            let file = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false
            });
            if (file) {
                thisInput.value = fileURLToPath(file[0].toString(true));
            }
        });

        let controller = new InputController();
        controller.addStep({
            title: 'Configure Chrome Executable Path',
            placeholder: 'Chrome Executable Path',
            prompt: 'Enter Chrome Executable Path',
            buttons: [folderBtn],
            validator: InputChecker.checkFileExist
        });
        let results = await controller.start();
        browserPath = results.shift();
        vscode.workspace.getConfiguration(WEBOSOSE).update(BROWSER_PATH, browserPath, true)
            .then(() => {
                console.log(`getbrowserPath: Set ${WEBOSOSE}.${BROWSER_PATH} to ${browserPath}`);
            });
    }
    return browserPath;
}

async function getDefaultDevice() {
    // let defaultDevice = vscode.workspace.getConfiguration(WEBOSOSE).get(DEFAULT_DEVICE);
    return "";
}

function getSimulatorDirPath() {
    let simulatorDir;
    const sdkHomePath = process.env.LG_WEBOS_TV_SDK_HOME || process.env.LG_WEBOS_CUSTOM_SDK_HOME;
    const cliPath = process.env.WEBOS_CLI_TV;

    if (sdkHomePath) {
        simulatorDir = path.join(sdkHomePath, 'Simulator');
    } else if (cliPath) {
        simulatorDir = path.resolve(cliPath, '../../Simulator');
    }

    console.log('simulatorDirPath:', simulatorDir);
    if (!fs.existsSync(simulatorDir) || !fs.statSync(simulatorDir).isDirectory()) {
        return null;
    } else {
        return simulatorDir;
    }
}

module.exports = {
    getCliPath: getCliPath,
    getBrowserPath: getBrowserPath,
    getDefaultDevice: getDefaultDevice,
    getSimulatorDirPath: getSimulatorDirPath
}
