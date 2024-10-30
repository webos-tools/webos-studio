/*
 * Copyright (c) 2021-2024 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const { isElevated } = require("./lib/isElevated");
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { ComponentMgr } = require("./componentManager");
const { AutoUpdate } = require("./AutoUpdateConfig");
const { getCurrentDeviceProfile } = require('./lib/deviceUtils');
class PackageManagerSidebar {
  constructor(context) {
    this.context = context;
    this.compMangerObj = new ComponentMgr(context);
    this.configData = this.compMangerObj.configJson;
    this.panel = null;


  }
  resolveWebviewView(panel) {
    this.panel = panel;
    this.compMangerObj.panel = panel
    panel.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      retainContextWhenHidden: true,
      enableForms: true,
      localResourceRoots: [this.context.extensionUri]
    };
    this.handle7zipBinPermissionAndResolveWebView(panel)

  }
  async handle7zipBinPermissionAndResolveWebView(panel) {
    let osStr = os.platform().toLowerCase();
    if (osStr == "linux" || osStr == "darwin") {
      const path7za = require('7zip-bin').path7za;
      try {
        fs.accessSync(path7za, fs.constants.X_OK);

      } catch (err) {
        let cmd = "chmod +x " + path7za
        await this.compMangerObj.installManager.executeSudoCommand(cmd, true);
      }


    }
    this.doResolveWebview(panel)
  }


  doResolveWebview(panel) {

    this.loadSDKManager().then(async () => {
      this.currentProfile = await getCurrentDeviceProfile();

      panel.webview.html = this.getHtmlForWebview(this.panel.webview);

      setTimeout(() => {
        this.panel.webview.postMessage({
          command: "SET_STATUS_JSON",
          data: this.compMangerObj.getStatusJson(),
        });
        this.compMangerObj.updateAvailableDiskspaceOnEnvPath();
      }, 100);

      this.panel.webview.onDidReceiveMessage(async (msg) => {
        try {
          switch (msg.command) {
            case "GET_CONFIG_JSON": {
              this.panel.webview.postMessage({
                command: "SET_CONFIG_JSON",
                data: this.configData,
              });
              break;
            }
            case "GET_STATUS_JSON": {
              this.panel.webview.postMessage({
                command: "SET_STATUS_JSON",
                data: this.compMangerObj.getStatusJson(),
              });
              break;
            }
            case "CHECK_PREREQUISITES": {
              let msgComp = {
                command: "CHECKING_PREREQUISITES",
                data: {
                  "step": "CHECKING",
                  ...msg.data,
                },
              };
              this.panel.webview.postMessage(msgComp)
              this.compMangerObj.checkPreReqOnCompInstall(msg.data, this.panel)
              break;
            }

            case "INSTALL_COMP": {
              require("./ga4Util").mpGa4Event("PackageManager_Install", { category: "Commands", name: msg.data.displayname, version: msg.data.sdk_version });
              this.compMangerObj.installCompAndDependancy(msg.data, this.panel)

              break;
            }

            case "UNINSTALL_COMP":
              {
                require("./ga4Util").mpGa4Event("PackageManager_UnInstall", { category: "Commands", name: msg.data.displayname, version: msg.data.sdk_version });
                this.compMangerObj.unInstallComp(msg.data, this.panel);
                break;

              }
            case "UNINSTALL_COMP_REQ":
              if (msg.data.componentInfo.comp_uid.includes("emulator")) {
                msg.data.componentInfo.sdk_version_act = msg.data.componentInfo.sdk_version;
              }
              vscode.window.showInformationMessage(`Do you want to uninstall '${msg.data.componentInfo.displayName} v${msg.data.componentInfo.sdk_version_act}'?`,
                ...["Yes", "No"])
                .then(async (answer) => {
                  if (answer === "Yes") {
                    // this.compMangerObj.unInstallComp(msg.data, this.panel);
                    msg.command = "UNINSTALL_CONFIRMED";
                    this.panel.webview.postMessage(msg);

                  } else {

                    let msgComp = {
                      command: "UNINSTALL_CANCELLED",
                      data: {
                        comp_uid: msg.data.componentInfo.comp_uid,
                        sdk: msg.data.sdk

                      },
                    };
                    this.panel.webview.postMessage(msgComp);


                  }
                })

              break;
            case "CANCEL_DOWNLOAD": {
              this.compMangerObj.cancelDownload(msg.data)
              break;
            }
          }
        } catch (error) {

          this.panel.webview.postMessage({
            command: "ERROR_PACKAGE_MANAGER",
            data: {
              ...msg.data,
              errMsg: error.message || "",
              message: error.message || "",
            },
          });
        }
      });

    }).catch((e) => {
      if (e == "NOADMIN") {
        panel.webview.html = this.getNoAdminHtml()
      }

    });

  }
  promptForSDKDir() {
    const header = "Configure SDK Location";
    const options = {
      detail: "Please select SDK Location directory to configure Package Manager",
      modal: true,
    };
    vscode.window
      .showInformationMessage(header, options, ...["Select Folder"])
      .then((answer) => {
        if (answer === "Select Folder") {
          this.openFolderDlg();
        } else {
          // do nothing
          vscode.commands.executeCommand('setContext', 'webosose.showpackagemanager', false);
        }
      });
  }
  async isEnvDirExists() {

    const msgData = this.compMangerObj.getEnvironment_pkgmgr({
      envVarName: this.configData["sdk_env"],
    });
    if (msgData.envVarValue != "" && msgData.envVarValue != null) {
      if (!fs.existsSync(msgData.envVarValue)) {
        // in case of mac, if vs code is launching from launch bar without quiting, 
        // old environment values are reappearing
        // to avoid get the values from global storage
        msgData.envVarValue = this.compMangerObj.getEnvFromGlobalState(this.configData["sdk_env"]);
        if (!msgData.envVarValue) {
          return null;
        }
        if (!fs.existsSync(msgData.envVarValue)) {
          return null;
        }

      }

      vscode.commands.executeCommand("webos.updateSDKPath", msgData.envVarValue);
      return msgData.envVarValue;
    } else {
      return null;
    }
  }
  openFolderDlg() {
    const options = {
      canSelectMany: false,
      canSelectFolders: true,
      canSelectFiles: false,
      openLabel: "Select folder",
    };
    vscode.window.showOpenDialog(options).then(async (folderUri) => {
      if (folderUri && folderUri[0]) {

        // check path has any content
        let filePath = vscode.Uri.file(folderUri[0].path);
        if (filePath.fsPath.includes(" ")) {
          vscode.commands.executeCommand('setContext', 'webosose.showpackagemanager', false);
          vscode.window.showErrorMessage(`Unable to configure Package Manager, selected folder name or parent folder name contains space character.`);
          return Promise.reject()
        }
        let osStr = os.platform().toLowerCase();
        if (osStr == "linux" || osStr == "darwin") {
          let cmd = ""
          let files = [];
          if (osStr == "linux") {
            cmd = "chmod 777  ~/.bashrc &&  chmod 777  ~/.profile"
            files.push(path.join(os.homedir(), ".bashrc"));
            files.push(path.join(os.homedir(), ".profile"));

          } else {
            // cmd = "chmod 777  ~/.bash_profile"

            if (fs.existsSync(path.join(os.homedir(), ".bash_profile"))) {
              cmd = "chmod 777  ~/.bash_profile"
              files.push(path.join(os.homedir(), ".bash_profile"));
            } else {
              cmd = `touch ${path.join(os.homedir(), ".bash_profile")} && chmod 777  ~/.bash_profile`
            }
          }
          if (files.length > 0) {
            try {
              files.forEach((element) => {
                let prgLoc = this.compMangerObj.executeCommandSync("which " + element)
                if (prgLoc != null) {
                  element = prgLoc.replace("\n", "")
                }
                fs.accessSync(element, fs.constants.W_OK);
              });

            } catch (e) {
              await this.compMangerObj.installManager.executeSudoCommand(cmd, false).catch((error) => {
                vscode.window.showErrorMessage(`Unable to configure Package Manager - ${error.message} `);
                vscode.commands.executeCommand('setContext', 'webosose.showpackagemanager', false);
                return Promise.reject()
              })
            }
          } else {
            await this.compMangerObj.installManager.executeSudoCommand(cmd, false).catch((error) => {
              vscode.window.showErrorMessage(`Unable to configure Package Manager - ${error.message} `);
              vscode.commands.executeCommand('setContext', 'webosose.showpackagemanager', false);
              return Promise.reject()
            })
          }
          // await this.compMangerObj.installManager.executeSudoCommand(cmd, false).catch((error) => {
          //   vscode.window.showErrorMessage(`Unable to configure Package Manager - ${error.message} `);
          //   vscode.commands.executeCommand('setContext', 'webosose.showpackagemanager', false);
          //   return Promise.reject()
          // })
        }


        const msgData = await this.compMangerObj.setPackageMangerEnvPath({
          envVarName: this.configData["sdk_env"],
          envVarValue: filePath.fsPath,
        });

        if (msgData.isSet) {

          await this.compMangerObj.setAnyEnvVariable("LG_WEBOS_TV_SDK_HOME", path.join(filePath.fsPath, "TV"));
          await this.compMangerObj.setAnyEnvVariable("WEBOS_CLI_TV", path.join(this.compMangerObj.getNpmGloablPath(), 'bin'));

          vscode.commands.executeCommand("webos.updateSDKPath", filePath.fsPath);
          await this.doStartEditor();
          this.doResolveWebview(this.panel)
        } else {
          vscode.window.showErrorMessage(`Unable to configure Package Manager - ${msgData.errMsg} `);
          vscode.commands.executeCommand('setContext', 'webosose.showpackagemanager', false);
          return Promise.reject()
        }
        return Promise.resolve();
      } else {
        vscode.commands.executeCommand('setContext', 'webosose.showpackagemanager', false);
        return Promise.reject()
      }


    })
  }


  async loadSDKManager() {

    return new Promise(async (resolve, reject) => {
      let configuredDir = null;
      configuredDir = await this.isEnvDirExists();

      if (configuredDir) {
        this.compMangerObj.envPath = configuredDir;
        this.compMangerObj.envPath_TV = path.join(configuredDir, "TV");
        await this.doStartEditor();
      } else {
        this.compMangerObj.envPath = "";
        this.compMangerObj.envPath_TV = "";
        if (await isElevated()) {
          this.promptForSDKDir();
          reject();
        } else {
          const header = "Package Manager";
          const options = {
            detail: "User do not have admin privilege. Please restart the VS Code with Admin Privilege",
            modal: true,
          };
          vscode.window.showInformationMessage(header, options);
          reject("NOADMIN");
        }
      }
      resolve()
    })

  }

  async doStartEditor() {
    await this.setTVCLIEnv();
    this.panel.webview.html = this.getLoaderHtml();
    // do not execute auto update on development mode
    if (this.context.extensionMode == 1) {
      if (await new AutoUpdate(this.context).doAutoUpateConfigFile()) {
        this.compMangerObj.configJson = this.compMangerObj.getConfigJson()
        this.configData = this.compMangerObj.configJson;
      }
    }
    this.compMangerObj.addDirectoriesIfNotAvl();
    this.compMangerObj.addStatusJsonIfNotAvl();
    this.compMangerObj.getStatusJson();
    await this.compMangerObj.updateCompStatus();
    await this.compMangerObj.updatePreReqStatus();
    this.compMangerObj.getDependancyJson();
    this.compMangerObj.clearDownloadDir();
    // this.compMangerObj.updateAvailableDiskspaceOnEnvPath();
    this.compMangerObj.addEnvIfMissing();
    this.compMangerObj.promptIfTVSDKInstallerIsAvailable();

  }
  async setTVCLIEnv() {

    let npmGPath = this.compMangerObj.getNpmGloablPath()
    let osStr = os.platform().toLowerCase();
    if (osStr == "linux" || osStr == "darwin") {
      npmGPath = path.join(npmGPath, 'bin')
    }
    if (this.compMangerObj.getEnvVarValue("WEBOS_CLI_TV") != npmGPath) {
      await this.compMangerObj.setAnyEnvVariable("WEBOS_CLI_TV", npmGPath);
    }


  }

  getDefaultDir() {
    let folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return folders[0].uri;
    } else {
      return null;
    }
  }

  getLoaderHtml() {
    const loadingUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "loading.gif"
      )
    );
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
			<body >
    
    <div  style =" display:flex;  justify-content: center; ">
                <img src="${loadingUri}" style ="width:30px;"></img>
                </div>
      </body>
                </html>
    `

  }
  getNoAdminHtml() {
    return `
    <html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
.center {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background:var(--vscode-activityBar-background);
}

</style>
</head>
<body>

<div class="center">
 <div style ="font-size:20px;color:white;position:absolute ">User do not have admin privilege. Please restart the VS Code with Admin Privilege</div>
 
 
</div>



</body>
</html>
    `
  }
  getHtmlForWebview(webview) {
    const tabviewCss = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "package_manager",
        "css",
        "tabview.css"
      )
    );

    const commonJs = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "package_manager",
        "js",
        "common.js"
      )
    );
    const treGridCss = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "package_manager",
        "css",
        "treegrid.css"
      )
    );
    const treeGridJS = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "package_manager",
        "js",
        "treegrid.js"
      )
    );
    const commonCss = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "package_manager",
        "css",
        "common.css"
      )
    );
    const faCss = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "package_manager",
        "css",
        "fa",
        "css",
        "all.css"
      )
    );
    const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

    return `
        <html lang="en">
        <head>
        <link href="${commonCss}" rel="stylesheet">
        <link href="${tabviewCss}" rel="stylesheet">
        <link href="${treGridCss}" rel="stylesheet">
        <link href="${faCss}" rel="stylesheet">
        <link href="${codiconsUri}" rel="stylesheet" />
     
        <dialog open  class="dlg" >
               ${this.getAllTreeGridView(["tv", "ose"], ["TV SDK", "OSE SDK"])}
        <div style ="padding-top:10px">SDK Location : ${this.compMangerObj.envPath.replace(this.compMangerObj.envPath.charAt(0), this.compMangerObj.envPath.charAt(0).toUpperCase())}</div>
        <div style ="padding-top:5px" id ="avlDskSpace"></div>
      
      </dialog>
      <script type='text/javascript' src="${commonJs}"></script>
      <script type='text/javascript' src="${treeGridJS}"></script>    
`;
  }
  getTreeTableHeaderHTML(id) {
    return `
      <div class="table-wrap"><table id="${"treegrid_" + id
      }" class="treegrid" role="treegrid" aria-label="sdk">
      <colgroup>
        <col id="treegrid-col1" style="width:20%">
        <col id="treegrid-col2" style="width:80%" >
      </colgroup>
      <thead style="display:none">
        <tr>
          <th scope="col" ></th>
          <th scope="col"></th>
        </tr>
      </thead>
      <tbody>
      `;
  }
  getTreeTableFooterHTML() {
    return `
    </tbody>
    </table>
    </div>
      `;
  }
  getTreeTableParentRowHTML(compName, displayName, sdk) {
    return `
      <tr data-rowprofile ="${sdk}" class ="trhover ${sdk != this.currentProfile ? " hiddenRow " : ""}" data-compname="${compName}"role="row" aria-level="2" aria-posinset="1" aria-setsize="1" aria-expanded="true">
        <td role="gridcell" style="width:100%;overflow-x:visibile">${displayName}</td>
       
        <td role="gridcell"></td>
      </tr>
      `;
  }
  getTreeTableCatRowHTML(catName, sdk) {
    return `
      <tr  data-rowprofile ="${sdk}" class ="trhover ${sdk != this.currentProfile ? " hiddenRow " : ""}" role="row" aria-level="1" aria-posinset="1" aria-setsize="1" aria-expanded="true">
        <td role="gridcell" style="width:100%;overflow-x:visibile">${catName}</td>
        
        <td role="gridcell"></td>
      </tr>
      `;
  }
  getTreeTableChildRowHTML(rowObj, statusJson, sdk) {

    let rowObjB64 = Buffer.from(JSON.stringify(rowObj)).toString("base64");
    let prerow = ` ${this.getActionInfoHTML(rowObj["compInfo"]["comp_uid"]
    )}`
    return `
      <tr data-rowprofile ="${sdk}" class="trhover childrow ${sdk != this.currentProfile ? " hiddenRow " : ""}" data-comp_uid="${rowObj["compInfo"]["comp_uid"]
      }"  data-rowobj ="${rowObjB64}" role="row" style="border-bottom:1px" aria-level="3" aria-posinset="1" aria-setsize="3" >
      <td role="gridcell" title ="Disk Space: ${this.convertSize(rowObj["compInfo"].expFileSizeInMB)}">${prerow}${rowObj["compInfo"]["shortDisplayName"]} </td>
       <td role="gridcell">${this.getActionHTML(
        rowObj,
        rowObj["sdk"],
        statusJson
      )}</td>
    </tr>
    
      `;
  }
  convertSize(sizeInMB) {
    if (sizeInMB >= 1000) {
      return sizeInMB / 1000 + "GB"
    } else {
      return sizeInMB + "MB"
    }
  }

  getActionHTML(rowObj, sdk, statusJson) {
    let isInstalled = false;
    if (
      statusJson &&
      statusJson != "" &&
      statusJson[sdk] &&
      statusJson[sdk][rowObj["compInfo"]["comp_uid"]]
    ) {

      isInstalled = true;
    }

    let html = `<span style="display:${isInstalled ? "none" : "block"}" id="${rowObj["compInfo"]["comp_uid"] + "_install"

      }"   onclick ="doRowAction('INSTALL_COMP','${Buffer.from(JSON.stringify(rowObj)).toString('base64')}')"><i title ="Install" style="cursor:pointer;float:right" class="  codicon codicon-empty-window"></i></span>
      <span style="display:${isInstalled ? "block" : "none"}"  id="${rowObj["compInfo"]["comp_uid"] + "_uninstall"
      }" class="" onclick ="doRowAction('UNINSTALL_COMP','${Buffer.from(JSON.stringify(rowObj)).toString('base64')}')"><i title ="Uninstall" style="cursor:pointer;float:right" class=" codicon codicon-trash"></i></span>
        <div class ="loadContainer" data-comp_uid = "${rowObj["compInfo"]["comp_uid"]}"  id="${rowObj["compInfo"]["comp_uid"] + "_loaderContainer"
      }">
       
        </div>
      `;
    return html;

  }
  getActionInfoHTML(comp_uid) {
    return `
    <span style="display:none" id ="${comp_uid + "_rowIcon"}" class="rowIcon"
      onmouseover ="showTooltipMsg('${comp_uid}')" onmouseout ="hideTooltipMsg('${comp_uid}')"> 
      <i class="fa fa-exclamation-triangle" aria-hidden="true"></i>
     <div style="display:none" id="${comp_uid + "_rowIconText"
      }" class="rowIconText"></div>
    </span>
    `;
  }

  getAllTreeGridView(sdks, sdkNames) {

    let configData = this.configData;
    let statusJson = this.compMangerObj.getStatusJson();
    if (configData != "") {
      let treeHTML = "";
      for (let k = 0; k < sdks.length; k++) {
        let config = configData[sdks[k]];

        treeHTML = treeHTML + this.getTreeTableCatRowHTML(sdkNames[k], sdks[k]);

        for (let i = 0; i < config["components"].length; i++) {
          let compName = config["components"][i]["type"];
          treeHTML =
            treeHTML +
            this.getTreeTableParentRowHTML(
              compName,
              config["components"][i]["displayName"],
              sdks[k]
            );

          for (let j = 0; j < config[compName].length; j++) {
            let rowObj = {};
            rowObj["sdk"] = sdks[k];
            rowObj["sdkDirName"] = config["subDirName"];
            rowObj["compName"] = compName;
            rowObj["displayName"] = config["components"][i]["displayName"];
            rowObj["compDirName"] = config["components"][i]["subDirName"];
            rowObj["compUID"] = config[compName][j]["comp_uid"];
            rowObj["compInfo"] = config[compName][j];
            rowObj["shortDisplayName"] = config["components"][i]["shortDisplayName"];

            treeHTML =
              treeHTML + this.getTreeTableChildRowHTML(rowObj, statusJson, sdks[k]);
          }
        }

      }
      treeHTML =
        this.getTreeTableHeaderHTML("_all") +
        treeHTML +
        this.getTreeTableFooterHTML();
      return treeHTML;
    }

  }


}
PackageManagerSidebar.viewType = 'packageMgr';
exports.PackageManagerSidebar = PackageManagerSidebar;
