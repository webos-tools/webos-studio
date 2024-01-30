/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const path = require('path');
const { addLibrary } = require('./lib/runCommand');
const notify = require('./lib/notificationUtils');
const { getDefaultDir, copyDirSync, updatePackageJson } = require('./lib/workspaceUtils');
let jsServicePatchPath = path.join(__dirname, "../media/patches");

module.exports = async function installLibrary(appDirName, type) {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Install webOS",
        cancellable: true
    }, async (progress, token) => {
        token.onCancellationRequested(() => {
            console.log("User canceled the long running operation");
        });
        await notify.showProgress(progress, 0, ``);
        // let progress = await notify.initProgress("generate application", true);
        try {
            let projectPath = getDefaultDir(),
                library;
            if (projectPath && appDirName) {
                projectPath = path.join(projectPath, appDirName)
                if (type == "enact-app") {
                    library = "@enact/webos";
                    await notify.showProgress(progress, 20, `${library} Library adding to project in progress...`);
                    await addLibrary(false, library, projectPath);
                } else {
                    library = "@types/webos-service";
                    await notify.showProgress(progress, 20, `JS Service Patch file adding in progress`);
                    await copyDirSync(jsServicePatchPath, path.join(projectPath, "patches"));
                    await updatePackageJson(projectPath)
                    await notify.showProgress(progress, 20, `${library} Library adding to project in progress...`);
                    await addLibrary(false, library, projectPath);
                    await addLibrary(false, "", projectPath);
                }
            }
            await notify.clearProgress(progress, `Success! Package installed for ${appDirName}`);
            require('./ga4Util').mpGa4Event("InstallLibrary", {category:"Commands", type:type});
            return Promise.resolve();
        } catch (err) {
            let erMsg = err.toString();
            vscode.window.showErrorMessage(`ERROR! Failed to install package. Details As follows: ${erMsg}`);
            await notify.clearProgress(progress, `ERROR! Failed to install package.`);
            return Promise.reject(err);
        }
    });
}
