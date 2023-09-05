/*
 * Copyright (c) 2021-2022 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const { isElevated } = require("./lib/isElevated");
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { ComponentMgr } = require("./componentManager");

class PackageManagerPanel {
  constructor(context) {
    this.context = context;
    this.compMangerObj = new ComponentMgr(context);
    this.configData = this.compMangerObj.configJson;
    this.panel = null;


  }
  resolveWebviewView(panel) {
    this.panel = panel;
    this.compMangerObj.panel = panel
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
    this.loadSDKManager().then(() => {

      panel.webview.options = {
        // Allow scripts in the webview
        enableScripts: true,
        retainContextWhenHidden: true,
        enableForms: true,
        localResourceRoots: [this.context.extensionUri]
      };

      panel.webview.html = this.getHtmlForWebview(this.panel.webview);

      setTimeout(() => {
        this.panel.webview.postMessage({
          command: "SET_STATUS_JSON",
          data: this.compMangerObj.getStatusJson(),
        });
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
              break; // msg.text
            }

            case "INSTALL_COMP": {
              this.compMangerObj.installCompAndDependancy(msg.data, this.panel)

              break; // msg.text
            }
            case "UNINSTALL_COMP":
              this.compMangerObj.unInstallComp(msg.data, this.panel);

              break;
            case "CANCEL_DOWNLOAD": {
              this.compMangerObj.cancelDownload(msg.data)
              break; // msg.text
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
    const header = "Configuring Package Manager";
    const options = {
      detail: "Please select the directory to configure Package Manager",
      modal: true,
    };
    vscode.window
      .showInformationMessage(header, options, ...["Select Folder"])
      .then((answer) => {
        if (answer === "Select Folder") {
          // return Promise.resolve();
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
        return false;
      }

      return true;
    } else {
      return false;
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
          vscode.window.showErrorMessage(`Unable to configure Package Manager, selected folder name or parent folder name contains sapce charactor`);
          return Promise.reject()
        }
        let osStr = os.platform().toLowerCase();
        if (osStr == "linux" || osStr == "darwin") {
          let cmd = ""
          if (osStr == "linux") {
            cmd = "chmod 777  ~/.bashrc &&  chmod 777  ~/.profile"
          } else {
            cmd = "chmod 777  ~/.bash_profile"
          }
          await this.compMangerObj.installManager.executeSudoCommand(cmd, false).catch((error) => {
            vscode.window.showErrorMessage(`Unable to configure Package Manager - ${error.message} `);
            vscode.commands.executeCommand('setContext', 'webosose.showpackagemanager', false);
            return Promise.reject()
          })
        }


        const msgData = await this.compMangerObj.setPackageMangerEnvPath({
          envVarName: this.configData["sdk_env"],
          envVarValue: filePath.fsPath,
        });

        if (msgData.isSet) {

          await this.compMangerObj.setAnyEnvVariable("LG_WEBOS_TV_SDK_HOME", path.join(filePath.fsPath, "TV"))
          await this.compMangerObj.setAnyEnvVariable("WEBOS_CLI_TV", path.join(filePath.fsPath, "TV", "CLI", "bin"))


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
      let isConfigured = false;
      isConfigured = await this.isEnvDirExists();
      if (isConfigured) {
        await this.doStartEditor();
      } else {
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
    this.panel.webview.html = this.getLoaderHtml();
    this.compMangerObj.addDirectoriesIfNotAvl();
    this.compMangerObj.addStatusJsonIfNotAvl();
    this.compMangerObj.getStatusJson();
    await this.compMangerObj.updateCompStatus()
    await this.compMangerObj.updatePreReqStatus()
    this.compMangerObj.getDependancyJson();
    this.compMangerObj.clearDownloadDir()
    this.compMangerObj.updateAvailableDiskspaceOnEnvPath();
    this.compMangerObj.addEnvIfMissing();

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
.wave {
  width: 5px;
  height: 50px;
  background: linear-gradient(45deg, var(--vscode-textLink-foreground), #fff);
  margin: 10px;
  animation: wave 1s linear infinite;
  border-radius: 20px;
}
.wave:nth-child(2) {
  animation-delay: 0.1s;
}
.wave:nth-child(3) {
  animation-delay: 0.2s;
}
.wave:nth-child(4) {
  animation-delay: 0.3s;
}
.wave:nth-child(5) {
  animation-delay: 0.4s;
}
.wave:nth-child(6) {
  animation-delay: 0.5s;
}
.wave:nth-child(7) {
  animation-delay: 0.6s;
}
.wave:nth-child(8) {
  animation-delay: 0.7s;
}
.wave:nth-child(9) {
  animation-delay: 0.8s;
}
.wave:nth-child(10) {
  animation-delay: 0.9s;
}

@keyframes wave {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1);
  }
  100% {
    transform: scale(0);
  }
}
}
</style>
</head>
<body>

<div class="center">
 <div style ="font-size:20px;color:white;position:absolute ">Loading</div>
  <div class="wave"></div>
  <div class="wave"></div>
  <div class="wave"></div>
  <div class="wave"></div>
  <div class="wave"></div>
  <div class="wave"></div>
  <div class="wave"></div>
  <div class="wave"></div>
  <div class="wave"></div>
  <div class="wave"></div>
 
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
    const tabviewJs = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "package_manager",
        "js",
        "tabview.js"
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

    return `
        <html lang="en">
        <head>
        <link href="${commonCss}" rel="stylesheet">
        <link href="${tabviewCss}" rel="stylesheet">
        <link href="${treGridCss}" rel="stylesheet">
        <link href="${faCss}" rel="stylesheet">
     
        <dialog open  class="dlg" >
       
          <div id = "tabs">
              <div class="tab">
                <button id="tvhead" class="tablinks" onclick="openTab(event, 'tv')">webOS TV </button>
                <button id="osehead" class="tablinks" onclick="openTab(event, 'ose')">webOS OSE</button>
              </div>

              <div id="tv" class="tabcontent">
           
                ${this.getCompTreeGridView("tv")}
                
                <fieldset id="tvnotes" class="notes">
                  <legend class="notelegend" >Release Notes</legend>
                  <div class ="notecontent" id="tvnotecontent"> 
                   
                  </div>
                </fieldset>
    
              </div>

              <div id="ose" class="tabcontent">
       
              ${this.getCompTreeGridView("ose")}
             
                <fieldset id="osenotes" class="notes">
                <legend class="notelegend" >Release Notes</legend>
                <div class ="notecontent" id="osenotecontent"> 
               
                </div>
              </fieldset>
              </div>

                <div style ="padding-top:10px; display: flex; justify-content: space-between;">
                <div>SDK Location : ${this.compMangerObj.envPath.replace(this.compMangerObj.envPath.charAt(0), this.compMangerObj.envPath.charAt(0).toUpperCase())}</div>
                <div id ="avlDskSpace"></div>
              </div>
              
      </dialog>
      <script type='text/javascript' src="${commonJs}"></script>
      <script type='text/javascript' src="${tabviewJs}"></script>
      <script type='text/javascript' src="${treeGridJS}"></script>    
`;
  }
  getTreeTableHeaderHTML(id) {
    return `
      <div class="table-wrap"><table id="${"treegrid_" + id
      }" class="treegrid" role="treegrid" aria-label="sdk">
      <colgroup>
        <col id="treegrid-col1" style="width:40%">
        <col id="treegrid-col2" style="width:15%" >
        <col id="treegrid-col3" style="width:70px" >
        <col id="treegrid-col4" style="width:15%" >
        <col id="treegrid-col5" style="width:20px" >
        <col id="treegrid-col6" style="width:30%" >
      </colgroup>
      <thead>
        <tr>
          <th scope="col" >Component</th>
          <th scope="col" >Version</th>
          <th scope="col">Status</th>
          <th scope="col">Disk Space</th>
          <th scope="col"></th>
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
  getTreeTableParentRowHTML(compName, displayName) {
    return `
      <tr data-compname="${compName}"role="row" aria-level="1" aria-posinset="1" aria-setsize="1" aria-expanded="true">
        <td role="gridcell">${displayName}</td>
        <td role="gridcell"></td>
        <td role="gridcell"></td>
        <td role="gridcell"></td>
        <td role="gridcell"></td>
        <td role="gridcell"></td>
      </tr>
      `;
  }
  getTreeTableChildRowHTML(rowObj, statusJson) {

    let rowObjB64 = Buffer.from(JSON.stringify(rowObj)).toString("base64");
    return `
      <tr class="trhover childrow" data-comp_uid="${rowObj["compInfo"]["comp_uid"]
      }"  data-rowobj ="${rowObjB64}" role="row" style="border-bottom:1px" aria-level="2" aria-posinset="1" aria-setsize="3" >
      <td role="gridcell">${rowObj["compInfo"].displayName}</td>
      <td role="gridcell"> ${rowObj["compInfo"].sdk_version}</td>
     
      <td role="gridcell"><div id="${rowObj["compUID"]}_check">${statusJson &&
        statusJson != "" &&
        statusJson[rowObj["sdk"]] &&
        statusJson[rowObj["sdk"]][rowObj["compInfo"]["comp_uid"]]
        ? `<i class="fa fa-check" ></i>`
        : ""
      }</div></td>
      <td role="gridcell"> ${this.convertSize(rowObj["compInfo"].expFileSizeInMB)}</td>
      <td role="gridcell" style="padding-left:0px">${this.getActionInfoHTML(
        rowObj["compInfo"]["comp_uid"]
      )}</td>
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

    let html = `<button style="display:${isInstalled ? "none" : "block"}" id="${rowObj["compInfo"]["comp_uid"] + "_install"

      }"  class="tg_button" onclick ="doRowAction('INSTALL_COMP','${Buffer.from(JSON.stringify(rowObj)).toString('base64')}')">Install</button>
      <button style="display:${isInstalled ? "block" : "none"}"  id="${rowObj["compInfo"]["comp_uid"] + "_uninstall"
      }" class="tg_button secondary" onclick ="doRowAction('UNINSTALL_COMP','${Buffer.from(JSON.stringify(rowObj)).toString('base64')}')">Uninstall</button>
        <div class ="loadContainer" data-comp_uid = "${rowObj["compInfo"]["comp_uid"]}"  id="${rowObj["compInfo"]["comp_uid"] + "_loaderContainer"
      }">
       
        </div>
      `;
    return html;
  }
  getActionInfoHTML(comp_uid) {
    return `
    <div style="display:none" id ="${comp_uid + "_rowIcon"}" class="rowIcon"
      onmouseover ="showTooltipMsg('${comp_uid}')" onmouseout ="hideTooltipMsg('${comp_uid}')"> 
      <i class="fa fa-exclamation-triangle" aria-hidden="true"></i>
     <div style="display:none" id="${comp_uid + "_rowIconText"
      }" class="rowIconText"></div>
    </div>
    `;
  }
  getCompTreeGridView(sdk) {
    let configData = this.configData;
    let statusJson = this.compMangerObj.getStatusJson();
    if (configData != "") {
      let config = configData[sdk];

      let treeHTML = "";
      for (let i = 0; i < config["components"].length; i++) {
        let compName = config["components"][i]["type"];
        treeHTML =
          treeHTML +
          this.getTreeTableParentRowHTML(
            compName,
            config["components"][i]["displayName"]
          );
        for (let j = 0; j < config[compName].length; j++) {
          let rowObj = {};
          rowObj["sdk"] = sdk;
          rowObj["sdkDirName"] = config["subDirName"];
          rowObj["compName"] = compName;
          rowObj["displayName"] = config["components"][i]["displayName"];
          rowObj["compDirName"] = config["components"][i]["subDirName"];
          rowObj["compUID"] = config[compName][j]["comp_uid"];
          rowObj["compInfo"] = config[compName][j];
          treeHTML =
            treeHTML + this.getTreeTableChildRowHTML(rowObj, statusJson);
        }
      }
      treeHTML =
        this.getTreeTableHeaderHTML(sdk) +
        treeHTML +
        this.getTreeTableFooterHTML();
      return treeHTML;
    }
  }
}
PackageManagerPanel.viewType = 'pkgmgr';
exports.PackageManagerPanel = PackageManagerPanel;
