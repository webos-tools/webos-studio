/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const { InputController } = require('./lib/inputController');
const { getDeviceList, getInstalledList } = require('./lib/deviceUtils');
const { getServiceId, getAppId, getDefaultDir, getAppsList, isAppFolder } = require('./lib/workspaceUtils');
const ares = require('./lib/runCommand');
const kill = require('tree-kill');
const path = require('path');
const portfinder = require('portfinder');
const notify = require('./lib/notificationUtils');
const tcpPortUsed = require('tcp-port-used');
const { logger } = require('./lib/logger');
module.exports = async function inspectApp(id, deviceName, isFolder, debugoption) {
    let folderName = id;
    let appId = id;
    let device = deviceName;
    let deviceList;
    let isService = false;
    let appType = undefined;

    // check default device is in the device list
    if (!deviceName) {
        device = null;
        deviceList = await getDeviceList();
        deviceList = deviceList.filter((device) => {
            return device.default === true;
        })

        device = deviceList[0].name;
    }

    if (id) {
        let defaultDir = getDefaultDir();
        let arrApps = await getAppsList(defaultDir);
        let dirent = undefined;
        let isApplId = false;

        for (var i = 0; i < arrApps.length; i++) {
            let objDirent = arrApps[i];
            let appIdFolder = undefined;
            if (!isFolder) {
                isApplId = await isAppFolder(objDirent.name);
                if (isApplId)
                    appIdFolder = await getAppId(objDirent.name);
                else
                    appIdFolder = await getServiceId(objDirent.name);
            }
            else {
                appIdFolder = objDirent.name;
            }
            if (appIdFolder !== folderName) continue;
            dirent = objDirent;
            break;
        }

        if (dirent && (dirent.type == "enact-app" || dirent.type == "web-app")) {
            appType = dirent.type;
            if (!isFolder) {
                appId = id;
            }
            else {
                appId = await getAppId(id);
            }
            folderName = dirent.name;
            let installed = await getInstalledList(device);
            installed.map(label => ({ label }));

            let indexAppId = installed.indexOf(appId);
            if (indexAppId < 0) {
                vscode.window.showErrorMessage(`ERROR! Failed to run a debug, since not installed app.`);
                return Promise.reject();
            }
        }
        else {
            appId = await getServiceId(id);
            let isInstalled;
            try {
                isInstalled = await ares.isInstalledService(appId, device);
            } catch (e) {
                vscode.window.showErrorMessage(`ERROR! Connection refused. Please check the device IP address or the port number.`);
                return Promise.reject();
            }
            if (!isInstalled) {
                vscode.window.showErrorMessage(`ERROR! Failed to run a debug, since not installed service.`);
                return Promise.reject();
            }
            isService = true;
        }
    } else {
        let controller2 = new InputController();
        let installed = await getInstalledList(device);
        controller2.addStep({
            title: 'Run Web Inspector',
            placeholder: 'Select App ID',
            items: installed.map(label => ({ label }))
        });
        let results2 = await controller2.start();
        appId = results2.shift();
    }

    return new Promise((resolve, reject) => {
        if (vscode.debug.activeDebugSession) {
            vscode.window.showInformationMessage(`Debug session is already active. Disconnect the session to start new debug session!`);
            resolve();
            return;
        }
        require('./ga4Util').mpGa4Event("InspectApp", {category:"Commands", debugoption: debugoption});
        ares.inspect(appId, device, isService)
            .then(([url, child]) => {
                child.stdout.on('data', (data) => {
                    logger.log(data)
                })
                let debugurl = url;
                if (isService) {
                    //Check IDE debugging or Browser
                    if(debugoption === 'BROWSER'){
                        vscode.window.showInformationMessage(`${url} As follows, open "chrome://inspect" in chrome,
                        - Click configure. - Enter URL and Done.`, 'Stop'
                        ).then((selectedItem) => {
                            if ('Stop' == selectedItem) {
                                child.stdin.pause();
                                kill(child.pid);
                            }
                        });    
                    }
                    else{
                        var desc = debugurl.toString('utf8');
                        var regdesc = JSON.parse(desc.match(/"([^']+)"/g));
                        var arrUrl = regdesc.split(':');
                        var ipaddress = arrUrl[0];
                        var emulport = arrUrl[1];
                        let folders = vscode.workspace.workspaceFolders;
                        let defaultWorkFolder = folders[0];
                        var serviceDir = path.join(defaultWorkFolder.uri['_fsPath'], folderName);
                        let launchConfiguration = {
                            "type": "node",
                            "request": "attach",
                            "name": "Attach to remote",
                            "address": ipaddress,
                            "port": emulport,
                            "localRoot": serviceDir,
                            "remoteRoot": "\\media\\developer\\apps\\usr\\palm\\services\\" + appId,
                            "protocol": "inspector"
                        };
                        vscode.debug.startDebugging(defaultWorkFolder, launchConfiguration);
                        new Promise(resolve => {
                            vscode.debug.onDidTerminateDebugSession(() => {
                                resolve();
                                child.stdin.pause();
                                kill(child.pid);
                                vscode.debug.stopDebugging();
                            });
                        });
                    }
                } else {
                    if(debugoption === 'BROWSER'){
                        vscode.window.showInformationMessage(`Web inspector is running on ${url}`, 'Stop'
                        ).then((selectedItem) => {
                            if ('Stop' == selectedItem) {
                                console.log("Stop");
                                console.log(child);
                                child.stdin.pause();
                                kill(child.pid);
                                ares.launchClose(appId, device, "0")
                                .then(() => {
                                    console.log(`Closed ${appId} on ${device}.`);
                                    resolve();
                                }).catch((err) => {
                                    let errMsg = `Failed to close ${appId} on ${device}.`
                                    if (err.includes(`Unknown method "closeByAppId" for category "/dev"`)) {
                                        errMsg = `Please make sure the 'Developer Mode' is on.`;
                                    } else if (err.includes(`Connection time out`)) {
                                        errMsg = `Please check ${device}'s IP address or port.`
                                    }
                                    console.log(`Error! ${errMsg}`);
                                    reject();
                                });
                            }
                        });
                        // open browser
                        ares.openBrowser(url);
                    }
                    else{
                        var descApp = debugurl.toString('utf8');
                        let debugurlArr = descApp.match(/^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w.-]+)*:\d*/gm);
                        var ip = debugurlArr[0].split('/')[2].split(':')[0];
                        var port = debugurlArr[0].split('/')[2].split(':')[1];
                        let folders = vscode.workspace.workspaceFolders;
                        let defaultWorkFolder = folders[0];
                        var appDir = path.join(defaultWorkFolder.uri['_fsPath'], folderName);
                        let launchConfiguration = undefined;
                        // Start
                        if (appType == "enact-app") {
                            portfinder.getPortPromise()
                                .then(async (enactport) => {
                                    vscode.window.withProgress({
                                        location: vscode.ProgressLocation.Notification,
                                        title: "Enact App Debug",
                                        cancellable: false
                                    }, async (progress) => {
                                        await notify.showProgress(progress, 50, `Preparing debug enact app, it may take few seconds...`);
                                        await ares.server(appDir, true, enactport)
                                            .then(async ([url, enactchild]) => {
                                                await notify.showProgress(progress, 80, `Launching debug session...`);
                                                var urldesc = url.split('http://');
                                                var hostArr = urldesc[1].split(':');
                                                var hostip = hostArr[0];
                                                var hostport = hostArr[1];
                                                var inUse = true;   // wait until the port is in use
                                                tcpPortUsed.waitForStatus(parseInt(hostport), hostip, inUse, 1000, 20000)
                                                    .then(function () {
                                                        launchConfiguration = {
                                                            "type": "pwa-chrome",
                                                            "request": "attach",
                                                            "name": "Attach to browser",
                                                            "address": ip,
                                                            "port": port,
                                                            "webRoot": path.join(appDir, "dist"),
                                                            // "url": descApp + "/",
                                                            "remoteRoot": "\\media\\developer\\apps\\usr\\palm\\applications\\" + appId,
                                                        };
                                                        vscode.debug.startDebugging(defaultWorkFolder, launchConfiguration);
    
                                                        resolve();
                                                    }, function (err) {
                                                        console.log('Error:', err.message);
                                                    });
                                                var debugStart = false;
                                                new Promise(resolve => {
                                                    vscode.debug.onDidStartDebugSession(() => {
                                                        if (!debugStart) {
                                                            debugStart = true;
                                                            vscode.debug.activeDebugConsole.appendLine(`window.location = "${url}"`);
                                                            vscode.debug.activeDebugConsole.appendLine(`Enter the command - window.location = "${url}" in DEBUG CONSOLE to debug pre-compiled files.(In case scripts are not loaded)`);
                                                            //vscode.window.showInformationMessage(`Enter the command - window.location = "${url}" in DEBUG CONSOLE to debug pre-compiled files.`);
                                                            // vscode.debug.activeDebugConsole.appendLine(eval(`this.window.location = "${url}"`));
                                                            // vscode.debug.activeDebugConsole.appendLine(`this.window.location.reload()`);
                                                            resolve();
                                                        }
                                                    });
                                                });
                                                new Promise(resolve => {
                                                    vscode.debug.onDidTerminateDebugSession(() => {
                                                        resolve();
                                                        child.stdin.pause();
                                                        kill(child.pid);
    
                                                        if (enactchild != null) {
                                                            enactchild.stdin.pause();
                                                            kill(enactchild.pid);
                                                        }
                                                        vscode.debug.stopDebugging();
                                                        ares.launchClose(appId, device, "0")
                                                            .then(() => {
                                                                console.log(`Closed ${appId} on ${device}.`);
                                                                resolve();
                                                            }).catch((err) => {
                                                                let errMsg = `Failed to close ${appId} on ${device}.`
                                                                if (err.includes(`Unknown method "closeByAppId" for category "/dev"`)) {
                                                                    errMsg = `Please make sure the 'Developer Mode' is on.`;
                                                                } else if (err.includes(`Connection time out`)) {
                                                                    errMsg = `Please check ${device}'s IP address or port.`
                                                                }
                                                                console.log(`Error! ${errMsg}`);
                                                                reject();
                                                            });
                                                    });
                                                });
    
                                            }).catch((err) => {
                                                console.log("proess error -", err)
                                                vscode.window.showErrorMessage(`Error! Failed to run a local server.`);
                                            })
                                    })
                                })
                                .catch((err) => {
                                    console.error(err);
                                    vscode.window.showErrorMessage(`Error! Failed to ge free port`);
                                });
                        }
                        else {
                            launchConfiguration = {
                                "type": "pwa-chrome",
                                "request": "attach",
                                "name": "Attach to browser",
                                "address": ip,
                                "port": port,
                                "webRoot": path.join(appDir),
                                "localRoot": path.join(appDir),
                                "remoteRoot": "\\media\\developer\\apps\\usr\\palm\\applications\\" + appId,
                                "protocol": "inspector"
                            };
                            vscode.debug.startDebugging(defaultWorkFolder, launchConfiguration);
                            new Promise(resolve => {
                                vscode.debug.onDidTerminateDebugSession(() => {
                                    resolve();
                                    child.stdin.pause();
                                    kill(child.pid);
                                    vscode.debug.stopDebugging();
                                    ares.launchClose(appId, device, "0")
                                        .then(() => {
                                            console.log(`Closed ${appId} on ${device}.`);
                                            resolve();
                                        }).catch((err) => {
                                            let errMsg = `Failed to close ${appId} on ${device}.`
                                            if (err.includes(`Unknown method "closeByAppId" for category "/dev"`)) {
                                                errMsg = `Please make sure the 'Developer Mode' is on.`;
                                            } else if (err.includes(`Connection time out`)) {
                                                errMsg = `Please check ${device}'s IP address or port.`
                                            }
                                            console.log(`Error! ${errMsg}`);
                                            reject();
                                        });
                                });
                            });
                        }
                    }
                    // End
                    // open browser
                    /* ares.openBrowser(url);*/
                }
                resolve();
            }).catch((err) => {
                console.error(err);
                vscode.window.showErrorMessage(`Error! Failed to run a web inspector.`);
                reject(err);
            });
    })
}
