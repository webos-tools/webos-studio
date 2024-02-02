/*
 * Copyright (c) 2022-2023 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { InputController } = require('./inputController');
const { InputChecker } = require('./inputChecker');
const { getDefaultDir, getIpkArray } = require('./workspaceUtils');
const { fileURLToPath } = require('url');

const folderBtn = InputController.FileBrowser;

const LAUNCHPARAMS_FILE = '.launchparams.json';

/**
 * @param {string} title
 * @param {string} prompt optional prompt string
 * @returns {Promise<string>} selected app directory path
 */
async function getAppDir(title, prompt) {
    if (!title) {
        console.error(`${arguments.callee.name}: arguments are not fulfilled.`);
        return null;
    }
    const defaultDir = getDefaultDir();
    let defaultString = '';
    if (defaultDir) {
        defaultString = ` (default: ${defaultDir})`;
    }
    folderBtn.bindAction(async function (thisInput) {
        let file = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true
        });
        if (file) {
            thisInput.value = fileURLToPath(file[0].toString(true));
        }
    });

    const controller = new InputController();
    controller.addStep({
        title: title,
        placeholder: `Web App Directory${defaultString}`,
        prompt: prompt ? prompt : 'Enter Directory Path',
        buttons: [folderBtn],
        validator: function (value) {
            if (value === '') {
                if (defaultDir) {
                    return null;
                } else {
                    return 'The directory must be specified.';
                }
            }
            return InputChecker.checkDirectoryExist(value);
        }
    });
    const results = await controller.start();
    let appDir = results.shift() || defaultDir;
    if (!path.isAbsolute(appDir) && defaultDir) {
        appDir = path.join(defaultDir, appDir);
    }
    return appDir;
}

function _checkLaunchParamsFile() {
    const defaultDir = getDefaultDir();
    if (defaultDir) {
        const launchParamsFile = path.join(defaultDir, LAUNCHPARAMS_FILE);
        if (fs.existsSync(launchParamsFile)) {
            console.log(`${arguments.callee.name}: ${launchParamsFile}`);
            const launchParamsData = fs.readFileSync(launchParamsFile, 'utf-8');
            return JSON.parse(launchParamsData);
        }
    } else {
        return null;
    }
}

async function _saveLaunchParams(params) {
    const defaultDir = getDefaultDir();
    if (defaultDir) {
        const launchParamsFile = path.join(defaultDir, LAUNCHPARAMS_FILE);
        const fileMsg = fs.existsSync(launchParamsFile) ? 'Updated' : 'Created';

        fs.writeFile(launchParamsFile, JSON.stringify(params, null, 4), 'utf-8', () => {
            console.log(`${arguments.callee.name}: ${fileMsg} ${launchParamsFile}`);
            vscode.window.showInformationMessage(`${fileMsg}: ${launchParamsFile}`);
            vscode.workspace.openTextDocument(launchParamsFile).then(doc => {
                vscode.window.showTextDocument(doc);
            });
        });
    } else {
        console.log(`${arguments.callee.name}: Failed to create .launchparams.json file`);
    }
}

/**
 * @param {string} title 
 * @returns {JSON} launch parameters
 */
async function getLaunchParams(title) {
    if (!title) {
        console.error(`${arguments.callee.name}: arguments are not fulfilled.`);
        return null;
    }
    let defaultStr = '(ex. {"key":"value"})';
    const defaultParams = _checkLaunchParamsFile();
    if (defaultParams !== null && typeof defaultParams === 'object') {
        defaultStr = `(default: ${JSON.stringify(defaultParams)})`;
    }

    const controller = new InputController();
    controller.addStep({
        title: title,
        placeholder: `Launch Parameters ${defaultStr}`,
        prompt: 'Enter Parameters in JSON Format',
        validator: function (value) {
            if (value === '') {
                if (defaultParams) {
                    return null;
                }
            }
            return InputChecker.checkJSON(value);
        }
    });
    const results = await controller.start();
    const result = results.shift();
    const params = result === '' ? defaultParams : JSON.parse(result);

    if (result !== '') {
        _saveLaunchParams(params);
    }
    return params;
}

module.exports = {
    getAppDir: getAppDir,
    getLaunchParams: getLaunchParams
};