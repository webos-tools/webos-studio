/*
 * Copyright (c) 2020-2024 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = require('vscode');
const kill = require('tree-kill');
const { getDeviceList } = require('./lib/deviceUtils');
const ares = require('./lib/runCommand');

/**
 * @param {string} appId app ID to inspect
 * @param {string} device target device name
 */
module.exports = async function inspectApp_ipk(appId, device) {
    if (!device) {
        let deviceList = await getDeviceList();
        deviceList = deviceList.filter((device) => {
            return device.default === true;
        })

        device = deviceList[0].name;
    }
    return new Promise((resolve, reject) => {

        // ares-inspect
        ares.inspect(appId, device, false)
            .then(([url, child]) => {
                url = url.toString();
                vscode.window.showInformationMessage(`Web inspector is running on ${url}`, 'Stop')
                    .then((selectedItem) => {
                        if ('Stop' == selectedItem) {
                            console.log("Stop");
                            console.log(child);
                            child.stdin.pause();
                            kill(child.pid);
                            ares.launchClose(appId, device, "0")
                                .then(() => {
                                    console.log(`Closed ${appId} on ${device}.`);
                                }).catch((err) => {
                                    let errMsg = `Failed to close ${appId} on ${device}.`
                                    if (err.includes(`Unknown method "closeByAppId" for category "/dev"`)) {
                                        errMsg = `Please make sure the 'Developer Mode' is on.`;
                                    } else if (err.includes(`Connection timeout`)) {
                                        errMsg = `Please check ${device}'s IP address or port.`
                                    }
                                    console.log(`Error! ${errMsg}`);
                                });
                        }
                    });
                // open browser
                ares.openBrowser(url);
                resolve();
            }).catch((err) => {
                console.error(err);
                vscode.window.showErrorMessage(`Error! Failed to run a web inspector.`);
                reject(err);
            });
    });
};