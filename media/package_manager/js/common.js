/*
 * Copyright (c) 2021-2022 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
let configJson = {};
let statusJson = {};
const vscode = acquireVsCodeApi();
let isChecking = false;
let pbarJson = {};


function setReleaseNote(row, treegridElem) {
  let rNoteElement = null;
  switch (treegridElem.id) {
    case "treegrid_tv":
      rNoteElement = document.getElementById("tvnotecontent");
      break;
    case "treegrid_ose":
      rNoteElement = document.getElementById("osenotecontent");

      break;

  }
  if (rNoteElement) {
    if (treegridElem.id == "treegrid_progress") {
      let plog = row.getAttribute("data-processLog");
      if (plog != "") {
        rNoteElement.innerText = atob(plog);
      }
    } else {
      let rowObj = row.getAttribute("data-rowobj");
      if (rowObj == null) {
        // clear release note
        rNoteElement.innerText = "";
      } else {
        if (JSON.parse(atob(rowObj))["compInfo"]) {
          rNoteElement.innerText = JSON.parse(atob(rowObj))["compInfo"][
            "description"
          ];
        } else {
          rNoteElement.innerText = JSON.parse(atob(rowObj))["description"];
        }
      }
    }
  }
}


function cancelDownload(comp_uid, isComp) {

  let msg = {
    command: "CANCEL_DOWNLOAD",
    data: {
      comp_uid: comp_uid,
      isComp: isComp

    }
  };

  vscode.postMessage(msg);
}
function doRowAction(command, rowObj) {
  if (isChecking) {
    return;
  }
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
    isChecking = true;
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
          shortName: rowObj["compInfo"]["shortName"],
          subDirName: rowObj["compInfo"]["subDirName"],
          sdk_version: rowObj["compInfo"]["sdk_version"],
          apiLevel: rowObj["compInfo"]["apiLevel"],
        },
      },
    };
    vscode.postMessage(msg);
  }
  hideRowIcon(rowObj["compInfo"]["comp_uid"]);
  doShowProgressBar(rowObj["compInfo"]["comp_uid"], "Verifying", null, "CHECKING");
}
function getRowObj(comp_uid) {
  let element = document.querySelector(`tr[data-comp_uid='${comp_uid}']`);
  let rowObjB64 = element.getAttribute("data-rowobj");
  return JSON.parse(atob(rowObjB64));
}
function showMsgWithoutPbar(comp_uid, message) {
  let installBtn = document.getElementById(comp_uid + "_install");
  let unInstallBtn = document.getElementById(comp_uid + "_uninstall");

  installBtn.style.display = "none";
  unInstallBtn.style.display = "none";
  pbarJson[comp_uid].showMessageWithoutProgressBar(message)
}
function doShowProgressBar(comp_uid, message, val, step) {
  let installBtn = document.getElementById(comp_uid + "_install");
  let unInstallBtn = document.getElementById(comp_uid + "_uninstall");
  installBtn.style.display = "none";
  unInstallBtn.style.display = "none";
  pbarJson[comp_uid].showProgressBar(val, message, step)
}

function showCancelBtn(comp_uid) {
  let cancelContainer = document.getElementById(comp_uid + "_loader_cancel");
  cancelContainer.style.display = "block";
  let prgcancelContainer = document.getElementById(comp_uid + "_prg_loader_cancel");
  prgcancelContainer.style.display = "block";


}
function hideCancelBtn(comp_uid) {
  let cancelContainer = document.getElementById(comp_uid + "_loader_cancel");
  cancelContainer.style.display = "none";
  let prgcancelContainer = document.getElementById(comp_uid + "_prg_loader_cancel");
  prgcancelContainer.style.display = "none";

}
function showProgressBarInSDKTab(comp_uid, message, val, step, displayName, isComp) {

  pbarJson[comp_uid].showProgressBar(val, displayName + "- " + message, step, isComp)
}

function hideProgressBarInSDKTab(comp_uid) {
  let loaderContainer = document.getElementById(comp_uid + "_loaderContainer");
  loaderContainer.style.display = "none";

}
function showRowInstallStatus(comp_uid, ver, preReqKey) {
  // set tick mark
  // set installed version text
  let check = document.getElementById(comp_uid + "_check");
  check.innerHTML = '<i  class="fa fa-check" ></i>';

}
function hideRowInstallStatus(comp_uid) {
  // set tick mark
  // set installed version text
  let check = document.getElementById(comp_uid + "_check");
  check.innerHTML = "";
}
function showInstallBtn(comp_uid) {
  let installBtn = document.getElementById(comp_uid + "_install");
  let unInstallBtn = document.getElementById(comp_uid + "_uninstall");
  let loaderContainer = document.getElementById(comp_uid + "_loaderContainer");
  installBtn.style.display = "block";
  unInstallBtn.style.display = "none";
  loaderContainer.style.display = "none";
  pbarJson[comp_uid].hideButtonArea()
}
function showUnInstallBtn(comp_uid) {
  let installBtn = document.getElementById(comp_uid + "_install");
  let unInstallBtn = document.getElementById(comp_uid + "_uninstall");
  let loaderContainer = document.getElementById(comp_uid + "_loaderContainer");
  installBtn.style.display = "none";
  unInstallBtn.style.display = "block";
  loaderContainer.style.display = "none";
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

function showRowIconSDK(comp_uid, msg) {
  document.getElementById(comp_uid + "_rowIcon").style.display = "block";
  document.getElementById(comp_uid + "_rowIconText").innerText = msg;
}

function hideRowIconSDK(comp_uid) {
  document.getElementById(comp_uid + "_rowIcon").style.display = "none";
  document.getElementById(comp_uid + "_rowIconText").innerText = "";
}
function isCompInstalled(comp_uid, sdk) {
  if (statusJson != "" && statusJson[sdk] && statusJson[sdk][comp_uid]) {
    return true;
  }
  return false;
}
function showActionButton(comp_uid, sdk) {
  if (isCompInstalled(comp_uid, sdk)) {
    showUnInstallBtn(comp_uid);
  } else {
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
      case "CHECKING_PREREQUISITES":
        doShowProgressBar(
          message.data["componentInfo"]["comp_uid"],
          "Verifying",
          null,
          "CHECKING"
        );


        break;
      case "CHECK_PREREQUISITES_COMPLETE": {
        isChecking = false;
        if (message.data["isSuccess"]) {
          doShowProgressBar(
            message.data["componentInfo"]["comp_uid"],
            message.data["depInstallKey"].length > 0 ? "Waiting" : "Downloading",
            null,
            "CHECKING"
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
              depInstall: message.data["depInstall"],
              depInstallKey: message.data["depInstallKey"],
            },
          });
        } else {
          // set error
          if (message.data["message"] != "") {
            showRowIcon(
              message.data["componentInfo"]["comp_uid"],
              message.data["message"]
            );
          }


          showActionButton(
            message.data["componentInfo"]["comp_uid"],
            message.data["sdk"]
          );
        }

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
        hideRowInstallStatus(message.data["componentInfo"]["comp_uid"]);
        break;
      }
      case "ERROR_PACKAGE_MANAGER": {
        if (message["errMsg"] != "") {
          showRowIcon(
            message.data["componentInfo"]["comp_uid"],
            message["errMsg"]
          );
        }

        showActionButton(
          message.data["componentInfo"]["comp_uid"],
          message.data["sdk"]
        );

        break;
      }


      case "DOWNLOAD_CANCELED": {

        break;
      }
      case "PAUSE_START_PRGBAR": {
        handlePauseStartPrgBar(message)
        break;
      }


      case "PRG_UPDATE": {
        if (!message.data["isError"]) {

          hideRowIconSDK(message.data["comp_uid"]);
          showProgressBarInSDKTab(
            message.data["comp_uid"],
            message.data["message"], message.data["val"], message.data["step"], message.data["displayName"], message.data["isComp"]);
        } else {

          hideProgressBarInSDKTab(message.data["comp_uid"]);
          showRowIconSDK(message.data["comp_uid"], message.data["message"]);
        }

        break;
      }
      case "PRG_UPDATE_COMP": {

        if (!message.data["isError"]) {

          hideProgressBarInSDKTab(message.data["comp_uid"]);

          if (message.data["isPreReqCom"]) {
            // start indef progress before installing next comp
            doShowProgressBar(
              message.data["comp_uid"],
              "Verifying",
              null,
              "CHECKING"
            );
          } else {
            showRowInstallStatus(message.data["row_uid"], message.data["ver"], message.data["key"]);

          }

        } else {
          hideProgressBarInSDKTab(message.data["comp_uid"]);
          if (message.data["message"] != "") {
            showRowIconSDK(message.data["comp_uid"], message.data["message"]);
          }


        }

        break;
      }
      case "DSKSPACE_UPDATE": {

        document.getElementById("avlDskSpace").innerHTML = "Available Space : " + message.data["dskSpace"]

        break;
      }
    }
  });
}
function handlePauseStartPrgBar(message) {
  if (message.data["isPaused"]) {
    pbarJson[message.data.componentInfo["comp_uid"]].pausePbar(message.data)
  } else {
    pbarJson[message.data.componentInfo["comp_uid"]].restartPbar(message.data)
  }
}
function init() {
  handleMsg();
  vscode.postMessage({
    command: "GET_CONFIG_JSON",
    data: {},
  });
  createPrgBarsJson(document);

}

function createPrgBarsJson(parent) {
  let allParentElements = parent.querySelectorAll(`div[class='loadContainer']`);
  for (let i = 0; i < allParentElements.length; i++) {
    let uid = allParentElements[i].getAttribute("data-comp_uid");
    pbarJson[uid] = new HProgressBar(allParentElements[i], false)

  }

}
class HProgressBar {

  constructor(parent, isPrgTab) {

    this.parentEle = parent
    this.isPrgTab = isPrgTab;
    this.hpbarContiner = null;
    this.hpbar = null;
    this.hpbarMsg = null;
    this.hpbarRightArea = null;
    this.indefProgress = null;
    this.installProgress = null;
    this.addPrgBarElement();
    this.isPbarPaused = false;

  }
  addPrgBarElement() {

    this.comp_uid = this.parentEle.getAttribute("data-comp_uid");
    // to cresate a prgbar element in prg area
    this.parentEle.innerHTML = "";
    this.hpbarContiner = document.createElement("div");
    this.hpbarContiner.setAttribute("class", "hpbarContiner");
    this.hpbarContiner.style.display = "none"
    this.parentEle.appendChild(this.hpbarContiner);


    this.hpbar = document.createElement("div");
    this.hpbar.setAttribute("class", "hpbar");
    this.hpbarContiner.appendChild(this.hpbar);

    this.hpbarMsg = document.createElement("div");
    this.hpbarMsg.setAttribute("class", "hpbarMsg");
    this.hpbarContiner.appendChild(this.hpbarMsg);


    this.hpbarRightArea = document.createElement("div");
    this.hpbarRightArea.setAttribute("class", "hpbarRightArea");
    this.hpbarContiner.appendChild(this.hpbarRightArea);

    this.cancelBtn = document.createElement("button");
    this.cancelBtn.setAttribute("class", "tg_cancelbutton");
    this.hpbarRightArea.appendChild(this.cancelBtn);
    this.cancelBtn.innerText = "Cancel";
    this.cancelBtn.onclick = this.doCancelDownload.bind(this)

  }
  doCancelDownload() {

    cancelDownload(this.comp_uid, this.cancelBtn.getAttribute("isComp"))

  }
  hideProgressBar() {
    // will be called on error or update end
    this.hpbarContiner.style.display = "none"
    this.clearIndefProgress()
    this.clearInstallProgress();
    this.hideButtonArea();
    this.hpbar.style.width = "0%"
    this.hpbar.style.marginLeft = "0%"
    this.setPBarMsg("")




  }
  showMessageWithoutProgressBar(message) {
    // will be called on error or update end
    this.parentEle.style.display = "block"
    this.hpbarContiner.style.display = "flex"
    this.clearIndefProgress()
    this.clearInstallProgress();
    this.hideButtonArea();
    this.hpbar.style.width = "0%"
    this.hpbar.style.marginLeft = "0%"
    this.setPBarMsg(message)




  }
  showProgressBar(val, message, step, isComp) {
    this.parentEle.style.display = "block"
    this.hpbarContiner.style.display = "flex"

    switch (step) {
      case "CHECKING":
      case "WAITING":
      case "UNINSTALLING":
        this.hideButtonArea();
        this.clearInstallProgress();
        this.clearIndefProgress();
        this.startIndefinteProgress(message)

        break;
      case "DOWNLOADING":
        {
          let msg = val != null && val != "" ? message + " " + val + "%" : message
          this.hpbarMsg.innerText = msg;


          this.hideButtonArea()
          if (val != null && val != "") {
            this.clearIndefProgress();
            this.clearInstallProgress();
            this.showButtonArea(isComp);
            this.startDownLadingProgess(val, msg, 0.5)
          }

        }
        break;
      case "EXTRACTING":
      case "INSTALLING":
        this.hideButtonArea();
        this.clearIndefProgress();
        this.clearInstallProgress()
        this.startInstallProgress(message)
        break;

    }

  }
  pausePbar(msgData) {
    this.isPbarPaused = true;
  }
  restartPbar(msgData) {
    this.isPbarPaused = false
  }
  hideButtonArea() {
    this.hpbarRightArea.style.display = "none";
    this.cancelBtn.setAttribute("isComp", "");
  }
  showButtonArea(isComp) {
    this.hpbarRightArea.style.display = "block";
    this.cancelBtn.setAttribute("isComp", isComp);
  }

  startIndefinteProgress(message) {
    this.setPBarMsg(message)
    this.hpbar.setAttribute("class", "hpbar");
    // will be called on 

    if (!this.indefProgress) {
      let counter = 0

      this.indefProgress = setInterval(() => {
        if (!this.isPbarPaused) {
          counter++;
        }

        this.hpbar.style.width = counter + "%"
        if (counter > 40) {
          this.hpbar.style.marginLeft = counter - 40 + "%"
        }
        if (counter >= 100) {

          this.hpbar.classList.add("hpbarNoBG");
          this.hpbar.classList.remove("hpbar");

          counter = 0
          this.hpbar.style.marginLeft = "0%";
          setTimeout(() => {
            this.hpbar.classList.add("hpbar");
            this.hpbar.classList.remove("hpbarNoBG");

          }, 35)


        }

      }, 30)
    }

  }
  startDownLadingProgess(val, message, divder) {
    this.hpbar.setAttribute("class", "hpbar");
    this.hpbar.style.width = (val * .7) + "%";//(val * divder) + "%"
    this.setPBarMsg(message)
  }
  startInstallProgress(message) {
    this.setPBarMsg(message)
    this.hpbar.setAttribute("class", "hpbar");
    // will be called on 

    if (!this.installProgress) {
      let counter = 0

      this.installProgress = setInterval(() => {
        if (!this.isPbarPaused) {
          counter++;
        }

        this.hpbar.style.width = counter + "%"
        if (counter > 40) {
          this.hpbar.style.marginLeft = counter - 40 + "%"
        }
        if (counter >= 100) {

          this.hpbar.classList.add("hpbarNoBG");
          this.hpbar.classList.remove("hpbar");

          counter = 0
          this.hpbar.style.marginLeft = "0%";
          setTimeout(() => {
            this.hpbar.classList.add("hpbar");
            this.hpbar.classList.remove("hpbarNoBG");

          }, 35)


        }

      }, 30)
    }

  }

  setPBarMsg(message) {

    let right = 0;
    if (this.cancelBtn.getBoundingClientRect().left != 0) {
      right = this.cancelBtn.getBoundingClientRect().left
    } else {
      right = this.hpbarContiner.getBoundingClientRect().right
    }

    this.hpbarMsg.style.width = (right - this.hpbarMsg.getBoundingClientRect().left) - 2 + "px"
    this.hpbarMsg.innerText = message

  }
  clearIndefProgress() {
    if (this.indefProgress) {
      clearInterval(this.indefProgress);
      this.indefProgress = null;
      this.hpbar.style.width = "0%"
      this.hpbar.style.marginLeft = "0%"
      this.setPBarMsg("")
    }

  }

  clearInstallProgress() {
    if (this.installProgress) {
      clearInterval(this.installProgress);
      this.installProgress = null;
      this.hpbar.style.width = "0%"
      this.hpbar.style.marginLeft = "0%"
      this.setPBarMsg("")
    }

  }

}

init();
document.addEventListener('contextmenu', event => event.preventDefault());
