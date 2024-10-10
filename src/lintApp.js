/*
 * Copyright (c) 2022-2024 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = require('vscode');
const { getDefaultDir } = require('./lib/workspaceUtils');
const ares = require('./lib/runCommand');
const path = require('path');
const fs = require('fs');
const notify = require('./lib/notificationUtils');
const { resolve } = require('path');

module.exports = async function lintApp(appFolder, collection, appType, isLintEnabled) {
    let folderName = appFolder;
    let defaultDir = getDefaultDir();
    let dirPath = path.join(defaultDir, folderName);
    const package_json = JSON.parse(fs.readFileSync(path.join(__filename, '..', '..', "package.json"), "utf-8"));
    const extensionBasePath = vscode.extensions.getExtension(`${package_json.publisher}.${package_json.name}`).extensionPath;
    const lintWebAppFolder = path.join(extensionBasePath, 'lintWebApp');
    const lintAppPath = path.join(lintWebAppFolder, folderName);


    disableAppDiagnostics(dirPath, collection);
    if (!isLintEnabled) {
        resolve();
        return;
    }

    if (appType === "WebApp") {
        // Check if the directory exists
        if (!fs.existsSync(lintWebAppFolder)) {
            // If it doesn't exist, create the directory
            fs.mkdirSync(lintWebAppFolder, { recursive: true });
            console.log('Directory created:', lintWebAppFolder);
        } else {
            console.log('Directory already exists:', lintWebAppFolder);
        }
        copyFolderSyncRecursive(dirPath, lintAppPath);
        console.log('App folder copied successfully!');
    }

    return new Promise((resolve, reject) => {
        // vscode.window.showInformationMessage(`Debug session is already active. Disconnect the session to start new debug session!`);
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${appType} Lint`,
            cancellable: false
        }, async (progress) => {
            await notify.showProgress(progress, 30, `Analyzing lint in progress, please wait for a few seconds...`);
            require('./ga4Util').mpGa4Event("LintApp", { category: "Commands" });
            await ares.getLintResults(dirPath, lintAppPath, extensionBasePath, appType)
                .then(async (stdout) => {
                    await notify.showProgress(progress, 80, `Analyzing lint in progress, please wait few seconds...`);
                    var test = stdout;
                    var arrLint = test.split(/\r\n|\r|\n/);
                    var diagArr = parseLintData(arrLint);
                    diagArr.forEach(diagObj => {
                        var docUri = diagObj["docUri"];
                        var lintArr = diagObj["lintArr"];
                        let newPath = "";
                        if (appType === "EnactApp") {
                            newPath = docUri;
                        }
                        else {
                            // Replace the old directory with the new directory
                            newPath = docUri.replace(lintAppPath, dirPath);
                        }
                        vscode.workspace.openTextDocument(newPath).then(function (document) {
                            if (document) {
                                var diagnosticLintArr = [];
                                for (var colindex = 0; colindex < lintArr.length; colindex++) {
                                    var lintObj = lintArr[colindex];
                                    // updateDiagnostics(document, collection);
                                    var tempObj = {};
                                    tempObj["code"] = lintObj["code"];
                                    tempObj["message"] = lintObj["message"];
                                    tempObj["range"] = lintObj["range"];
                                    tempObj["severity"] = lintObj["severity"];
                                    tempObj["source"] = lintObj["source"];
                                    diagnosticLintArr.push(tempObj);
                                }
                                collection.set(document.uri, diagnosticLintArr);
                            }
                        });
                    });
                    // Use fs.rmdir to remove a temp directory for Web App Lint
                    fs.rm(lintWebAppFolder, { recursive: true }, (err) => {
                        if (err) {
                            console.error(`Error removing directory: ${err.message}`);
                        } else {
                            console.log(`Directory removed: ${lintWebAppFolder}`);
                        }
                    });
                    resolve();
                }).catch((err) => {
                    console.error(err);
                    vscode.window.showErrorMessage(`Error! Failed to run ${appType} lint.`);
                    reject(err);
                });
        });
    })
}

function parseLintData(arrLint) {
    let diagnosticArr = [];
    let diagnosticComplete = false;
    for (var index = 0; index < arrLint.length; index++) {
        var diagLine = arrLint[index];
        if (!diagLine.trim()) continue;

        const diagPath = diagLine;
        if (fs.existsSync(diagPath)) {
            var diagnosticObj = {};
            diagnosticObj["docUri"] = diagPath;
            diagnosticObj["lintArr"] = [];
            diagnosticArr.push(diagnosticObj);
        }
        else {
            var diagnosticseverity = undefined;
            var vscodeSeverity = undefined;
            if (diagnosticComplete) {
                // Append the content as it is.
                continue;
            }
            var lintContent = diagLine.trim();
            // ✖ 52 problems
            if (lintContent.includes("✖") && lintContent.includes("problem") &&
                lintContent.includes("error") && lintContent.includes("warning")) {
                diagnosticComplete = true;
                // Append the content as it is.
                continue;
            }
            else if (lintContent.includes("error")) {
                diagnosticseverity = "error";
                vscodeSeverity = vscode.DiagnosticSeverity.Error;
            }
            else if (lintContent.includes("warning")) {
                diagnosticseverity = "warning";
                vscodeSeverity = vscode.DiagnosticSeverity.Warning;
            }
            else if (lintContent.includes("hint")) {
                diagnosticseverity = "hint";
                vscodeSeverity = vscode.DiagnosticSeverity.Hint;
            }
            else if (lintContent.includes("information")) {
                diagnosticseverity = "information";
                vscodeSeverity = vscode.DiagnosticSeverity.Information;
            }
            else {
                continue;
            }
            var lintObj = {};
            var lintContentArr = lintContent.split(diagnosticseverity);
            var lineDetail = lintContentArr[0].split(':');
            var lineNo = parseInt(lineDetail[0]) - 1;
            var startIndex = parseInt(lineDetail[1]) - 1;
            lintObj["code"] = '';
            lintObj["message"] = lintContent;
            lintObj["range"] = new vscode.Range(new vscode.Position(lineNo, startIndex), new vscode.Position(lineNo, startIndex + 5));
            lintObj["severity"] = vscodeSeverity;
            lintObj["source"] = '';
            diagnosticArr[diagnosticArr.length - 1]["lintArr"].push(lintObj);
        }
    }
    return diagnosticArr;
}

function copyFolderSyncRecursive(source, target) {
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target);
    }

    const files = fs.readdirSync(source);

    files.forEach(file => {
        const sourcePath = path.join(source, file);
        const targetPath = path.join(target, file);

        if (fs.statSync(sourcePath).isDirectory()) {
            copyFolderSyncRecursive(sourcePath, targetPath);
        } else {
            fs.copyFileSync(sourcePath, targetPath);
        }
    });
}

function disableAppDiagnostics(dirPath, collection) {
    getAllFiles(function (files) {

        files.forEach(docUri => {
            vscode.workspace.openTextDocument(docUri).then(function (document) {
                if (document && document.uri.fsPath.includes(dirPath)) {
                    collection.set(document.uri, []);
                }
            });
        });
    });
}

function getAllFiles(callback) {
    let listUrls;

    let toString = (uris) => uris.map((uri) => uri.fsPath);
    vscode.workspace.findFiles('{**/*.js,**/*.jsx,**/*.html}', '{**/node_modules/**,**/.git/**,**/bower_components/**,**/dist/**}').then((uris) => {
        if (!uris) {
            vscode.window.showErrorMessage("You are not in a workspace. Please open a project before using folder content.");
            return callback(listUrls);
        }

        listUrls = toString(uris);
        return callback(listUrls);
    });
}
