/*
 * Copyright (c) 2021-2024 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = require('vscode');
let { addLibrary, installEnactTemplate, addEmulatorLauncher } = require('./lib/runCommand');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const notify = require('./lib/notificationUtils');
const { InputChecker } = require('./lib/inputChecker');
const libraryList = ["@enact/cli", "@webos-tools/cli", "patch-package"];
const libraryPrompt = {
    "@enact/cli": `@enact/cli Global package adding in progress. This may take few minutes, Please wait...`,
    "@webos-tools/cli": `@webos-tools/cli Global package adding in progress...`,
    "patch-package": `patch-package Global package adding in progress...`
}
const command = "npm install -g @enact/cli @webos-tools/cli patch-package"
let promptlock = false;

function getPromptlock() {
    return promptlock;
}

function setPromptlock(set) {
    promptlock = set;
}

async function isNodeInstalledRoot() {
    try {
        const { stdout } = await exec('stat -f "%Su"  `npm config get prefix`');
        if (stdout.trim() === 'root') {
            return true;
        }
    } catch (e) {
        // Do not handle exception
    }
    return false;
}

async function installGlobalLibrary() {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Install Global Packages",
        cancellable: false
    }, async (progress, token) => {
        token.onCancellationRequested(() => {
            console.log("User canceled the long running operation");
        });
        try {
            await notify.showProgress(progress, 1, `Installation initiated..`);
            let pw = "";
            if (process.platform == "nodarwin") {
                await notify.showProgress(progress, 5, `Please enter sudo password in top input field.`);
                pw = await getSudoPassword();
                if (pw) {
                    for (let i = 0; i < libraryList.length; i++) {
                        await notify.showProgress(progress, 10, libraryPrompt[`${libraryList[i]}`]);

                        await addLibrary(true, libraryList[i], pw);
                        await notify.showProgress(progress, 10, `${libraryList[i]} Global package adding Completed.`);
                    }
                    await installEnactTemplate();
                    vscode.commands.executeCommand('webososeDevices.refreshList');
                    await notify.clearProgress(progress, `Success! All Package installed`);
                    vscode.commands.executeCommand('webos.updateProfile');
                    return Promise.resolve();
                }
            } else {
                for (let i = 0; i < libraryList.length; i++) {
                    await notify.showProgress(progress, 10, libraryPrompt[`${libraryList[i]}`]);

                    await addLibrary(true, libraryList[i]);
                    await notify.showProgress(progress, 10, `${libraryList[i]} Global package adding completed.`);
                }
                await installEnactTemplate();
                vscode.commands.executeCommand('webososeDevices.refreshList');
                await notify.clearProgress(progress, `Success! All packages installed`);
                vscode.commands.executeCommand('webos.updateProfile');
                return Promise.resolve();
            }
        } catch (err) {
            let erMsg = err.toString();
            vscode.window.showErrorMessage(`ERROR! Failed to install package.
                Please install manually these packages ${libraryList}.
                Details As follows: ${erMsg}`);
            await notify.clearProgress(progress, `ERROR! Failed to install package.`);
            return Promise.reject(err);
        }
    });
}

async function installEmulatorLauncher() {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Install Emulator Launcher",
        cancellable: false
    }, async (progress, token) => {
        token.onCancellationRequested(() => {
            console.log("User canceled the long running operation");
        });
        try {
            await notify.showProgress(progress, 1, `Installation initiated..`);
            await notify.showProgress(progress, 10, `Emulator Launcher`);

            await addEmulatorLauncher();
            await notify.showProgress(progress, 10, `Emulator Launcher install Completed.`);
                
            vscode.commands.executeCommand('webososeDevices.refreshList');
            await notify.clearProgress(progress, `Success! Emulator Launcher installed.`);
            return Promise.resolve();
        } catch (err) {
            let erMsg = err.toString();
            vscode.window.showErrorMessage(`ERROR! Failed to install package.
                Please install manually python3 and VirtualBox by referring to https://www.webosose.org/docs/tools/sdk/emulator/virtualbox-emulator/emulator-launcher/.
                And then set appropriate PATH. Details As follows: ${erMsg}`);
            await notify.clearProgress(progress, `ERROR! Failed to install package.`);
            return Promise.reject(err);
        }
    });
}

async function showPrompt() {
    // Prevent to show installing globalpacakge message multiple times at once.
    if (getPromptlock() == true) {
        return;
    } else {
        setPromptlock(true);
    }
    if (process.platform == "darwin") {
        const isRoot = await isNodeInstalledRoot();
        if (isRoot === true) {
            vscode.window.showErrorMessage(`Error! Node permission error. Please refer to the Option 2 in the [npm/installation-setup-docs](https://npm.github.io/installation-setup-docs/installing/a-note-on-permissions.html#option-2-change-npms-default-directory-to-another-directory).`);
            setPromptlock(false);
            return;
        }
    }
    await vscode.window.showInformationMessage(
        `Warning! If you have already installed OSE/TV vs code extensions and CLIs, you should remove them before using this extension.
             This extension needs following packages to be installed globally, ${libraryList}.
             Click 𝐘𝐞𝐬 to approve installing them, else install them manually using following command,
             ${command}`,
        ...["Yes", "No"]
    )
    .then(async (answer) => {
        if (answer === "Yes") {
            await installGlobalLibrary();
            setPromptlock(false);
        } else {
            //user clicks "No", "X" button or timeouted the popup message
            vscode.window.showInformationMessage(`Please install manually these packages using NPM command, ${command}`);
            // Do not show message to inform installing global package to user.
            // User can install the package by "webOS : Install global pacakage" command palette
            setPromptlock(true);
        }
    })
}

async function showEmulatorPrompt() {
    await vscode.window.showInformationMessage(
        `This extension needs webos-emulator.
             Click 𝐘𝐞𝐬 to approve installing this, else install this manually by referring to
             https://webosose.org/docs/tools/sdk/emulator/virtualbox-emulator/emulator-launcher/.`,
        ...["Yes", "No"]
    )
        .then(async (answer) => {
            if (answer === "Yes") {
                installEmulatorLauncher();
            } else {
                vscode.window.showInformationMessage(`Please install webos-emulator manually.`);
            }
        });
}

async function getSudoPassword() {
    return new Promise((resolve, reject) => {
        vscode.window.showInputBox({
            title: 'Admin Password to Install dependent Global Packages',
            placeHolder: `Entered password will be used only once to install packages & never saved.`,
            prompt: 'Enter your Admin password',
            password: true,
            ignoreFocusOut: true,
            validateInput: InputChecker.checkPassword
        }).then(value => {
            if (value === undefined) {
                reject("User Cancelled");
            } else {
                resolve(value);
            }
        });
    });
}

module.exports = {
    installGlobalLibrary: installGlobalLibrary,
    installEmulatorLauncher: installEmulatorLauncher,
    showPrompt: showPrompt,
    getPromptlock : getPromptlock,
    setPromptlock : setPromptlock,
    showEmulatorPrompt: showEmulatorPrompt,
    getSudoPassword: getSudoPassword
}
