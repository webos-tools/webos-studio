let configJson = {};
let statusJson = {};
const vscode = acquireVsCodeApi();
function setReleaseNote(row, treegridElem) {
  let rowObj = row.getAttribute("data-rowobj");

  let rNoteElement = null;
  switch (treegridElem.id) {
    case "treegrid_tv":
      rNoteElement = document.getElementById("tvnotecontent");
      break;
    case "treegrid_ose":
      rNoteElement = document.getElementById("osenotecontent");

      break;
  }
  if (rowObj == null) {
    // clear release note
    rNoteElement.innerText = "";
  } else {
    rNoteElement.innerText = JSON.parse(atob(rowObj))["compInfo"][
      "description"
    ];
  }
}

function doRowAction(command, rowObj) {
  rowObj = JSON.parse(atob(rowObj));
  if (command == "INSTALL_COMP") {
    // check prerequests
    let msg = {
      command: "CHECK_PREREQUISITES",
      data: {
        sdk: rowObj["sdk"],
        component: rowObj["compName"],
        componentInfo: {
          comp_uid: rowObj["compInfo"]["comp_uid"],
          sdk_version: rowObj["compInfo"]["sdk_version"],
          apiLevel: rowObj["compInfo"]["apiLevel"],
        },
      },
    };
    vscode.postMessage(msg);
  } else {
    let msg = {
      command: "UNINSTALL_COMP",
      data: {
        sdk: rowObj["sdk"],
        sdkSubDirName: rowObj["sdkDirName"],
        component: rowObj["compName"],
        componentSubDirName: rowObj["compDirName"],
        componentInfo: {
          comp_uid: rowObj["compInfo"]["comp_uid"],
          subDirName: rowObj["compInfo"]["subDirName"],
          sdk_version: rowObj["compInfo"]["sdk_version"],
          apiLevel: rowObj["compInfo"]["apiLevel"],
        },
      },
    };

    vscode.postMessage(msg);
  }
  hideRowIcon(rowObj["compInfo"]["comp_uid"]);
  showProgressBar(rowObj["compInfo"]["comp_uid"], "Checking");
}
function getRowObj(comp_uid) {
 
  let element = document.querySelector(`tr[data-comp_uid='${comp_uid}']`);
  let rowObjB64 = element.getAttribute("data-rowobj");
  return JSON.parse(atob(rowObjB64));
}
function showProgressBar(comp_uid, message) {
  let installBtn = document.getElementById(comp_uid + "_install");
  let unInstallBtn = document.getElementById(comp_uid + "_uninstall");
  let loaderContainer = document.getElementById(comp_uid + "_loaderContainer");
  let loader = document.getElementById(comp_uid + "_loader");
  let loaderMsg = document.getElementById(comp_uid + "_loaderMsg");
  installBtn.style.display = "none";
  unInstallBtn.style.display = "none";
  loaderContainer.style.display = "block";
  loaderMsg.innerText = message;
}
function showInstallBtn(comp_uid) {
  let installBtn = document.getElementById(comp_uid + "_install");
  let unInstallBtn = document.getElementById(comp_uid + "_uninstall");
  let loaderContainer = document.getElementById(comp_uid + "_loaderContainer");
  let loader = document.getElementById(comp_uid + "_loader");
  let loaderMsg = document.getElementById(comp_uid + "_loaderMsg");
  installBtn.style.display = "block";
  unInstallBtn.style.display = "none";
  loaderContainer.style.display = "none";
  loaderMsg.innerText = "";
}
function showUnInstallBtn(comp_uid) {
  let installBtn = document.getElementById(comp_uid + "_install");
  let unInstallBtn = document.getElementById(comp_uid + "_uninstall");
  let loaderContainer = document.getElementById(comp_uid + "_loaderContainer");
  let loader = document.getElementById(comp_uid + "_loader");
  let loaderMsg = document.getElementById(comp_uid + "_loaderMsg");
  installBtn.style.display = "none";
  unInstallBtn.style.display = "block";
  loaderContainer.style.display = "none";
  loaderMsg.innerText = "";
}
function showTooltipMsg(comp_uid) {
  document.getElementById(comp_uid + "_rowIconText").style.display = "block";
}
function hideTooltipMsg(comp_uid) {
  document.getElementById(comp_uid + "_rowIconText").style.display = "none";
}
function showRowIcon(comp_uid, msg) {
  document.getElementById(comp_uid + "_rowIcon").style.display = "block";
  document.getElementById(comp_uid + "_rowIconText").innerText = msg;
}
function hideRowIcon(comp_uid) {
  document.getElementById(comp_uid + "_rowIcon").style.display = "none";
  document.getElementById(comp_uid + "_rowIconText").innerText = "";
}
function isCompInstalled(comp_uid, sdk) {
  if (statusJson != "" && statusJson[sdk] && statusJson[sdk]["installed"]) {
    for (let i = 0; i < statusJson[sdk]["installed"].length; i++) {
      if (statusJson[sdk]["installed"][i]["comp_uid"] == comp_uid) {
        return true;
      }
    }
  }
  return false;
}
function showActionButton(comp_uid,sdk){
  if(isCompInstalled(comp_uid,sdk)){
    showUnInstallBtn(comp_uid);
  }else{
    showInstallBtn(comp_uid);
  }
}
function handleMsg() {
  window.addEventListener("message", (event) => {
    const message = event.data; // The json data that the extension sent

    switch (message.command) {
      case "SET_CONFIG_JSON": {
        configJson = message.data;
        break;
      }
      case "SET_STATUS_JSON": {
        statusJson = message.data;
        break;
      }
      case "CHECK_PREREQUISITES_COMPLETE": {
        if (message.data["isSuccess"]) {
          showProgressBar(
            message.data["componentInfo"]["comp_uid"],
            "Checking"
          );
          // send install msg
          let rowObj = getRowObj(message.data["componentInfo"]["comp_uid"]);

          vscode.postMessage({
            command: "INSTALL_COMP",
            data: {
              sdk: rowObj["sdk"],
              sdkSubDirName: rowObj["sdkDirName"],
              component: rowObj["compName"],
              componentSubDirName: rowObj["compDirName"],
              componentInfo: rowObj["compInfo"],
            },
          });
        } else {
          // set error
          showRowIcon(
            message.data["componentInfo"]["comp_uid"],
            message.data["message"]
          );

          showActionButton(message.data["componentInfo"]["comp_uid"],message.data["sdk"])
        }

        break;
      }
      case "DOWNLOAD_FILE_COMPLETE": {
        showProgressBar(
          message.data["componentInfo"]["comp_uid"],
          "Downloading"
        );
        break;
      }
      case "EXTRACT_FILE_COMPLETE": {
        showProgressBar(
          message.data["componentInfo"]["comp_uid"],
          "Extracting"
        );
        break;
      }
      case "REGISTER_COMP_COMPLETE": {
        showProgressBar(
          message.data["componentInfo"]["comp_uid"],
          "Registering"
        );
        break;
      }
      case "CREATE_SHORTCUTS_COMPLETE": {
        showProgressBar(
          message.data["componentInfo"]["comp_uid"],
          "Adding Shortcut"
        );
        break;
      }

      case "INSTALL_COMP_COMPLETE": {
        showUnInstallBtn(message.data["componentInfo"]["comp_uid"]);
        vscode.postMessage({
          command: "GET_STATUS_JSON",
          data: {},
        });
       
        break;
      }
      case "UNINSTALL_COMP_COMPLETE": {
        showInstallBtn(message.data["componentInfo"]["comp_uid"]);
        vscode.postMessage({
          command: "GET_STATUS_JSON",
          data: {},
        });
        break;
      }
      case "ERROR_PACKAGE_MANAGER": {
        showRowIcon(
          message.data["componentInfo"]["comp_uid"],
          message.data["message"]
        );

        showActionButton(message.data["componentInfo"]["comp_uid"],message.data["sdk"])
        break;
      }
    }
  });
}

function init() {
  handleMsg();
  vscode.postMessage({
    command: "GET_CONFIG_JSON",
    data: {},
  });
}
init();
