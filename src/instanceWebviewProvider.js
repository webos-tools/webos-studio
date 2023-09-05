/*
  * Copyright (c) 2021-2023 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require("vscode");
const { VboxInstanceProvider } = require('./vboxInstances');
const os = require("os");
const { exec } = require('child_process');
const { resolve } = require("path");
const { getRunningInstance } = require('./lib/vboxUtils');
const fs = require('fs')
const { logger } = require('./lib/logger');
const wemulIntegration = true;
class InstanceWebviewProvider {

    constructor(_extensionUri) {
        this.filteredInstanceList = [];
        this._extensionUri = _extensionUri;
        this.vboxInstanceProvider = new VboxInstanceProvider();
        this.loadingInstList = false
        this.webos_emulator = this.getweobosEmulatorPrgm()

    }
    getweobosEmulatorPrgm() {
        let osStr = os.platform().toLowerCase();
        let prg = "";
        switch (osStr) {
            case "darwin":
                prg = " source  ~/.bash_profile && webos-emulator";
                break;
            case "linux":
                prg = " .  ~/.profile && webos-emulator ";
                break;
            case "win32":
                prg = "webos-emulator ";
                break;

        }
        return prg;

    }
    resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            retainContextWhenHidden: true,
            enableForms: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

     

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        //   this.sendIcons(webviewView.webview);
        this.setInitialValue();
        this.getInstalledInstanceListAndSendToWebview();
        webviewView.webview.onDidReceiveMessage(msg => {
            switch (msg.command) {
                case 'loadInstance':
                    {
                        this.getInstalledInstanceListAndSendToWebview();
                        break;
                    }
                case 'addInstance':
                    {
                        this.addNewInstance(msg.data)
                        break;
                    }
                case 'updateInstance':
                    {
                        this.updateInstance(msg.data)
                        break;
                    }
                case 'showMsg':
                    {
                        this.showMessge(msg.data)
                        break;
                    }
                case 'launchInstance':
                    {
                        this.launchSelectedInstance(msg.data)
                        break;
                    }
                case 'deleteInstance':
                    {
                        this.deleteInstance(msg.data)
                        break;
                    }
                case 'editInstance':
                    {
                        this.editInstance(msg.data)
                        break;
                    }
            }
        });
        
    }
    showMessge(data) {
        if (data.isError) {
            vscode.window.showErrorMessage(data.msg)
        } else {
            vscode.window.showInformationMessage(data.msg);
        }
    }
    async getInstalledInstanceListAndSendToWebview() {
        if (!this.loadingInstList) {
            this.loadingInstList = true;
            this._view.webview.postMessage({ command: 'clearInstanceList', "data": {} });
            await this.vboxInstanceProvider.getChildren_WebView()
                .then(async (data) => {
                    this.filteredInstanceList = [];
                    await this.getSupportedInstance(data).then(() => {
                        this._view.webview.postMessage({ command: 'loadInstnaceList', "data": { "filterdInsance": this.filteredInstanceList, allInstance: data } });
                    }).catch((e)=>{
                        console.log(e)
                    })
                })
            this.loadingInstList = false;
        }
    }

    setInitialValue() {
        this._view.webview.postMessage({ command: 'loadInitValue', "data": { "currentOS": os.type(), "totalMem": Math.floor(((os.totalmem() / 1024) / 1024) * .88) } });
    }
    openAddInstance() {
        this._view.webview.postMessage({ command: 'loadAddInstance', "data": { "currentOS": os.type(), "totalMem": Math.floor(((os.totalmem() / 1024) / 1024) * .88) } });
    }
    async getSupportedInstance(instanceList) {
        for (let i = 0; i < instanceList.length; i++) {
            let commands = [`VBoxManage showvminfo  "${instanceList[i].label}"`];
            await this.exec_commands(commands)
                .then((stdout) => {
                    if (stdout.includes('Guest OS:')) {
                        let outArray = stdout.split('\n')
                        for (let j = 0; j < outArray.length; j++) {
                            if (outArray[j].includes('Guest OS:')) {
                                let osType = outArray[j].split(":")[1].trim();
                                if (osType == "Other Linux (64-bit)" || osType == "Other Linux (32-bit)") {
                                    this.filteredInstanceList.push(instanceList[i])
                                }
                                break;
                            }
                        }
                    }
                }).catch((err) => {
                    vscode.window.showErrorMessage("Unable to get device info.. " + instanceList[i].label)
                    console.log("error", err);
                })
        }
    }

    gcd = (a, b) => {
        return b
            ? this.gcd(b, a % b)
            : a;
    };
    aspectRatio = (width, height) => {
        const divisor = this.gcd(width, height);

        return `${(width / divisor)}:${(height / divisor)}`;
    }
    getScreenZoomFactor(data) {
        // 16:9 ose res //1920x1080
        let w = data.w;
        let h = data.h
        let screenAR = this.aspectRatio(w, h);
        if (screenAR != '16:9') {
            // not matching with ose aspect ratio
            if (w > h) {
                return (w / 1920)
            } else {
                return (h / 1080)
            }
        } else {
            // matching 
            return (w / 1920)
        }
    }

    async addNewInstance(data) {
        if (!fs.existsSync(data.vmdkFile)) {
            vscode.window.showErrorMessage("Error: VMDK file not exists ")
            return false;
        }
        await this.vboxInstanceProvider.getChildren_WebView()
            .then(async (instListData) => {

                for (let i = 0; i < instListData.length; i++) {
                    if (instListData[i].label == data.instName) {
                        vscode.window.showErrorMessage("Instance Name  already exists")
                        return false;
                    }
                    if (instListData[i]["attachedVMDK"] == data.vmdkFile && instListData[i].uuid != data.uuid) {
                        vscode.window.showErrorMessage(`Selected VMDK file is already using by ${instListData[i].label} `)
                        return false;
                    }
                }
                let commands = [`vboxmanage createvm --ostype ${data.os} --register --name "${data.instName}"`]

                // let commands = [`vboxmanage createvm  --register --name "${data.instName}"`]
                return await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                }, async (progress) => {
                    progress.report({ increment: 50, message: `Adding instance ...` });

                    await this.exec_commands(commands)
                        .then(async (stdout) => {
                            if (stdout.includes('UUID')) {
                                let outArray = stdout.split('\n')
                                let uuid = outArray[1].split(":")[1].trim();

                                commands = [];
                                if (wemulIntegration) {
                                    commands = [`${this.webos_emulator} -vd ${uuid} --hidden-vce-create --memory ${data.memory} --monitorcount ${data.monitorCount} --vmdk "${data.vmdkFile}" --scalefactor 0.7`]
                                } else {
                                    switch (data.currentOS) {
                                        case 'Darwin':
                                            commands = [
                                                `vboxmanage modifyvm ${uuid} --longmode ${data.os == "Linux" ? " off" : " on"}`,
                                                `vboxmanage modifyvm ${uuid} --memory ${data.memory} --vram 128 --ioapic on --cpus 2`,
                                                `vboxmanage modifyvm ${uuid} --graphicscontroller vmsvga`,
                                                `vboxmanage modifyvm ${uuid} --accelerate3d on`,
                                                `vboxmanage modifyvm ${uuid} --audio coreaudio --audioout on --audioin on`,
                                                `vboxmanage modifyvm ${uuid} --nic1 nat --nictype1 82540EM --natpf1 ssh,tcp,,6622,,22`,
                                                `vboxmanage modifyvm ${uuid} --natpf1 web-inspector,tcp,,9998,,9998`,
                                                `vboxmanage modifyvm ${uuid} --natpf1 enact-browser-web-inspector,tcp,,9223,,9999`,
                                                `vboxmanage modifyvm ${uuid} --mouse usbtablet`,
                                                `vboxmanage modifyvm ${uuid} --uart1 0x3f8 4 --uartmode1 file /dev/null`,
                                                `vboxmanage modifyvm ${uuid} --monitorcount ${data.monitorCount}`,
                                                `vboxmanage storagectl ${uuid} --add ide --name "${data.instName}"`,
                                                `vboxmanage storageattach ${uuid} --storagectl "${data.instName}" --type hdd --port 0 --device 0 --medium "${data.vmdkFile}"`,
                                                `vboxmanage setextradata ${uuid} GUI/ScaleFactor ${this.getScreenZoomFactor(data)}`
                                            ]
                                            break;
                                        case 'Linux':
                                            commands = [
                                                `vboxmanage modifyvm ${uuid} --longmode ${data.os == "Linux" ? " off" : " on"}`,
                                                `vboxmanage modifyvm ${uuid} --memory ${data.memory} --vram 128 --ioapic on --cpus 2`,
                                                `vboxmanage modifyvm ${uuid} --graphicscontroller vmsvga`,
                                                `vboxmanage modifyvm ${uuid} --accelerate3d on`,
                                                `vboxmanage modifyvm ${uuid} --audio pulse --audioout on --audioin on`,
                                                `vboxmanage modifyvm ${uuid} --nic1 nat --nictype1 82540EM --natpf1 ssh,tcp,,6622,,22`,
                                                `vboxmanage modifyvm ${uuid} --natpf1 web-inspector,tcp,,9998,,9998`,
                                                `vboxmanage modifyvm ${uuid} --natpf1 enact-browser-web-inspector,tcp,,9223,,9999`,
                                                `vboxmanage modifyvm ${uuid} --mouse usbtablet`,
                                                `vboxmanage modifyvm ${uuid} --uart1 0x3f8 4 --uartmode1 file /dev/null`,
                                                `vboxmanage modifyvm ${uuid} --monitorcount ${data.monitorCount}`,
                                                `vboxmanage storagectl ${uuid} --add ide --name "${data.instName}"`,
                                                `vboxmanage storageattach ${uuid} --storagectl "${data.instName}" --type hdd --port 0 --device 0 --medium "${data.vmdkFile}"`,
                                                `vboxmanage setextradata ${uuid} GUI/ScaleFactor ${this.getScreenZoomFactor(data)}`
                                            ]
                                            break;
                                        case 'Windows_NT':

                                            commands = [
                                                `vboxmanage modifyvm ${uuid} --longmode ${data.os == "Linux" ? " off" : " on"}`,
                                                `vboxmanage modifyvm ${uuid} --memory ${data.memory} --vram 128 --ioapic on --cpus 2`,
                                                `vboxmanage modifyvm ${uuid} --graphicscontroller vmsvga`,
                                                `vboxmanage modifyvm ${uuid} --accelerate3d on`,
                                                `vboxmanage modifyvm ${uuid} --audio dsound --audioout on --audioin on`,
                                                `vboxmanage modifyvm ${uuid} --nic1 nat --nictype1 82540EM --natpf1 ssh,tcp,,6622,,22`,
                                                `vboxmanage modifyvm ${uuid} --natpf1 web-inspector,tcp,,9998,,9998`,
                                                `vboxmanage modifyvm ${uuid} --natpf1 enact-browser-web-inspector,tcp,,9223,,9999`,
                                                `vboxmanage modifyvm ${uuid} --mouse usbtablet`,
                                                `vboxmanage modifyvm ${uuid} --uart1 0x3f8 4 --uartmode1 file null`,
                                                `vboxmanage modifyvm ${uuid} --monitorcount ${data.monitorCount}`,
                                                `vboxmanage storagectl ${uuid} --add ide --name "${data.instName}"`,
                                                `vboxmanage storageattach ${uuid} --storagectl "${data.instName}" --type hdd --port 0 --device 0 --medium "${data.vmdkFile}"`,
                                                `vboxmanage setextradata ${uuid} GUI/ScaleFactor ${this.getScreenZoomFactor(data)}`
                                            ]
                                            break;

                                    }
                                }
                                await this.exec_commands(commands)
                                    .then(async () => {
                                        progress.report({ increment: 90, message: `Adding instance ...` });
                                        this.getInstalledInstanceListAndSendToWebview();
                                    }).catch((err) => {
                                        // display error
                                        vscode.window.showErrorMessage("Error Modifying Instance values")
                                        console.log("error", err);
                                    })
                            } else {
                                console.log("do not contain uuid..", stdout)
                                vscode.window.showErrorMessage("Error gettng instance uuid")
                            }
                        }).catch((err) => {
                            // display error
                            vscode.window.showErrorMessage("Error Adding Instance")
                            console.log("error", err);
                        })
                });
            });
    }
    async updateInstance(data) {
        if (!fs.existsSync(data.vmdkFile)) {
            vscode.window.showErrorMessage("Error: VMDK file not exists ")
            return false;
        }
        await this.vboxInstanceProvider.getChildren_WebView()
            .then(async (instListData) => {

                for (let i = 0; i < instListData.length; i++) {
                    if (instListData[i].label == data.instName && instListData[i].uuid != data.uuid) {
                        vscode.window.showErrorMessage("Instance Name  already exists")
                        return false;
                    }
                    if (instListData[i]["attachedVMDK"] == data.vmdkFile && instListData[i].uuid != data.uuid) {
                        vscode.window.showErrorMessage(`Selected VMDK file is already using by ${instListData[i].label} `)
                        return false;
                    }
                    if (instListData[i]["state"] == "saved" && instListData[i].uuid == data.uuid) {
                        vscode.window.showErrorMessage(`Could not update,  The Instance ${instListData[i].label} is in saved state`)
                        return false;
                    }
                }
                let updatecommands = [];
                if (wemulIntegration) {
                    updatecommands = [`${this.webos_emulator} -vd ${data.uuid} -m --name "${data.instName}" --memory ${data.memory} --monitorcount ${data.monitorCount} --vmdk "${data.vmdkFile}"`]
                } else {
                    updatecommands = [
                        `vboxmanage modifyvm ${data.uuid} --longmode ${data.os == "Linux" ? " off" : " on"}`,
                        `vboxmanage modifyvm ${data.uuid} --name "${data.instName}"`,
                        `vboxmanage modifyvm ${data.uuid} --memory ${data.memory} --vram 128 --ioapic on --cpus 2`,
                        `vboxmanage modifyvm ${data.uuid} --monitorcount ${data.monitorCount}`,
                        `vboxmanage modifyvm ${data.uuid} --ostype ${data.os}`,
                        `vboxmanage storageattach ${data.uuid} --storagectl "${data.vmdkController}" --type hdd --port 0 --device 0 --medium "${data.vmdkFile}"`

                    ]
                }

                return await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                }, async (progress) => {

                    await getRunningInstance()
                        .then(async (runninguuid) => {
                            let commands = [];
                            if (data.uuid == runninguuid) {
                                vscode.window
                                    .showInformationMessage(` Selected instance is running, need a instance shutdown. do you want to continue  ?`, ...["Yes", "No"])
                                    .then(async (answer) => {
                                        return await vscode.window.withProgress({
                                            location: vscode.ProgressLocation.Notification,
                                        }, async (progress) => {

                                            progress.report({ increment: 20, message: `Shutting down instance ...` });
                                            if (answer === "Yes") {
                                                if (wemulIntegration) {
                                                    commands = [
                                                        `${this.webos_emulator} -vd ${runninguuid} -k`,
                                                        `ping -${os.type() == "Windows_NT" ? "n" : "c"} 5 localhost `,
                                                    ]
                                                } else {
                                                    commands = [
                                                        `VBoxManage controlvm ${runninguuid} pause`,
                                                        `ping -${os.type() == "Windows_NT" ? "n" : "c"} 5 localhost `,
                                                        `VBoxManage controlvm  ${runninguuid} poweroff`,
                                                        `ping -${os.type() == "Windows_NT" ? "n" : "c"} 5 localhost `,

                                                    ]
                                                }
                                                progress.report({ increment: 10, message: `Shutting down instance ...` });
                                                await this.exec_commands(commands)
                                                    .then(async () => {
                                                        progress.report({ increment: 20, message: `Updating instance ...` });

                                                        await this.exec_commands(updatecommands)
                                                            .then(async () => {
                                                                progress.report({ increment: 10, message: `Updating instance ...` });
                                                                this.getInstalledInstanceListAndSendToWebview();
                                                            }).catch((err) => {
                                                                // display error
                                                                vscode.window.showErrorMessage("Error Updating Instance values")
                                                                console.log("error", err);
                                                            })
                                                    }).catch((err) => {
                                                        // display error
                                                        vscode.window.showErrorMessage("Error Updating Instance values")
                                                        console.log("error", err);
                                                    })
                                            }
                                        })
                                    })
                            } else {

                                progress.report({ increment: 20, message: `Updating instance ...` });
                                await this.exec_commands(updatecommands)
                                    .then(async () => {
                                        progress.report({ increment: 10, message: `Updating instance ...` });
                                        this.getInstalledInstanceListAndSendToWebview();
                                        progress.report({ increment: 10, message: `Updating instance ...` });
                                    }).catch((err) => {
                                        // display error
                                        vscode.window.showErrorMessage("Error Updating Instance values")
                                        console.log("error", err);
                                    })
                            }
                        })
                });
            });
    }

    async launchSelectedInstance(data) {
        await getRunningInstance()
            .then(async (runninguuid) => {
                let commands = [];
                if (data.uuid == runninguuid) {
                    // already launched
                    vscode.window.showWarningMessage("Selected instance is already running...")
                    resolve("already running")
                } else if (runninguuid !== "") {
                    // running some other
                    vscode.window
                        .showInformationMessage(`Do you want to stop the current instance and launch  '${data.instName}' ?`, ...["Yes", "No"])
                        .then(async (answer) => {
                            if (answer === "Yes") {
                                if (wemulIntegration) {
                                    commands = [
                                        `${this.webos_emulator} -vd ${runninguuid} -k`,
                                        `ping -${os.type() == "Windows_NT" ? "n" : "c"} 5 localhost `,
                                        `${this.webos_emulator} -vd ${data.uuid} -s`,
                                    ]
                                }
                                else {
                                    commands = [
                                        `VBoxManage controlvm ${runninguuid} pause`,
                                        `ping -${os.type() == "Windows_NT" ? "n" : "c"} 5 localhost `,
                                        `VBoxManage controlvm  ${runninguuid} poweroff`,
                                        `ping -${os.type() == "Windows_NT" ? "n" : "c"} 5 localhost `,
                                        `vboxmanage startvm ${data.uuid}`,
                                    ]
                                }
                                return await vscode.window.withProgress({
                                    location: vscode.ProgressLocation.Notification,
                                }, async (progress) => {
                                    progress.report({ increment: 20, message: `Launching Instance ${data.instName} ...` });
                                    await this.exec_commands(commands)
                                        .then(() => {
                                            progress.report({ increment: 40, message: `Launching Instance ${data.instName}  ...` });
                                            this.getInstalledInstanceListAndSendToWebview();
                                        }).catch((err) => {
                                            vscode.window.showErrorMessage("Error Launching Instance")
                                            console.log("error", err);
                                        })
                                })
                            }
                        })

                } else {
                    // no running instance
                    if (wemulIntegration) {
                        commands = [
                            `${this.webos_emulator} -vd ${data.uuid} -s`,
                            `ping -${os.type() == "Windows_NT" ? "n" : "c"} 5 localhost `,
                        ]
                    } else {
                        commands = [
                            `vboxmanage startvm ${data.uuid}`,
                            `ping -${os.type() == "Windows_NT" ? "n" : "c"} 5 localhost `,
                        ]
                    }
                    return await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                    }, async (progress) => {
                        progress.report({ increment: 10, message: `Launching Instance ${data.instName} ...` });
                        await this.exec_commands(commands)
                            .then(() => {
                                progress.report({ increment: 40, message: `Launching Instance ${data.instName}  ...` });
                                this.getInstalledInstanceListAndSendToWebview();
                            }).catch((err) => {
                                vscode.window.showErrorMessage("Error Launching Instance")
                                console.log("error", err);
                            })
                    })
                }
            }).catch((err) => {
                console.error("Error on Fetching Running Instance Found");
                console.log("error", err);
            })
    }
    async deleteInstance(data) {
        vscode.window
            .showInformationMessage((wemulIntegration) ? `Do you want to delete instance '${data.instName}' ?` :
                `This will delete 'VMDK file' and 'Saved State', Do you want to delete instance '${data.instName}' ?`,
                ...["Yes", "No"])
            .then(async (answer) => {
                if (answer === "Yes") {
                    return await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                    }, async (progress) => {
                        progress.report({ increment: 50, message: `Deleting instance ...` });
                        let commands = [];
                        await getRunningInstance()
                            .then(async (runninguuid) => {
                                if (data.uuid == runninguuid) {
                                    //  if (data.isRunning == "true") {
                                    if (wemulIntegration) {
                                        commands = [
                                            `${this.webos_emulator} -vd ${data.uuid} -k`,
                                            `ping -${os.type() == "Windows_NT" ? "n" : "c"} 5 localhost `,
                                            `${this.webos_emulator} -vd ${data.uuid} --delete`
                                        ]
                                    } else {
                                        commands = [
                                            `vboxmanage controlvm ${data.uuid} pause`,
                                            `vboxmanage controlvm ${data.uuid} poweroff`,
                                            `ping -${os.type() == "Windows_NT" ? "n" : "c"} 5 localhost `,
                                            `vboxmanage unregistervm ${data.uuid} --delete`
                                        ]
                                    }
                                } else {
                                    if (wemulIntegration) {
                                        commands = [
                                            `${this.webos_emulator} -vd ${data.uuid} --delete`
                                        ]
                                    } else {
                                        commands = [
                                            `vboxmanage unregistervm ${data.uuid} --delete`
                                        ]
                                    }
                                }
                                await this.exec_commands(commands)
                                    .then(() => {
                                        this.getInstalledInstanceListAndSendToWebview();
                                    }).catch((err) => {
                                        vscode.window.showErrorMessage("Error deleting device")
                                        console.log("error", err);
                                    })

                            }).catch((err) => {
                                console.error("Error on Fetching Running Instance Found");
                                console.log("error", err);
                            })
                    })
                }
            });
    }

    async editInstance(data) {
        let commands = [`VBoxManage showvminfo  ${data.uuid}`];
        let updateFormData = { instName: null, monitorCount: null, memory: null, vmdkFile: null, vmdkController: null }
        await this.exec_commands(commands)
            .then((stdout) => {
                //   if (stdout.includes('Guest OS:')) {
                let outArray = stdout.split('\n');

                for (let j = 0; j < outArray.length; j++) {
                    if (outArray[j].includes('Guest OS:')) {
                        let osString = outArray[j].split(":")[1].trim();
                        if (osString == "Other Linux (64-bit)") {
                            updateFormData["os"] = "Linux_64";
                        } else if (osString == "Other Linux (32-bit)") {
                            updateFormData["os"] = "Linux";
                        }
                        else {
                            updateFormData["os"] = osString;
                        }
                    }
                    if (j == 0 && outArray[j].search('^Name:') == 0) {
                        updateFormData["instName"] = outArray[j].split(":")[1].trim();
                    }
                    if (outArray[j].includes('Monitor count:')) {
                        updateFormData["monitorCount"] = outArray[j].split(":")[1].trim();
                    }
                    if (outArray[j].includes('Memory size:')) {
                        updateFormData["memory"] = parseInt(outArray[j].split(":")[1].trim());
                    }
                    // if (outArray[j].includes(`.vmdk`) && outArray[j].includes(`UUID:`)) {
                    if (outArray[j].includes(`.vmdk`)) {
                        updateFormData["vmdkFile"] = outArray[j].split(": ")[1].split("(UUID")[0].replace(`(UUID: ${data.uuid})`, "").replaceAll('"', '').trim();
                        //  updateFormData["vmdkController"] = outArray[j].split(": ")[0].split("(0")[0].trim()
                    }

                    if (outArray[j].includes('Storage Controller Name (0):')) {
                        updateFormData["vmdkController"] = outArray[j].split(":")[1].trim();
                    }

                    if (outArray[j].includes('#0:')) {
                        updateFormData["vmdkController"] = outArray[j].split(",")[0].split(" ")[1].replaceAll("'", '').trim();
                    }
                }

                updateFormData["uuid"] = data.uuid;
                updateFormData["currentOS"] = os.type();
                updateFormData["totalMem"] = Math.floor(((os.totalmem() / 1024) / 1024) * .88)

                this._view.webview.postMessage({ command: 'editInstance', "data": updateFormData });

            }).catch((err) => {
                vscode.window.showErrorMessage("Error getting instance info")
                console.log("error", err);
            })
    }

    async exec_commands(commands) {
        let commandstring = commands.join(" && ");
        return new Promise((resolve, reject) => {
            logger.run(commandstring)
            logger.log("------------------------------------------------")
            exec(commandstring, (error, stdout, stderr) => {
                if(stdout){
                    if (!commandstring.includes("showvminfo")) {
                        logger.log(stdout )
                    }
                }
                if (error) {
                    logger.error(error)
                    reject(error);
                }
                if (stderr) {
                    logger.warn(stderr)

                }
                resolve(stdout);
            });
        })
    }
    _getHtmlForWebview(webview) {
        const resettUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
        const loadingUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'loading.gif'));
        // Use a nonce to only allow a specific script to be run.
        getNonce();
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${resettUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
                <link href="${codiconsUri}" rel="stylesheet" />
				<title>Cat Colors</title>
			</head>
			<body style ="display:none">
                <div id="welcomeLayout" class="welcomeLayout" >
                     In order to create VirtualBox Emulator, you can click on the 'Add Instance' icon on the top or click below button.</br></br>
                     <button id="welcomAddInstance" class="webview-button">Add Instance</button>
                     </br>
                     learn more about how to use emulator
                     <a href="https://marketplace.visualstudio.com/items?itemName=webOSOSESDK.webosose">read our docs</a>.
                      
                </div>
                <div id="listLayout" class="listLayout">
                    <div id="instanceList">
                    </div>
                  
                </div>
                <div id ="listLoaderProgress" style ="display: none;  justify-content: center; ">
                <img src="${loadingUri}" style ="width:30px;"></img>
                </div>

                
                <div id="addLayout" class="addLayout">
                    <table style="width:100%"><tr><td>
                    <label  for="instName">Name</label>
                    <input placeholder ="Supports only alphanumeric, dot, hyphen, underscore and space characters" title ="Supports only alphanumeric, dot, hyphen, underscore and space characters"  type="text" id="instName" pattern="[A-Za-z0-9]{50}" >
                    </td></tr>
                    <tr><td>
                    <label  for="os">OS</label>
                    <select id="os">
                        <option value="Linux_64" selected>Other Linux (64 bit)</option>
                        <option value="Linux">Other Linux (32 bit)</option>
                        
                    </select>
                    </td></tr>
                    <tr><td>
                    <label for="vmdkFile">Select VMDK File</label>
                    <input type="file" id="vmdkFile" accept=".vmdk" style ="display:none" >
                    <div class ="fileButtonContainer"> <span theFile="" id="selectedFile">No VMDK file choosen</span><span id ="fileButton" class="fileButton"> Choose File </span></div>
                  
                    </td></tr>
                    <tr><td>
                    <label for="monitorCount">Monitor count</label>
                    <select id="monitorCount">
                        <option value="1" selected>1</option>
                        <option value="2">2</option>
                        
                    </select>
                    </td></tr>
                    <tr><td>
                    <label>Memory</label>
                    <span style="width:100%;text-align: center" id="memSelectd"></span>
                    <input type="range" id="memory" >
                    
                    </td></tr>
                        <table style="width:100% ;margin-top :-15px">
                        <tr><td  style="width:50%" id ="memMin">min</td><td style="width:50%;text-align: right" id ="memMax">max</td>
                        </tr>
                        </table>
                    </table>
                    <div style="width:100%;margin-top :10px; display:none" class="notSupportedContainer" id = "notSupportedContainer" >
                       
                    </div>
                    <table style="width:100%;margin-top :10px">
                        <tr  style="width:100%">
                            <td style="width:50%"><button id="btnAddInstnce" class="webview-button">Add Instance</button></td>
                            <td style="width:50%"><button id="btnCancelInstnce" class="webview-button">Cancel</button></td>
                        </tr>
                    </table>
                    <br>
                    <div style="width:100%;margin-top :10px;  display:none" class="defaultValueContainer" id = "defaultValueContainer" >
                      <div id ="defaultValues">  </div>
                  
                </table>
                    
                </div>
				
               

				<script src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}
InstanceWebviewProvider.viewType = 'vbox';
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

exports.InstanceWebviewProvider = InstanceWebviewProvider;
