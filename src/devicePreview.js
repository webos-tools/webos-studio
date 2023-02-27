/*
 * Copyright (c) 2021-2022 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = require("vscode");
const path = require("path");
const { fileURLToPath } = require("url");
const { InputController } = require("./lib/inputController");
const { InputChecker } = require("./lib/inputChecker");
const ares = require("./lib/runCommand");
const { getDefaultDir } = require("./lib/workspaceUtils");
const appUtils = require("./lib/appUtil");
const portfinder = require("portfinder");
const notify = require("./lib/notificationUtils");

const { getDeviceList, getInstalledList } = require("./lib/deviceUtils");
const fs = require("fs");
const defaultGateway = require("default-gateway");
const os = require("os");

const watch = require("node-watch");

const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const enactUtils = require("./lib/enactUtils");
const kill = require("tree-kill");
let sysIP = "127.0.0.1";
const { logger } = require('./lib/logger');
const chalk = require('chalk');

let userAppDir = "";
let targetDevice = null;
let isEnact;
let dp_appId;
let socketClient = null;
let dpContext = {
  isPreviewStarted: false,
  userAppDir: "",
  targetDevice: "",
  isEnact: false,
  previewPort: "",
  previewProcess: null,
  appFileWatcher: null,
  previewURL: "",
  isPreviewUrlSent: false,
  enactCompileCount: 0,
};

async function devicePreviewStart(appSelectedDir, context) {
   

  dp_appId = getDevicePreviewAppId(context);

  let device = null;

  let deviceList = await getDeviceList();
  sysIP = getNWAddress(os.networkInterfaces());
  // get default device
  let deviceListDefault = deviceList.filter((device) => {
    return device.default === true;
  });
  if (deviceListDefault.length > 0) {
    device = deviceListDefault[0];
  }

  /// get the app dir
  let defaultDir = getDefaultDir();
  let defaultString = "";
  let appDir;
  let appId;

  if (defaultDir) {
    defaultString = ` (default: ${defaultDir})`;
  }

  let folderBtn = InputController.FileBrowser;
  folderBtn.bindAction(async function (thisInput) {
    let folder = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
    });
    if (folder) {
      thisInput.value = fileURLToPath(folder[0].toString(true));
    }
  });

  let controller = new InputController();
  controller.addStep({
    title: "Device Preview",
    placeholder: `App Directory${defaultString}`,
    prompt: "Enter Directory/Path to Preview on Device",
    buttons: [folderBtn],
    validator: function (value) {
      if (value === "") {
        if (defaultDir) {
          let appInfoError = InputChecker.checkAppInfoExists(defaultDir);
          if (appInfoError) {
            return appInfoError;
          } else {
            return null;
          }
        } else {
          return "The directory must be specified.";
        }
      }
      // return InputChecker.checkDirectoryExist(value);

      let folderError = InputChecker.checkDirectoryExist(value);
      if (folderError != null) {
        return folderError;
      } else {
        let appInfoError = InputChecker.checkAppInfoExists(value);
        if (appInfoError) {
          return appInfoError;
        } else {
          appUtils.getAppId(value, (id) => {
            appId = id;
            return null;
          });
        }
      }
    },
  });
  if (appSelectedDir) {
    appDir = appSelectedDir;
    appUtils.getAppId(appDir, (id) => {
      appId = id;
    });
  } else {
    let results = await controller.start();
    appDir = results.shift() || defaultDir;
  }

  if (!path.isAbsolute(appDir) && defaultDir) {
    appDir = path.join(defaultDir, appDir);
  }

  if (!device) {
    let controller = new InputController();
    controller.addStep({
      title: "Select the Device",
      placeholder: "Select Target Device",
      items: deviceList
        .map(
          (device) =>
            `${device.name} (${device.username}@${device.ip}:${device.port})`
        )
        .map((label) => ({ label })),
    });

    let results = await controller.start();
    let deviceName = results.shift();
    deviceName = deviceName.slice(0, deviceName.indexOf(" ("));
    let deviceListSel = deviceList.filter((device) => {
      return device.name == deviceName;
    });

    device = deviceListSel[0];
  }

  if (appDir && device) {
    userAppId = appId;
    userAppDir = appDir;
    targetDevice = device;
    isEnact = await enactUtils.isEnactApp(appDir);
    await devicePreviewStop(context, false, dpContext);

    dpContext.userAppDir = userAppDir;
    dpContext.targetDevice = targetDevice;
    dpContext.isEnact = isEnact;

    installContainerAppOnDeviceAndLaunch(context, device);
  
  }
}

function updateConfigJs(context, port) {
  try {
    fs.writeFileSync(
      path.join(context.extensionPath, "device_preview", "js", "config.js"),
      `var SOCKET_SERVER_IP ="${sysIP}";
           var SOCKET_SERVER_PORT ="${port}";`,
      "utf8"
    );
  } catch (e) {
    console.log("error updating configfile", e);
  }
}
function getDevicePreviewAppId(context) {
  let rawdata = fs.readFileSync(
    path.join(context.extensionPath, "device_preview", "appinfo.json")
  );
  return JSON.parse(rawdata).id;
}
async function installContainerAppOnDeviceAndLaunch(context, device) {
  let appDir = path.join(context.extensionPath, "device_preview");
  let outDir = path.join(context.extensionPath, "device_preview", "out");

  portfinder
    .getPortPromise()
    .then(async (port) => {
      updateConfigJs(context, port);
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Setting Up Device Preview..",
          cancellable: false,
        },
        async (progress) => {
          await notify.showProgress(progress, 40, "Packaging ");
          await ares
            .package(appDir, outDir, false, "")
            .then(async (ipkFile) => {
              let ipkPath = path.join(outDir, ipkFile);
              await notify.showProgress(progress, 60, "Installing ");
              await ares
                .install(ipkPath, device.name)
                .then(async () => {
                  // launch the app
                  startSocketServer(sysIP, port);

                  await notify.showProgress(progress, 80, `Launching`);
                  await ares
                    .launch(dp_appId, device.name, undefined, 0)
                    .then(async () => {
                      await notify.clearProgress(
                        progress,
                        "Device Preview App Launched"
                      );
                      // start the serving app

                      setTimeout(() => {
                        startLocalPreview();
                      }, 500);
                    })
                    .catch(async (err) => {
                      let errMsg = `Failed to launch ${dp_appId} on ${device.name}.`;
                      if (err.includes(`Connection time out`)) {
                        errMsg = `Please check ${device}'s IP address or port.`;
                      }
                      await notify.clearProgress(progress, `ERROR! ${errMsg}`);
                      let erMsg = err.toString();
                      vscode.window.showErrorMessage(
                        `ERROR! ${errMsg}. Details As follows: ${erMsg}`
                      );
                    });
                })
                .catch(async (err) => {
                  let errMsg = `Failed to install ${ipkPath} on ${device.name}.`;
                  if (
                    err.includes(`Unknown method "install" for category "/dev"`)
                  ) {
                    errMsg = `Please make sure the 'Developer Mode' is on.`;
                  } else if (err.includes(`Connection time out`)) {
                    errMsg = `Please check ${device.name}'s IP address or port.`;
                  }
                  await notify.clearProgress(progress, `ERROR! ${errMsg}`);
                  let erMsg = err.toString();
                  vscode.window.showErrorMessage(
                    `ERROR! ${errMsg}. Details As follows: ${erMsg}`
                  );
                });
              // resolve(ipkPath);
            })
            .catch((err) => {
              console.log("error", err);
              throw err;
            });
        }
      );
    })
    .catch((err) => {
      console.log(err);
      vscode.window.showErrorMessage(`Error! Failed to get free port`);
    });
}
function getNWAddress(networkInterfaces) {
  // const { gateway, interface } = defaultGateway.v4.sync();
  const result = defaultGateway.v4.sync();
  for (let i = 0; i < networkInterfaces[result["interface"]].length; i++) {
    let addrEntity = networkInterfaces[result["interface"]][i];
    if (addrEntity["family"] == "IPv4" && !addrEntity["internal"]) {
      return addrEntity["address"];
    }
  }
  return "127.0.0.1";
}
async function startSocketServer(ip, port) {
  // const socketPort = data.socketPort;
  // const hostAppId = hostAppHelper.getHostAppId(data.baseAppPath);
  // const hostAppName = hostAppId.split('.')[1];
  // deviceName = deviceInfo.deviceName; //global
  // const hostAppPath = deviceInfo.appInstallPath + hostAppName;
  // module.exports.closeSocketServer();
  // appLaunchHelper.terminateApp(deviceName, hostAppId);

  http.listen(port, ip, () => {
    console.log(`listening on ${port}`);
  });

  http.close((e) => {
    if (!e.message.includes("Server is not running")) {
      console.log(`Close listening: ${e.message}`);
    }
  });

  http.on("error", (e) => {
    console.log(`Error listening: ${e.message}`);
  });

  socketClient = io.on("connection", (socket) => {
    theSocket = socket;
    console.log(`a user connected`);
    console.log(`new client connected, id = ${socket.id} `);
    socket.emit("connection_resp", { status: "connected" });

    socket.on("app_url_req", () => {
      console.log(`socket on::::app_url_req`);
      if (dpContext.isPreviewStarted) {
        socket.emit("app_url_resp", { url: dpContext.previewURL });
      }
      // if(dpContext.enactCompileCount ==1){
      //   socket.emit("preview_progress", {
      //     statusText: "App Preview : Compiling",
      //     progress: 90,
      //   });
      // }
    });
    socket.on("disconnect", () => {
      console.log(`disconnect, id = ${socket.id}`);
      socket.disconnect(true);
      socketClient.close();
    });

    socket.once("connect_error", () => {
      console.log(`socket once::::connect_error`);
    });
  });
}
async function startLocalPreview() {
  // send starting dev server
  let enactProgressTimer = null;
  let pvalue = 10;
  if (socketClient) {
    socketClient.emit("preview_progress", {
      statusText: "App Preview : Starting Development Server",
      progress: pvalue,
    });
  }
  // enact app take time
  if (isEnact) {
    enactProgressTimer = setInterval(() => {
      pvalue++;
      if (pvalue < 60) {
        if (socketClient) {
          socketClient.emit("preview_progress", {
            statusText: "App Preview : Starting Development Server",
            progress: pvalue,
          });
        }
      } else {
        clearInterval(enactProgressTimer);
      }
    }, 3000);
  }

  portfinder
    .getPortPromise()
    .then(async (port) => {
      await ares
        .server(userAppDir, isEnact, port)
        .then(async ([url, child]) => {
          // trigger app load
          dpContext.previewProcess = child;
          dpContext.previewPort = port;
          dpContext.previewURL = url;
          dpContext.isPreviewStarted = true;
          dpContext.isPreviewUrlSent = false;
          if (isEnact) {
            // send compailing
            clearInterval(enactProgressTimer);
            if (socketClient) {
              socketClient.emit("preview_progress", {
                statusText: "App Preview : Compiling",
                progress: pvalue,
              });
            }

            enactProgressTimer = setInterval(() => {
              pvalue++;
              if (pvalue < 95) {
                if (socketClient) {
                  socketClient.emit("preview_progress", {
                    statusText: "App Preview : Compiling",
                    progress: pvalue,
                  });
                }
              } else {
                clearInterval(enactProgressTimer);
              }
            }, 3000);

            child.stdout.on("data", async (data) => {
              console.error("process data ->", data.toString());

              let outData = data.toString();

              if (outData.includes("Compiling...")) {
                dpContext.enactCompileCount++;
                if (dpContext.enactCompileCount == 1) {
                  //todo
                }
              }

              // if done
              if (
                outData.includes("Failed to compile") ||
                outData.includes("Compiled with warnings") ||
                outData.includes("Compiled successfully")
              ) {
               
                if (dpContext.isPreviewUrlSent) {
                  // await ares.launchClose(dp_appId, targetDevice.name, 0);
                  // await ares.launch(dp_appId, targetDevice.name, undefined, 0);
                } else {
                  if (socketClient) {
                    dpContext.isPreviewUrlSent = true;
                    socketClient.emit("preview_progress", {
                      statusText: "App Preview : Loading App",
                      progress: 100,
                    });
                    socketClient.emit("app_url_resp", {
                      url: dpContext.previewURL,
                    });
                  }
                }
              }
            });
          } else {
         
            if (socketClient) {
              socketClient.emit("preview_progress", {
                statusText: "App Preview : Loading App",
                progress: 100,
              });

              dpContext.isPreviewUrlSent = true;
              socketClient.emit("app_url_resp", { url: url });
            }
            dpContext.appFileWatcher = watch(
              userAppDir,
              { recursive: true },
              async (evt, name) => {
                console.log("File changes->" + `${name} ${evt}`);
                await ares.launchClose(dp_appId, targetDevice.name, 0);
                await ares.launch(dp_appId, targetDevice.name, undefined, 0);
              }
            );
          }
        })
        .catch((err) => {
          console.log("process error -", err);
          vscode.window.showErrorMessage(
            `Error! Failed to run a local server.`
          );
        });
    })
    .catch((err) => {
      console.log(err);
      vscode.window.showErrorMessage(`Error! Failed to get free port`);
    });
}
// watchForAppChanges(path.join(userAppDir));
// function watchForAppChanges(basePath) {
//   console.log("watching ->", basePath);

//   dpContext.appFileWatcher = watch(
//     basePath,
//     { recursive: true },
//     async (evt, name) => {
//       console.log("File changes->"+`${name} ${evt}`);
//       // await ares.launchClose(dp_appId, targetDevice.name, 0);
//       // await ares.launch(dp_appId, targetDevice.name, undefined, 0);

//     }
//   );
// }

async function devicePreviewStop(context, isFromCommand) {
  dp_appId = getDevicePreviewAppId(context);
  // dpContext = dp_context;
  if (targetDevice == null) {
    let deviceList = await getDeviceList();

    // get default device
    let deviceListDefault = deviceList.filter((device) => {
      return device.default === true;
    });
    if (deviceListDefault.length > 0) {
      targetDevice = deviceListDefault[0];
    }
  }
  if (targetDevice) {
    // if(!dpContext.isPreviewStarted ){
    //   if(isFromCommand){
    //     vscode.window.showErrorMessage(
    //       "Preview Procress is in Process, Unable to Stop Device Preview"
    //      );
    //      return;
    //   }

    // }
    let deviceName = targetDevice.name;
    await ares
      .installRemove(dp_appId, deviceName)
      .then(async () => {
        if (dpContext.previewProcess != null) {
          dpContext.previewProcess.stdin.pause();
          kill(dpContext.previewProcess.pid);
        }
        if (dpContext.appFileWatcher != null) {
          dpContext.appFileWatcher.close();
        }
        http.close();
        io.removeAllListeners("connection");
        io.close();
        if (isFromCommand)
          vscode.window.showInformationMessage(
            "Device Preview has been stoped."
          );
      })
      .catch((err) => {
        console.log("Error on removing  Device Preview App on " + deviceName);
        if (isFromCommand)
          vscode.window.showErrorMessage(
            "Error on removing  Device Preview App on " + deviceName
          );
      });

    dpContext = {
      isPreviewStarted: false,
      userAppDir: "",
      targetDevice: "",
      isEnact: false,
      previewPort: "",
      previewProcess: null,
      appFileWatcher: null,
      previewURL: "",
      isPreviewUrlSent: false,
      enactCompileCount: 0,
    };
  } else {
    vscode.window.showErrorMessage(
      `Unable to connect to device to stop preview `
    );
  }
}
module.exports = {
  devicePreviewStart: devicePreviewStart,
  devicePreviewStop: devicePreviewStop,
};
