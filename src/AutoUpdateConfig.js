
/*
 * Copyright (c) 2024 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = require("vscode");
const util = require("util");
const fs = require("fs");
const sudoExec = util.promisify(require("sudo-prompt-alt").exec);
const os = require("os");
const { isElevated } = require("./lib/isElevated");


const fetch = require("node-fetch");
const path = require("path");
const { logger } = require('./lib/logger');
const exec = util.promisify(require("child_process").exec);
const dns = require('dns').promises;



class AutoUpdate {

    constructor(context) {
        this.context = context;
        this.isConfigUpdated = false;
        this.configJson = null;
        this.fileTypeCode = null;
        this.tv_servEmulators = [];
        this.tv_servSimulators = [];
        this.ose_servEmulators = [];
    }
    checkInternet() {
        return dns.lookup('google.com')
            .then(() => true)
            .catch(() => false);
    }

    async doAutoUpateConfigFile() {
        let isConnected = await this.checkInternet();


        if (isConnected) {
            this.configJson = this.getConfigJson();
            this.fileTypeCode = this.getFileTypeCode()
            await this.getServerTVComponents();
            await this.getServerOSEComponents();

            this.updateTVConfig();
            this.updateOSEConfig();

            if (this.isConfigUpdated) {
                let filePath = path.join(this.context.extensionUri.fsPath, "media", "package_manager", "config", "config.json");
                fs.writeFileSync(filePath, JSON.stringify(this.configJson), "utf8");
                logger.info("AutoUpdate - Updated Package Manager configuration with new components")

                return true
            } else {
                return false
            }
        } else {
            logger.warn("Unable to connect to internet to check Package Manager updates")
            return false;
        }





    }


    orderConfig(objArray) {
        let o = {};
        objArray.forEach(element => {
            o[element.sortOrder] = element;
        });

        var sorted = {},
            key, a = [];

        for (key in o) {
            if (o.hasOwnProperty(key)) {
                a.push(key);
            }
        }

        a.sort();
        for (key = 0; key < a.length; key++) {
            sorted[a[key]] = o[a[key]];
        }
        return sorted;
    }
    updateTVConfig() {
        //Emulator
        // geneerate comp_uid
        let lastIDInt = this.configJson.tv["tv-emulator"].length + 1;

        this.tv_servEmulators.forEach(servEntry => {
            let isAvailable = true;
            for (let i = 0; i < this.configJson.tv["tv-emulator"].length; i++) {
                if (servEntry.subDirName == this.configJson.tv["tv-emulator"][i].subDirName) {
                    isAvailable = true;
                    break;
                } else {
                    isAvailable = false
                }
            }
            if (!isAvailable) {
                servEntry["comp_uid"] = "tv_emulator_" + lastIDInt++;
                // add the Entry to config file
                this.configJson.tv["tv-emulator"].push(servEntry)
                this.isConfigUpdated = true;
                logger.info("AutoUpdate - Found New version of  " + servEntry["displayName"] + " " + servEntry["shortDisplayName"])

            }

        });
        //order entries
        let orderedEntries = this.orderConfig(this.configJson.tv["tv-emulator"])
        this.configJson.tv["tv-emulator"] = [];
        Object.keys(orderedEntries).forEach((key) => { this.configJson.tv["tv-emulator"].push(orderedEntries[key]) })

        // // simulator
        lastIDInt = this.configJson.tv["tv-simulator"].length + 1;//parseInt(lastID) + 1
        this.tv_servSimulators.forEach(servEntry => {
            let isAvailable = true;
            for (let i = 0; i < this.configJson.tv["tv-simulator"].length; i++) {
                if (servEntry.subDirName == this.configJson.tv["tv-simulator"][i].subDirName) {
                    isAvailable = true;
                    break;
                } else {
                    isAvailable = false
                }
            }
            if (!isAvailable) {
                servEntry["comp_uid"] = "tv_simulator_" + lastIDInt++;
                // add the Entry to config file
                this.configJson.tv["tv-simulator"].push(servEntry)
                this.isConfigUpdated = true;
                logger.info("AutoUpdate - Found New version of  " + servEntry["displayName"] + " " + servEntry["shortDisplayName"])

            }

        });

        orderedEntries = this.orderConfig(this.configJson.tv["tv-simulator"])
        this.configJson.tv["tv-simulator"] = [];
        Object.keys(orderedEntries).forEach((key) => { this.configJson.tv["tv-simulator"].push(orderedEntries[key]) })


    }
    updateOSEConfig() {
        //Emulator
        // geneerate comp_uid
        let lastIDInt = this.configJson.ose["ose-emulator"].length + 1;

        this.ose_servEmulators.forEach(servEntry => {
            let isAvailable = true;
            for (let i = 0; i < this.configJson.ose["ose-emulator"].length; i++) {
                if (servEntry.subDirName == this.configJson.ose["ose-emulator"][i].subDirName) {
                    isAvailable = true;
                    break;
                } else {
                    isAvailable = false
                }
            }
            if (!isAvailable) {
                servEntry["comp_uid"] = "ose_emulator_" + lastIDInt++;
                // add the Entry to config file
                this.configJson.ose["ose-emulator"].push(servEntry)
                this.isConfigUpdated = true;
                logger.info("AutoUpdate - Found New version of  " + servEntry["displayName"] + " " + servEntry["shortDisplayName"])

            }

        });
        //order entries
        let orderedEntries = this.orderConfig(this.configJson.ose["ose-emulator"])
        this.configJson.ose["ose-emulator"] = [];
        Object.keys(orderedEntries).forEach((key) => { this.configJson.ose["ose-emulator"].push(orderedEntries[key]) })
    }


    async getServerTVComponents() {
        await this.getListOfTVEmulatorFromDevServer();
        await this.getListOfTVSimulatorFromDevServer()

    }
    async getListOfTVEmulatorFromDevServer() {
        const respBaseUrl = await fetch("https://developer.lge.com/resource/tv/RetrieveToolLastVersion.dev?resourceId=RS00007403")
            .catch((err) => {
                logger.warn("Unable to connect developer.lge.com to check for update")
            });
        if (!respBaseUrl) return;
        const jsonResp = await respBaseUrl.json();
        this.tv_servEmulators = [];
        for (let i = 0; i < jsonResp.fileList.length; i++) {
            if (jsonResp.fileList[i]["fileTypeCode"] == this.fileTypeCode && jsonResp.fileList[i]["fileName"].includes("Emulator_tv")) {
                let fileSplit = jsonResp.fileList[i].fileName.split("_")
                let lastFileSplit = fileSplit[fileSplit.length - 1]
                let extSplit = lastFileSplit.split(".")
                extSplit.pop();
                extSplit = extSplit.join(".");
                let verNo = extSplit.replace("v", "")


                // create a Config Entry json
                let configEntry = {
                    // "comp_uid" : "tv_emulator_" +(this.tv_servEmulators.length+1),
                    "subDirName": "v" + verNo,
                    "displayName": "webOS TV Emulator",
                    "shortDisplayName": "v" + verNo,
                    "shortName": "Emulator",
                    "sdk_version": verNo,
                    "apiLevel": "21",
                    "repository": "https://developer.lge.com/resource/tv/RetrieveToolLastVersion.dev?resourceId=RS00007403",
                    "description": "",
                    "userid": "sdk",
                    "password": "sdk",
                    "expFileSizeInMB": "1460",
                    "installMethod": "TV_EMULATOR_INSTALL_FORALL",
                    "uninstallMethod": "TV_EMULATOR_UNINSTALL_FORALL"
                }



                this.tv_servEmulators.push(configEntry);


            }
        }
        this.tv_servEmulators = this.assignSortOrder(this.tv_servEmulators, "tv", "tv-emulator")



    }
    async getListOfTVSimulatorFromDevServer() {
        const respBaseUrl = await fetch("https://developer.lge.com/resource/tv/RetrieveToolLastVersion.dev?resourceId=RS00007585")
            .catch((err) => {
                logger.warn("Unable to connect developer.lge.com to check for update")
            });
        if (!respBaseUrl) return;
        const jsonResp = await respBaseUrl.json();
        this.tv_servSimulators = [];
        for (let i = 0; i < jsonResp.fileList.length; i++) {
            if (jsonResp.fileList[i]["fileTypeCode"] == this.fileTypeCode && jsonResp.fileList[i]["fileName"].includes("webOS_TV_")) {
                //"fileName":"webOS_TV_24_Simulator_1.4.0_mac.zip"
                let fileSplit = jsonResp.fileList[i].fileName.split("_")
                let ver1 = fileSplit[2]
                let ver2 = fileSplit[fileSplit.length - 2]
                fileSplit.pop()
                let subDirName = fileSplit.join("_")
                fileSplit.pop();
                let displayName = fileSplit.join(" ")

                // create a Config Entry json
                let configEntry = {
                    // "comp_uid" : "tv_simulator_" +(this.tv_servSimulators.length+1),
                    "subDirName": subDirName,
                    "displayName": displayName,
                    "shortDisplayName": `(webOS${ver1}) v${ver2}`,
                    "shortName": "Simulator",
                    "sdk_version": ver1 + ".0",
                    "sdk_version_act": ver2,
                    "tvos_version": ver1,
                    "apiLevel": "21",
                    "repository": "https://developer.lge.com/resource/tv/RetrieveToolLastVersion.dev?resourceId=RS00007585",
                    "description": "",
                    "userid": "sdk",
                    "password": "sdk",
                    "expFileSizeInMB": "60",
                    "installMethod": "TV_SIMULATOR_INSTALL_FORALL",
                    "uninstallMethod": "TV_SIMULATOR_UNINSTALL_FORALL"
                }


                this.tv_servSimulators.push(configEntry);
            }
        }
        this.tv_servSimulators = this.assignSortOrder(this.tv_servSimulators, "tv", "tv-simulator")


    }
    async getServerOSEComponents() {
        await this.getListOfOSEEmulatorFromDevServer();
    }
    async getListOfOSEEmulatorFromDevServer() {
        let output = await exec(`curl -sL https://api.github.com/repos/webosose/build-webos/tags`);
        const jsonResp = JSON.parse(output.stdout);
        this.ose_servEmulators = [];
        for (let i = 0; i < jsonResp.length; i++) {

            let verNo = jsonResp[i]["name"].replace("v", "")
            let v1 = parseInt(verNo.split(".")[0])
            let v2 = parseInt(verNo.split(".")[1])
            if (v1 >= 2 && v2 >= 20) {
                // create a Config Entry json
                let configEntry = {
                    // "comp_uid" : "ose_simulator_" +(this.ose_servEmulators.length+1),
                    "subDirName": "v" + verNo,
                    "displayName": "webOS OSE Emulator",
                    "shortDisplayName": "v" + verNo,
                    "shortName": "Emulator",
                    "sdk_version": verNo,
                    "apiLevel": "28",
                    "repository": "https://github.com/webosose/build-webos/releases/download/" + "v" + verNo + "/webos-ose-" + verNo.replaceAll(".", "-") + "-qemux86-64.tar.bz2",
                    "description": "",
                    "userid": "sdk",
                    "password": "sdk",
                    "expFileSizeInMB": "3650",
                    "installMethod": "OSE_EMULATOR_INSTALL_FORALL",
                    "uninstallMethod": "OSE_EMULATOR_UNINSTALL_FORALL"
                }
                this.ose_servEmulators.push(configEntry);
            }



        }
        this.ose_servEmulators.reverse();
        this.ose_servEmulators = this.assignSortOrder(this.ose_servEmulators, "ose", "ose-emulator")


    }
    getConfigJson() {
        // getting Config json , which contains the component information
        let jsonPath = vscode.Uri.joinPath(this.context.extensionUri, "media", "package_manager", "config", "config.json");
        let configData = "";
        try {
            configData = fs.readFileSync(jsonPath.fsPath, "utf8");
            return JSON.parse(configData);
        } catch (e) {
            return null;
        }
    }
    getFileTypeCode() {
        let osStr = os.platform().toLowerCase();
        switch (osStr) {
            case "win32":
                return "SW6"

            case "linux":
                return "SL6"

            case "darwin":
                return "SMC";
        }
    }
    assignSortOrder(newEntries, sdk, compName) {
        let oldEntries = this.configJson[sdk][compName];
        let newSorderOrder = oldEntries.length + 1;
        newEntries.forEach((newE, index) => {

            let isEntryFound = false
            for (let i = 0; i < oldEntries.length; i++) {
                if (oldEntries[i]["subDirName"] == newE["subDirName"]) {
                    newE["sortOrder"] = oldEntries[i]["sortOrder"];
                    isEntryFound = true;
                    break;
                }
            }
            if (!isEntryFound) {
                newE["sortOrder"] = newSorderOrder++;// index + 1
            }
        });
        return newEntries;
    }
}
exports.AutoUpdate = AutoUpdate;