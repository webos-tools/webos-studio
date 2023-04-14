/*
  * Copyright (c) 2021-2022 LG Electronics Inc.
  * SPDX-License-Identifier: Apache-2.0
*/
const vscode = require("vscode");
const path = require('path');
const fs = require('fs');


class SDK_Manager {

    constructor(context) {
        this.context = context
        this.editorVer = 1;
        this.expressServer = null;
        this.lastSrcCodeSavedPath = null;
        this.lastCompPath = null;
        this.panel = null;
    }

    startEditor() {



        this.panel = vscode.window.createWebviewPanel(
            'sdkmanager', // Identifies the type of the webview. Used internally
            'SDK Manager', // Title of the panel displayed to the user
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
            }
        this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
        this.panel.onDidDispose(
            () => {
                // this.expressServer.close();
                this.panel = undefined;
            },
            null,
            this.context.subscriptions
        );

       
        this.panel.webview.onDidReceiveMessage(async msg => {
            console.log("Webview message received-----------");
            console.log(msg.command);
            console.log(msg);
            switch (msg.command) {
                case 'IMPORT_IPK_FILE':
                    {
                        break;
                    }
                case 'INSTALL_COMP':
                    {

                      this.panel.webview.postMessage({ command: 'START_PROGRESS', "data":msg.data})
                        break; // msg.text
                    }
                case 'READ_CONFIG':{
                  break;
                }
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
        const tabviewCss = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', "package_manager", "css", 'tabview.css'));
        const tabviewJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', "package_manager", "js", 'tabview.js'));
        const commonJs = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', "package_manager", "js", 'common.js'));
        const treGridCss = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', "package_manager", "css", 'treegrid.css'));
        const treeGridJS = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', "package_manager", "js", 'treegrid.js'));
      
        return `
        <html lang="en">
        <head>
        <link href="${tabviewCss}" rel="stylesheet">
        <link href="${treGridCss}" rel="stylesheet">

        <dialog open  class="dlg" >
              <h3 class="tabheader">Package Manager</h3>

              <div class="tab">
                <button id="tvhead" class="tablinks" onclick="openTab(event, 'tv')">webOS TV </button>
                <button id="osehead" class="tablinks" onclick="openTab(event, 'ose')">webOS OSE</button>
                <button id="prghead" style ="align:right" class="tablinks" onclick="openTab(event, 'progress')">Progress</button>
              </div>

              <div id="tv" class="tabcontent">
              
               
                
                ${this.getCompTreeGridView("tv")}
                
                <fieldset id="tvnotes" class="notes">
                  <legend class="notelegend" >Release Notes</legend>
                  <div id="tvnotecontent"> 
                   
                  </div>
                </fieldset>

               
              </div>

              <div id="ose" class="tabcontent">
              
                
              ${this.getCompTreeGridView("ose")}
             
                <fieldset id="osenotes" class="notes">
                <legend class="notelegend" >Release Notes</legend>
                <div id="osenotecontent"> 
               
                </div>
              </fieldset>
              </div>

              <div id="progress" class="tabcontent">
              ${this.getProgressTreeGridView()}
                
              </div>
              
      </dialog>
      <script type='text/javascript' src="${commonJs}"></script>
      <script type='text/javascript' src="${tabviewJs}"></script>
      <script type='text/javascript' src="${treeGridJS}"></script>    
`;
    }
    getTreeTableHeaderHTML(id){
      return `
      <div class="table-wrap"><table id="${"treegrid_"+id}" class="treegrid" role="treegrid" aria-label="Inbox">
      <colgroup>
        <col id="treegrid-col1">
        <col id="treegrid-col2">
        <col id="treegrid-col3">
        <col id="treegrid-col4">
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Component</th>
          <th scope="col">Version</th>
          <th scope="col">API Level</th>
          <th scope="col"></th>
        </tr>
      </thead>
      <tbody>
      `
    }
    getTreeTableFooterHTML(){
      return `
    </tbody>
    </table>
    </div>
      `
    }
    getTreeTableParentRowHTML(compName,displayName){
      return `
      <tr data-compname="${compName}"role="row" aria-level="1" aria-posinset="1" aria-setsize="1" aria-expanded="true">
        <td role="gridcell">${displayName}</td>
        <td role="gridcell"></td>
        <td role="gridcell"></td>
        <td role="gridcell"></td>
      </tr>
      `
    }
    getTreeTableChildRowHTML(rowObj,compName,sdk,statusJson,j){
      let altRowStyle ="";
      if((j+1) %2 == 0){
        altRowStyle = ` style="background-color:whitesmoke"`
      }
      let rowObjB64 =Buffer.from(JSON.stringify(rowObj)).toString('base64')
      return `
      <tr ${altRowStyle} data-compName="${compName}" data-sdk="${sdk}" data-rowobj ="${rowObjB64}" role="row" style="border-bottom:1px" aria-level="2" aria-posinset="1" aria-setsize="3">
      <td role="gridcell">${rowObj.displayName}</td>
      <td role="gridcell"> ${rowObj.sdk_version}</td>
      <td role="gridcell"> ${rowObj.apiLevel}</td>
      <td role="gridcell">${this.getActionHTML(rowObj,compName,sdk,statusJson)}</td>
    </tr>
      `
    }
    getActionHTML(rowObj,compName,sdk,statusJson){
      let isInstalled =false;
      if(statusJson != "" && statusJson[sdk] && statusJson[sdk]["installed"]){
        for (let i = 0; i< statusJson[sdk]["installed"].length;i++){
          if(statusJson[sdk]["installed"][i]["type"]==rowObj["type"]&& statusJson[sdk]["installed"][i]["sdk_version"]==rowObj["sdk_version"]){
            isInstalled = true
            break;
          }
        }

      }
      if(isInstalled){
        return `<button onclick ="doRowAction('INSTALL_COMP','${btoa(JSON.stringify(rowObj))}','${compName}','${sdk}')">Uninstall</button>`
      }else{
        return `<button onclick ="doRowAction('INSTALL_COMP','${btoa(JSON.stringify(rowObj))}','${compName}','${sdk}')">Install</button>`
      }
      // if(rowObj["isInProgress"]){
      //   return `<div class ="loader"></div> <div>Installing</div>`
      // }else{
        
      // }
    }
    getProgressTreeGridView(){
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
    </table></div>`

    }

    getCompTreeGridView(sdk){
    let configData =   this.getConfigFile();
    let statusJson =   this.getStatusJson();
    if(configData !=""){
      let config = configData[sdk]
      let treeHTML = "";
      for (let i = 0; i< config["components"].length;i++){
        let compName = config["components"][i]["type"]
        treeHTML = treeHTML+ this.getTreeTableParentRowHTML(compName,config["components"][i]["displayName"])
        for (let j = 0; j< config[compName].length;j++){
          treeHTML = treeHTML+ this.getTreeTableChildRowHTML( config[compName][j],compName,sdk,statusJson,j)
       }
      }
      treeHTML = this.getTreeTableHeaderHTML(sdk)+treeHTML+this.getTreeTableFooterHTML()
      return treeHTML;
    }
   

    }
    getConfigFile(){
      let jsonPath  =  vscode.Uri.joinPath(this.context.extensionUri, 'media', "package_manager", "js", 'config.json')
      let configData =""
      try {
        configData = fs.readFileSync(jsonPath.fsPath, 'utf8');
        return  JSON.parse(configData);
      }
      catch (e) {
          console.log("err " + e);
          return "";
      }
  
    }
    getStatusJson(){
      let jsonPath  =  vscode.Uri.joinPath(this.context.extensionUri, 'media', "package_manager", "js", 'status.json')
      let configData =""
      try {
        configData = fs.readFileSync(jsonPath.fsPath, 'utf8');
        return  JSON.parse(configData);
      }
      catch (e) {
          console.log("err " + e);
          return "";
      }
  
    }
   
}

exports.SDK_Manager = SDK_Manager;
