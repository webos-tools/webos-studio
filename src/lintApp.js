/*
  * Copyright (c) 2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const { getDefaultDir } = require('./lib/workspaceUtils');
const ares = require('./lib/runCommand');
const path = require('path');
const fs = require('fs');
const notify = require('./lib/notificationUtils');
const { resolve } = require('path');

module.exports = async function lintApp(appFolder, collection, isLintEnabled) {
    let folderName = appFolder;
    let defaultDir = getDefaultDir();
    let dirPath = path.join(defaultDir, folderName);
    let isEnact = true;
    disableAppDiagnostics(dirPath, collection);
    if (!isLintEnabled) {
        resolve();
        return;
    }

    return new Promise((resolve, reject) => {
        // vscode.window.showInformationMessage(`Debug session is already active. Disconnect the session to start new debug session!`);
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Enact App Lint",
            cancellable: false
        }, async (progress) => {
            await notify.showProgress(progress, 30, `Analyzing lint in progress, please wait few seconds...`);
            require('./ga4Util').mpGa4Event("LintApp", {category:"Commands"});
            await ares.getLintResults(dirPath, isEnact)
                .then(async (stdout) => {
                    await notify.showProgress(progress, 80, `Analyzing lint in progress, please wait few seconds...`);
                    var test = stdout;
                    var arrLint = test.split(/\r\n|\r|\n/);
            
                    // [{"docUri":"path","lintArr":[{Obj1details}, {Obj2details}]}, 
                    //  {"uri2":"path","lintArr":[{Obj1details}, {Obj2details}]}]
                    var diagArr = parseLintData(arrLint);
                    diagArr.forEach(diagObj => {
                        var docUri = diagObj["docUri"];
                        var lintArr = diagObj["lintArr"];
                        vscode.workspace.openTextDocument(docUri).then(function (document) {
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
                    resolve();
                }).catch((err) => {
                    console.error(err);
                    vscode.window.showErrorMessage(`Error! Failed to run enact lint.`);
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
        // [{"uri1":"path","lintArr":[{Obj1details}, {Obj2details}]}, 
        //  {"uri2":"path","lintArr":[{Obj1details}, {Obj2details}]}]
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
    /* const config = vscode.workspace.getConfiguration();
    var excludeList: { [k: string]: boolean } = {};
    excludeList[*.html] = true;
    excludeList[*.css] = true;
    config.update('files.exclude', excludeList, false); */
    let toString = (uris) => uris.map((uri) => uri.fsPath);
    // const files = vscode.workspace.findFiles('**/*.*', '**/node_modules/**').then((uris) => {
    vscode.workspace.findFiles('{**/*.js,**/*.jsx,**/*.html}', '{**/node_modules/**,**/.git/**,**/bower_components/**,**/dist/**}').then((uris) => {
        if (!uris) {
            vscode.window.showErrorMessage("You are not in a workspace. Please open a project before using folder content.");
            return callback(listUrls);
        }

        listUrls = toString(uris);
        return callback(listUrls);
    });
}
