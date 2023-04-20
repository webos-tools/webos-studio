/*
 * Copyright (c) 2021-2022 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

class SDK_Manager {
  constructor(context) {
    this.context = context;
    this.editorVer = 1;
    this.expressServer = null;
    this.lastSrcCodeSavedPath = null;
    this.lastCompPath = null;
    this.panel = null;
    this.configData = this.getConfigFile();
    this.envPath = "";
  }
  promptForSDKDir() {
    const header = "Configuring Package Manager";
    const options= {
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
        }
      });
   
  }
  isEnvDirExists() {
    //TODO
    // const result = await installer.checkPrerequisites({"envVarName":this.configData["sdk_env"]});
    // if( !result.error){
    //   this.envPath = result.data.path;
    // }

    return false;
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
        this.envPath = folderUri[0].fsPath;
        //TODO
        // const result = await installer.setEnvPath({
        //   envVarName: this.configData["sdk_env"],
        //   envVarValue: folderUri[0].fsPath,
        // });
        // if (!result.error) {
        //   this.envPath =folderUri[0].fsPath;

        //   this.startEditor();

        // }else{
        //   vscode.window
        //   .showInformationMessage(
        //     `Unable to configure package manager - ${result.error} `
        //   )
        // }

        this.startEditor();
      }
      return Promise.resolve();
    });
  }

  loadSDKManager() {
    if (this.isEnvDirExists()) {
      this.startEditor();
    } else {
      this.promptForSDKDir();
    }
  }

  startEditor() {
    // check is directory exist

    this.panel = vscode.window.createWebviewPanel(
      "sdkmanager", // Identifies the type of the webview. Used internally
      "SDK Manager", // Title of the panel displayed to the user
      vscode.ViewColumn.One, // Editor column to show the new webview panel in.
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );
    this.panel.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      enableForms: true,
    };
    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
    this.panel.onDidDispose(
      () => {
        // this.expressServer.close();
        this.panel = undefined;
      },
      null,
      this.context.subscriptions
    );

    setTimeout(() => {
      this.panel.webview.postMessage({
        command: "SET_STATUS_JSON",
        data: this.getStatusJson(),
      });
    }, 100);

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      console.log("Webview message received-----------");
      console.log(msg.command);
      console.log(msg);
      switch (msg.command) {
        case "GET_CONFIG_JSON": {
          this.panel.webview.postMessage({
            command: "SET_CONFIG_JSON",
            data: this.configData,
          });
          break;
        }
        case "GET_STATU_JSON": {
          this.panel.webview.postMessage({
            command: "SET_STATUS_JSON",
            data: this.getStatusJson(),
          });
          break;
        }
        case "CHECK_PREREQUISITES": {
          msg.data["isSuccess"] = true;
          msg.data["message"] = "Pre req not installed";
          setTimeout(() => {
            this.panel.webview.postMessage({
              command: "CHECK_PREREQUISITES_COMPLETE",
              data: msg.data,
            });
          }, 1000);
          break; // msg.text
        }

        case "INSTALL_COMP": {
          setTimeout(() => {
            this.panel.webview.postMessage({
              command: "DOWNLOAD_FILE_COMPLETE",
              data: msg.data,
            });
          }, 1000);
          setTimeout(() => {
            this.panel.webview.postMessage({
              command: "EXTRACT_FILE_COMPLETE",
              data: msg.data,
            });
          }, 2000);
          setTimeout(() => {
            this.panel.webview.postMessage({
              command: "REGISTER_COMP_COMPLETE",
              data: msg.data,
            });
          }, 3000);
          setTimeout(() => {
            this.panel.webview.postMessage({
              command: "CREATE_SHORTCUTS_COMPLETE",
              data: msg.data,
            });
          }, 4000);
          setTimeout(() => {
            this.panel.webview.postMessage({
              command: "INSTALL_COMP_COMPLETE",
              data: msg.data,
            });
          }, 5000);

          break; // msg.text
        }
        case "UNINSTALL_COMP":
          setTimeout(() => {
            this.panel.webview.postMessage({
              command: "UNINSTALL_COMP_COMPLETE",
              data: msg.data,
            });
          }, 1000);
      }
    });
  }

  getDefaultDir() {
    let folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return folders[0].uri;
    } else {
      return null;
    }
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

    return `
        <html lang="en">
        <head>
        <link href="${commonCss}" rel="stylesheet">
        <link href="${tabviewCss}" rel="stylesheet">
        <link href="${treGridCss}" rel="stylesheet">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        
        	

        <dialog open  class="dlg" >
              <h3 class="tabheader">Package Manager</h3>
              
        
          <div id = "tabs">
              <div class="tab">
                <button id="tvhead" class="tablinks" onclick="openTab(event, 'tv')">webOS TV </button>
                <button id="osehead" class="tablinks" onclick="openTab(event, 'ose')">webOS OSE</button>
                <button id="prghead" style ="  border-top-right-radius: 5px;" class="tablinks" onclick="openTab(event, 'progress')">Progress</button>
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

              <div id="progress" class="tabcontent">
              ${this.getProgressTreeGridView()}
                
              </div>
              </div>
              <div style="padding-top:10px">SDK Location:- ${this.envPath}</div>
              
      </dialog>
      <script type='text/javascript' src="${commonJs}"></script>
      <script type='text/javascript' src="${tabviewJs}"></script>
      <script type='text/javascript' src="${treeGridJS}"></script>    
`;
  }
  getTreeTableHeaderHTML(id) {
    return `
      <div class="table-wrap"><table id="${
        "treegrid_" + id
      }" class="treegrid" role="treegrid" aria-label="Inbox">
      <colgroup>
        <col id="treegrid-col1" style="width:40%">
        <col id="treegrid-col2" style="width:15%" >
        <col id="treegrid-col3" style="width:15%" >
        <col id="treegrid-col4" style="width:20px" >
        <col id="treegrid-col5" style="width:30%" >
      </colgroup>
      <thead>
        <tr>
          <th scope="col" >Component</th>
          <th scope="col" >Version</th>
          <th scope="col" >API Level</th>
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
      </tr>
      `;
  }
  getTreeTableChildRowHTML(rowObj, statusJson) {
    let rowObjB64 = Buffer.from(JSON.stringify(rowObj)).toString("base64");
    return `
      <tr class="trhover childrow" data-comp_uid="${
        rowObj["compInfo"]["comp_uid"]
      }"  data-rowobj ="${rowObjB64}" role="row" style="border-bottom:1px" aria-level="2" aria-posinset="1" aria-setsize="3">
      <td role="gridcell">${rowObj["compInfo"].displayName}</td>
      <td role="gridcell"> ${rowObj["compInfo"].sdk_version}</td>
      <td role="gridcell"> ${rowObj["compInfo"].apiLevel}</td>
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
  getActionHTML(rowObj, sdk, statusJson) {
    let isInstalled = false;
    if (statusJson != "" && statusJson[sdk] && statusJson[sdk]["installed"]) {
      for (let i = 0; i < statusJson[sdk]["installed"].length; i++) {
        if (
          statusJson[sdk]["installed"][i]["type"] == rowObj["type"] &&
          statusJson[sdk]["installed"][i]["comp_uid"] ==
            rowObj["compInfo"]["comp_uid"]
        ) {
          isInstalled = true;
          break;
        }
      }
    }
    let html = `<button style="display:${isInstalled ? "none" : "block"}" id="${
      rowObj["compInfo"]["comp_uid"] + "_install"
    }"  class="tg_button" onclick ="doRowAction('INSTALL_COMP','${btoa(
      JSON.stringify(rowObj)
    )}')">Install</button>
      <button style="display:${isInstalled ? "block" : "none"}"  id="${
      rowObj["compInfo"]["comp_uid"] + "_uninstall"
    }" class="tg_button" onclick ="doRowAction('UNINSTALL_COMP','${btoa(
      JSON.stringify(rowObj)
    )}')">UnInstall</button>
        <div style="display:none" id="${
          rowObj["compInfo"]["comp_uid"] + "_loaderContainer"
        }">
        <div style="display:flex">
        <div id="${
          rowObj["compInfo"]["comp_uid"] + "_loader"
        }"class ="loader"></div><div style="padding-left:5px" id="${
      rowObj["compInfo"]["comp_uid"] + "_loaderMsg"
    }"></div>
        </div>
        </div>
      `;
    return html;
  }
  getActionInfoHTML(comp_uid) {
    return `
    <div style="display:none" id ="${comp_uid + "_rowIcon"}" class="rowIcon"
      onmouseover ="showTooltipMsg('${comp_uid}')" onmouseout ="hideTooltipMsg('${comp_uid}')"> 
      <i class="fa fa-exclamation-triangle" aria-hidden="true"></i>
     <div style="display:none" id="${
       comp_uid + "_rowIconText"
     }" class="rowIconText"></div>
    </div>
    `;
  }
  getProgressTreeGridView() {
    return `<div class="table-wrap"><table id="treegrid" role="treegrid" aria-label="Inbox">
      <colgroup>
        <col id="treegrid-col1">
        <col id="treegrid-col2">
        <col id="treegrid-col3">
      </colgroup>
      <thead>
        <tr>
          <th scope="col">SDK</th>
          <th scope="col">Component</th>
          <th scope="col">Version</th>
        </tr>
      </thead>
      <tbody>
        <tr role="row" aria-level="1" aria-posinset="1" aria-setsize="1" aria-expanded="true">
          <td role="gridcell">TV</td>
          <td role="gridcell"></td>
          <td role="gridcell"></td>
        </tr>
        <tr role="row" aria-level="2" aria-posinset="1" aria-setsize="3">
          <td role="gridcell">cli</td>
          <td role="gridcell">1.0.1</td>
          <td role="gridcell"><div class="loader"></div></td>
        </tr>
        <tr role="row" aria-level="1" aria-posinset="1" aria-setsize="1" aria-expanded="true">
        <td role="gridcell">OSE</td>
        <td role="gridcell"></td>
        <td role="gridcell"></td>
      </tr>
      <tr role="row" aria-level="2" aria-posinset="1" aria-setsize="3">
        <td role="gridcell">cli</td>
        <td role="gridcell">1.0.1</td>
        <td role="gridcell"><div class="loader"></div></td>
      </tr>
      </tbody>
    </table></div>`;
  }

  getCompTreeGridView(sdk) {
    let configData = this.configData; //getConfigFile();
    let statusJson = this.getStatusJson();
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
  getConfigFile() {
    let jsonPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      "media",
      "package_manager",
      "js",
      "config.json"
    );
    let configData = "";
    try {
      configData = fs.readFileSync(jsonPath.fsPath, "utf8");
      return JSON.parse(configData);
    } catch (e) {
      console.log("err " + e);
      return "";
    }
  }
  getStatusJson() {
    let configData = "";
    try {
      let jsonPath = vscode.Uri.joinPath(
        this.context.extensionUri,
        "media",
        "package_manager",
        "js",
        "status.json"
      );
      configData = fs.readFileSync(jsonPath.fsPath, "utf8");
      // configData = fs.readFileSync(path.join(this.envPath, "status.json"),"utf-8")
      return JSON.parse(configData);
    } catch (e) {
      console.log("err " + e);
      return "";
    }
  }
}

exports.SDK_Manager = SDK_Manager;
