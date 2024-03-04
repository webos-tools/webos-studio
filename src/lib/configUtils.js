/*
  * Copyright (c) 2021-2023 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const fs = require('fs');
const { fileURLToPath } = require('url');
const semver = require('semver');
const { InputController } = require('./inputController');
const { InputChecker } = require('./inputChecker');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const WEBOSOSE = 'webos';
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

let simulatorPath;
function getSimulatorDirPath(sdkPath) {
    if (sdkPath) {
        simulatorPath = path.join(sdkPath , 'TV', 'Simulator');
        return simulatorPath;
    }

    let simulatorDir;
    const sdkHomePath = process.env.LG_WEBOS_TV_SDK_HOME || process.env.LG_WEBOS_CUSTOM_SDK_HOME;
    const cliPath = process.env.WEBOS_CLI_TV;

    if (simulatorPath) {
        simulatorDir = simulatorPath;
    } else if (sdkHomePath) {
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

async function aresVersion() {
    try {
        const { stdout, stderr } = await exec('ares -V');
        if (stdout) {
            return stdout.trim().split(': ')[1];
        }
    } catch (e) {
        console.error(e);
    }
    return '';
}

async function checkCliVersion() {
    if (getCliPath() === '') {
        try {
            const cliPackageJsonVersion = await aresVersion();
            const cliVersionStr = semver.valid(semver.coerce(cliPackageJsonVersion));
            console.log(`webOS CLI version: ${cliPackageJsonVersion}`);
            if (!cliPackageJsonVersion || !cliVersionStr) {
                vscode.window.showWarningMessage(`Warning! Failed to check the webOS CLI version.`);
                return true;
            }
            const packageJson = require(path.resolve(__dirname, '../../package.json'));
            const supportedVersionRange = packageJson.engines['webos-cli'];
            if (packageJson && packageJson.engines && supportedVersionRange) {
                const validRange = semver.validRange(supportedVersionRange);
                if (validRange) {
                    if (semver.satisfies(cliVersionStr, validRange)) {
                        return true;
                    } else {
                        console.log(`Supported CLI version: ${validRange}`);
                        vscode.window.showErrorMessage("webOS Studio", {
                            detail: `Found old TV/OSE CLI. Please uninstall  and install 3.0 or higher CLI to use webOS Studio. (Refer https://github.com/webos-tools/cli)`,
                            modal: true} );
                        return false;
                    }
                } else {
                    console.warn(`webos-cli version range is invalid: ${supportedVersionRange}`);
                    return true;
                }
            } else {
                console.warn(`Failed to check webos-cli version range: ${supportedVersionRange}`);
                return true;
            }
        } catch (err) {
            console.error(err);
            return false;
        }
    }
    // CLI is not installed
    return false;
}

module.exports = {
    getCliPath: getCliPath,
    getBrowserPath: getBrowserPath,
    getDefaultDevice: getDefaultDevice,
    getSimulatorDirPath: getSimulatorDirPath,
    checkCliVersion: checkCliVersion
}
