/*
 * Copyright (c) 2021-2022 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

const vscode = require("vscode");
const util = require("util");
const fs = require("fs");
const sudoExec = util.promisify(require("sudo-prompt-alt").exec);
const os = require("os");
const { isElevated } = require("./lib/isElevated");

const { DownloaderHelper } = require('node-downloader-helper');
const createDesktopShortcut = require("create-desktop-shortcuts");
const fetch = require("node-fetch");
const path = require("path");
const checkDiskSpace = require("check-disk-space").default;
const exec = util.promisify(require("child_process").exec);
const { compareVersions, satisfies, compare } = require("compare-versions");
const cp = require("child_process");
const _7z = require("7zip-min");
const { logger } = require('./lib/logger');


const ignoreList = [
  // # All
  '^npm-debug\\.log$', // Error log for npm
  '^\\..*\\.swp$', // Swap file for vim state
  // # macOS
  '^\\.DS_Store$', // Stores custom folder attributes
  '^\\.AppleDouble$', // Stores additional file resources
  '^\\.LSOverride$', // Contains the absolute path to the app to be used
  '^Icon\\r$', // Custom Finder icon: http://superuser.com/questions/298785/icon-file-on-os-x-desktop
  '^\\._.*', // Thumbnail
  '^\\.Spotlight-V100(?:$|\\/)', // Directory that might appear on external disk
  '\\.Trashes', // File that might appear on external disk
  '^__MACOSX$', // Resource fork
  // # Linux
  '~$', // Backup file
  // # Windows
  '^Thumbs\\.db$', // Image file cache
  '^ehthumbs\\.db$', // Folder config file
  '^[Dd]esktop\\.ini$', // Stores custom folder attributes
  '@eaDir$', // Synology Diskstation "hidden" folder where the server stores thumbnails
];
let junkRegex = new RegExp(ignoreList.join('|'));

function isNotJunk(filename) {
  return !isJunk(filename);
}
function isJunk(filename) {
  return junkRegex.test(filename);
}




class ComponentMgr {
  constructor(context) {
    this.context = context;
    this.configJson = this.getConfigJson();
    this.preReqJson = this.getPreReqJson();
    this.statusJson = null;
    this.envPath = "";
    this.envPath_TV = "";
    this.dependancyJson = {};
    this.installManager = new InstallManager(this);

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
  async updateAvailableDiskspaceOnEnvPath() {
    // gets the Avalialble diskspace and send a msg to UI
    await checkDiskSpace(this.envPath).then((diskSpace) => {
      let dskSpace = Math.floor((diskSpace.free / 1024) / 1024);
      let dskSpaceStr = "";
      if (dskSpace >= 1024) {
        dskSpaceStr = Math.floor(dskSpace / 1024) + "GB"
      } else {
        dskSpaceStr = dskSpace + "MB"
      }
      let msgComp = {
        command: "DSKSPACE_UPDATE",
        data: {
          dskSpace: dskSpaceStr,
          isError: false,
        },
      };
      this.panel.webview.postMessage(msgComp);
    })

  }
  clearDownloadDir() {
    // clear the Download cache
    fs.readdirSync(path.join(this.envPath, "Downloads")).forEach((file) => {
      fs.rmSync(path.join(this.envPath, "Downloads", file), {
        recursive: true,
        force: true,
      });
    });

  }
  getPreReqJson() {
    // PreReq Json contains the Dependancy software information
    let jsonPath = vscode.Uri.joinPath(this.context.extensionUri, "media", "package_manager", "config", "preReq.json");
    let configData = "";
    try {
      configData = fs.readFileSync(jsonPath.fsPath, "utf8");
      return JSON.parse(configData);
    } catch (e) {
      // console.log("err " + e);
      return null;
    }
  }
  getDependancyJson() {

    this.dependancyJson["tv"] = this.getCompPreReqJsonStatusCompreWithVersion("tv")["tv"];
    this.dependancyJson["ose"] = this.getCompPreReqJsonStatusCompreWithVersion("ose")["ose"];
    this.dependancyJson["common"] = this.getCompPreReqJsonStatusCompreWithVersion("common")["common"];
  }
  addStatusJsonIfNotAvl() {
    // this will copy the Status json in the Config Dir
    let statusJson = {
      preReq: {},
      tv: {},
      ose: {},
      common: {}
    };

    let filePath = path.join(this.envPath, "Config", "status.json");
    //  if (!fs.existsSync(filePath)) {
    var dirname = path.dirname(filePath);
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(statusJson), "utf8");
    //}
  }
  addEnvIfMissing() {
    let tvsdk = this.getEnvVarValue("LG_WEBOS_TV_SDK_HOME");
    if (!tvsdk) {
      this.setAnyEnvVariable("LG_WEBOS_TV_SDK_HOME", path.join(this.envPath, "TV"))
    }
  
  }
  promptIfTVSDKInstallerIsAvailable() {
    let tvsdk = this.getEnvVarValue("LG_WEBOS_TV_SDK_HOME");
    let sdkHome = this.getEnvVarValue("LG_WEBOS_STUDIO_SDK_HOME");

    if (sdkHome && tvsdk) {

      if (fs.existsSync(tvsdk) && !tvsdk.includes(sdkHome)) {
        let isEmpty = false
        let files = fs.readdirSync(tvsdk).filter(isNotJunk)
        if (!files.length) {
          isEmpty = true;
        }
        if (!isEmpty) {
          vscode.window.showInformationMessage("webOS Studio",
            {
              detail: `Found TV SDK in ${tvsdk}, Please uninstall TV SDK to install TV components in Package Manager`,
              modal: true,
            }
          );

        }

      }

    }

  }
  addDirectoriesIfNotAvl() {
    // on Loading of the Package manager this will be called to create required dir if not available

    let dirname = path.join(this.envPath);
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }
    // add Resource
    dirname = path.join(this.envPath, "Tools");
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }
    // add downloads
    dirname = path.join(this.envPath, "Downloads");
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }
    // add tv
    dirname = path.join(this.envPath, "TV");
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }
    dirname = path.join(this.envPath, "OSE");
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }
    dirname = path.join(this.envPath, "Common");
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }
  }

  getStatusJson() {
    if (!this.statusJson) {
      let filePath = path.join(this.envPath, "Config", "status.json");
      let configData = "";
      try {
        configData = fs.readFileSync(filePath, "utf8");
        this.statusJson = JSON.parse(configData);
        return this.statusJson;
      } catch (e) {
        this.statusJson = null;
        // console.log("err " + e);
        return null;
      }
    } else {
      return this.statusJson;
    }
  }
  getCompPreReqJsonStatusCompreWithVersion(sdk) {
    // SDK/ COMP/
    let rObj = {};
    rObj[sdk] = {};
    let osStr = os.platform().toLowerCase();
    for (let i = 0; i < this.configJson[sdk]["components"].length; i++) {
      let comp = this.configJson[sdk]["components"][i]["type"];
      rObj[sdk][comp] = {};
      for (let j = 0; j < this.configJson[sdk][comp].length; j++) {
        let uid = this.configJson[sdk][comp][j]["comp_uid"];
        rObj[sdk][comp][uid] = {};
        let toolPreReq;
        if (osStr == "linux") {
          let uver = this.installManager.getUbuntuVersion();
          toolPreReq = this.preReqJson.dependencies[sdk][comp][osStr][uver];
        } else {
          toolPreReq = this.preReqJson.dependencies[sdk][comp][osStr][uid];
        }

        if (!toolPreReq) {
          toolPreReq = this.preReqJson.dependencies[sdk][comp][osStr]["-default-"];
        }
        if (toolPreReq) {

          let toolsReq = Object.keys(toolPreReq);
          for (let k = 0; k < toolsReq.length; k++) {
            rObj[sdk][comp][uid][toolsReq[k]] = {};
            rObj[sdk][comp][uid][toolsReq[k]]["displayName"] = this.preReqJson.toolDef[toolsReq[k]]["displayName"];
            rObj[sdk][comp][uid][toolsReq[k]]["shortName"] = this.preReqJson.toolDef[toolsReq[k]]["shortName"];
            rObj[sdk][comp][uid][toolsReq[k]]["isGlobalInstall"] = this.preReqJson.toolDef[toolsReq[k]]["isGlobalInstall"];
            rObj[sdk][comp][uid][toolsReq[k]]["description"] = this.preReqJson.toolDef[toolsReq[k]]["description"];
            rObj[sdk][comp][uid][toolsReq[k]]["reqVersion"] = toolPreReq[toolsReq[k]];
            rObj[sdk][comp][uid][toolsReq[k]]["installedVersion"] = this.statusJson["preReq"][toolsReq[k]] ? this.statusJson["preReq"][toolsReq[k]] : "";
            rObj[sdk][comp][uid][toolsReq[k]]["isInstalledReqVer"] = rObj[sdk][comp][uid][toolsReq[k]]["installedVersion"] != "" ? this.compareVersion(rObj[sdk][comp][uid][toolsReq[k]]["reqVersion"], rObj[sdk][comp][uid][toolsReq[k]]["installedVersion"]) : false;
            rObj[sdk][comp][uid][toolsReq[k]]["downloadInfo"] = this.getThePreReqInstallDetails(rObj[sdk][comp][uid][toolsReq[k]]["reqVersion"], this.preReqJson.tools[toolsReq[k]][osStr]);
          }
        }
      }
    }
    return rObj;
  }

  getThePreReqInstallDetails(reqVer, availableVerObjects) {
    let versions = Object.keys(availableVerObjects);
    let sortedVers = versions.sort(compareVersions);
    let fReqVer = reqVer
      .replace(">=", "")
      .replace("<=", "")
      .replace("==", "")
      .replace("<", "")
      .replace(">", "")
      .replace("=", "");
    let op = "";
    if (reqVer.includes(">=")) {
      op = ">=";
    } else if (reqVer.includes("<=")) {
      op = "<=";
    } else if (reqVer.includes("=")) {
      op = "=";
    } else if (reqVer.includes(">")) {
      op = ">";
    } else if (reqVer.includes("<")) {
      op = "<";
    } else {
      op = ">=";
    }

    switch (op) {
      case ">=":
        if (this.compareVersionWithoutOp(fReqVer, sortedVers[sortedVers.length - 1], op)) {
          let rObj = availableVerObjects[sortedVers[sortedVers.length - 1]];
          rObj["version"] = sortedVers[sortedVers.length - 1];
          return rObj;
        }
        break;

      case "=":
        {
          let rObj = availableVerObjects[fReqVer];
          rObj["version"] = fReqVer;
          return rObj;
        }

    }


    return {};
  }
  compareVersion(reqVer, instVer) {
    let rvalue = false;
    try {
      instVer = instVer.replace("r", ".").replace("_", ".");
      rvalue = satisfies(instVer, reqVer);
    } catch { }
    return rvalue;
  }
  compareVersionWithoutOp(reqVer, availableV, op) {
    let rvalue = false;
    try {
      availableV = availableV.replace("r", ".").replace("_", ".");
      rvalue = compare(availableV, reqVer, op);
    } catch (e) {
    }
    return rvalue;
  }

  reloadStatusJson() {
    let filePath = path.join(this.envPath, "Config", "status.json");
    let configData = "";
    try {
      configData = fs.readFileSync(filePath, "utf8");
      this.statusJson = configData;
      return JSON.parse(configData);
    } catch (e) {
      this.statusJson = null;

      return null;
    }
  }
  saveStatusJson(statusJson) {
    let filePath = path.join(this.envPath, "Config", "status.json");
    if (!fs.existsSync(filePath)) {
      var dirname = path.dirname(filePath);
      if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
      }
    }
    fs.writeFileSync(filePath, JSON.stringify(statusJson), "utf8");
    this.statusJson = statusJson;
  }
  addEnvVarInLinux(newVarLine) {
    // environment var in linux willbe added to three files
    return new Promise(async (resolve, reject) => {
      let filePath = path.join("~/.profile");
      let filePath2 = path.join("~/.bashrc");
      let filePath3 = path.join("~/.bash_profile");

      let command = `echo '${newVarLine}' >> ${filePath} &&  echo '${newVarLine}' >> ${filePath2} &&  echo '${newVarLine}' >> ${filePath3}`;
      await this.executeAnyCommand(command)
        .then((out) => {
          resolve();
        })
        .catch((err) => {
          // console.log("err", err);
          reject(err);
        });
    });
  }
  addEnvVarInMac(newVarLine) {
    // On mac Environment var will be added to Bash_Profile
    return new Promise(async (resolve, reject) => {
      let filePath = path.join("~/.bash_profile");
      let command = `echo '${newVarLine}' >> ${filePath} `;
      await this.executeAnyCommand(command)
        .then((out) => {
          resolve();
        })
        .catch((err) => {
          // console.log("err", err);
          reject(err);
        });
    });
  }

  getVboxCommandPath() {
    // if vbox command is throwing error, in case it is not updated in profile
    // get the vbox install path along with command and return
    let cmd = "vboxmanage --version";
    let stdout = this.executeCommandSync(cmd);
    if (stdout) {
      let v = stdout.replace("\r", "").replace("\n", "");
      if (v) {
        return "vboxmanage";
      } else {
        let vboxPath = this.getEnvVarValue("VBOX_MSI_INSTALL_PATH");
        if (vboxPath) {
          return `"${path.join(vboxPath, "vboxmanage")}"`;
        } else {
          return "vboxmanage";
        }
      }
    } else {
      let vboxPath = this.getEnvVarValue("VBOX_MSI_INSTALL_PATH");
      if (vboxPath) {
        return `"${path.join(vboxPath, "vboxmanage")}"`;
      } else {
        return "vboxmanage";
      }
    }
  }
  getPythonCommandPath_win() {
    // if python command is throwing error, in case it is not updated in profile
    // get the python install path along with command  and return
    let cmd = "python --version";
    let stdout = this.executeCommandSync(cmd);
    if (stdout) {
      let v = stdout.replace("\r", "").replace("\n", "");
      if (v) {
        return "python";
      } else {
        let pyPath = this.getEnvVarValue("PYTHON_INSTALL_PATH");
        if (pyPath) {
          return `"${path.join(pyPath, "python")}"`;
        } else {
          return "python";
        }
      }
    } else {
      let pyPath = this.getEnvVarValue("PYTHON_INSTALL_PATH");
      if (pyPath) {
        return `"${path.join(pyPath, "python")}"`;
      } else {
        return "python";
      }
    }
  }
  getWebOSLauncher_win() {
    // if webos-emulator  command is throwing error, in case it is not updated in profile
    // get the webos-emulator  install path along with command  and return
    let cmd = "webos-emulator --version";
    let stdout = this.executeCommandSync(cmd);
    if (stdout) {
      return "webos-emulator";
    } else {
      let pyPath = this.getEnvVarValue("PYTHON_INSTALL_PATH");
      if (pyPath) {
        return `"${path.join(pyPath, "Scripts", "webos-emulator")}"`;
      } else {
        return "webos-emulator";
      }
    }
  }

  async updatePreReqStatus() {

    // execute relevent commands for the preReq and get the version of installed 
    // and update the status json

    let osStr = os.platform().toLowerCase();
    try {
      let tools = Object.keys(this.preReqJson.toolDef);
      let rObj = {};
      for (let i = 0; i < tools.length; i++) {
        let key = tools[i];
        let command = "";
        switch (key) {
          case "nvm":
            command = "nvm version";
            if (osStr == "linux" || osStr == "darwin") {
              command = "nvm --version";
            }
            break;
          case "node":
            {
              let nvmnodejs = this.getEnvVarValue("NVM_SYMLINK");
              let nodePrg = "node.exe";
              if (osStr == "linux") {
                nodePrg = "node";
              } else if (osStr == "darwin") {
                nodePrg = "node";
              }
              if (nvmnodejs) {
                nodePrg = path.join(nvmnodejs, nodePrg);
              }
              command = `"${nodePrg}" --version`;
            }
            break;
          case "virtualbox":
            command = `${this.getVboxCommandPath()} --version`;
            break;

          case "jre":
            {
              let jrePrg = path.join(this.envPath_TV, "Resources", "Jre", "bin", "java");
              if (osStr == "linux") {
                command = `"${jrePrg}"` + " -version | head -1 | cut -f2 -d' '";
              } else if (osStr == "darwin") {

                jrePrg = path.join(this.envPath_TV, "Resources", "Jre", "Contents", "Home", "bin", "java");
                command = `"${jrePrg}"` + " -version | head -1 | cut -f2 -d' '";
              } else {
                command = `"${jrePrg}"` + " -version";
              }
            }
            break;
          case "python3":
            if (osStr == "linux" || osStr == "darwin") {
              command = "python3 --version";
            } else {
              command = `${this.getPythonCommandPath_win()} --version`;
            }

            break;

          case "webos-emulator-launcher":
            if (osStr == "linux") {
              command = " .  ~/.profile && webos-emulator --version";
            } else if (osStr == "darwin") {
              command =
                " source  ~/.bash_profile && webos-emulator --version";
            } else {
              command = `${this.getWebOSLauncher_win()} --version`;

            }

            break;
          case "brew":
            command = "brew --version";
            break;

          case "influxdb":
            {
              // check the influxdb dir and file exists
              let dirToCheck = path.join(this.envPath, "OSE", "ResourceMonitor", "influxdb")

              if (fs.existsSync(dirToCheck)) {
                let subdir = fs.readdirSync(dirToCheck);
                if (subdir.length > 0) {
                  let fileToCheck = ""
                  switch (osStr) {
                    case "win32":
                      fileToCheck = path.join(dirToCheck, subdir[0], "influx.exe")
                      break;
                    case "linux":
                      fileToCheck = path.join(dirToCheck, subdir[0], "influx")
                      break;
                    case "darwin":
                      fileToCheck = path.join(dirToCheck, subdir[0], "usr", "bin", "influx.exe")
                      break;
                  }

                  if (fs.existsSync(fileToCheck)) {
                    rObj[key] = "1.8.10"
                  }
                }
              }
            }
            break;
        }

        if (command != "") {
          if (osStr == "linux") {
            if (key == "nvm") {
              command = ". $HOME/.nvm/nvm.sh  && " + command;
            } else if (key == "node") {
              command = ".  ~/.profile &&  .  ~/.bashrc &&  " + command;
            } else if (key == "node" && rObj["nvm"]) {
              command = ".  ~/.bashrc && " + command;
            }
          } else if (osStr == "darwin") {

            if (key == "nvm") {
              command = "source ~/.bashrc && " + command;

            } else if (key == "node") {
              command = "source  ~/.bashrc  &&  " + command;
            } else if (key == "node" && rObj["nvm"]) {
              command = "source  ~/.bashrc && " + command;
            }
          }

          await exec(command)
            .then((data) => {
              switch (key) {
                case "nvm":
                  rObj[key] = data.stdout.replace("\r", "").replace("\n", "");
                  break;
                case "node":

                  rObj[key] = data.stdout
                    .replace("\r", "")
                    .replace("\n", "")
                    .replace("v", "");
                  // nvm required for node install , so if node is already insatled then no need to install nvm
                  // so  mark it as nvm installed 
                  if (rObj["node"]) {
                    if (!rObj["nvm"]) {
                      rObj["nvm"] = "0.0.1"

                    }

                  }
                  break;

                case "virtualbox":
                  rObj[key] = data.stdout.replace("\r", "").replace("\n", "");
                  break;

                case "jre":

                  if (!data.stderr.includes("No such file or directory")) {

                    rObj[key] = data.stderr
                      .split("\r")[0]
                      .replace("openjdk version ", "")
                      .replace('"', "")
                      .replace('"', "")
                      .replace("\n", "")
                      .split(" ")[0]
                      .trim();

                    rObj[key] = rObj[key].replace("OpenJDK", "")

                  }


                  break;
                case "python3":
                  rObj[key] = data.stdout
                    .replace("\r", "")
                    .replace("\n", "")
                    .replace("Python ", "");

                  break;
                case "webos-emulator-launcher":
                  rObj[key] = data.stdout
                    .replace("\r", "")
                    .replace("\n", "")
                    .replace("webos-emulator ", "");
                  break;
                case "brew":
                  rObj[key] = data.stdout
                    .split("\n")[0]
                    .replace("Homebrew", "")
                    .trim();

                  break;
              }
            })

            .catch((e) => {
              // console.error("Not Available-", command);
            });
        }
      }

      this.statusJson["preReq"] = rObj;
      this.saveStatusJson(this.statusJson);

    } catch (e) {
      // console.log("error-", e);

    }

  }
  async updateCompStatus() {

    // get the comp installed status and update status json 
    let osStr = os.platform().toLowerCase();
    let sdkLst = ["common", "tv", "ose"];

    for (let j = 0; j < sdkLst.length; j++) {
      try {
        let components = this.configJson[sdkLst[j]]["components"];
        for (let k = 0; k < components.length; k++) {
          let compDetailsJsonArray =
            this.configJson[sdkLst[j]][components[k]["type"]];
          let command = "";
          switch (components[k]["type"]) {
          
            case "ose-cli":
              {
                command = "ares -V";

                if (osStr == "darwin") {
                  command = "source ~/.bashrc && " + command;
                } else if (osStr == "linux") {
                  command = ". ~/.bashrc && " + command;
                }
                // ONLY ONE OSE CLI
                let comp_uid = compDetailsJsonArray[0]["comp_uid"];

                let stdout = this.executeCommandSync(command);
                if (stdout) {
                  let ver = stdout
                    .replace("Version:", "")
                    .replace("\r:", "")
                    .trim();
                  this.statusJson[sdkLst[j]][comp_uid] = {
                    sdk_version: ver,
                    location: "NPM_GLOBAL",
                  };
                } else {
                  delete this.statusJson[sdkLst[j]][comp_uid];
                }
              }
              break;
            case "int-cli":
              {
                command = "ares -V";

                if (osStr == "darwin") {
                  command = "source ~/.bashrc && " + command;
                } else if (osStr == "linux") {
                  command = ". ~/.bashrc && " + command;
                }
                // ONLY ONE Intgrated CLI
                let comp_uid = compDetailsJsonArray[0]["comp_uid"];

                let stdout = this.executeCommandSync(command);
                if (stdout) {
                  let ver = stdout
                    .replace("Version:", "")
                    .replace("\r:", "")
                    .trim();
                  this.statusJson[sdkLst[j]][comp_uid] = {
                    sdk_version: ver,
                    location: "NPM_GLOBAL",
                  };
                } else {
                  delete this.statusJson[sdkLst[j]][comp_uid];
                }
              }
              break;
            case "ose-emulator":
            case "tv-emulator":

              {
                let emulators = this.configJson[sdkLst[j]][components[k]["type"]];
                for (let f = 0; f < emulators.length; f++) {
                  // check is emulator instance is already created
                  let instanceName = "";
                  if (sdkLst[j] == "tv") {
                    if (emulators[f]["sdk_version"] != "1.2.0") {
                      instanceName = "LG webOS TV Emulator" + " " + emulators[f]["sdk_version"];
                    } else {
                      instanceName = "LG webOS TV Emulator";
                    }
                  } else if (sdkLst[j] == "ose") {
                    instanceName = "LG_webOS_OSE_Emulator_" + emulators[f]["sdk_version"];
                  }
                  if (instanceName != "") {
                    await this.installManager
                      .vbox_isInstanceNotAvailable(instanceName)
                      .then(() => {
                        let comp_uid = emulators[f]["comp_uid"];
                        delete this.statusJson[sdkLst[j]][comp_uid];
                      })
                      .catch((error) => {
                        // instance is available
                        if (!error) {
                          let comp_uid = emulators[f]["comp_uid"];
                          let sdk = this.configJson[sdkLst[j]];
                          let loc = path.join(
                            this.envPath,
                            sdk["subDirName"],
                            sdk["components"][k]["subDirName"],
                            emulators[f]["subDirName"]
                          );

                          this.statusJson[sdkLst[j]][comp_uid] = { sdk_version: emulators[f]["sdk_version"], location: loc, instName: instanceName, };
                        } else {
                          let comp_uid = emulators[f]["comp_uid"];
                          delete this.statusJson[sdkLst[j]][comp_uid];
                        }
                      });
                  }
                }
              }
              break;
            case "tv-simulator":
              {
                let simulators = this.configJson[sdkLst[j]][components[k]["type"]];

                let tvsdkPath = this.envPath_TV;//this.getEnvVarValue("LG_WEBOS_TV_SDK_HOME")
                if (tvsdkPath) {

                  for (let f = 0; f < simulators.length; f++) {
                    // check simulator dir exist or not

                    let fileToCheck = ""
                    switch (osStr) {
                      case "win32":
                        fileToCheck = simulators[f].subDirName + ".exe"
                        break;
                      case "linux":
                        fileToCheck = simulators[f].subDirName + ".appimage"
                        break;
                      case "darwin":
                        fileToCheck = simulators[f].subDirName + ".app"
                        break;
                    }
                    let pathToCheck = path.join(tvsdkPath, components[k].subDirName, simulators[f].subDirName, fileToCheck)
                    // console.log(pathToCheck)
                    let instanceName = simulators[f].displayName;
                    if (fs.existsSync(pathToCheck)) {
                      let comp_uid = simulators[f]["comp_uid"];
                      let sdk = this.configJson[sdkLst[j]];
                      let loc = path.join(tvsdkPath, components[k].subDirName, simulators[f].subDirName)

                      this.statusJson[sdkLst[j]][comp_uid] = { sdk_version: simulators[f]["sdk_version"], location: loc, instName: instanceName, };
                    } else {
                      let comp_uid = simulators[f]["comp_uid"];
                      delete this.statusJson[sdkLst[j]][comp_uid];
                    }

                  }
                }
              }
              break;
            case "tv-beanviser":
              {

                let beanvisers = this.configJson[sdkLst[j]][components[k]["type"]];

                let tvsdkPath = this.envPath_TV;// this.getEnvVarValue("LG_WEBOS_TV_SDK_HOME")
                if (tvsdkPath) {

                  for (let f = 0; f < beanvisers.length; f++) {
                    // check simulator dir exist or not

                    let fileToCheck = ""
                    switch (osStr) {
                      case "win32":
                        fileToCheck = "beanviser.cmd"
                        break;
                      case "linux":
                      case "darwin":
                        fileToCheck = "beanviser.sh"
                        break;
                    }
                    let pathToCheck = path.join(tvsdkPath, components[k].subDirName, fileToCheck)
                    let instanceName = beanvisers[f].displayName;
                    if (fs.existsSync(pathToCheck)) {
                      let comp_uid = beanvisers[f]["comp_uid"];
                      let sdk = this.configJson[sdkLst[j]];
                      let loc = path.join(tvsdkPath, components[k].subDirName)

                      this.statusJson[sdkLst[j]][comp_uid] = { sdk_version: beanvisers[f]["sdk_version"], location: loc, instName: instanceName, };
                    } else {
                      let comp_uid = beanvisers[f]["comp_uid"];
                      delete this.statusJson[sdkLst[j]][comp_uid];
                    }

                  }
                }
              }
              break;
            case "ose-workflowdesigner":
              {

                let wfdesingers = this.configJson[sdkLst[j]][components[k]["type"]];
                let skPath = path.join(this.envPath, "OSE")

                if (skPath) {

                  for (let f = 0; f < wfdesingers.length; f++) {
                    // check simulator dir exist or not

                    let fileToCheck = ""
                    switch (osStr) {
                      case "win32":
                        fileToCheck = "launch-workflow-designer.cmd"
                        break;
                      case "linux":
                      case "darwin":
                        fileToCheck = "launch-workflow-designer.sh"
                        break;
                    }
                    let pathToCheck = path.join(skPath, components[k].subDirName, fileToCheck)
                    // console.log(pathToCheck)
                    let instanceName = wfdesingers[f].displayName;
                    if (fs.existsSync(pathToCheck)) {
                      let comp_uid = wfdesingers[f]["comp_uid"];
                      let sdk = this.configJson[sdkLst[j]];
                      let loc = path.join(skPath, components[k].subDirName)

                      this.statusJson[sdkLst[j]][comp_uid] = { sdk_version: wfdesingers[f]["sdk_version"], location: loc, instName: instanceName, };
                    } else {
                      let comp_uid = wfdesingers[f]["comp_uid"];
                      delete this.statusJson[sdkLst[j]][comp_uid];
                    }

                  }
                }
              }
              break;
            case "ose-resourcemonitor":
              {

                let resMonitors = this.configJson[sdkLst[j]][components[k]["type"]];
                let skPath = path.join(this.envPath, "OSE")

                if (skPath) {

                  for (let f = 0; f < resMonitors.length; f++) {
                    // check simulator dir exist or not

                    let fileToCheck = ""
                    switch (osStr) {
                      case "win32":
                        fileToCheck = "grafana.exe"
                        break;
                      case "linux":
                      case "darwin":
                        fileToCheck = "grafana"
                        break;
                    }
                    let pathToCheck = path.join(skPath, components[k].subDirName, resMonitors[f].subDirName, "bin", fileToCheck)
                    let instanceName = resMonitors[f].displayName;
                    if (fs.existsSync(pathToCheck)) {
                      let comp_uid = resMonitors[f]["comp_uid"];
                      let sdk = this.configJson[sdkLst[j]];
                      let loc = path.join(skPath, components[k].subDirName)

                      this.statusJson[sdkLst[j]][comp_uid] = { sdk_version: resMonitors[f]["sdk_version"], location: loc, instName: instanceName, };
                    } else {
                      let comp_uid = resMonitors[f]["comp_uid"];
                      delete this.statusJson[sdkLst[j]][comp_uid];
                    }

                  }
                }
              }
              break;
          }


        }
        this.saveStatusJson(this.statusJson);

      } catch (e) {
        console.log("error-", e);

      }
    }

  }
  setInitialDir(evnFolderValue) {
    if (!fs.existsSync(evnFolderValue)) {
      fs.mkdirSync(evnFolderValue, { recursive: true });
    }
  }

  async setPackageMangerEnvPath(msgData) {
    // this will be called on setup time
    // set the Environment and Root Dir
    try {
      let output = null;
      switch (os.platform().toLowerCase()) {
        case "win32": {
          await exec(`setx ${msgData.envVarName} "${msgData.envVarValue}" /m`);
          process.env[msgData.envVarName] = msgData.envVarValue;
          output = await exec(`echo %${msgData.envVarName}%`);
          this.setInitialDir(msgData.envVarValue);
          break;
        }
        case "linux": {
          await exec(`export ${msgData.envVarName}="${msgData.envVarValue}"`);
          await exec(`. ~/.bashrc`);
          process.env[msgData.envVarName] = msgData.envVarValue;
          output = await exec(`printenv ${msgData.envVarName}`);
          await this.addEnvVarInLinux(
            `export ${msgData.envVarName}="${msgData.envVarValue}"`
          );
          await exec(`. ~/.profile`);
          break;
        }
        case "darwin": {
          await exec(`export ${msgData.envVarName}="${msgData.envVarValue}"`);
          await exec(`source ~/.bash_profile`);
          process.env[msgData.envVarName] = msgData.envVarValue;
          await this.addEnvVarInMac(
            `export ${msgData.envVarName}="${msgData.envVarValue}"`
          );
          output = await exec(`printenv ${msgData.envVarName}`);
          break;
        }
        default: {
          console.log("Error setting env path! error: Unknown platform!");
          break;
        }
      }
      if (output && output.stdout && output.stdout.trim().toLowerCase() === msgData.envVarValue.toLowerCase()) {
        msgData["isSet"] = true;

        let evalue = this.getEnvVarValue(msgData.envVarName);
        this.envPath = evalue;
        this.envPath_TV = path.join(evalue, "TV");

      } else {
        msgData["isSet"] = false;
        msgData["errMsg"] = "Error setting Environment";
        this.envPath = "";
        this.envPath_TV = ""
      }

      return msgData;
    } catch (error) {
      msgData["isSet"] = false;
      msgData["errMsg"] = error.message;
      this.envPath = "";
      return msgData;
    }
  }

  async setEnvPathVariableSync(pathValue) {
    // update the Path Environment value
    try {
      switch (os.platform().toLowerCase()) {
        case "win32": {
          if (!process.env.path.includes(pathValue + ";")) {
            process.env.path = pathValue + ";" + process.env.path;
            this.executeCommandSync(`setx /M PATH "%PATH%"`);
          }
          break;
        }
        case "linux": {
          this.executeCommandSync(`export PATH=$PATH:/"${pathValue}"`);
          this.executeCommandSync(`. ~/.bashrc`);

          break;
        }
        case "darwin": {
          this.executeCommandSync(`export PATH=$PATH:/"${pathValue}"`);
          this.executeCommandSync(`source ~/.bash_profile`);

          break;
        }
      }
    } catch (e) { }
  }
  async deleteEnvPathVariableSync(pathValue) {
    //Delete value from Env Path
    try {
      switch (os.platform().toLowerCase()) {
        case "win32": {
          if (process.env.path.includes(pathValue + ";")) {
            process.env.path = process.env.path.replace(pathValue + ";", "");
            this.executeCommandSync(`setx /M PATH "%PATH%"`);
          }
          break;
        }
        case "linux": {
          break;
        }
        case "darwin": {
          break;
        }
      }
    } catch (e) { }
  }
  async setAnyEnvVariable(envVarName, envVarValue) {
    // setting any environment variable
    return new Promise(async (resolve, reject) => {
      try {
        switch (os.platform().toLowerCase()) {
          case "win32": {
            await exec(`setx ${envVarName} "${envVarValue}" /m`);
            process.env[envVarName] = envVarValue;

            break;
          }
          case "linux": {
            await exec(`export ${envVarName}="${envVarValue}"`);
            await exec(`. ~/.bashrc`);
            process.env[envVarName] = envVarValue;

            await this.addEnvVarInLinux(
              `export ${envVarName}="${envVarValue}"`
            );
            await exec(`. ~/.profile`);

            break;
          }
          case "darwin": {
            await exec(`export ${envVarName}="${envVarValue}"`);

            await this.addEnvVarInMac(`export ${envVarName}="${envVarValue}"`);
            await exec(`source ~/.bash_profile`);
            process.env[envVarName] = envVarValue;

            break;
          }
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
  getEnvironment_pkgmgr(msgData) {

    let evalue = this.getEnvVarValue(msgData.envVarName);
    if (evalue != "" && evalue != null) {
      msgData["envVarValue"] = evalue;
      msgData["errMsg"] = "";
      this.envPath = evalue;
      this.envPath_TV = path.join(evalue, "TV");

    } else {
      msgData["envVarValue"] = "";
      msgData["errMsg"] = "Error getting Environment";
      this.envPath = "";
      this.envPath_TV = "";
    }
    return msgData;
  }
  getEnvVarValue(envVar) {
    if (process.env[envVar]) {
      return process.env[envVar];
    } else {
      let envValue = this.getEnvFromShell(envVar);

      return envValue;
    }
  }
  getEnvFromShell(envVar) {
    // in case of environment var is not availble in the current process execute directly from shell and get it
    let osStr = os.platform().toLowerCase();
    let cmd = "";
    if (osStr == "linux") {
      cmd = ". ~/.bash_profile && env";
    } else if (osStr == "darwin") {
      cmd = "source ~/.bash_profile && env";
    } else {
      cmd = "set `PATH=C` && set";
    }

    let stdOut = this.executeCommandSync(cmd);
    if (stdOut) {
      let envArray = stdOut.split("\n");
      for (let i = 0; i < envArray.length; i++) {
        if (envArray[i].includes(envVar + "=")) {
          return envArray[i].replace(envVar + "=", "").trim();
        }
      }
      return null;
    } else {
      return null;
    }
  }

  async checkPreReqOnCompInstall(msgData, panel) {

    let msgComp = {
      command: "CHECK_PREREQUISITES_COMPLETE",
      data: {
        ...msgData,
      },
    };

    // if (msgData.component == "tv-emulator" && !this.statusJson["tv"]["tv_cli_1"]) {

    //   logger.info("TV CLI not found, Please install TV CLI before launching TV Emulator")

    // }
    // check Admin previlate
    if (await isElevated()) {
      // ask for confiration for pre req install  if yes send   complete req
      let depObjs =
        this.dependancyJson[msgData.sdk][msgData.component][
        msgData.componentInfo.comp_uid
        ];
      // filter out installed items
      let itemKey = Object.keys(depObjs);
      let itemToInstall = {};
      let itemToInstallKey = [];
      let userPrompt = "";



      let installingDepText = "";
      for (let i = 0; i < itemKey.length; i++) {
        if (!depObjs[itemKey[i]]["isInstalledReqVer"] && !depObjs[itemKey[i]]["downloadInfo"]["isInstalling"] && !depObjs[itemKey[i]]["downloadInfo"]["isInstalled"]) {
          itemToInstallKey.push(itemKey[i]);
          itemToInstall[itemKey[i]] = depObjs[itemKey[i]];
          userPrompt = userPrompt + "\n" + `> ` + depObjs[itemKey[i]]["displayName"] + " v" + depObjs[itemKey[i]]["downloadInfo"]["version"];
        }

        // check any dependency is alredy installing
        if (
          this.installManager.installingDep.length > 0 &&
          this.installManager.installingDep.includes(itemKey[i])
        ) {
          installingDepText = installingDepText + "\n" + `> ` + depObjs[itemKey[i]]["displayName"];
        }

      }

      if (installingDepText) {
        msgComp["data"]["isSuccess"] = false;
        msgComp["data"]["message"] = "";//`Following prerequisites are installing  ${installingDepText} try after installing prerequisites`;
        panel.webview.postMessage(msgComp);
        const header = "Package Manager";
        const options = {
          detail: `Following prerequisites are being installed  ${installingDepText} \nTry after installing prerequisites`,
          modal: true,
        };
        vscode.window
          .showInformationMessage(header, options)
          .then((answer) => { });
        return;
      }
      // since resource monitor do is inbuilt with extenstion 
      //grafana sotware will be installed ,
      // grafana is not configured as preReq but as component, bcos there is nothing will be installed/uninstalled for resource monitor

      if (msgData["component"] == "ose-resourcemonitor") {
        userPrompt = ""
      }
      if (userPrompt != "") {
        const header = "Package Manager";
        const options = { detail: "Following software will be installed " + userPrompt + "\n\nDo you want to continue?", modal: true, };
        // 
        let msgCompPbarPauseStart = {
          command: "PAUSE_START_PRGBAR",
          data: {
            ...msgData,
          },
        };
        msgCompPbarPauseStart.data["isPaused"] = true;
        panel.webview.postMessage(msgCompPbarPauseStart);

        vscode.window
          .showInformationMessage(header, options, ...["Yes"])
          .then((answer) => {
            if (answer === "Yes") {
              msgCompPbarPauseStart.data["isPaused"] = false;
              panel.webview.postMessage(msgCompPbarPauseStart);
              this.installIfSpaceAvailable(panel, msgComp, itemToInstall, itemToInstallKey, msgData.sdk, msgData.component, msgData.componentInfo.comp_uid);
            } else {
              // do nothing
              msgComp["data"]["isSuccess"] = false;
              msgComp["data"]["message"] = "";//"User cancelled the installation";
              panel.webview.postMessage(msgComp);
            }
          });
      } else {
        this.installIfSpaceAvailable(panel, msgComp, itemToInstall, itemToInstallKey, msgData.sdk, msgData.component, msgData.componentInfo.comp_uid);
      }
    } else {
      // send msg
      msgComp["data"]["isSuccess"] = false;
      msgComp["data"]["message"] = "User do not have admin privilege. Please restart the VS Code with Admin Privilege";
      panel.webview.postMessage(msgComp);

    }
  }

  async installIfSpaceAvailable(panel, msgComp, itemToInstall, itemToInstallKey, sdk, comp, comp_uid) {
    // before installing check the sapce and continue

    checkDiskSpace(this.envPath).then((diskSpace) => {
      const availableSpace = Math.floor(diskSpace.free / 1048576);
      let reqSpace = this.getRequiredDiskspaceForPreReq(itemToInstall, itemToInstallKey) + this.getRequiredDiskspaceForComp(sdk, comp, comp_uid) + 300;
      // 300 mb buffer
      if (availableSpace > reqSpace) {
        this.updateInstStatusPreReqAndDepJson(
          itemToInstall,
          itemToInstallKey,
          sdk,
          comp,
          comp_uid,
          true
        );

        msgComp["data"]["isSuccess"] = true;
        msgComp["data"]["message"] = "Verification Done.. ";
        msgComp["data"]["depInstall"] = itemToInstall;
        msgComp["data"]["depInstallKey"] = itemToInstallKey;
        //Send CHECK_PREREQUISITES_COMPLETE message
        panel.webview.postMessage(msgComp);
      } else {
        msgComp["data"]["isSuccess"] = false;
        msgComp["data"]["message"] = "Not Enough Disk space, required -" + reqSpace + "MB";
        panel.webview.postMessage(msgComp);
      }
    });
  }
  getRequiredDiskspaceForPreReq(itemToInstall, itemToInstallKey) {
    let totalSize = 0;
    for (let i = 0; i < itemToInstallKey.length; i++) {
      totalSize = totalSize + parseInt(itemToInstall[itemToInstallKey[i]]["downloadInfo"]["expFileSizeInMB"]);
    }
    return totalSize;
  }
  getRequiredDiskspaceForComp(sdk, comp, comp_uid) {
    let config = this.configJson[sdk][comp];
    let totalSize = 0;
    for (let i = 0; i < config.length; i++) {
      if (config[i]["comp_uid"] == comp_uid) {
        totalSize = parseInt(config[i]["expFileSizeInMB"]);
        break;
      }
    }
    return totalSize;
  }
  updateInstStatusPreReqAndDepJson(itemToInstall, itemToInstallKey, sdk, comp, comp_uid, status) {
    let osStr = os.platform().toLowerCase();

    for (let i = 0; i < itemToInstallKey.length; i++) {
      let preReq = this.preReqJson["tools"][itemToInstallKey[i]][osStr][itemToInstall[itemToInstallKey[i]]["downloadInfo"]["version"]];
      preReq["isInstalling"] = status;
      this.dependancyJson[sdk][comp][comp_uid][itemToInstallKey[i]]["downloadInfo"]["isInstalling"] = status;
    }
  }
  updateInstStatusPreReqAndDepJsonById(key, version, status, sdk, comp, comp_uid, isInstalled) {
    let osStr = os.platform().toLowerCase();

    let preReq = this.preReqJson["tools"][key][osStr][version];
    preReq["isInstalling"] = status;
    this.dependancyJson[sdk][comp][comp_uid][key]["downloadInfo"]["isInstalling"] = status;

    preReq["isInstalled"] = isInstalled;
    this.dependancyJson[sdk][comp][comp_uid][key]["downloadInfo"]["isInstalled"] = isInstalled;

    this.installManager.installingDep = this.installManager.installingDep.filter((item) => {
      return item !== key;
    });
  }
  updateInstallingStatusPreReqAndDepJsonOfOtherDepOnError(status, sdk, comp, comp_uid, qItem) {
    let qItemMsgData = qItem["msgData"];
    let keys = Object.keys(qItemMsgData["depInstall"]);
    let osStr = os.platform().toLowerCase();
    for (let i = 0; i < keys.length; i++) {
      let version = qItemMsgData.depInstall[keys[i]]["downloadInfo"]["version"];
      let preReq = this.preReqJson["tools"][keys[i]][osStr][version];
      preReq["isInstalling"] = status;
      this.dependancyJson[sdk][comp][comp_uid][keys[i]]["downloadInfo"]["isInstalling"] = status;
      this.installManager.installingDep = this.installManager.installingDep.filter((item) => {
        return item !== keys[i];
      });
    }
  }

  async installCompAndDependancy(msgData, panel) {
    this.createCompDirecries(msgData);
    this.installManager.addToQueAndProcess(msgData, null, null, panel);
  }
  async cancelDownload(msgData) {
    this.installManager.cancelDownloader(msgData);
    this.clearAllDirOnCancel(msgData)
  }
  clearAllDirOnCancel(msgData) {

    let compInfo = null;
    if (msgData["comp_uid"] == "ose_resourcemonitor_1") {
      compInfo = {
        mainDir: "OSE",
        subDirName: "ResourceMonitor",
        subSubDirName: "",

      }
    } else {
      compInfo = this.getCompInfo(msgData["comp_uid"])
    }

    if (compInfo != null) {
      let dirPath = path.join(this.envPath, compInfo.mainDir, compInfo.subDirName, compInfo.subSubDirName)

      if (fs.existsSync(dirPath)) {
        try {


          fs.rmSync(dirPath, { recursive: true, force: true });
          var dirname = path.dirname(dirPath);

          if (path.basename(dirname) != "TV" && path.basename(dirname) != "OSE" && fs.readdirSync(dirname).filter(isNotJunk).length == 0) {
            this.removeDir(dirname);
          }
          if (msgData["comp_uid"] == "ose_resourcemonitor_1") {
            this.dependancyJson["ose"]["ose-resourcemonitor"]["ose_resourcemonitor_1"]["influxdb"]["downloadInfo"]["isInstalled"] = false
            this.dependancyJson["ose"]["ose-resourcemonitor"]["ose_resourcemonitor_1"]["influxdb"]["isInstalledReqVer"] = false
          }
        } catch (e) {
          console.log(e)
        }
      }

    }
  }
  getCompInfo(comp_uid) {
    let compInfo = this.getCompConfigInfo("tv", comp_uid);
    if (compInfo == null) {
      compInfo = this.getCompConfigInfo("ose", comp_uid);
    }
    return compInfo;



  }
  getCompConfigInfo(sdk, comp_uid) {

    let keys = Object.keys(this.configJson[sdk]);

    for (let i = 0; i < keys.length; i++) {
      if (keys[i] != "components" && keys[i] != "subDirName") {
        let def = this.configJson[sdk][keys[i]]
        for (let j = 0; j < def.length; j++) {
          if (def[j]["comp_uid"] == comp_uid) {
            console.log("found comp")

            let compInfo = {
              mainDir: this.configJson[sdk]["subDirName"],
              subSubDirName: def[j]["subDirName"],
            }
            for (let k = 0; k < this.configJson[sdk]["components"].length; k++) {
              if (this.configJson[sdk]["components"][k]["type"] == keys[i]) {
                compInfo["subDirName"] = this.configJson[sdk]["components"][k]["subDirName"]
              }
            }
            return compInfo;
          }
        }

      }


    }

    this.configJson[sdk]
  }
  handleCompUnInstallMsg(error, msgData, selComp) {
    let sdkErrMsg = {
      command: "ERROR_PACKAGE_MANAGER",
      data: { ...msgData },
      errMsg: error.message


    };
    this.panel.webview.postMessage(sdkErrMsg);
    logger.error(`${selComp.displayName} - ${error.message}`)

  }

  async unInstallComp(msgData, panel) {
    this.panel = panel;

    let msgComp = {
      command: "PRG_UPDATE",
      data: {
        row_uid: msgData.componentInfo.comp_uid,
        comp_uid: msgData.componentInfo.comp_uid,
        displayName: msgData.componentInfo.shortName,
        message: "Uninstalling",
        isError: false,
        step: "UNINSTALLING"
      },
    };
    this.panel.webview.postMessage(msgComp);

    // get comp install loation and remove the dir
    let compInstallInfo =
      this.statusJson[msgData.sdk][msgData.componentInfo.comp_uid];
    let compConfigInfs = this.configJson[msgData.sdk][msgData.component];
    let selComp = null;
    for (let i = 0; i < compConfigInfs.length; i++) {
      if (compConfigInfs[i]["comp_uid"] == msgData.componentInfo.comp_uid) {
        selComp = compConfigInfs[i];
        break;
      }
    }
    logger.info(`${selComp.displayName} - Uninstalling.`)

    // moved to timer functin as logger prints(above line )after finising in the uninstallation operaton
    setTimeout(async () => {
      switch (selComp.uninstallMethod) {
        case "OSE_CLI_UNINSTALL_FORALL": {
          let osStr = os.platform().toLowerCase();
          let command = ` npm uninstall -g @webosose/ares-cli `;
          if (osStr == "darwin") {
            command = "source ~/.bashrc && " + command;
          } else if (osStr == "linux") {
            command = ". ~/.bashrc && " + command;
          }
          msgComp["data"]["message"] = "Uninstalling via NPM";
          this.panel.webview.postMessage(msgComp);

          await this.uninstallFromNPM(command, msgComp)
            .then(() => {
              msgComp["command"] = "PRG_UPDATE_COMP";
              msgComp["data"]["message"] = "Uninstalled successfully";
              this.panel.webview.postMessage(msgComp);

              let instCompMsg = {
                command: "UNINSTALL_COMP_COMPLETE",
                data: {

                  sdk: msgData.sdk,
                  component: msgData.component,
                  componentInfo: {
                    sdk_version: msgData.componentInfo.sdk_version,
                    apiLevel: msgData.componentInfo.apiLevel,
                    comp_uid: msgData.componentInfo.comp_uid,
                  },
                },
              };
              this.panel.webview.postMessage(instCompMsg);
              logger.info(`${selComp.displayName} - Uninstalled.`)
              delete this.statusJson[msgData.sdk][msgData.componentInfo.comp_uid];
              this.saveStatusJson(this.statusJson);
            })
            .catch((error) => {
              msgComp["data"]["message"] = error.message;
              msgComp["data"]["isError"] = true;
              this.panel.webview.postMessage(msgComp);
              this.handleCompUnInstallMsg(error, msgData, selComp)
            });

          break;
        }
        case "INT_CLI_UNINSTALL_FORALL": {
          let osStr = os.platform().toLowerCase();
          let command = ` npm unlink @webosose/ares-cli -g`;
          // let command = ` npm uninstall -g @webosose/ares-cli `;

          if (osStr == "darwin") {
            command = "source ~/.bashrc && " + command;
          } else if (osStr == "linux") {
            command = ". ~/.bashrc && " + command;
          }
          msgComp["data"]["message"] = "Uninstalling via NPM";
          this.panel.webview.postMessage(msgComp);

          await this.uninstallFromNPM(command, msgComp)
            .then(() => {
              let compLocation = path.join(this.envPath, "Common", "CLI");
              this.removeDir(compLocation);

              msgComp["command"] = "PRG_UPDATE_COMP";
              msgComp["data"]["message"] = "Uninstalled successfully";
              this.panel.webview.postMessage(msgComp);

              let instCompMsg = {
                command: "UNINSTALL_COMP_COMPLETE",
                data: {

                  sdk: msgData.sdk,
                  component: msgData.component,
                  componentInfo: {
                    sdk_version: msgData.componentInfo.sdk_version,
                    apiLevel: msgData.componentInfo.apiLevel,
                    comp_uid: msgData.componentInfo.comp_uid,
                  },
                },
              };
              this.panel.webview.postMessage(instCompMsg);
              logger.info(`${selComp.displayName} - Uninstalled.`)
              delete this.statusJson[msgData.sdk][msgData.componentInfo.comp_uid];
              this.saveStatusJson(this.statusJson);
              vscode.commands.executeCommand('webos.updateProfile');
            })
            .catch((error) => {
              msgComp["data"]["message"] = error.message;
              msgComp["data"]["isError"] = true;
              this.panel.webview.postMessage(msgComp);
              this.handleCompUnInstallMsg(error, msgData, selComp)
            });

          break;
        }

        case "OSE_EMULATOR_UNINSTALL_FORALL":
        case "TV_EMULATOR_UNINSTALL_FORALL": {
          let instName = compInstallInfo["instName"];

          await this.installManager
            .vbox_getRunningInstance()
            .then(async (runningInstance) => {
              let commands = [];
              let vboxcmd = this.getVboxCommandPath();
              if (runningInstance.includes(`"${instName}"`)) {
                commands = [
                  `${vboxcmd} controlvm "${instName}" pause`,
                  `${vboxcmd} controlvm "${instName}" poweroff`,
                  `ping -${os.type() == "Windows_NT" ? "n" : "c"} 5 localhost `,
                  `${vboxcmd} unregistervm "${instName}" --delete`,
                ];
              } else {
                commands = [`${vboxcmd} unregistervm "${instName}" --delete`];
              }

              await this.installManager
                .exec_commands(commands.join(" && "))
                .then(async () => {
                  try {
                    this.removeVmdk(selComp, instName);
                  } catch { }
                  msgComp["command"] = "PRG_UPDATE_COMP";
                  msgComp["data"]["message"] = "Uninstalled successfully";
                  this.panel.webview.postMessage(msgComp);
                  delete this.statusJson[msgData.sdk][
                    msgData.componentInfo.comp_uid
                  ];
                  this.saveStatusJson(this.statusJson);
                  // send complete msg
                  let instCompMsg = {
                    command: "UNINSTALL_COMP_COMPLETE",
                    data: {
                      sdk: msgData.sdk,
                      component: msgData.component,
                      componentInfo: {
                        sdk_version: msgData.componentInfo.sdk_version,
                        apiLevel: msgData.componentInfo.apiLevel,
                        comp_uid: msgData.componentInfo.comp_uid,
                      },
                    },
                  };
                  this.panel.webview.postMessage(instCompMsg);
                  logger.info(`${selComp.displayName} - Uninstalled.`)
                })
                .catch((err) => {
                  this.handleCompUnInstallMsg(err, msgData, selComp)
                  logger.error(`${selComp.displayName} - ${err}`)

                });
            });


          break;
        }
        case "TV_SIMULATOR_UNINSTALL_FORALL": {
          try {
            let tvPath = this.envPath_TV;// this.getEnvVarValue("LG_WEBOS_TV_SDK_HOME");
            const desktopDir = path.join(os.homedir(), "Desktop");
            let osStr = os.platform().toLowerCase();

            if (tvPath) {
              let ext = ".lnk";
              if (osStr == "darwin") {
                ext = "";

              } else if (osStr == 'linux') {
                ext = ".desktop"
              }

              let tvEmulatorPath = path.join(tvPath, msgData.componentSubDirName, msgData.componentInfo.subDirName);
              this.removeDir(tvEmulatorPath);

              if (fs.readdirSync(path.join(tvPath, msgData.componentSubDirName)).filter(isNotJunk).length === 0) {
                this.removeDir(path.join(tvPath, msgData.componentSubDirName));
              }
              let linkfile = selComp.displayName + ext
              let shortcutPath = path.join(
                desktopDir,
                selComp.displayName + ext
              );

              fs.readdirSync(desktopDir).forEach((file) => {
                if (file == linkfile) {
                  fs.unlinkSync(shortcutPath);
                }
              });

            }



            msgComp["command"] = "PRG_UPDATE_COMP";
            msgComp["data"]["message"] = "Uninstalled successfully";
            this.panel.webview.postMessage(msgComp);
            delete this.statusJson[msgData.sdk][msgData.componentInfo.comp_uid];
            this.saveStatusJson(this.statusJson);

            // send complete msg
            let instCompMsg = {
              command: "UNINSTALL_COMP_COMPLETE",
              data: {
                sdk: msgData.sdk,
                component: msgData.component,
                componentInfo: {
                  sdk_version: msgData.componentInfo.sdk_version,
                  apiLevel: msgData.componentInfo.apiLevel,
                  comp_uid: msgData.componentInfo.comp_uid,
                },
              },
            };
            this.panel.webview.postMessage(instCompMsg);
            logger.info(`${selComp.displayName} - Uninstalled.`)
          } catch (error) {
            this.handleCompUnInstallMsg(error, msgData, selComp)
          }
          break;
        }
        case "TV_BEANVISER_UNINSTALL_FORALL": {
          try {
            let tvPath = this.envPath_TV;
            const desktopDir = path.join(os.homedir(), "Desktop");
            let osStr = os.platform().toLowerCase();

            if (tvPath) {
              let ext = ".lnk";
              if (osStr == "darwin") {
                ext = "";

              } else if (osStr == 'linux') {
                ext = ".desktop"
              }

              let tvBeanviserPath = path.join(tvPath, msgData.componentSubDirName);
              this.removeDir(tvBeanviserPath);
              let linkfile = selComp.displayName + ext
              let shortcutPath = path.join(
                desktopDir,
                selComp.displayName + ext
              );

              fs.readdirSync(desktopDir).forEach((file) => {
                if (file == linkfile) {
                  fs.unlinkSync(shortcutPath);
                }
              });

            }

            // remove environment variable

            msgComp["command"] = "PRG_UPDATE_COMP";
            msgComp["data"]["message"] = "Uninstalled successfully";
            this.panel.webview.postMessage(msgComp);
            delete this.statusJson[msgData.sdk][msgData.componentInfo.comp_uid];
            this.saveStatusJson(this.statusJson);

            // send complete msg
            let instCompMsg = {
              command: "UNINSTALL_COMP_COMPLETE",
              data: {
                sdk: msgData.sdk,
                component: msgData.component,
                componentInfo: {
                  sdk_version: msgData.componentInfo.sdk_version,
                  apiLevel: msgData.componentInfo.apiLevel,
                  comp_uid: msgData.componentInfo.comp_uid,
                },
              },
            };
            this.panel.webview.postMessage(instCompMsg);
            logger.info(`${selComp.displayName} - Uninstalled.`)
          } catch (error) {
            this.handleCompUnInstallMsg(error, msgData, selComp)
          }
          break;
        }
        case "OSE_WFDESIGNER_UNINSTALL_FORALL": {
          try {
            let sdkPath = this.envPath;//this.getEnvVarValue("LG_WEBOS_STUDIO_SDK_HOME");
            const desktopDir = path.join(os.homedir(), "Desktop");
            let osStr = os.platform().toLowerCase();

            if (sdkPath) {
              let ext = ".lnk";
              if (osStr == "darwin") {
                ext = "";

              } else if (osStr == 'linux') {
                ext = ".desktop"
              }

              let toolPath = path.join(sdkPath, "OSE", msgData.componentSubDirName);
              this.removeDir(toolPath);
              let linkfile = selComp.displayName + ext
              let shortcutPath = path.join(
                desktopDir,
                selComp.displayName + ext
              );

              fs.readdirSync(desktopDir).forEach((file) => {
                if (file == linkfile) {
                  fs.unlinkSync(shortcutPath);
                }
              });

            }
            msgComp["command"] = "PRG_UPDATE_COMP";
            msgComp["data"]["message"] = "Uninstalled successfully";
            this.panel.webview.postMessage(msgComp);
            delete this.statusJson[msgData.sdk][msgData.componentInfo.comp_uid];
            this.saveStatusJson(this.statusJson);

            // send complete msg
            let instCompMsg = {
              command: "UNINSTALL_COMP_COMPLETE",
              data: {
                sdk: msgData.sdk,
                component: msgData.component,
                componentInfo: {
                  sdk_version: msgData.componentInfo.sdk_version,
                  apiLevel: msgData.componentInfo.apiLevel,
                  comp_uid: msgData.componentInfo.comp_uid,
                },
              },
            };
            this.panel.webview.postMessage(instCompMsg);
            logger.info(`${selComp.displayName} - Uninstalled.`)
          } catch (error) {
            this.handleCompUnInstallMsg(error, msgData, selComp)
          }
          break;
        }
        case "OSE_RESMONITOR_UNINSTALL_FORALL": {
          try {
            let sdkPath = this.envPath;
            let osStr = os.platform().toLowerCase();

            if (sdkPath) {

              let toolPath = path.join(sdkPath, "OSE", msgData.componentSubDirName);//, msgData.componentInfo.subDirName
              this.removeDir(toolPath);

            }
            msgComp["command"] = "PRG_UPDATE_COMP";
            msgComp["data"]["message"] = "Uninstalled successfully";
            this.panel.webview.postMessage(msgComp);
            delete this.statusJson[msgData.sdk][msgData.componentInfo.comp_uid];
            this.dependancyJson[msgData.sdk]["ose-resourcemonitor"][msgData.componentInfo.comp_uid]["influxdb"]["downloadInfo"]["isInstalled"] = false
            this.dependancyJson[msgData.sdk]["ose-resourcemonitor"][msgData.componentInfo.comp_uid]["influxdb"]["isInstalledReqVer"] = false


            this.saveStatusJson(this.statusJson);

            // send complete msg
            let instCompMsg = {
              command: "UNINSTALL_COMP_COMPLETE",
              data: {
                sdk: msgData.sdk,
                component: msgData.component,
                componentInfo: {
                  sdk_version: msgData.componentInfo.sdk_version,
                  apiLevel: msgData.componentInfo.apiLevel,
                  comp_uid: msgData.componentInfo.comp_uid,
                },
              },
            };
            this.panel.webview.postMessage(instCompMsg);
            logger.info(`${selComp.displayName} - Uninstalled.`)
          } catch (error) {
            this.handleCompUnInstallMsg(error, msgData, selComp)
          }
          break;

        }
      }
      this.updateAvailableDiskspaceOnEnvPath();

    }, 1);
  }
  removeVmdk(selComp, instName) {
    let fileLocation = "";
    let compLocation = "";

    let version = "";
    switch (selComp.uninstallMethod) {
      case "OSE_EMULATOR_UNINSTALL_FORALL":
        {
          version = instName.replace("LG_webOS_OSE_Emulator_", "").trim();
          compLocation = path.join(this.envPath, "OSE", "Emulator");
          fileLocation = path.join(compLocation, "v" + version);
        }
        break;

      case "TV_EMULATOR_UNINSTALL_FORALL":
        {
          if (instName == "LG webOS TV Emulator") {
            version = "1.2.0";
          } else {
            version = instName.replace("LG webOS TV Emulator", "").trim();
          }
          compLocation = path.join(this.envPath, "TV", "Emulator");
          fileLocation = path.join(compLocation, "v" + version);
        }
        break;
    }
    if (fileLocation != "") {
      try {
        this.removeDir(fileLocation);

        if (fs.readdirSync(compLocation).filter(isNotJunk).length == 0) {
          this.removeDir(compLocation);
        }
        const desktopDir = path.join(os.homedir(), "Desktop");
        let osStr = os.platform().toLowerCase();

        let ext = ".lnk";
        if (osStr == "darwin") {
          ext = "";

        } else if (osStr == 'linux') {
          ext = ".desktop"
        }

        let shortcutPath = path.join(
          desktopDir,
          selComp.displayName + " " + version + ext
        );
        let linkfile = selComp.displayName + " " + version + ext


        fs.readdirSync(desktopDir).forEach((file) => {
          if (file == linkfile) {
            fs.unlinkSync(shortcutPath);
          }
        });

      } catch { }
    }

  }
  removeDir(installedPath) {
    try {
      fs.rmSync(installedPath, { recursive: true, force: true });
      return true;
    } catch (e) {
      logger.info("Unable to remove the folder -" + installedPath + " , Please remove manually ")
      logger.error("Error removing -" + installedPath + " - " + e.message)
      return false;
    }

  }
  executeCommandSync(command) {
    try {
      let stdout = cp
        .execSync(command, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 })
        .toString();
      return stdout;
    } catch (e) {
      return null;
    }
  }
  executeAnyCommand(command) {
    return new Promise(async (resolve, reject) => {
      cp.exec(command, (error, stdout, stderr) => {

        if (error) {
          // console.log(error);
          reject(error);
        }
        if (stderr) {
          // console.log(stderr);
        }
        resolve(stdout);
      });
    });
  }
  getNPMProgram(withoutProfileLoader) {
    let osStr = os.platform().toLowerCase();
    let profileLoader = "";
    if (osStr == "linux") {
      profileLoader = " . ~/.profile && ";
    } else if (osStr == "darwin") {
      profileLoader = " source ~/.bashrc && ";
    }
    let nvmnodejs = this.getEnvVarValue("NVM_SYMLINK");
    let whichcommand = ""
    if (osStr == "win32") {
      whichcommand = "where npm"
    } else {
      whichcommand = "which npm"
    }
    let npmPrg = this.executeCommandSync(whichcommand)
    if (npmPrg == null) {
      npmPrg = "npm"
    } else {
      npmPrg = npmPrg.split("\n")[0];//replace("\n","")
    }

    if (nvmnodejs) {
      npmPrg = `"${path.join(nvmnodejs, "npm")}"`;
    } else {
      npmPrg = `"${npmPrg}"`
    }
    if (withoutProfileLoader) {
      return npmPrg.replace(/\"/g, '')

    } else {
      return `${profileLoader} ${npmPrg}`

    }
  }
  getNpmGloablFolder() {
    let command = `${this.getNPMProgram()} root -g `;
    let outStr = this.executeCommandSync(command)
    return outStr.split("\n")[0]


  }
  async uninstallFromNPM(command, comp_uid) {
    return new Promise(async (resolve, reject) => {
      let osStr = os.platform().toLowerCase();
      let cmd = ""

      if (osStr == "darwin" || osStr == "linux") {
        let nodeGFloder = this.getNpmGloablFolder()

        cmd = "chmod -R 777 " + nodeGFloder

      }
      if (osStr == "darwin") {
        await this.installManager
          .executeSudoCommand(cmd, false)
          .then(async () => {
            await this.executeAnyCommand(command)
              .then(() => {
                resolve();
              })
              .catch((error) => {
                reject(error);
              });
          })
          .catch((error) => {
            reject(error);
          });
      } else if (osStr == "linux") {


        await this.installManager
          .executeSudoCommand(cmd, false)
          .then(async () => {
            await this.installManager.executeAnyCommand(command)
              .then(() => {
                resolve();
              })
              .catch((error) => {
                reject(error);
              });
          })
          .catch((error) => {
            reject(error);
          });
      }

      else {
        await this.executeAnyCommand(command)
          .then(() => {
            resolve();
          })
          .catch((error) => {
            reject(error);
          });
      }
    });
  }

  createCompDirecries(msgData) {
    // create sdk dir
    if (msgData.component == "ose-cli" || msgData.componentSubDirName == "jre" || msgData.componentSubDirName == "webos-emulator-launcher") {
      return;
    }

    let filePath = path.join(this.envPath, msgData.sdkSubDirName);
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath, { recursive: true });
    }

    // create comp dir
    filePath = path.join(
      this.envPath,
      msgData.sdkSubDirName,
      msgData.componentSubDirName
    );
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath, { recursive: true });
    }
    // create comp dir
    if (msgData.componentInfo.subDirName != "") {
      filePath = path.join(
        this.envPath,
        msgData.sdkSubDirName,
        msgData.componentSubDirName,
        msgData.componentInfo.subDirName
      );
      if (!fs.existsSync(filePath)) {
        fs.mkdirSync(filePath, { recursive: true });
      }
    }

  }
}

class InstallManager {
  constructor(componentMgr) {
    this.componentMgr = componentMgr;
    this.downloadQue = [];
    this.panel = null;
    this.downloadedFileName = "";
    this.processingQIndex = -1;
    this.installingDep = [];
    this.downloaders = {}
    this.sudoPWD = null;
  }
  removeQItem(qItem) {
    qItem["isProcessed"] = true;
  }
  qRejectHandlerForPreReq(err, msgComp, depInstallItem, qItem, key) {
    msgComp["command"] = "PRG_UPDATE_COMP";
    msgComp["data"]["message"] = err.message;
    msgComp["data"]["isError"] = true;
    this.panel.webview.postMessage(msgComp);

    this.sendQErrMsg({ message: err["code"] == "ERR_REQUEST_CANCELLED" ? "" : "Failed to install Pre-requisites" }, qItem);
    this.componentMgr.updateInstallingStatusPreReqAndDepJsonOfOtherDepOnError(false, qItem.msgData.sdk, qItem.msgData.component, qItem.msgData.componentInfo.comp_uid, qItem);
    // update inst status for other prequest and compoonents
    this.removeQItem(qItem);
    logger.error(`${depInstallItem.displayName} ${depInstallItem["downloadInfo"]["version"]} ${err.message} `)
    this.componentMgr.clearAllDirOnCancel({ comp_uid: qItem.msgData.componentInfo.comp_uid, isComp: false })

  }
  qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem) {
    let msgComp = {
      command: "PRG_UPDATE_COMP",
      data: {
        row_uid: comp_uid + "_" + key,
        comp_uid: comp_uid,
        message: "Installed successfully",
        ver: depInstallItem["downloadInfo"]["version"],
        isError: false,
        isPreReqCom: true,
        key: key,

      },
    };
    this.panel.webview.postMessage(msgComp);
    logger.info(`${depInstallItem.displayName} ${depInstallItem["downloadInfo"]["version"]} Installed successfully `)

    this.componentMgr.updateInstStatusPreReqAndDepJsonById(
      key,
      depInstallItem["downloadInfo"]["version"],
      false,
      qItem.msgData.sdk,
      qItem.msgData.component,
      qItem.msgData.componentInfo.comp_uid,
      true
    );
    this.componentMgr.updateAvailableDiskspaceOnEnvPath();
  }
  qRejectHandlerForComp(err, msgComp, qItem) {
    msgComp["command"] = "PRG_UPDATE_COMP";
    msgComp["data"]["message"] = err.message;
    msgComp["data"]["isError"] = true;
    this.panel.webview.postMessage(msgComp);
    this.sendQErrMsg(err, qItem);
    // send error msg

    this.removeQItem(qItem);
    logger.error(`${qItem.msgData.componentInfo.displayName} ${err.message}`)
    this.componentMgr.clearAllDirOnCancel({ comp_uid: qItem.msgData.componentInfo.comp_uid, isComp: true })
  }
  qCompletionHandlerForComp(msgComp, qItem) {
    msgComp["command"] = "PRG_UPDATE_COMP";
    msgComp["data"]["message"] = "Installed successfully";
    this.panel.webview.postMessage(msgComp);
    // send instComp Messge

    this.componentMgr.saveStatusJson(this.componentMgr.statusJson);

    let instCompMsg = {
      command: "INSTALL_COMP_COMPLETE",
      data: {
        sdk: qItem.msgData.sdk,
        component: qItem.msgData.component,
        componentInfo: {
          sdk_version: qItem.msgData.componentInfo.sdk_version,
          apiLevel: qItem.msgData.componentInfo.apiLevel,
          comp_uid: qItem.msgData.componentInfo.comp_uid,
        },
      },
    };
    this.panel.webview.postMessage(instCompMsg);
    this.removeQItem(qItem);
    this.componentMgr.updateAvailableDiskspaceOnEnvPath();
    logger.info(`${qItem.msgData.componentInfo.displayName} Installed successfully`)
  }
  removeProcessedQueitemAndProcessQue() {
    const filtered = this.downloadQue.filter((el) => {
      return el.isProcessed == false;
    });
    this.downloadQue = filtered;
    if (this.downloadQue.length > 0) {
      setTimeout(() => {
        this.processQue();
      }, 100);
    }
  }
  async processQue() {
    for (let i = 0; i < this.downloadQue.length; i++) {
      let qItem = this.downloadQue[i];
      this.processingQIndex = i;
      if (qItem.isProcessing) {
        continue;
      }
      if (qItem.isProcessed) {
        continue;
      }

      qItem["isProcessing"] = true;
      // install dependancy first

      for (let j = 0; j < qItem.msgData.depInstallKey.length; j++) {
        if (this.downloadQue[i].isProcessed) {
          continue;
        }
        let key = qItem.msgData.depInstallKey[j];

        let depInstallItem = qItem.msgData.depInstall[key];
        let comp_uid = qItem.msgData.componentInfo.comp_uid;
        await this.componentMgr.updatePreReqStatus();
        switch (depInstallItem.downloadInfo.installMethod) {
          case "OSE_INSTALL_CLI_NVM_WIN":
            {
              // download

              let msgComp = {
                command: "PRG_UPDATE",
                data: {
                  row_uid: comp_uid + "_" + key,
                  comp_uid: comp_uid,
                  displayName: depInstallItem.shortName,
                  message: "Downloading",
                  step: "DOWNLOADING",
                  isError: false,
                },
              };
              this.panel.webview.postMessage(msgComp);
              await this.downloadDepItem(depInstallItem.downloadInfo, comp_uid, key, qItem, depInstallItem)

                .then(async () => {
                  msgComp["data"]["message"] = "Downloaded successfully";
                  msgComp["data"]["step"] = "DOWNLOADING";
                  msgComp["data"]["val"] = 50;
                  this.panel.webview.postMessage(msgComp);

                  // unzip file
                  msgComp["data"]["message"] = "Extracting";
                  msgComp["data"]["step"] = "EXTRACTING"
                  this.panel.webview.postMessage(msgComp);

                  let destPath = "";
                  destPath = path.join(
                    this.componentMgr.envPath,
                    "Tools",
                    key,
                    "v" + depInstallItem["downloadInfo"]["version"]
                  );

                  await this.unzipFile(
                    path.join(
                      this.componentMgr.envPath,
                      "Downloads",
                      qItem["downloadedFileName"]

                    ),
                    destPath,
                    comp_uid + "_" + key,
                    depInstallItem
                  )
                    .then(async () => {
                      msgComp["data"]["message"] = "Extracted successfully";
                      this.panel.webview.postMessage(msgComp);

                      if (!fs.existsSync(path.join(destPath, "nodejs"))) {
                        fs.mkdirSync(path.join(destPath, "nodejs"), { recursive: true });
                      }

                      if (!fs.existsSync(path.join(destPath, "settings.txt"))) {
                        var dirname = path.dirname(
                          path.join(destPath, "settings.txt")
                        );
                        if (!fs.existsSync(dirname)) {
                          fs.mkdirSync(dirname, { recursive: true });
                        }

                        fs.writeFileSync(
                          path.join(destPath, "settings.txt"),
                          `root: ${destPath}
                        path: ${path.join(destPath, "nodejs")}
                        `,
                          "utf8"
                        );
                      }
                      this.panel.webview.postMessage(msgComp);
                      await this.componentMgr.setAnyEnvVariable(
                        "NVM_HOME",
                        destPath
                      );
                      await this.componentMgr.setAnyEnvVariable(
                        "NVM_SYMLINK",
                        path.join(destPath, "nodejs")
                      );
                      this.componentMgr.setEnvPathVariableSync(destPath);
                      this.componentMgr.setEnvPathVariableSync(
                        path.join(destPath, "nodejs")
                      );

                      this.qPreReqCompletionHandlerForPreReq(
                        comp_uid,
                        key,
                        depInstallItem,
                        qItem
                      );
                    })
                    .catch((err) => {
                      this.qRejectHandlerForPreReq(
                        err,
                        msgComp,
                        depInstallItem,
                        qItem,
                        key
                      );
                    });
                })
                .catch((error) => {
                  this.qRejectHandlerForPreReq(
                    error,
                    msgComp,
                    depInstallItem,
                    qItem,
                    key
                  );
                });
            }
            break;
          case "OSE_INSTALL_CLI_NVM_MAC":
          case "OSE_INSTALL_CLI_NVM_LINUX":
            {
              // download
              let osStr = os.platform().toLowerCase();
              let msgComp = {
                command: "PRG_UPDATE",
                data: {
                  row_uid: comp_uid + "_" + key,
                  comp_uid: comp_uid,
                  displayName: depInstallItem.shortName,
                  message: `Installing via ${osStr == "linux" ? "cURL" : "brew"}`,
                  step: "INSTALLING",
                  isError: false,
                },
              };
              this.panel.webview.postMessage(msgComp);
              let ver = qItem.msgData.depInstall[key]["downloadInfo"]["version"];
              logger.run(`${depInstallItem.displayName} ${depInstallItem["downloadInfo"]["version"]} - ${depInstallItem.downloadInfo.script} `)

              await this.executeAnyCommand(depInstallItem.downloadInfo.script)
                .then(async () => {

                  let command = "";
                  switch (osStr) {
                    case "linux":
                      command = `chmod -R  777 /home/.nvm`;
                      break;
                    case "darwin":
                      command = `echo 'source $(brew --prefix nvm)/nvm.sh ' >> ~/.bash_profile `

                      await this.executeSudoCommand(command, true);
                      command = `echo 'source $(brew --prefix nvm)/nvm.sh ' >> ~/.bashrc `

                      break;
                  }
                  await this.executeSudoCommand(command, true);
                  this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                })
                .catch((error) => {
                  this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                });
            }
            break;
          case "OSE_INSTALL_CLI_NODE_WIN64":
            {
              let msgComp = {
                command: "PRG_UPDATE",
                data: {
                  row_uid: comp_uid + "_" + key,
                  comp_uid: comp_uid,
                  displayName: depInstallItem.shortName,
                  message: "Downloading",
                  step: "DOWNLOADING",
                  val: 0,
                  isError: false,
                },
              };
              this.panel.webview.postMessage(msgComp);

              if (this.componentMgr.getEnvVarValue("NVM_HOME")) {
                // install through nvm
                msgComp["data"]["message"] = "Installing via NVM";
                msgComp["data"]["step"] = "INSTALLING"
                this.panel.webview.postMessage(msgComp);
                let ver = qItem.msgData.depInstall[key]["downloadInfo"]["version"];
                let nvmpgm = path.join(this.componentMgr.getEnvVarValue("NVM_HOME"), "nvm");
                await this.executeAnyCommand(` "${nvmpgm}" install ${ver} && "${nvmpgm}" use ${ver} `)
                  .then(() => {
                    this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                  })
                  .catch((error) => {
                    this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                  });
              } else {
                await this.downloadDepItem(depInstallItem.downloadInfo, comp_uid, key, qItem, depInstallItem)
                  .then(async () => {
                    msgComp["data"]["message"] = "Installing";
                    msgComp["data"]["step"] = "INSTALLING";
                    this.panel.webview.postMessage(msgComp);

                    // run the script to install silent
                    let dlFile = path.join(this.componentMgr.envPath, "Downloads", qItem["downloadedFileName"]);
                    await this.executeCommand(` MsiExec.exe /i ${dlFile} /qn`, comp_uid, key, "Installing")
                      .then(() => {
                        this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                      })
                      .catch((error) => {
                        this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                      });
                  })
                  .catch((error) => {
                    this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                  });
              }
            }
            break;
          case "OSE_INSTALL_CLI_NODE_LINUX":
            {
              let msgComp = {
                command: "PRG_UPDATE",
                data: {
                  row_uid: comp_uid + "_" + key,
                  comp_uid: comp_uid,
                  displayName: depInstallItem.shortName,
                  message: "Downloading",
                  isError: false,
                },
              };
              if (this.componentMgr.statusJson["preReq"]["nvm"]) {
                // install through nvm
                msgComp["data"]["message"] = "Installing via NVM";
                msgComp["data"]["step"] = "INSTALLING"
                this.panel.webview.postMessage(msgComp);
                let ver =
                  qItem.msgData.depInstall[key]["downloadInfo"]["version"];
                let command = "";


                // add directory permission

                command = `chmod -R  777 $HOME/.nvm/ && . $HOME/.nvm/nvm.sh  &&  nvm install ${ver} && nvm use ${ver} && chmod -R  777  $HOME/.nvm/ `;

                await this.executeSudoCommand(command, false)
                  .then(() => {
                    this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                  })
                  .catch((error) => {
                    this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                  });
              } else {
                msgComp["data"]["message"] = "Installing";
                msgComp["data"]["step"] = "INSTALLING"
                this.panel.webview.postMessage(msgComp);
                logger.run(`${depInstallItem.displayName} ${depInstallItem["downloadInfo"]["version"]} - ${depInstallItem.downloadInfo.script} `)
                await this.executeAnyCommand(depInstallItem.downloadInfo.script)
                  .then(() => {
                    this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                  })
                  .catch((error) => {
                    this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                  });
              }
            }
            break;
          case "OSE_INSTALL_CLI_NODE_MAC":
            {
              let msgComp = {
                command: "PRG_UPDATE",
                data: {
                  row_uid: comp_uid + "_" + key,
                  comp_uid: comp_uid,
                  displayName: depInstallItem.shortName,
                  message: "Installing",
                  isError: false,
                },
              };


              let cmd = "source ~/.bashrc && nvm --version"
              let nvmV = this.componentMgr.executeCommandSync(cmd);

              if (nvmV) {

                // install through nvm
                msgComp["data"]["message"] = "Installing via NVM";
                msgComp["data"]["step"] = "INSTALLING"
                this.panel.webview.postMessage(msgComp);
                let ver = qItem.msgData.depInstall[key]["downloadInfo"]["version"];
                cmd = ` source ~/.bashrc && nvm install ${ver} && nvm use ${ver} `
                logger.run(`${depInstallItem.displayName} ${depInstallItem["downloadInfo"]["version"]} - ${cmd} `)
                await this.executeAnyCommand(cmd)
                  .then(() => {
                    this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                  })
                  .catch((error) => {
                    this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                  });
              } else {
                msgComp["data"]["message"] = "Installing";
                msgComp["data"]["step"] = "INSTALLING"
                this.panel.webview.postMessage(msgComp);
                logger.run(`${depInstallItem.displayName} ${depInstallItem["downloadInfo"]["version"]} - ${depInstallItem.downloadInfo.script} `)
                await this.executeSudoCommand(depInstallItem.downloadInfo.script, false) //(depInstallItem.downloadInfo.script)
                  .then(() => {
                    this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                  })
                  .catch((error) => {
                    this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                  });
              }
            }
            break;

          case "INSTALL_VBOX_WIN":
            {
              // download

              let msgComp = {
                command: "PRG_UPDATE",
                data: {
                  row_uid: comp_uid + "_" + key,
                  comp_uid: comp_uid,
                  message: "Downloading",
                  displayName: depInstallItem.shortName,
                  step: "DOWNLOADING",
                  val: 0,
                  isError: false,
                },
              };
              this.panel.webview.postMessage(msgComp);
              await this.downloadDepItem(depInstallItem.downloadInfo, comp_uid, key, qItem, depInstallItem)

                .then(async () => {
                  msgComp["data"]["val"] = 50;
                  msgComp["data"]["message"] = "Downloaded successfully";
                  this.panel.webview.postMessage(msgComp);

                  // unzip file
                  msgComp["data"]["step"] = "EXTRACTING"
                  msgComp["data"]["message"] = "Extracting";
                  this.panel.webview.postMessage(msgComp);

                  let ver = qItem.msgData.depInstall[key]["downloadInfo"]["version"];

                  // create a dir to
                  let desPathForextact = path.join(
                    this.componentMgr.envPath,
                    "Downloads",
                    "vboxTemp"
                  );
                  if (fs.existsSync(desPathForextact)) {
                    fs.rmSync(desPathForextact, {
                      recursive: true,
                      force: true,
                    });
                  }
                  fs.mkdirSync(desPathForextact, { recursive: true });

                  let srcPath = path.join(
                    this.componentMgr.envPath,
                    "Downloads",
                    qItem["downloadedFileName"]
                  );

                  if (qItem.msgData.depInstall[key]["installedVersion"] == "") {
                    // fresh installation  use silent installation
                    // msi installation throwing a prompt
                    msgComp["data"]["step"] = "INSTALLING"
                    msgComp["data"]["message"] = "Installing ";
                    this.panel.webview.postMessage(msgComp);

                    let vboxPath = path.join(
                      this.componentMgr.envPath,
                      "Tools",
                      "virtualbox"
                    );
                    if (!fs.existsSync(vboxPath)) {
                      fs.mkdirSync(vboxPath, { recursive: true });
                    }
                    let cmd = `"${srcPath}"  --msiparams INSTALLDIR="\\"${vboxPath}\\"" --silent --ignore-reboot `;
                    logger.run(`${depInstallItem.displayName} ${depInstallItem["downloadInfo"]["version"]} - ${cmd} `)
                    await this.executeAnyCommand(cmd)
                      .then(async () => {
                        await this.componentMgr.setAnyEnvVariable(
                          "VBOX_MSI_INSTALL_PATH",
                          vboxPath
                        );

                        this.componentMgr.setEnvPathVariableSync(vboxPath);
                        this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                      })
                      .catch((error) => {
                        this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                      });
                  } else {
                    let error = {
                      message:
                        "Unable to reinstall existing version of virtual box, please uninstall try again",
                    };

                    this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);

                  }
                })
                .catch((error) => {
                  this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                });
            }
            break;
          case "INSTALL_VBOX_LINUX":
            {
              let uVer = this.getUbuntuVersion();
              if (uVer != "") {
                depInstallItem.downloadInfo.location = depInstallItem.downloadInfo["location" + "_" + uVer];
              }
              let msgComp = {
                command: "PRG_UPDATE",
                data: {
                  row_uid: comp_uid + "_" + key,
                  comp_uid: comp_uid,
                  displayName: depInstallItem.shortName,
                  message: "Downloading",
                  step: "DOWNLOADING",
                  val: 0,
                  isError: false,
                },
              };
              this.panel.webview.postMessage(msgComp);
              await this.downloadDepItem(
                depInstallItem.downloadInfo,
                comp_uid,
                key,
                qItem,
                depInstallItem
              )
                .then(async () => {
                  msgComp["data"]["step"] = "INSTALLING"
                  msgComp["data"]["message"] = "Installing";
                  this.panel.webview.postMessage(msgComp);
                  let debfile = path.join(
                    this.componentMgr.envPath,
                    "Downloads",
                    qItem["downloadedFileName"]
                  );
                  let installScript = ` apt install -y '${debfile}'`;
                  logger.run(`${depInstallItem.displayName} ${depInstallItem["downloadInfo"]["version"]} - ${installScript} `)
                  await this.executeSudoCommand(installScript, false)
                    .then(async () => {
                      this.qPreReqCompletionHandlerForPreReq(
                        comp_uid,
                        key,
                        depInstallItem,
                        qItem
                      );
                    })
                    .catch((error) => {
                      if (
                        qItem.msgData.depInstall[key]["installedVersion"] != ""
                      ) {
                        error.message =
                          "Unable to reinstall existing version of virtual box, please uninstall try again";
                      }

                      this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                    });
                })
                .catch((error) => {
                  if (qItem.msgData.depInstall[key]["installedVersion"] != "") {
                    error.message =
                      "Unable to reinstall existing version of virtual box, please uninstall try again";
                  }
                  this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                });
              // todo
            }
            break;
          case "INSTALL_VBOX_MAC":
            {
              let msgComp = {
                command: "PRG_UPDATE",
                data: {
                  row_uid: comp_uid + "_" + key,
                  comp_uid: comp_uid,
                  displayName: depInstallItem.shortName,
                  message: "Downloading",
                  step: "DOWNLOADING",
                  val: 0,
                  isError: false,
                },
              };
              this.panel.webview.postMessage(msgComp);

              await this.downloadDepItem(depInstallItem.downloadInfo, comp_uid, key, qItem, depInstallItem)
                .then(async () => {
                  msgComp["data"]["message"] = "Downloaded successfully";
                  msgComp["data"]["val"] = 50;
                  this.panel.webview.postMessage(msgComp);
                  let ver =
                    qItem.msgData.depInstall[key]["downloadInfo"]["version"];
                  let srcPath = path.join(
                    this.componentMgr.envPath,
                    "Downloads",
                    qItem["downloadedFileName"]
                  );
                  msgComp["data"]["message"] = "Installing";
                  msgComp["data"]["step"] = "INSTALLING"
                  this.panel.webview.postMessage(msgComp);
                  let cmd = ` hdiutil attach "${srcPath}" &&  installer -pkg /Volumes/VirtualBox/VirtualBox.pkg -target "/Volumes/Macintosh HD"`;
                  logger.run(`${depInstallItem.displayName} ${depInstallItem["downloadInfo"]["version"]} - ${cmd} `)
                  await this.executeSudoCommand(cmd, false)
                    .then(async () => {
                      this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                    })
                    .catch((error) => {

                      if (
                        qItem.msgData.depInstall[key]["installedVersion"] != ""
                      ) {
                        error.message = "Unable to reinstall existing version of virtual box, please uninstall try again";
                      }
                      this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                    });
                })
                .catch((error) => {
                  if (qItem.msgData.depInstall[key]["installedVersion"] != "") {
                    error.message =
                      "Unable to reinstall existing version of virtual box, please uninstall try again";
                  }
                  this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                });
            }
            break;
          case "INSTALL_PYTHON3_WIN":
            {
              let msgComp = {
                command: "PRG_UPDATE",
                data: {
                  row_uid: comp_uid + "_" + key,
                  comp_uid: comp_uid,
                  displayName: depInstallItem.shortName,
                  message: "Downloading",
                  step: "DOWNLOADING",
                  val: 0,
                  isError: false,
                },
              };
              this.panel.webview.postMessage(msgComp);
              await this.downloadDepItem(depInstallItem.downloadInfo, comp_uid, key, qItem, depInstallItem)
                .then(async () => {
                  msgComp["data"]["val"] = 50;
                  msgComp["data"]["message"] = "Downloaded successfully";
                  this.panel.webview.postMessage(msgComp);
                  let ver =
                    qItem.msgData.depInstall[key]["downloadInfo"]["version"];
                  let srcPath = path.join(
                    this.componentMgr.envPath,
                    "Downloads",
                    qItem["downloadedFileName"]
                  );
                  msgComp["data"]["step"] = "INSTALLING"
                  msgComp["data"]["message"] = "Installing";
                  this.panel.webview.postMessage(msgComp);
                  //TargetDir
                  let pythonPath = path.join(
                    this.componentMgr.envPath,
                    "Tools",
                    "Python3"
                  );


                  if (!fs.existsSync(pythonPath)) {
                    fs.mkdirSync(pythonPath, { recursive: true });
                  }

                  let cmd = `"${srcPath}" /quiet TargetDir="${pythonPath}" InstallAllUsers=1 PrependPath=1 AppendPath=1 Include_test=0 `;
                  logger.run(`${depInstallItem.displayName} ${depInstallItem["downloadInfo"]["version"]} - ${cmd} `)
                  await this.executeAnyCommand(cmd)
                    .then(async () => {

                      await this.componentMgr.setAnyEnvVariable(
                        "PYTHON_INSTALL_PATH",
                        pythonPath
                      );
                      this.componentMgr.setEnvPathVariableSync(pythonPath);
                      this.componentMgr.setEnvPathVariableSync(path.join(pythonPath, "Scripts"));

                      this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                    })
                    .catch((error) => {
                      this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                    });
                })
                .catch((error) => {
                  this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                });
            }
            break;
          case "INSTALL_PYTHON3_MAC":
            {
              let msgComp = {
                command: "PRG_UPDATE",
                data: {
                  row_uid: comp_uid + "_" + key,
                  comp_uid: comp_uid,
                  displayName: depInstallItem.shortName,
                  message: "Downloading",
                  step: "DOWNLOADING",
                  va: 0,
                  isError: false,
                },
              };
              this.panel.webview.postMessage(msgComp);
              await this.downloadDepItem(depInstallItem.downloadInfo, comp_uid, key, qItem, depInstallItem)
                .then(async () => {
                  msgComp["data"]["val"] = 50;
                  msgComp["data"]["message"] = "Downloaded successfully";
                  this.panel.webview.postMessage(msgComp);
                  let ver = qItem.msgData.depInstall[key]["downloadInfo"]["version"];
                  let srcPath = path.join(
                    this.componentMgr.envPath,
                    "Downloads",
                    qItem["downloadedFileName"]
                  );
                  msgComp["data"]["step"] = "INSTALLING"
                  msgComp["data"]["message"] = "Installing";
                  this.panel.webview.postMessage(msgComp);
                  let cmd = ` installer -pkg "${srcPath}" -target  / `;
                  logger.run(`${depInstallItem.displayName} ${depInstallItem["downloadInfo"]["version"]} - ${cmd} `)
                  await this.executeSudoCommand(cmd, false)
                    .then(async () => {
                      this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                    })
                    .catch((error) => {
                      this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                    });
                })
                .catch((error) => {
                  this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                });
            }
            break;
          case "INSTALL_PYTHON3_LINUX":
            {
              let msgComp = {
                command: "PRG_UPDATE",
                data: {
                  row_uid: comp_uid + "_" + key,
                  comp_uid: comp_uid,
                  displayName: depInstallItem.shortName,
                  message: "Installing ",
                  step: "INSTALLING",
                  isError: false,
                },
              };
              this.panel.webview.postMessage(msgComp);
              let cmd = `apt-get -y install software-properties-common &&  add-apt-repository -y ppa:deadsnakes/ppa &&  apt-get -y update && apt-get -y install python${depInstallItem["downloadInfo"]["version"]}`;
              logger.run(`${depInstallItem.displayName} ${depInstallItem["downloadInfo"]["version"]} - ${cmd} `)
              await this.executeSudoCommand(cmd, false)
                //await this.executeAnyCommand(cmd)
                .then(async () => {
                  this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                })
                .catch((error) => {
                  this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                });
            }
            break;
          case "INSTALL_JRE_FOR_EMULATOR":
            {
              let msgComp = {
                command: "PRG_UPDATE",
                data: {
                  row_uid: comp_uid + "_" + key,
                  comp_uid: comp_uid,
                  displayName: depInstallItem.shortName,
                  message: "Downloading",
                  step: "DOWNLOADING",
                  val: 0,
                  isError: false,
                },
              };
              this.panel.webview.postMessage(msgComp);

              const respBaseUrl = await fetch(depInstallItem.downloadInfo.location).catch((err) => {
                this.qRejectHandlerForPreReq(err, msgComp, depInstallItem, qItem, key);
              });
              if (!respBaseUrl) return;

              const data = await respBaseUrl.json();
              let fileInfo = "";
              let osStr = os.platform().toLowerCase();
              switch (osStr) {
                case "linux":
                  fileInfo = "Resources_linux";
                  break;
                case "darwin":
                  fileInfo = "Resources_mac";
                  break;
                case "win32":
                  fileInfo = "Resources_win";
                  break;
              }
              let fileId = this.getFileId(data, fileInfo);

              const respCompUrl = await fetch("https://developer.lge.com/resource/tv/RetrieveToolDownloadUrl.dev?fileId=" + fileId)
                .catch((err) => {
                  this.qRejectHandlerForPreReq(err, msgComp, depInstallItem, qItem, key);
                });
              if (!respCompUrl) return;
              const respCompUrlData = await respCompUrl.json();

              let url = respCompUrlData["gftsUrl"].replace("http:", "https:");
              depInstallItem.downloadInfo.location = url;

              await this.downloadDepItem(depInstallItem.downloadInfo, comp_uid, key, qItem, depInstallItem)

                .then(async () => {
                  msgComp["data"]["val"] = 50;
                  msgComp["data"]["message"] = "Downloaded successfully";
                  this.panel.webview.postMessage(msgComp);

                  // unzip file
                  msgComp["data"]["step"] = "EXTRACTING"
                  msgComp["data"]["message"] = "Extracting";
                  this.panel.webview.postMessage(msgComp);

                  // JRE Should TV SDK HOME, else thow error in emulator
                  let destPath = this.componentMgr.envPath_TV;
                  await this.unzipFile(
                    path.join(
                      this.componentMgr.envPath,
                      "Downloads",
                      qItem["downloadedFileName"]
                    ), destPath, comp_uid + "_" + key, depInstallItem)
                    .then(async () => {
                      msgComp["data"]["message"] = "Extracted successfully";
                      this.panel.webview.postMessage(msgComp);

                      let osStr = os.platform().toLowerCase();

                      if (osStr == "darwin" || osStr == "linux") {

                        await this.executeSudoCommand(`chmod -R 777 "${path.join(destPath, "Resources")}"`, true);
                      }

                      this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                    })
                    .catch((err) => {
                      this.qRejectHandlerForPreReq(err, msgComp, depInstallItem, qItem, key);
                    });
                })
                .catch((error) => {
                  this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                });
            }
            break;
          case "INSTALL_BREW_MAC":
            {
              let msgComp = {
                command: "PRG_UPDATE",
                data: {
                  row_uid: comp_uid + "_" + key,
                  comp_uid: comp_uid,
                  displayName: depInstallItem.shortName,
                  message: "Installing ",
                  step: "INSTALLING",
                  isError: false,
                },
              };
              this.panel.webview.postMessage(msgComp);
              let cmd = `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`;
              logger.run(`${depInstallItem.displayName} ${depInstallItem["downloadInfo"]["version"]} - ${cmd} `)
              await this.executeSudoCommand(cmd, false)
                .then(async () => {
                  this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                })
                .catch((error) => {
                  this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                });
            }
            break;

          case "INSTALL_WEBOS_EMU_LAUNCHER":
            {
              let msgComp = {
                command: "PRG_UPDATE",
                data: {
                  row_uid: comp_uid + "_" + key,
                  comp_uid: comp_uid,
                  displayName: depInstallItem.shortName,
                  message: "Installing ",
                  step: "INSTALLING",
                  isError: false,
                },
              };

              this.panel.webview.postMessage(msgComp);
              let osStr = os.platform().toLowerCase();
              let pyPath = this.componentMgr.getPythonCommandPath_win();
              let cmd = `${pyPath} -m pip install --upgrade webos-emulator --force-reinstall`;
              if (osStr == "linux" || osStr == "darwin") {
                cmd = `python3 -m pip install --upgrade webos-emulator --force-reinstall`;
              }
              await this.exec_commands(cmd)
                .then(async (stdout) => {
                  if (
                    stdout.includes("Consider adding this directory to PATH")
                  ) {
                    let emuLauncherDir = this.getEmuLauncherPath(stdout);
                    if (emuLauncherDir != "") {
                      this.componentMgr.setEnvPathVariableSync(emuLauncherDir);
                    }
                  }
                  let pyPath = this.componentMgr.getEnvVarValue(
                    "PYTHON_INSTALL_PATH"
                  );
                  if (pyPath != "" && pyPath != null) {
                    this.componentMgr.setEnvPathVariableSync(path.join(pyPath, "Scripts"));
                  }

                  this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                })
                .catch((error) => {
                  this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                });
            }
            break;

          case "INSTALL_INFLUXDB_ALL":
            {
              let msgComp = {
                command: "PRG_UPDATE",
                data: {
                  row_uid: comp_uid + "_" + key,
                  comp_uid: comp_uid,
                  displayName: depInstallItem.shortName,
                  message: "Downloading",
                  step: "DOWNLOADING",
                  val: 0,
                  isError: false,
                },
              };
              this.panel.webview.postMessage(msgComp);
              let osStr = os.platform().toLowerCase();

              let destPath = path.join(
                this.componentMgr.envPath,
                "OSE",
                "ResourceMonitor",
                "influxdb"

              );

              await this.downloadDepItem(depInstallItem.downloadInfo, comp_uid, key, qItem, depInstallItem)

                .then(async () => {
                  msgComp["data"]["val"] = 50;
                  msgComp["data"]["message"] = "Downloaded successfully";
                  this.panel.webview.postMessage(msgComp);

                  // unzip file
                  msgComp["data"]["step"] = "EXTRACTING"
                  msgComp["data"]["message"] = "Extracting";
                  this.panel.webview.postMessage(msgComp);

                  switch (osStr) {
                    case "darwin":
                    case "linux": {
                      let desPathForextact = path.join(
                        this.componentMgr.envPath,
                        "Downloads",
                        "influxDbTemp"
                      );
                      if (fs.existsSync(desPathForextact)) {
                        fs.rmSync(desPathForextact, { recursive: true, force: true, });
                      }

                      await this.unzipFile(
                        path.join(
                          this.componentMgr.envPath,
                          "Downloads",
                          qItem["downloadedFileName"]
                        ), desPathForextact, comp_uid + "_" + key, depInstallItem)
                        .then(async () => {

                          let exFile = fs.readdirSync(desPathForextact).filter(isNotJunk);
                          await this.unzipFile(
                            path.join(desPathForextact, exFile[0]),
                            destPath,
                            comp_uid,
                            depInstallItem
                          ).then(async () => {
                            msgComp["data"]["message"] = "Extracted successfully";
                            this.panel.webview.postMessage(msgComp);
                            await this.executeSudoCommand(
                              `chmod -R 777 "${path.join(destPath)}"`, true
                            );
                            if (fs.existsSync(destPath)) {
                              let subdir = fs.readdirSync(destPath).filter(isNotJunk);
                              if (subdir.length > 0) {

                                this.updateSettingJson("influxdb", path.join(destPath, subdir[0]))

                              }
                            }



                            this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);
                          })
                            .catch((err) => {
                              this.qRejectHandlerForPreReq(err, msgComp, depInstallItem, qItem, key);
                            });
                        })


                    }
                      break;
                    case "win32": {
                      await this.unzipFile(
                        path.join(
                          this.componentMgr.envPath,
                          "Downloads",
                          qItem["downloadedFileName"]
                        ), destPath, comp_uid + "_" + key, depInstallItem)
                        .then(async () => {
                          msgComp["data"]["message"] = "Extracted successfully";
                          this.panel.webview.postMessage(msgComp);
                          if (fs.existsSync(destPath)) {
                            let subdir = fs.readdirSync(destPath).filter(isNotJunk);
                            if (subdir.length > 0) {
                              this.updateSettingJson("influxdb", path.join(destPath, subdir[0]))

                            }
                          }

                          this.qPreReqCompletionHandlerForPreReq(comp_uid, key, depInstallItem, qItem);

                        })
                        .catch((err) => {
                          this.qRejectHandlerForPreReq(err, msgComp, depInstallItem, qItem, key);
                        });
                    }
                      break;
                  }



                })
                .catch((error) => {
                  this.qRejectHandlerForPreReq(error, msgComp, depInstallItem, qItem, key);
                });
            }
            break;
        }

      }

      // dependancy installed
      // install the component
      if (qItem.isProcessed) {
        continue;
      }
      let comp_uid = qItem.msgData.componentInfo.comp_uid;



      switch (qItem.msgData.componentInfo.installMethod) {

        case "OSE_CLI_INSTALL_FORALL":
          {
            let msgComp = {
              command: "PRG_UPDATE",
              data: {
                row_uid: comp_uid,
                comp_uid: comp_uid,
                displayName: qItem.msgData.componentInfo.shortName,
                message: "Installing via NPM",
                step: "INSTALLING",
                isError: false,
              },
            };
            this.panel.webview.postMessage(msgComp);


            let osStr = os.platform().toLowerCase();
            let profileLoader = "";
            if (osStr == "linux") {
              profileLoader = " . ~/.profile && ";
            } else if (osStr == "darwin") {
              profileLoader = " source ~/.bashrc && ";
            }
            let npmPrg = this.componentMgr.getNPMProgram()
            let command = ` ${npmPrg} install -g  @webosose/ares-cli `;
            logger.run(`${qItem.msgData.componentInfo.shortName} - ${command} `)
            if (osStr == "darwin") {
              await this.executeSudoCommand(command, false)
                .then(async () => {
                  this.componentMgr.statusJson[qItem.msgData.sdk][qItem.msgData.componentInfo.comp_uid] = {
                    sdk_version: qItem.msgData.componentInfo.sdk_version,
                    location: "NPM_GLOBAL",
                  };

                  this.qCompletionHandlerForComp(msgComp, qItem);
                })
                .catch((error) => {
                  this.qRejectHandlerForComp(error, msgComp, qItem);
                });
            } else {
              await this.executeAnyCommand(command)
                .then(async () => {
                  this.componentMgr.statusJson[qItem.msgData.sdk][qItem.msgData.componentInfo.comp_uid] = {
                    sdk_version: qItem.msgData.componentInfo.sdk_version,
                    location: "NPM_GLOBAL",
                  };

                  this.qCompletionHandlerForComp(msgComp, qItem);
                })
                .catch((error) => {
                  this.qRejectHandlerForComp(error, msgComp, qItem);
                });
            }

          }
          break;
        case "INT_CLI_INSTALL_FORALL":
          {
            let msgComp = {
              command: "PRG_UPDATE",
              data: {
                row_uid: comp_uid,
                comp_uid: comp_uid,
                displayName: qItem.msgData.componentInfo.shortName,
                message: "Installing via NPM",
                step: "INSTALLING",
                isError: false,
              },
            };
            this.panel.webview.postMessage(msgComp);
            let destPath = path.join(
              this.componentMgr.envPath,
              qItem.msgData.sdkSubDirName,
              qItem.msgData.componentSubDirName
            );
            let osStr = os.platform().toLowerCase();
            let profileLoader = "";
            if (osStr == "linux") {
              profileLoader = " . ~/.profile && ";
            } else if (osStr == "darwin") {
              profileLoader = " source ~/.bashrc && ";
            }
            let npmPrg = this.componentMgr.getNPMProgram()

            let gitPath = path.join(destPath, qItem.msgData.componentInfo.subDirName)
            let linkCommand = `${npmPrg} install &&  ${npmPrg} link `;
            let uninstallCommand = ` ${npmPrg} uninstall @webosose/ares-cli -g `
            let gitCommand = ` git clone ${qItem.msgData.componentInfo.repository}   `;
            logger.run(`${qItem.msgData.componentInfo.shortName} - ${gitCommand} `)
            if (fs.existsSync(gitPath)) {
              fs.rmSync(gitPath, { recursive: true, force: true, });
            }
            await this.executeAnyCommand(uninstallCommand)

            await this.executeAnyCommand(gitCommand, { cwd: destPath })
              .then(async () => {

                await this.executeAnyCommand(linkCommand, { cwd: gitPath })
                  .then(async () => {
                    this.componentMgr.statusJson[qItem.msgData.sdk][qItem.msgData.componentInfo.comp_uid] = {
                      sdk_version: qItem.msgData.componentInfo.sdk_version,
                      location: "NPM_GLOBAL",
                    };
                    this.componentMgr.setAnyEnvVariable("WEBOS_CLI_TV", path.dirname(path.join(this.componentMgr.getNPMProgram(true))))


                    this.qCompletionHandlerForComp(msgComp, qItem);
                  })
                  .catch((error) => {
                    this.qRejectHandlerForComp(error, msgComp, qItem);
                  });
              })
              .catch((error) => {
                this.qRejectHandlerForComp(error, msgComp, qItem);
              });
              vscode.commands.executeCommand('webos.updateProfile');

          }
          break;
        case "TV_EMULATOR_INSTALL_FORALL":
          {

            let msgComp = {
              command: "PRG_UPDATE",
              data: {
                row_uid: comp_uid,
                comp_uid: comp_uid,
                displayName: qItem.msgData.componentInfo.shortName,
                message: "Downloading",
                step: "DOWNLOADING",
                val: 0,
                isError: false,
              },
            };
            try {
              this.panel.webview.postMessage(msgComp);
              const respBaseUrl = await fetch(qItem.msgData.componentInfo.repository);
              const data = await respBaseUrl.json();
              let fileId = this.getFileId(
                data,
                qItem.msgData.componentInfo.sdk_version
              );

              const respCompUrl = await fetch("https://developer.lge.com/resource/tv/RetrieveToolDownloadUrl.dev?fileId=" + fileId)
                .catch((err) => {
                  this.qRejectHandlerForComp(err, msgComp, qItem);
                });
              if (!respCompUrl) return;
              const respCompUrlData = await respCompUrl.json();

              let url = respCompUrlData["gftsUrl"].replace("http:", "https:");

              await this.downloadCompItem(url, comp_uid, qItem)
                .then(async () => {
                  msgComp["data"]["val"] = 50;
                  msgComp["data"]["message"] = "Downloaded successfully";
                  this.panel.webview.postMessage(msgComp);

                  let destPath = path.join(
                    this.componentMgr.envPath,
                    qItem.msgData.sdkSubDirName
                  );
                  msgComp["data"]["step"] = "EXTRACTING"
                  msgComp["data"]["message"] = "Extracting";
                  this.panel.webview.postMessage(msgComp);
                  await this.unzipFile(path.join(this.componentMgr.envPath, "Downloads", qItem["downloadedFileName"]), destPath, comp_uid, qItem)
                    .then(async () => {
                      msgComp["data"]["message"] = "Adding Emulator Instance";
                      this.panel.webview.postMessage(msgComp);

                      let scriptPath = path.join(
                        destPath,
                        "Emulator",
                        qItem.msgData.componentInfo.subDirName
                      );

                      let instName = "LG webOS TV Emulator";
                      if (qItem.msgData.componentInfo.sdk_version != "1.2.0") {
                        instName = instName + " " + qItem.msgData.componentInfo.sdk_version;
                      }

                      await this.vbox_isInstanceNotAvailable(instName)
                        .then(async () => {
                          msgComp["data"]["message"] = "Adding Emulator Instance";
                          this.panel.webview.postMessage(msgComp);

                          let osStr = os.platform().toLowerCase();
                          if (osStr == "linux" || osStr == "darwin") {
                            await this.executeAnyCommand(`chmod -R 777 "${scriptPath}"`);
                          }

                          await this.vbox_addNew_TV_Instance(scriptPath)
                            .then(async (uuid) => {
                              this.componentMgr.statusJson[qItem.msgData.sdk][qItem.msgData.componentInfo.comp_uid] = {
                                sdk_version: qItem.msgData.componentInfo.sdk_version,
                                location: scriptPath,
                                instName: instName,
                              };
                              try {
                                this.addShortcut(scriptPath, qItem.msgData.componentInfo.sdk_version, "TV_EMU", qItem.msgData.componentInfo.displayName);
                              } catch { }

                              this.qCompletionHandlerForComp(msgComp, qItem);
                            })
                            .catch((err) => {
                              // console.log("0", err);
                              this.qRejectHandlerForComp(err, msgComp, qItem);
                            });

                        })
                        .catch((err) => {
                          this.qRejectHandlerForComp({ message: "Emulator Instance Already available" }, msgComp, qItem);
                        });
                    })
                    .catch((err) => {
                      this.qRejectHandlerForComp(err, msgComp, qItem);
                    });
                })
                .catch((err) => {
                  this.qRejectHandlerForComp(err, msgComp, qItem);
                });
            } catch (err) {

              this.qRejectHandlerForComp(err, msgComp, qItem);
            }
          }
          break;
        case "OSE_EMULATOR_INSTALL_FORALL":
          {
            let msgComp = {
              command: "PRG_UPDATE",
              data: {
                row_uid: comp_uid,
                comp_uid: comp_uid,
                displayName: qItem.msgData.componentInfo.shortName,
                message: "Downloading",
                step: "DOWNLOADING",
                val: 0,
                isError: false,
              },
            };
            try {
              this.panel.webview.postMessage(msgComp);
              await this.downloadCompItem(qItem.msgData.componentInfo.repository, comp_uid, qItem)
                .then(async () => {
                  msgComp["data"]["val"] = 50;
                  msgComp["data"]["message"] = "Downloaded successfully";
                  this.panel.webview.postMessage(msgComp);

                  let destPath = path.join(
                    this.componentMgr.envPath,
                    qItem.msgData.sdkSubDirName,
                    qItem.msgData.componentSubDirName,
                    qItem.msgData.componentInfo.subDirName
                  );
                  msgComp["data"]["step"] = "EXTRACTING"
                  msgComp["data"]["message"] = "Extracting";
                  this.panel.webview.postMessage(msgComp);
                  await this.unzipFile(path.join(this.componentMgr.envPath, "Downloads", qItem["downloadedFileName"]), destPath, comp_uid, qItem)
                    .then(async () => {
                      await this.unzipFile(path.join(destPath, qItem["downloadedFileName"].replace(".bz2", "")), destPath, comp_uid, qItem)
                        .then(async () => {
                          msgComp["data"]["message"] = "Adding Emulator";
                          this.panel.webview.postMessage(msgComp);
                          let vmdkfileName = "";
                          fs.readdirSync(destPath).filter(isNotJunk).forEach((file) => {
                            if (file.toLowerCase().includes(".vmdk")) {
                              vmdkfileName = file;
                            }
                          });

                          let vmdk = path.join(destPath, vmdkfileName);
                          let instName = "LG_webOS_OSE_Emulator_" + qItem.msgData.componentInfo["sdk_version"];
                          await this.vbox_isInstanceNotAvailable(instName)
                            .then(() => {
                              // add instance
                              msgComp["data"]["message"] =
                                "Adding Emulator Instance";
                              this.panel.webview.postMessage(msgComp);

                              this.vbox_addNew_OSE_Instance(instName, vmdk)
                                .then(async () => {
                                  this.componentMgr.statusJson[qItem.msgData.sdk][qItem.msgData.componentInfo.comp_uid] = {
                                    sdk_version: qItem.msgData.componentInfo.sdk_version,
                                    location: destPath,
                                    instName: instName,
                                  };
                                  try {

                                    let osStr = os.platform().toLowerCase();
                                    let fileExt = "Launcher.bat"
                                    if (osStr == "linux") {
                                      fileExt = "Launcher.sh"
                                    } else if (osStr == "darwin") {
                                      fileExt = "Launcher.command"

                                    }

                                    // add Launcher
                                    this.addOseEmulatorLauncher(instName, destPath, fileExt);

                                    if (osStr == "linux" || osStr == "darwin") {
                                      await this.executeAnyCommand(
                                        `chmod -R 777 "${destPath}"`
                                      );
                                    }

                                    this.addShortcut(path.join(destPath, fileExt), qItem.msgData.componentInfo["sdk_version"], "OSE_EMU", qItem.msgData.componentInfo.displayName);
                                  } catch { }


                                  this.qCompletionHandlerForComp(msgComp, qItem);
                                })
                                .catch((err) => {
                                  this.qRejectHandlerForComp(err, msgComp, qItem);
                                });
                            })
                            .catch(() => {
                              this.qRejectHandlerForComp({ message: "Emulator Instance Already available", }, msgComp, qItem);
                              // instance Already available
                            });
                        })
                        .catch((error) => {
                          // console.log(error);
                        });
                    })
                    .catch((err) => {
                      this.qRejectHandlerForComp(err, msgComp, qItem);
                    });
                })
                .catch((err) => {
                  this.qRejectHandlerForComp(err, msgComp, qItem);
                });
            } catch (err) {

              this.qRejectHandlerForComp(err, msgComp, qItem);
            }
          }
          break;
        case "TV_SIMULATOR_INSTALL_FORALL":
          {

            let msgComp = {
              command: "PRG_UPDATE",
              data: {
                row_uid: comp_uid,
                comp_uid: comp_uid,
                displayName: qItem.msgData.componentInfo.shortName,
                message: "Downloading",
                step: "DOWNLOADING",
                val: 0,
                isError: false,
              },
            };
            try {
              this.panel.webview.postMessage(msgComp);
              const respBaseUrl = await fetch(qItem.msgData.componentInfo.repository)
                .catch((err) => {
                  this.qRejectHandlerForComp(err, msgComp, qItem);
                });
              if (!respBaseUrl) return;
              const data = await respBaseUrl.json();
              let fileId = this.getSimulatorFileId(data, qItem.msgData.componentInfo.sdk_version_act, qItem.msgData.componentInfo.tvos_version);

              const respCompUrl = await fetch("https://developer.lge.com/resource/tv/RetrieveToolDownloadUrl.dev?fileId=" + fileId)
                .catch((err) => {
                  this.qRejectHandlerForComp(err, msgComp, qItem);
                });
              if (!respCompUrl) return;
              const respCompUrlData = await respCompUrl.json();

              let url = respCompUrlData["gftsUrl"].replace("http:", "https:");
              await this.downloadCompItem(url, comp_uid, qItem)
                .then(async () => {
                  msgComp["data"]["val"] = 50;
                  msgComp["data"]["message"] = "Downloaded successfully";
                  this.panel.webview.postMessage(msgComp);

                  let destPath = path.join(
                    this.componentMgr.envPath,
                    qItem.msgData.sdkSubDirName,
                    qItem.msgData.componentSubDirName,
                  );
                  msgComp["data"]["step"] = "EXTRACTING"
                  msgComp["data"]["message"] = "Extracting";
                  this.panel.webview.postMessage(msgComp);

                  let osStr = os.platform().toLowerCase();

                  {
                    // only one unzip operation
                    await this.unzipFile(
                      path.join(
                        this.componentMgr.envPath,
                        "Downloads",
                        qItem["downloadedFileName"]
                      ),
                      destPath,
                      comp_uid,
                      qItem
                    )
                      .then(async () => {
                        msgComp["data"]["message"] = "Extracted successfully";
                        this.panel.webview.postMessage(msgComp);

                        this.componentMgr.statusJson[qItem.msgData.sdk][qItem.msgData.componentInfo.comp_uid] = {
                          sdk_version: qItem.msgData.componentInfo.sdk_version,
                          location: destPath,
                        };
                        if (osStr == "linux" || osStr == "darwin") {
                          await this.executeAnyCommand(
                            `chmod -R 777 "${destPath}"`
                          );
                        }
                        try {
                          let fileExt = ".exe"
                          if (osStr == "linux") {
                            fileExt = ".appimage"
                          } else if (osStr == "darwin") {
                            fileExt = ".app"

                          }

                          this.addShortcut(path.join(destPath, qItem.msgData.componentInfo.subDirName, qItem.msgData.componentInfo.subDirName + fileExt), null, "TV_SIMU", qItem.msgData.componentInfo.displayName);
                        } catch { }
                        this.qCompletionHandlerForComp(msgComp, qItem);
                      })
                      .catch((err) => {
                        this.qRejectHandlerForComp(err, msgComp, qItem);
                      });
                  }


                })
                .catch((err) => {
                  this.qRejectHandlerForComp(err, msgComp, qItem);
                });
            } catch (err) {

              this.qRejectHandlerForComp(err, msgComp, qItem);
            }
          }
          break;
        case "TV_BEANVISER_INSTALL_FORALL":
          {

            let msgComp = {
              command: "PRG_UPDATE",
              data: {
                row_uid: comp_uid,
                comp_uid: comp_uid,
                displayName: qItem.msgData.componentInfo.shortName,
                message: "Downloading",
                step: "DOWNLOADING",
                val: 0,
                isError: false,
              },
            };
            try {
              this.panel.webview.postMessage(msgComp);
              const respBaseUrl = await fetch(qItem.msgData.componentInfo.repository)
                .catch((err) => {
                  this.qRejectHandlerForComp(err, msgComp, qItem);
                });
              if (!respBaseUrl) return;
              const data = await respBaseUrl.json();
              let fileId = this.getFileId(data, qItem.msgData.componentInfo.sdk_version);

              const respCompUrl = await fetch("https://developer.lge.com/resource/tv/RetrieveToolDownloadUrl.dev?fileId=" + fileId)
                .catch((err) => {
                  this.qRejectHandlerForComp(err, msgComp, qItem);
                });
              if (!respCompUrl) return;
              const respCompUrlData = await respCompUrl.json();

              let url = respCompUrlData["gftsUrl"].replace("http:", "https:");
              await this.downloadCompItem(url, comp_uid, qItem)
                .then(async () => {
                  msgComp["data"]["val"] = 50;
                  msgComp["data"]["message"] = "Downloaded successfully";
                  this.panel.webview.postMessage(msgComp);

                  let destPath = path.join(
                    this.componentMgr.envPath,
                    qItem.msgData.sdkSubDirName

                  );

                  msgComp["data"]["step"] = "EXTRACTING"
                  msgComp["data"]["message"] = "Extracting";
                  this.panel.webview.postMessage(msgComp);


                  let osStr = os.platform().toLowerCase();
                  switch (osStr) {
                    case "darwin":
                    case "linux":
                      {
                        // two unzip operation
                        let desPathForextact = path.join(
                          this.componentMgr.envPath,
                          "Downloads",
                          "tvBeanviserTemp"
                        );
                        if (fs.existsSync(desPathForextact)) {
                          fs.rmSync(desPathForextact, { recursive: true, force: true, });
                        }

                        // first unzip

                        await this.unzipFile(
                          path.join(
                            this.componentMgr.envPath,
                            "Downloads",
                            qItem["downloadedFileName"]
                          ), desPathForextact, comp_uid, qItem)
                          .then(async () => {
                            // extract again
                            let exFile = fs.readdirSync(desPathForextact).filter(isNotJunk);
                            await this.unzipFile(
                              path.join(desPathForextact, exFile[0]),
                              destPath,
                              comp_uid,
                              qItem
                            )
                              .then(async () => {
                                msgComp["data"]["message"] = "Extracted successfully";
                                this.panel.webview.postMessage(msgComp);

                                this.componentMgr.statusJson[qItem.msgData.sdk][qItem.msgData.componentInfo.comp_uid] = {
                                  sdk_version: qItem.msgData.componentInfo.sdk_version,
                                  location: destPath,
                                };

                                await this.executeAnyCommand(
                                  `chmod -R 777 "${destPath}"`
                                );
                                try {
                                  let fileExt = ".sh"
                                  if (osStr == "darwin") {
                                    fileExt = ".command"
                                    fs.copyFile(path.join(destPath, qItem.msgData.componentSubDirName, "beanviser.sh"), path.join(destPath, qItem.msgData.componentSubDirName, "beanviser" + fileExt), (err) => {
                                    });
                                  }

                                  this.addShortcut(path.join(destPath, qItem.msgData.componentSubDirName, "beanviser" + fileExt), null, "TV_BEANVISER", qItem.msgData.componentInfo.displayName);
                                } catch { }

                                this.qCompletionHandlerForComp(msgComp, qItem);
                              })
                              .catch((err) => {
                                this.qRejectHandlerForComp(err, msgComp, qItem);
                              });
                          })
                          .catch((err) => {
                            this.qRejectHandlerForComp(err, msgComp, qItem);
                          });
                      }
                      break;
                    case "win32":
                      {
                        // only one unzip operation
                        await this.unzipFile(
                          path.join(
                            this.componentMgr.envPath,
                            "Downloads",
                            qItem["downloadedFileName"]
                          ),
                          destPath,
                          comp_uid,
                          qItem
                        )
                          .then(async () => {
                            msgComp["data"]["message"] = "Extracted successfully";
                            this.panel.webview.postMessage(msgComp);

                            this.componentMgr.statusJson[qItem.msgData.sdk][qItem.msgData.componentInfo.comp_uid] = {
                              sdk_version: qItem.msgData.componentInfo.sdk_version,
                              location: destPath,
                            };

                            try {
                              let fileExt = ".cmd"
                              this.addShortcut(path.join(destPath, qItem.msgData.componentSubDirName, qItem.msgData.componentSubDirName + fileExt), null, "TV_BEANVISER", qItem.msgData.componentInfo.displayName, path.join(destPath, qItem.msgData.componentSubDirName));
                            } catch { }
                            this.qCompletionHandlerForComp(msgComp, qItem);
                          })
                          .catch((err) => {
                            this.qRejectHandlerForComp(err, msgComp, qItem);
                          });
                      }
                      break;
                  }


                })
                .catch((err) => {
                  this.qRejectHandlerForComp(err, msgComp, qItem);
                });
            } catch (err) {

              this.qRejectHandlerForComp(err, msgComp, qItem);
            }
          }
          break;

        case "OSE_WFDESIGNER_INSTALL_FORALL":
          {

            let osStr = os.platform().toLowerCase();
            let msgComp = {
              command: "PRG_UPDATE",
              data: {
                row_uid: comp_uid,
                comp_uid: comp_uid,
                displayName: qItem.msgData.componentInfo.shortName,
                message: "Downloading",
                step: "DOWNLOADING",
                val: 0,
                isError: false,
              },
            };
            try {
              let downloadURL = ""
              switch (osStr) {
                case "win32":
                  downloadURL = "https://webosose.s3.ap-northeast-2.amazonaws.com/tools/workflow-designer/v1.0.3/workflow-designer-win64-1.0.3.zip"
                  break;
                case "linux":
                  downloadURL = "https://webosose.s3.ap-northeast-2.amazonaws.com/tools/workflow-designer/v1.0.3/workflow-designer-linux64-1.0.3.tgz"

                  break;
                case "darwin":
                  downloadURL = "https://webosose.s3.ap-northeast-2.amazonaws.com/tools/workflow-designer/v1.0.3/workflow-designer-mac64-1.0.3.tgz"

                  break;
              }

              await this.downloadCompItem(downloadURL, comp_uid, qItem)
                .then(async () => {
                  msgComp["data"]["val"] = 50;
                  msgComp["data"]["message"] = "Downloaded successfully";
                  this.panel.webview.postMessage(msgComp);

                  let destPath = path.join(
                    this.componentMgr.envPath,
                    qItem.msgData.sdkSubDirName

                  );

                  msgComp["data"]["step"] = "EXTRACTING"
                  msgComp["data"]["message"] = "Extracting";
                  this.panel.webview.postMessage(msgComp);



                  switch (osStr) {
                    case "darwin":
                    case "linux":
                      {
                        // two unzip operation
                        let desPathForextact = path.join(
                          this.componentMgr.envPath,
                          "Downloads",
                          "tvWFDTemp"
                        );
                        if (fs.existsSync(desPathForextact)) {
                          fs.rmSync(desPathForextact, { recursive: true, force: true, });
                        }

                        // first unzip

                        await this.unzipFile(
                          path.join(
                            this.componentMgr.envPath,
                            "Downloads",
                            qItem["downloadedFileName"]
                          ), desPathForextact, comp_uid, qItem)
                          .then(async () => {
                            // extract again
                            let exFile = fs.readdirSync(desPathForextact).filter(isNotJunk);
                            await this.unzipFile(
                              path.join(desPathForextact, exFile[0]),
                              destPath,
                              comp_uid,
                              qItem
                            )
                              .then(async () => {
                                msgComp["data"]["message"] = "Extracted successfully";
                                this.panel.webview.postMessage(msgComp);

                                this.componentMgr.statusJson[qItem.msgData.sdk][qItem.msgData.componentInfo.comp_uid] = {
                                  sdk_version: qItem.msgData.componentInfo.sdk_version,
                                  location: destPath,
                                };

                                await this.executeAnyCommand(
                                  `chmod -R 777 "${destPath}"`
                                );
                                try {
                                  let fileToex = "launch-workflow-designer.sh"
                                  if (osStr == "darwin") {
                                    fileToex = "launch-workflow-designer.command"
                                    fs.copyFile(path.join(destPath, qItem.msgData.componentSubDirName, "launch-workflow-designer.sh"), path.join(destPath, qItem.msgData.componentSubDirName, fileToex), (err) => {
                                    });
                                  }

                                  this.addShortcut(path.join(destPath, qItem.msgData.componentSubDirName, fileToex), null, "OSE_WFD", qItem.msgData.componentInfo.displayName);
                                } catch { }

                                this.qCompletionHandlerForComp(msgComp, qItem);
                              })
                              .catch((err) => {
                                this.qRejectHandlerForComp(err, msgComp, qItem);
                              });
                          })
                          .catch((err) => {
                            this.qRejectHandlerForComp(err, msgComp, qItem);
                          });
                      }
                      break;
                    case "win32":
                      {
                        // only one unzip operation
                        await this.unzipFile(
                          path.join(
                            this.componentMgr.envPath,
                            "Downloads",
                            qItem["downloadedFileName"]
                          ),
                          destPath,
                          comp_uid,
                          qItem
                        )
                          .then(async () => {
                            msgComp["data"]["message"] = "Extracted successfully";
                            this.panel.webview.postMessage(msgComp);

                            this.componentMgr.statusJson[qItem.msgData.sdk][qItem.msgData.componentInfo.comp_uid] = {
                              sdk_version: qItem.msgData.componentInfo.sdk_version,
                              location: destPath,
                            };

                            try {
                              let fileToex = "launch-workflow-designer.cmd"
                              this.addShortcut(path.join(destPath, qItem.msgData.componentSubDirName, fileToex), null, "OSE_WFD", qItem.msgData.componentInfo.displayName, path.join(destPath, qItem.msgData.componentSubDirName));
                            } catch { }
                            this.qCompletionHandlerForComp(msgComp, qItem);
                          })
                          .catch((err) => {
                            this.qRejectHandlerForComp(err, msgComp, qItem);
                          });
                      }
                      break;
                  }


                })
                .catch((err) => {
                  this.qRejectHandlerForComp(err, msgComp, qItem);
                });
            } catch (err) {

              this.qRejectHandlerForComp(err, msgComp, qItem);
            }
          }
          break;
        case "OSE_RESMONITOR_INSTALL_FORALL":
          {

            let osStr = os.platform().toLowerCase();
            let msgComp = {
              command: "PRG_UPDATE",
              data: {
                row_uid: comp_uid,
                comp_uid: comp_uid,
                displayName: qItem.msgData.componentInfo.shortName,
                message: "Downloading",
                step: "DOWNLOADING",
                val: 0,
                isError: false,
              },
            };
            try {
              let downloadURL = ""
              switch (osStr) {
                case "win32":
                  downloadURL = "https://dl.grafana.com/enterprise/release/grafana-enterprise-9.4.7.windows-amd64.zip"
                  break;
                case "linux":
                  downloadURL = "https://dl.grafana.com/enterprise/release/grafana-enterprise-9.4.7.linux-amd64.tar.gz"

                  break;
                case "darwin":
                  downloadURL = "https://dl.grafana.com/enterprise/release/grafana-enterprise-9.4.7.darwin-amd64.tar.gz"

                  break;
              }

              await this.downloadCompItem(downloadURL, comp_uid, qItem)
                .then(async () => {
                  msgComp["data"]["val"] = 50;
                  msgComp["data"]["message"] = "Downloaded successfully";
                  this.panel.webview.postMessage(msgComp);

                  let destPath = path.join(
                    this.componentMgr.envPath,
                    qItem.msgData.sdkSubDirName,
                    qItem.msgData.componentSubDirName
                  );

                  msgComp["data"]["step"] = "EXTRACTING"
                  msgComp["data"]["message"] = "Extracting";
                  this.panel.webview.postMessage(msgComp);



                  switch (osStr) {
                    case "darwin":
                    case "linux":
                      {
                        // two unzip operation
                        let desPathForextact = path.join(
                          this.componentMgr.envPath,
                          "Downloads",
                          "grafanaTemp"
                        );
                        if (fs.existsSync(desPathForextact)) {
                          fs.rmSync(desPathForextact, { recursive: true, force: true, });
                        }

                        // first unzip

                        await this.unzipFile(
                          path.join(
                            this.componentMgr.envPath,
                            "Downloads",
                            qItem["downloadedFileName"]
                          ), desPathForextact, comp_uid, qItem)
                          .then(async () => {
                            // extract again
                            let exFile = fs.readdirSync(desPathForextact).filter(isNotJunk);
                            await this.unzipFile(
                              path.join(desPathForextact, exFile[0]),
                              destPath,
                              comp_uid,
                              qItem
                            )
                              .then(async () => {
                                msgComp["data"]["message"] = "Extracted successfully";
                                this.panel.webview.postMessage(msgComp);

                                this.componentMgr.statusJson[qItem.msgData.sdk][qItem.msgData.componentInfo.comp_uid] = {
                                  sdk_version: qItem.msgData.componentInfo.sdk_version,
                                  location: destPath,
                                };

                                await this.executeAnyCommand(
                                  `chmod -R 777 "${destPath}"`
                                );

                                if (fs.existsSync(destPath)) {
                                  let subdir = fs.readdirSync(destPath).filter(isNotJunk);
                                  if (subdir.length > 0) {
                                    this.updateSettingJson("grafana", path.join(destPath, subdir[0]))

                                  }
                                }

                                this.qCompletionHandlerForComp(msgComp, qItem);
                              })
                              .catch((err) => {
                                this.qRejectHandlerForComp(err, msgComp, qItem);
                              });
                          })
                          .catch((err) => {
                            this.qRejectHandlerForComp(err, msgComp, qItem);
                          });
                      }
                      break;
                    case "win32":
                      {
                        // only one unzip operation
                        await this.unzipFile(
                          path.join(
                            this.componentMgr.envPath,
                            "Downloads",
                            qItem["downloadedFileName"]
                          ),
                          destPath,
                          comp_uid,
                          qItem
                        )
                          .then(async () => {
                            msgComp["data"]["message"] = "Extracted successfully";
                            this.panel.webview.postMessage(msgComp);

                            this.componentMgr.statusJson[qItem.msgData.sdk][qItem.msgData.componentInfo.comp_uid] = {
                              sdk_version: qItem.msgData.componentInfo.sdk_version,
                              location: destPath,
                            };

                            if (fs.existsSync(destPath)) {
                              let subdir = fs.readdirSync(destPath).filter(isNotJunk);
                              if (subdir.length > 0) {
                                this.updateSettingJson("grafana", path.join(destPath, subdir[0]))

                              }
                            }
                            this.qCompletionHandlerForComp(msgComp, qItem);
                          })
                          .catch((err) => {
                            this.qRejectHandlerForComp(err, msgComp, qItem);
                          });
                      }
                      break;
                  }


                })
                .catch((err) => {
                  this.qRejectHandlerForComp(err, msgComp, qItem);
                });
            } catch (err) {

              this.qRejectHandlerForComp(err, msgComp, qItem);
            }
          }
          break;
      }

    }
  }

  getEmuLauncherPath(stdOut) {
    let lines = stdOut.split("\r");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("WARNING: The script webos-emulator.exe is installed in ")) {
        let emuLauncherDir = lines[i]
          .replace(
            "WARNING: The script webos-emulator.exe is installed in ",
            ""
          )
          .replace("which is not on PATH.", "")
          .replace("'", "")
          .replace("'", "");
        return emuLauncherDir;
      }
    }
  }
  addOseEmulatorLauncher(instName, fPath, shFile) {
    let filePath = path.join(fPath, shFile);
    fs.writeFileSync(filePath, `vboxmanage startvm "${instName}"`, "utf8");
  }

  async getSettingsJSON() {
    // Open the user settings.json file in a new editor
    await vscode.commands.executeCommand("workbench.action.openSettingsJson");

    // Grab the new active editor from the window (should be the one we just
    // opened)
    const activeEditor = vscode.window.activeTextEditor;
    // Get the open document from the active editor (should be the
    // settings.json file)
    const settingsDocument = activeEditor.document;

    // Get all of the text contained in the file
    const documentText = settingsDocument.getText();

    // Close the active settings.json editor
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");

    // Return the document parsed to a proper object
    return JSON.parse(documentText);
  }
  async setSettingsJSON(settings) {
    // Open the user settings.json file in a new editor
    await vscode.commands.executeCommand("workbench.action.openSettingsJson");

    // Grab the new active editor from the window (should be the one we just
    // opened)
    const activeEditor = vscode.window.activeTextEditor;
    // Get the open document from the active editor (should be the
    // settings.json file)
    const settingsDocument = activeEditor.document;
    const documentText = settingsDocument.getText();
    // console.log(documentText)

    // Open an edit operation to update the settings document
    activeEditor.edit((editBuilder) => {
      // Make a range from start to end of the document
      const startPosition = new vscode.Position(0, 0);
      const endPosition = settingsDocument.lineAt(settingsDocument.lineCount - 1).rangeIncludingLineBreak.end;
      const range = new vscode.Range(startPosition, endPosition);

      // Replace everything with the new settings object
      editBuilder.replace(range, JSON.stringify(settings));


    });
    // Save the changed settings.json file
    await settingsDocument.save();
    // Close the active settings.json editor
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");


  }
  updateSettingJson(dbType, value) {
    /*
    Windows %APPDATA%\Code\User\settings.json
    macOS $HOME/Library/Application\ Support/Code/User/settings.json
  Linux $HOME/.config/Code/User/settings.json

    */
    let osStr = os.platform().toLowerCase();
    let settingFPath = ""
    switch (osStr) {
      case "darwin":
        settingFPath = path.join(os.homedir(), "Library", "Application Support", "Code", "User", "settings.json")
        break;
      case "linux":
        settingFPath = path.join(os.homedir(), ".config", "Code", "User", "settings.json")
        break;
      case "win32":
        settingFPath = path.join(os.homedir(), "AppData", "Roaming", "Code", "User", "settings.json")
        break;

    }
    let configData ="{}"
    if (fs.existsSync(settingFPath)) {
      configData = fs.readFileSync(settingFPath, "utf8")  
    }
    configData = JSON.parse(configData);
    if (dbType == "influxdb") {
      if(configData["webosose.resourceMonitoring.influxdbInstallPath"]){
        logger.info("Resource Monitor - Overriden the Influxdb install path in settings")
      }

      configData["webosose.resourceMonitoring.influxdbInstallPath"] = value

    } else {
      if(configData["webosose.resourceMonitoring.grafanaInstallPath"]){
        logger.info("Resource Monitor - Overriden the Grafana install path in settings")
      }

      configData["webosose.resourceMonitoring.grafanaInstallPath"] = value
    }
    fs.writeFileSync(settingFPath, JSON.stringify(configData), "utf8");
  }

  async vbox_setNewUUID(vmdkFile) {
    return new Promise(async (resolve, reject) => {
      let vboxcmd = this.componentMgr.getVboxCommandPath();
      let command = `${vboxcmd} internalcommands sethduuid ${vmdkFile}`;
      cp.exec(command, (error, stdout, stderr) => {
        if (stdout) {
          let uuid = stdout.replace("UUID changed to:", "").trim();
          resolve(uuid);
          // resolve();
        }
        if (error) {
          // console.log(error);
          reject(error);
        }
        if (stderr) {
          // console.log(stderr);
        }
      });
    });
  }

  async vbox_isInstanceNotAvailable(instName) {
    instName = `"${instName}"`;
    let vboxcmd = this.componentMgr.getVboxCommandPath();
    return new Promise(async (resolve, reject) => {
      let command = `${vboxcmd} list vms`;
      cp.exec(command, (error, stdout, stderr) => {
        if (!stdout.includes(instName)) {
          resolve();
        } else {
          reject();
        }
        if (error) {
          // console.log(error);
          reject(error);
        }
        if (stderr) {
          // console.log(stderr);
        }
      });
    });
  }

  exec_commands(command) {
    return new Promise((resolve, reject) => {
      cp.exec(command, (error, stdout, stderr) => {
        if (stdout) {
          resolve(stdout + "\r" + stderr);
        }
        if (error) {
          reject(error);
        }

        resolve(stdout);
      });
    });

  }
  gcd = (a, b) => {
    return b ? this.gcd(b, a % b) : a;
  };
  aspectRatio = (width, height) => {
    const divisor = this.gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  };
  vbox_getScreenZoomFactor(data) {
    // 16:9 ose res //1920x1080
    let w = data.w;
    let h = data.h;
    let screenAR = this.aspectRatio(w, h);
    if (screenAR != "16:9") {
      // not matching with ose aspect ratio
      if (w > h) {
        return w / 1920;
      } else {
        return h / 1080;
      }
    } else {
      // matching
      return w / 1920;
    }
  }
  vbox_addNew_OSE_Instance(instName, vmdkFile) {
    return new Promise(async (resolve, reject) => {
      let osStr = os.platform().toLowerCase();
      let data = {
        instName: instName,
        monitorCount: "1",
        memory: "3558",
        w: 1280,
        h: 720,
        vmdkController: "",
        vmdkFile: vmdkFile,
        os: "Linux_64"

      };

      let vboxcmd = this.componentMgr.getVboxCommandPath();
      let command = `${vboxcmd} createvm --ostype ${data.os} --register --name "${data.instName}"`;

      await this.exec_commands(command)
        .then(async () => {
          let commands = [];
          let vboxcmd = this.componentMgr.getVboxCommandPath();
          switch (osStr) {
            case "darwin":
              commands = [
                `${vboxcmd} modifyvm "${instName}" --longmode ${data.os == "Linux" ? " off" : " on"
                }`,
                `${vboxcmd} modifyvm "${instName}" --memory ${data.memory} --vram 128 --ioapic on --cpus 2`,
                `${vboxcmd} modifyvm "${instName}" --graphicscontroller vmsvga`,
                `${vboxcmd} modifyvm "${instName}" --accelerate3d on`,
                `${vboxcmd} modifyvm "${instName}" --audio coreaudio --audioout on --audioin on`,
                `${vboxcmd} modifyvm "${instName}" --nic1 nat --nictype1 82540EM --natpf1 ssh,tcp,,6622,,22`,
                `${vboxcmd} modifyvm "${instName}" --natpf1 web-inspector,tcp,,9998,,9998`,
                `${vboxcmd} modifyvm "${instName}" --natpf1 enact-browser-web-inspector,tcp,,9223,,9999`,
                `${vboxcmd} modifyvm "${instName}" --mouse usbtablet`,
                `${vboxcmd} modifyvm "${instName}" --uart1 0x3f8 4 --uartmode1 file /dev/null`,
                `${vboxcmd} modifyvm "${instName}" --monitorcount ${data.monitorCount}`,
                `${vboxcmd} storagectl "${instName}" --add ide --name "${data.instName}"`,
                `${vboxcmd} storageattach "${instName}" --storagectl "${data.instName}" --type hdd --port 0 --device 0 --medium "${data.vmdkFile}"`,
                `${vboxcmd} setextradata "${instName}" GUI/ScaleFactor ${this.vbox_getScreenZoomFactor(
                  data
                )}`,
              ];
              break;
            case "linux":
              commands = [
                `${vboxcmd} modifyvm "${instName}" --longmode ${data.os == "Linux" ? " off" : " on"}`,
                `${vboxcmd} modifyvm "${instName}" --memory ${data.memory} --vram 128 --ioapic on --cpus 2`,
                `${vboxcmd} modifyvm "${instName}" --graphicscontroller vmsvga`,
                `${vboxcmd} modifyvm "${instName}" --accelerate3d on`,
                `${vboxcmd} modifyvm "${instName}" --audio pulse --audioout on --audioin on`,
                `${vboxcmd} modifyvm "${instName}" --nic1 nat --nictype1 82540EM --natpf1 ssh,tcp,,6622,,22`,
                `${vboxcmd} modifyvm "${instName}" --natpf1 web-inspector,tcp,,9998,,9998`,
                `${vboxcmd} modifyvm "${instName}" --natpf1 enact-browser-web-inspector,tcp,,9223,,9999`,
                `${vboxcmd} modifyvm "${instName}" --mouse usbtablet`,
                `${vboxcmd} modifyvm "${instName}" --uart1 0x3f8 4 --uartmode1 file /dev/null`,
                `${vboxcmd} modifyvm "${instName}" --monitorcount ${data.monitorCount}`,
                `${vboxcmd} storagectl "${instName}" --add ide --name "${data.instName}"`,
                `${vboxcmd} storageattach "${instName}" --storagectl "${data.instName}" --type hdd --port 0 --device 0 --medium "${data.vmdkFile}"`,
                `${vboxcmd} setextradata "${instName}" GUI/ScaleFactor ${this.vbox_getScreenZoomFactor(data)}`,
              ];
              break;
            case "win32":
              commands = [
                `${vboxcmd} modifyvm "${instName}" --longmode ${data.os == "Linux" ? " off" : " on"}`,
                `${vboxcmd} modifyvm "${instName}" --memory ${data.memory} --vram 128 --ioapic on --cpus 2`,
                `${vboxcmd} modifyvm "${instName}" --graphicscontroller vmsvga`,
                `${vboxcmd} modifyvm "${instName}" --accelerate3d on`,
                `${vboxcmd} modifyvm "${instName}" --audio dsound --audioout on --audioin on`,
                `${vboxcmd} modifyvm "${instName}" --nic1 nat --nictype1 82540EM --natpf1 ssh,tcp,,6622,,22`,
                `${vboxcmd} modifyvm "${instName}" --natpf1 web-inspector,tcp,,9998,,9998`,
                `${vboxcmd} modifyvm "${instName}" --natpf1 enact-browser-web-inspector,tcp,,9223,,9999`,
                `${vboxcmd} modifyvm "${instName}" --mouse usbtablet`,
                `${vboxcmd} modifyvm "${instName}" --uart1 0x3f8 4 --uartmode1 file null`,
                `${vboxcmd} modifyvm "${instName}" --monitorcount ${data.monitorCount}`,
                `${vboxcmd} storagectl "${instName}" --add ide --name "${data.instName}"`,
                `${vboxcmd} storageattach "${instName}" --storagectl "${data.instName}" --type hdd --port 0 --device 0 --medium "${data.vmdkFile}"`,
                `${vboxcmd} setextradata "${instName}" GUI/ScaleFactor ${this.vbox_getScreenZoomFactor(data)}`,
              ];
              break;
          }

          await this.exec_commands(commands.join(" && "))
            .then(async () => {
              resolve();
            })
            .catch((err) => {
              // console.log(err);
              resolve(err);
            });
          // }
        })
        .catch((error) => {
          // console.log(error);
          reject(error);
        });
    });
  }
  vbox_addNew_TV_Instance(scriptPath) {
    return new Promise((resolve, reject) => {
      let osStr = os.platform().toLowerCase();
      let scriptFile = "";
      let command = "";
      switch (osStr) {
        case "win32":
          scriptFile = "vm_register.bat";
          command = `"${path.join(scriptPath, scriptFile)}"`;
          break;
        case "linux":
          scriptFile = "vm_register.sh";
          command = `"${path.join(scriptPath, scriptFile)}"`;
          break;
        case "darwin":
          scriptFile = "vm_register.command";
          command = `"${path.join(scriptPath, scriptFile)}"`;
          break;
      }

      cp.exec(command, (error, stdout, stderr) => {
        if (stdout) {
          resolve(stdout + "\r" + stderr);
        }
        if (error) {
          reject(error);
        }

        resolve(stdout);
      });
    });
  }
  addShortcut(filePath, version, targetType, displayName, wdir) {

    let osStr = os.platform().toLowerCase();



    if (targetType == "TV_EMU") {
      if (osStr == "darwin") {
        fs.copyFile(path.join(filePath, "run_webos_emulator.sh"), path.join(filePath, "run_webos_emulator.command"), (err) => {
        });
      }
      const shortcutsCreated = createDesktopShortcut({
        windows: {
          filePath: path.join(filePath, "LG_webOS_TV_Emulator.exe"),
          name: displayName + " " + version,
          icon: path.join(filePath, "DTVEmulator.png"),
        },
        linux: {
          filePath: `/usr/bin/gnome-terminal`,
          arguments: ` -- sh  "${path.join(filePath, "LG_webOS_TV_Emulator.sh")}" `,
          name: displayName + " " + version,
          icon: path.join(filePath, "DTVEmulator.png"),
        },
        osx: {
          filePath: path.join(filePath, "run_webos_emulator.command"),
          name: displayName + " " + version,
          overwrite: true
        },
      });

      if (shortcutsCreated) {

        // sudo chown $USER:$USER ~/Desktop/desktopfile
      }
    }
    else if (targetType == "OSE_EMU") {

      const shortcutsCreated = createDesktopShortcut({
        windows: {
          filePath: filePath,
          name: displayName + " " + version,

        },
        linux: {
          filePath: filePath,
          name: displayName + " " + version,

        },
        osx: {
          filePath: filePath,
          name: displayName + " " + version,
          overwrite: true
        },
      });

      if (shortcutsCreated) {

        // sudo chown $USER:$USER ~/Desktop/desktopfile
      }
    }
    else if (targetType == "TV_CLI") {
      if (osStr == "darwin") {
        fs.writeFileSync(path.join(filePath, "run_cli_terminal.command"), `osascript -e 'tell app "Terminal" 
        do script "cd '\\'${filePath.replaceAll(" ", "\\ ")}\\''" 
       end tell'
       `, "utf8")
        this.executeAnyCommand(`chmod -R 777 "${filePath}"`);
      } else if (osStr == "linux") {
        this.executeAnyCommand(`chmod -R 777 "${filePath}"`);
      }
      let cmdWin = this.componentMgr.getEnvVarValue("ComSpec");
      const shortcutsCreated = createDesktopShortcut({
        windows: {
          filePath: cmdWin ? cmdWin : "C:\\Windows\\system32\\cmd.exe",
          workingDirectory: filePath,
          name: displayName,
        },
        linux: { filePath: `/usr/bin/gnome-terminal`, arguments: `--working-directory='${filePath}'`, name: displayName },
        osx: { filePath: path.join(filePath, "run_cli_terminal.command"), name: displayName, overwrite: true },
      });

    } else if (targetType == "TV_SIMU") {

      const shortcutsCreated = createDesktopShortcut({
        windows: {
          filePath: filePath,
          name: displayName,
        },
        linux: {
          filePath: filePath,
          chmod: true,
          name: displayName,
        },
        osx: {
          filePath: filePath,
          name: displayName,
          overwrite: true
        },
      });

      if (shortcutsCreated) {

        // sudo chown $USER:$USER ~/Desktop/desktopfile
      }
    }
    // 
    else if (targetType == "TV_BEANVISER") {

      const shortcutsCreated = createDesktopShortcut({
        windows: {
          filePath: filePath,
          name: displayName,
          workingDirectory: wdir,
        },
        linux: {
          filePath: filePath,
          name: displayName,
        },
        osx: {
          filePath: filePath,
          name: displayName,
          overwrite: true
        },
      });

      if (shortcutsCreated) {
      }
    }
    else if (targetType == "OSE_WFD") {

      const shortcutsCreated = createDesktopShortcut({
        windows: {
          filePath: filePath,
          name: displayName,
          workingDirectory: wdir
        },
        linux: {
          filePath: filePath,
          name: displayName,

          icon: path.join(filePath, "DTVEmulator.png"),
        },
        osx: {
          filePath: filePath,
          name: displayName,
          overwrite: true
        },
      });

      if (shortcutsCreated) {
      }
    }

  }

  vbox_deleteInstance(instName) {
    return new Promise(async (resolve, reject) => {
      let runningInstance = await this.vbox_getRunningInstance();
      let commands = [];
      let vboxcmd = this.componentMgr.getVboxCommandPath();
      if (runningInstance.includes(`"${instName}"`)) {

        commands = [
          `${vboxcmd} controlvm "${instName}" pause`,
          `${vboxcmd} controlvm "${instName}" poweroff`,
          `ping -${os.type() == "Windows_NT" ? "n" : "c"} 5 localhost `,
          `${vboxcmd} unregistervm "${instName}" --delete`,
        ];
      } else {
        commands = [`${vboxcmd} unregistervm "${instName}" --delete`];
      }

      await this.exec_commands(commands.join(" && "))
        .then(async () => {
          resolve();
        })
        .catch((err) => {
          // console.log(err);
          resolve(err);
        });
    });
  }
  async vbox_getRunningInstance() {
    return new Promise((resolve, reject) => {
      let vboxcmd = this.componentMgr.getVboxCommandPath();
      let command = `${vboxcmd} list runningvms`;
      cp.exec(command, (error, stdout, stderr) => {

        if (error) {
          reject(error);
        }
        resolve(stdout);
      });
    });
  }


  getUbuntuVersion() {
    let command = "lsb_release -a";
    let stdout = this.componentMgr.executeCommandSync(command);
    if (stdout) {
      let outArray = stdout.split("\n");
      for (let i = 0; i < outArray.length; i++) {
        if (outArray[i].includes("Release:")) {
          let ver = outArray[i].replace("Release:", "").trim();
          return ver;
        }
      }
    }
    return "";
  }

  async downloadDepItem(downladInfo, comp_uid, key, qItem, depInstallItem) {

    return new Promise(async (resolve, reject) => {
      let msgComp = {
        command: "PRG_UPDATE",
        data: {
          row_uid: comp_uid + "_" + key,
          comp_uid: comp_uid,
          displayName: depInstallItem.shortName,
          isComp: false,
          isError: false,
          step: "DOWNLOADING",
        },
      };
      logger.info(`Downloading ${depInstallItem.displayName} from ${downladInfo.location}`)

      const downloader = new DownloaderHelper(downladInfo.location, path.join(this.componentMgr.envPath, "Downloads"),
        {
          timeout: 10000,
          resumeOnIncompleteMaxRetry: 5,
          resumeOnIncomplete: true, // Resume download if the file is incomplete (set false if using any pipe that modifies the file)
          retry: { maxRetries: 4, delay: 5000 }, // { maxRetries: number, delay: number in ms } or false to disable (default)
          forceResume: true, // If the server does not return the "accept-ranges" header, can be force if it does support it
          progressThrottle: 1000, // interval time of the 'progress.throttled' event will be emitted
          override: true
        }
      );
      downloader.on('end', (downladInfo) => {
        delete this.downloaders[comp_uid]
        // logger.info(`Downloaded ${depInstallItem.displayName} from ${downladInfo.location}`)
        resolve();
      });
      downloader.on('error', (err) => {
        logger.error(`${depInstallItem.displayName} - ${err.message}`)
      });

      downloader.on('start', () => {
      });
      downloader.on('retry', (attempt, retryOpts, err) => {
        logger.info(`Retrying Download ${depInstallItem.displayName} from ${downladInfo.location}`)
      });
      downloader.on('resume', () => {
      });
      downloader.on('timeout', () => {
      });
      downloader.on('stop', () => {
        //      logger.info(`Download ${depInstallItem.displayName} cancelled `)
        delete this.downloaders[comp_uid]
        reject({ "code": "ERR_REQUEST_CANCELLED", "message": "Request Cancelled" })
      });
      downloader.on('progress.throttled', (stats) => {

        if (stats.progress == 100) {
          logger.info(`Downloaded ${depInstallItem.displayName} from ${downladInfo.location}`)
        }
        let percentage = parseInt(stats.progress);/// 2
        msgComp.data.message = "Downloading";
        msgComp.data.val = parseInt(percentage);
        this.panel.webview.postMessage(msgComp);

      });

      downloader.on('download', (downloadInfo) => {
        qItem["downloadedFileName"] = downloadInfo.fileName;
        logger.info(`Downloading ${depInstallItem.displayName} to  ${downloadInfo.filePath}`)

      });

      this.downloaders[comp_uid] = downloader

      await downloader.start()
        .catch((err) => {
          logger.error(`${depInstallItem.displayName} - ${err}`)
          delete this.downloaders[comp_uid]
          reject(err);
        });


    });
  }


  downloadCompItem(url, comp_uid, qItem) {

    return new Promise(async (resolve, reject) => {
      let msgComp = {
        command: "PRG_UPDATE",
        data: {
          row_uid: comp_uid,
          comp_uid: comp_uid,
          displayName: qItem.msgData.componentInfo.shortName,
          isError: false,
          isComp: true,
          step: "DOWNLOADING",
        },
      };
      logger.info(`Downloading ${qItem.msgData.componentInfo.displayName} from ${url}`)

      const downloader = new DownloaderHelper(url, path.join(this.componentMgr.envPath, "Downloads"),
        {
          timeout: 10000,
          resumeOnIncompleteMaxRetry: 5,
          resumeOnIncomplete: true, // Resume download if the file is incomplete (set false if using any pipe that modifies the file)
          retry: { maxRetries: 4, delay: 5000 }, // { maxRetries: number, delay: number in ms } or false to disable (default)
          forceResume: true, // If the server does not return the "accept-ranges" header, can be force if it does support it
          progressThrottle: 1000, // interval time of the 'progress.throttled' event will be emitted
          override: true
        }
      );
      downloader.on('end', (downladInfo) => {
        delete this.downloaders[comp_uid]
        logger.info(`Downloaded ${qItem.msgData.componentInfo.displayName} from ${url}`)
        resolve();
      });
      downloader.on('error', (err) => {
        logger.error(`${qItem.msgData.componentInfo.displayName} - ${err.message}`)
      });

      downloader.on('start', () => {
      });
      downloader.on('retry', (attempt, retryOpts, err) => {
        logger.info(`Retrying Download ${qItem.msgData.componentInfo.displayName} from ${url}`)
      });
      downloader.on('resume', () => {
      });
      downloader.on('timeout', () => {
      });
      downloader.on('stop', () => {
        // logger.info(`Download ${qItem.msgData.componentInfo.displayName} cancelled `)
        delete this.downloaders[comp_uid]
        reject({ "code": "ERR_REQUEST_CANCELLED", "message": "Request Cancelled" })
      });
      downloader.on('progress.throttled', (stats) => {

        if (stats.progress == 100) {
          logger.info(`Downloaded ${qItem.msgData.componentInfo.displayName} from ${url}`)
        }
        let percentage = parseInt(stats.progress);
        msgComp.data.message = "Downloading";
        msgComp.data.val = parseInt(percentage);
        this.panel.webview.postMessage(msgComp);

      });

      downloader.on('download', (downloadInfo) => {
        qItem["downloadedFileName"] = downloadInfo.fileName;
        logger.info(`Downloading ${qItem.msgData.componentInfo.displayName} to  ${downloadInfo.filePath}`)

      });

      this.downloaders[comp_uid] = downloader

      await downloader.start()
        .catch((err) => {
          logger.error(`${qItem.msgData.componentInfo.displayName} - ${err}`)
          delete this.downloaders[comp_uid]
          reject(err);
        });


    });
  }

  sendQErrMsg(error, qItem) {
    let msgComp = {
      command: "ERROR_PACKAGE_MANAGER",
      data: { ...qItem["msgData"] },
      errMsg: error["code"] == "ERR_REQUEST_CANCELLED" ? "" : error.message

    };
    this.panel.webview.postMessage(msgComp);
  }

  unzipFile(filePath, destination, comp_uid, item) {
    let displayName = ""
    if (item["displayName"]) {
      displayName = item["displayName"]
    } else {
      displayName = item.msgData.componentInfo.displayName
    }
    logger.info(`${displayName} -Extracting ${filePath} `)

    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }
    return new Promise(async (resolve, reject) => {
      try {
        await _7z.unpack(filePath, destination, (err) => {
          if (!err) {
            resolve();
            logger.info(`${displayName} - ${filePath} -Extracted `)
          } else {

            logger.info(`${displayName} - Error on Extracting ${filePath} -${err} `)
            reject(err);
          }
        });
      } catch (error) {
        logger.info(`${displayName} - Error on Extracting ${filePath} -${error} `)
        reject(error);
      }
    });
  }

  addToQueAndProcess(msgData, successCB, errCB, panel) {
    this.panel = panel;
    this.downloadQue.push({
      msgData: msgData,
      successCB: successCB,
      errCB: errCB,
      isProcessed: false,
      isProcessing: false,
    });
    this.installingDep = this.installingDep.concat(msgData.depInstallKey);

    setTimeout(() => {
      this.processQue();
    }, 100);

  }
  cancelDownloader(msgData) {
    this.downloaders[msgData["comp_uid"]].stop();

  }

  executeCommand(command, comp_uid, depItem, msg) {

    return new Promise(async (resolve, reject) => {
      try {
        await exec(command)
          .then((data) => {
            resolve();
          })
          .catch((e) => {
            reject(e);
          });

        resolve();
      } catch (e) {
        reject();
      }
    });
  }
  executeAnyCommand(command, option) {
    return new Promise(async (resolve, reject) => {
      cp.exec(command, option, (error, stdout, stderr) => {

        if (stdout) {
          if (
            stdout.includes("is not available") &&
            stdout.includes("is not installed")
          ) {
            reject({ message: stdout });
          }

        }
        if (error) {
          reject(error);
        }
        if (stderr) {
        }
        resolve(stdout);
      });
    });
  }

  async executeSudoCommand(command, isSilent) {
    return new Promise(async (resolve, reject) => {
      let options = {
        name: "webOS Studio",
      };
      await sudoExec(command, options)
        .then((error, stdout, stderr) => {
          // console.log(error, stdout, stderr);
          if (isSilent) {
            resolve()
          } else {
            if (error) {
              resolve(error);
            } else {
              resolve(stdout);
            }
          }

        })
        .catch((error) => {
          if (isSilent) {
            resolve()
          } else {
            reject(error);
          }

        });
    }); ``
  }
  getFileId(jsonResp, version) {
    let osStr = os.platform().toLowerCase();

    switch (osStr) {
      case "win32":
        for (let i = 0; i < jsonResp.fileList.length; i++) {
          if (version) {
            if (jsonResp.fileList[i]["fileTypeCode"] == "SW6" && jsonResp.fileList[i]["fileName"].includes(version + ".zip")) {
              return jsonResp.fileList[i]["fileId"];
            }
          } else {
            if (jsonResp.fileList[i]["fileTypeCode"] == "SW6") {
              return jsonResp.fileList[i]["fileId"];
            }
          }
        }
        break;
      case "linux":
        for (let i = 0; i < jsonResp.fileList.length; i++) {
          if (version) {
            if (jsonResp.fileList[i]["fileTypeCode"] == "SL6" && (jsonResp.fileList[i]["fileName"].includes(version + ".zip") || jsonResp.fileList[i]["fileName"].includes(version + ".tgz"))) {
              return jsonResp.fileList[i]["fileId"];
            }
          } else {
            if (jsonResp.fileList[i]["fileTypeCode"] == "SL6") {
              return jsonResp.fileList[i]["fileId"];
            }
          }
        }
        break;

      case "darwin":
        for (let i = 0; i < jsonResp.fileList.length; i++) {
          if (version) {
            if (jsonResp.fileList[i]["fileTypeCode"] == "SMC" && (jsonResp.fileList[i]["fileName"].includes(version + ".zip") || jsonResp.fileList[i]["fileName"].includes(version + ".tgz"))) {
              return jsonResp.fileList[i]["fileId"];
            }
          } else {
            if (jsonResp.fileList[i]["fileTypeCode"] == "SMC") {
              return jsonResp.fileList[i]["fileId"];
            }
          }
        }
        break;
    }
  }
  getSimulatorFileId(jsonResp, version, tvOSVersion) {
    let osStr = os.platform().toLowerCase();

    let fileName = "";

    switch (osStr) {
      case "win32":
        fileName = `webOS_TV_${tvOSVersion}_Simulator_${version}_win.zip`

        break;
      case "linux":
        fileName = `webOS_TV_${tvOSVersion}_Simulator_${version}_linux.zip`
        break;
      case "darwin":
        fileName = `webOS_TV_${tvOSVersion}_Simulator_${version}_mac.zip`
        break;
    }
    switch (osStr) {
      case "win32":
        for (let i = 0; i < jsonResp.fileList.length; i++) {
          if (jsonResp.fileList[i]["fileTypeCode"] == "SW6" && jsonResp.fileList[i]["fileName"] == fileName) {
            return jsonResp.fileList[i]["fileId"];
          }
        }
        break;
      case "linux":
        for (let i = 0; i < jsonResp.fileList.length; i++) {
          if (jsonResp.fileList[i]["fileTypeCode"] == "SL6" && jsonResp.fileList[i]["fileName"] == fileName) {
            return jsonResp.fileList[i]["fileId"];
          }
        }
        break;

      case "darwin":
        for (let i = 0; i < jsonResp.fileList.length; i++) {
          if (jsonResp.fileList[i]["fileTypeCode"] == "SMC" && jsonResp.fileList[i]["fileName"] == fileName) {
            return jsonResp.fileList[i]["fileId"];
          }
        }
        break;
    }
  }
}

exports.ComponentMgr = ComponentMgr;
