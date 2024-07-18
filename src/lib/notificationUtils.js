/*
 * Copyright (c) 2021-2022 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = require('vscode');
let wait1 = async () => await new Promise((resolve) => { setTimeout(() => { resolve(); }, 3500); });
let wait2 = async () => await new Promise((resolve) => { setTimeout(() => { resolve(); }, 1500); });

function initProgress(title, cancellable, cb) {
    try {
        if (!cancellable)
            cancellable = false;
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: title,
            cancellable: cancellable
        }, async (progress, token) => {
            token.onCancellationRequested(() => {
                console.log("User canceled the long running operation");
            });
            await wait1();
            cb(progress, token);
        });
    } catch (e) {
        console.log(e);
    }
}

async function showProgress(progress, increment, msg) {
    progress.report({ increment: increment, message: msg });
    await wait2();
}

async function clearProgress(progress, msg) {
    progress.report({ increment: 100, message: msg });
    await wait1();
}

module.exports = {
    initProgress: initProgress,
    showProgress: showProgress,
    clearProgress: clearProgress
}
