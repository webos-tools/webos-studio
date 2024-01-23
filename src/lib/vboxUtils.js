/*
  * Copyright (c) 2021-2023 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require('vscode');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { getCliPath } = require('./configUtils');
const { logger } = require('./logger');
const { showEmulatorPrompt } = require('../installGlobalLibrary');
let instanceList = [];

function _sortByName(a, b) {
    return a.name > b.name ? 1 : -1;
}

function _execAsync(cmd, option, next) {
    return new Promise((resolve, reject) => {
        let execOption = {};
        if (typeof option == "function") {
            next = option;
        } else if (typeof option == "object") {
            execOption = option;
        }
        logger.run(cmd )
        logger.log("------------------------------------------------")
        exec(cmd, execOption, (err, stdout, stderr) => {
            if(stdout){
                if (!cmd.includes('list vms -l')) {
                    logger.log(stdout);
                }
            }
            if(stderr){
                logger.warn(stderr);
            }
            if (err) {
                logger.error(err);
                if (stderr.includes('not recognized') || stderr.includes('not found') || (os.type() == "Windows_NT" && err.code == 1)) {
                    // const { showPrompt } = require('../installGlobalLibrary');
                    // showPrompt();
                    if (cmd.includes('VBoxManage')) {
                        vscode.window.showWarningMessage(`Warning! Unable to find the VirtualBox.`)
                        reject("Unable to find the installed  VirtualBox");
                    } else {
                        showEmulatorPrompt();
                        reject("Unable to find the installed  webos-emulator");
                    }
                } else {
                    reject(stderr);
                }
            } else {

                if (next) {
                    next(stdout, resolve, reject);
                } else {
                    resolve(stdout);
                }
            }
        })
    })
}

async function setupInstanceList() {
    let cmd = `${path.join(await getCliPath(), 'VBoxManage list vms')}`;
    return _execAsync(cmd, (stdout, resolve, reject) => {

        if (stdout.includes('{')) {
            resolve(stdout);
        } else {
            reject('No instance found')
        }

    });
}
async function getRunningInstance() {
    let cmd = `${path.join(await getCliPath(), 'VBoxManage list runningvms')}`;
    // eslint-disable-next-line no-unused-vars
    return _execAsync(cmd, (stdout, resolve, reject) => {

        if (stdout.includes('{')) {
            // resolve(stdout);
            let data = stdout.replace(/"/g, "{")
            data = data.replace(/}/g, "{")
            const withBlankArray = data.split("{");
            const filtered = withBlankArray.filter((el) => {
                return el !== null && typeof el !== 'undefined' && el.trim() !== "";
            });
            resolve(filtered[1])
        } else {
            resolve('')
        }

    });
}
async function getInstanceVMDK() {
    let cmd = `${path.join(await getCliPath(), 'VBoxManage list vms -l')}`;
    // eslint-disable-next-line no-unused-vars
    return _execAsync(cmd, (stdout, resolve, reject) => {

        let outArray = stdout.split('\n')
        let infoArray = []
        let vmdkInfos = { "uuid": "", "attachedVMDK": "","state":"" };

        for (let j = 0; j < outArray.length; j++) {

            if (outArray[j].includes('Hardware UUID:') && vmdkInfos["uuid"] == "") {
                vmdkInfos["uuid"] = outArray[j].split(":")[1].trim();
                vmdkInfos["attachedVMDK"] = "";
            }
            
            if (outArray[j].includes('State:') && vmdkInfos["uuid"] != "") {
                vmdkInfos["state"] = outArray[j].split(":")[1].split("(")[0].trim();
            }

            if (outArray[j].includes(`.vmdk`) && vmdkInfos["uuid"]) {
                vmdkInfos["attachedVMDK"] = outArray[j].split(": ")[1].split("(UUID")[0].replaceAll('"', '').trim();
                infoArray.push(vmdkInfos)
                vmdkInfos = { "uuid": "", attachedVMDK: "" ,"state":"" };
            }
        }
        resolve(infoArray);
    });
}

async function checkWebosEmulator() {
    let cmd = `${path.join(await getCliPath(), 'webos-emulator --version')}`;
    return _execAsync(cmd, (stdout, resolve, reject) => {

        if (stdout.includes('webos-emulator')) {
            resolve(stdout);
        } else {
            reject('not found!!!');
        }
    });
}

//--------------------------------------
async function _setInstanceList() {
    instanceList = [];
    await setupInstanceList()
        .then(async (data) => {
            data = data.replace(/"/g, "{")
            data = data.replace(/}/g, "{")
            const withBlankArray = data.split("{");
            const filtered = withBlankArray.filter((el) => {
                return el !== null && typeof el !== 'undefined' && el.trim() !== "";
            });
            let count = 0;
            instanceList = []
            while (count < filtered.length) {
                let data = {};
                data["name"] = filtered[count]
                data["uuid"] = filtered[++count];
                data["isRunning"] = false;
                data["attachedVMDK"] = "";
                data["state"] ="";
                instanceList.push(data)
                count++;
            }
            instanceList.sort(_sortByName);

            await getRunningInstance()
                .then((data) => {
                    instanceList.forEach((instance) => {
                        if (instance.uuid == data) {
                            instance.isRunning = true;
                        }
                    });
                }).catch((err) => {
                      console.error("No Running Instance Found", err);
                });

            await getInstanceVMDK()
                .then((data) => {
                    instanceList.forEach((instance) => {
                        for (let i = 0; i < data.length; i++) {
                            if (instance.uuid == data[i].uuid) {
                                instance["attachedVMDK"] = data[i]["attachedVMDK"]
                                instance["state"] = data[i]["state"]
                            }
                        }
                    });
                }).catch((err) => {
                      console.error("vmdk", err);
                });
        }).catch((err) => {
            console.error(err);
            // vscode.window.showErrorMessage(`Error! Failed to get the device list.`);
        })
    await checkWebosEmulator()
        .then(async (data) => {
            console.log("webos-emulator :", data);
        }).catch((err) => {
            console.error(err);
        })
}

async function getInstanceList() {
    await _setInstanceList();
    return instanceList;
}

module.exports = {
    getInstanceList: getInstanceList,
    getRunningInstance: getRunningInstance
    // getRunningList: getRunningList
}
