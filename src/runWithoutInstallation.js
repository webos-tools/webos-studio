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

const {
  getDeviceList,
  getInstalledList,
  getRunningList,
  updateDeviceStatus,
} = require("./lib/deviceUtils");
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
const { logger } = require("./lib/logger");
const { rejects } = require("assert");

let userAppDir = "";
let targetDevice = null;
let isEnact;
let dp_appInfo;
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
  socketPort: "",
  socketIp: "",
};
let containerAppInfo = null;

 let gContext =null;
async function runWithoutInstall(appSelectedDir, context) {
   gContext =context;

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

  let appDir;
  let appId;

  /// get the app dir
  let defaultDir = getDefaultDir();
  let defaultString = "";

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
    title: "Auto reload Application",
    placeholder: `App Directory${defaultString}`,
    prompt: "Enter Directory/Path to Auto reload Application on Device",
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

    if(!isEnact){
      const title = 'Auto Reload Application';
      const prompt = 'Enter Directory Path to Run';
      const hostIp = sysIP;
      const deviceName = device.name;
    
      // ares-launch --hosted --host-ip
      ares.launchHosted(appDir, deviceName, hostIp)
          .then(() => {
              vscode.window.showInformationMessage(`Success! ${appDir} is running on ${deviceName}.`);
            }).catch((err) => {
            console.log(err.toString())
              let errMsg = `Failed to run ${appDir} on ${deviceName}.`;
           
              if (typeof err === 'string' && err.includes(`Unknown method`) && err.includes(`for category "/dev"`)) {
                  errMsg = `Please make sure the 'Developer Mode' is on.`;
              } else if (typeof err === 'string' && err.includes(`Connection time`)) {
                  errMsg = `Please check ${deviceName}'s IP address or port.`;
              }else if(err.toString().includes("uncaughtException")) {
                errMsg = `Please check ${deviceName}'s IP address or port.`;
              };
              vscode.window.showErrorMessage(`Error! ${errMsg}`);
          });
          return;
    }
    //In case of Enact Auto Reload App
    dp_appInfo = getRunWithoutInstallAppId(context);

    containerAppInfo = await getExistingContainerAppInfo(device);

    dpContext.isEnact = isEnact;
    if (
      dpContext.previewProcess != null &&
      containerAppInfo &&
      dpContext.userAppDir == appDir &&
      dpContext.targetDevice["name"] == targetDevice.name
    ) {
      onlyLaunchContainerApp(context, device);
    } else {
      await stopServerAndClearResources(context, false);
      dpContext.userAppDir = userAppDir;
      dpContext.targetDevice = targetDevice;
      if (containerAppInfo) {
        // launch
        startSocketAndLaunchContainerApp(context, device);
      } else {
        installContainerAndStartSocketAndLaunch(context, device);
      }
    }
    require('./ga4Util').mpGa4Event("runWithoutInstall", {category:"Commands"});
  }
}

async function getExistingContainerAppInfo(device) {
  let installedAppInfoObj = {};

  await ares
    .installListFull(device.name)
    .then(async (appInfo) => {
      let appInfoArray = appInfo.split('\n')
    
      let appInfoJsonArray = [];

      appInfoArray.forEach((cell) => {
        try {
          appInfoJsonArray.push(cell.trim());
        } catch (e) {}
      });

      //getRunningList
      let runningAppIdJson = await getRunningAppJson(device);

      appInfoJsonArray.forEach((appObj) => {
        console.log(appObj , dp_appInfo["id"], appObj["id"] == dp_appInfo["id"])
        if ( appObj == dp_appInfo["id"] ) {
          installedAppInfoObj["id"] = appObj;
          installedAppInfoObj["isRunning"] = runningAppIdJson[appObj];
        }
      });
    })
    .catch((err) => {
      console.log("Error", err);
      vscode.window.showErrorMessage(
        `Error Connecting Device. Details As follows: ${err.toString()}`
      );
    });
    if(installedAppInfoObj["id"] == null ){
      return null;
    }else{
      return installedAppInfoObj;
    }
  
}
async function getRunningAppJson(device) {
  let runningAppIdJson = {};
  let running = await getRunningList(device.name);

  running.forEach((appId) => {
    let idArray = appId.split(/\s+/);
    let id = idArray[0].trim();
    runningAppIdJson[id] = true;
  });
  return runningAppIdJson;
}

function getRunWithoutInstallAppId(context) {
  let rawdata = fs.readFileSync(
    path.join(context.extensionPath, "src", "device_preview", "appinfo.json")
  );
  return JSON.parse(rawdata);
}
async function installContainerAndStartSocketAndLaunch(context, device) {

  let outDir = path.join(context.extensionPath, "src", "device_preview", "out");

  portfinder
    .getPortPromise()
    .then(async (port) => {
      //added begin
      startSocketServer(sysIP, port);

      dpContext.socketIp = sysIP;
      dpContext.socketPort = port;
      let param = {
        SOCKET_SERVER_IP: `${sysIP}`,
        SOCKET_SERVER_PORT: `${port}`,
      };
      // start the serving app
      setTimeout(() => {
        startLocalPreview();
      }, 10);
      //  added end
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Setting Up Application Auto reload on Device",
          cancellable: false,
        },
        
        async (progress) => {
          await notify.showProgress(progress, 40, "Please Wait ");
          // await ares
          //   .package(appDir, outDir, false, "")
          await getContainerAppPackage(context)
            .then(async (ipkFile) => {
              let ipkPath = path.join(outDir, ipkFile);
              await notify.showProgress(progress, 60, "Please Wait ");
              await ares
                .install(ipkPath, device.name)
             
                .then(async () => {
               

                  await notify.showProgress(progress, 80, `Launching`);
                    await ares
                    .launch(dp_appInfo["id"], device.name, param, 0)
                    .then(async () => {
                      if (containerAppInfo)
                        containerAppInfo["isRunning"] = true;
                      await notify.clearProgress(
                        progress,
                        "App Launched without Installation"
                      );

                     
                      if (containerAppInfo)
                        containerAppInfo["isRunning"] = true;

                    })
                    .catch(async (err) => {
                      let errMsg = `Failed to launch ${dp_appInfo["id"]} on ${device.name}.`;
                      if (err.toString().includes(`Connection time out`)) {
                        errMsg = `Please check ${device}'s IP address or port.`;
                      }
                      await notify.clearProgress(progress, `ERROR! ${errMsg}`);
                      let erMsg = err.toString();
                      vscode.window.showErrorMessage(
                        `ERROR! ${errMsg}`
                      );
                    });
                })
                .catch(async (err) => {
                  let errMsg = `Failed to install ${ipkPath} on ${device.name}.`;
                  if (
                    err
                      .toString()
                      .includes(`Unknown method "install" for category "/dev"`)
                  ) {
                    errMsg = `Please make sure the 'Developer Mode' is on.`;
                  } else if (err.includes(`Connection time out`)) {
                    errMsg = `Please check ${device.name}'s IP address or port.`;
                  }
                  await notify.clearProgress(progress, `ERROR! ${errMsg}`);
                  let erMsg = err.toString();
                  vscode.window.showErrorMessage(
                    `ERROR! ${errMsg}`
                  );
                });
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
async function getContainerAppPackage(context){
  let appDir = path.join(context.extensionPath, "src", "device_preview");
  let outDir = path.join(context.extensionPath, "src", "device_preview", "out");
  
  let ipkFileName  = dp_appInfo["id"]+"_"+dp_appInfo["version"]+"_"+"all.ipk"
  let ipkFilePath =  path.join(context.extensionPath, "src", "device_preview", "out",ipkFileName);
  return new Promise(async(resolve, reject) => {
    if (fs.existsSync(ipkFilePath)) {
      //file exists
      resolve(ipkFileName)
    }else{
      await ares
      .package(appDir, outDir, false, "")
      .then(async (ipkFile) => {
        resolve(ipkFile)
      })
      .catch((err) => {
        console.log("error", err);
        reject(err)
      
      });
    }
    

  })

}
async function startSocketAndLaunchContainerApp(context, device) {
  portfinder
    .getPortPromise()
    .then(async (port) => {
     
      startSocketServer(sysIP, port);

      dpContext.socketIp = sysIP;
      dpContext.socketPort = port;
      if (containerAppInfo && containerAppInfo["isRunning"]) {
        await ares.launchClose(dp_appInfo["id"], targetDevice.name, 0);
      }
      setTimeout(() => {
            startLocalPreview();
          }, 10);
  
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Starting Auto reload Application on Device",
          cancellable: false,
        },
        async (progress) => {
          await notify.showProgress(progress, 40, "Please Wait ");
          // startSocketServer(sysIP, port);


          await notify.showProgress(progress, 80, `Launching`);
          let param = {
            SOCKET_SERVER_IP: `${sysIP}`,
            SOCKET_SERVER_PORT: `${port}`,
          };
        
          await ares

            .launch(dp_appInfo["id"], device.name, param, 0)
            .then(async () => {
              if (containerAppInfo) containerAppInfo["isRunning"] = true;
              await notify.clearProgress(
                progress,
                "App Launched without Installation"
              );
       
            })
            .catch(async (err) => {
              let errMsg = `Failed to launch ${dp_appInfo["id"]} on ${device.name}.`;
              if (err.toString().includes(`Connection time out`)) {
                errMsg = `Please check ${device}'s IP address or port.`;
              }
              await notify.clearProgress(progress, `ERROR! ${errMsg}`);
              let erMsg = err.toString();
              vscode.window.showErrorMessage(
                `ERROR! ${errMsg}. Details As follows: ${erMsg}`
              );
            });
        }
      );
    })
    .catch((err) => {
      console.log(err);
      vscode.window.showErrorMessage(`Error! Failed to get free port`);
    });
}
async function onlyLaunchContainerApp(context, device) {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Auto reload Application on Device",
      cancellable: false,
    },
    async (progress) => {
      await notify.showProgress(progress, 80, `Launching`);
      let param = {
        SOCKET_SERVER_IP: `${dpContext.socketIp}`,
        SOCKET_SERVER_PORT: `${dpContext.socketPort}`,
      };
      if (containerAppInfo && containerAppInfo["isRunning"]) {
        await ares.launchClose(dp_appInfo["id"], device.name, 0);
      }

      await ares

        .launch(dp_appInfo["id"], device.name, param, 0)
        .then(async () => {
          if (containerAppInfo) containerAppInfo["isRunning"] = true;
          await notify.clearProgress(progress, "App Launched without Installation");
        })
        .catch(async (err) => {
          let errMsg = `Failed to launch ${dp_appInfo["id"]} on ${device.name}.`;
          if (err.toString().includes(`Connection time out`)) {
            errMsg = `Please check ${device}'s IP address or port.`;
          }
          await notify.clearProgress(progress, `ERROR! ${errMsg}`);
          let erMsg = err.toString();
          vscode.window.showErrorMessage(
            `ERROR! ${errMsg}. Details As follows: ${erMsg}`
          );
        });
    }
  );
}
function getNWAddress(networkInterfaces) {
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

    console.log(`new client connected, id = ${socket.id} `);
    socket.emit("connection_resp", { status: "connected" });

    socket.on("app_url_req", () => {
      console.log(`socket on::::app_url_req`);
      if (dpContext.isPreviewStarted) {
        socket.emit("app_url_resp", { url: dpContext.previewURL });
      }
    });
    socket.on("disconnect", () => {
      console.log(`disconnect, id = ${socket.id}`);
      socket.disconnect(true);
      socketClient.close();
    });

    socket.once("connect_error", () => {
      console.log(`connect_error::::connect_error`);
    });
  });
}
async function startLocalPreview() {
  // send starting dev server
  let enactProgressTimer = null;
  let pvalue = 10;
  if (socketClient) {
    socketClient.emit("preview_progress", {
      statusText: "App Launch : Starting Development Server",
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
            statusText: "App Launch : Starting Development Server",
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
            // pvalue =60;
            if (socketClient) {
              socketClient.emit("preview_progress", {
                statusText: "App Launch : Compiling",
                progress: pvalue,
              });
            }

            enactProgressTimer = setInterval(() => {
              pvalue++;
              if (pvalue < 95) {
                if (socketClient) {
                  socketClient.emit("preview_progress", {
                    statusText: "App Launch : Compiling",
                    progress: pvalue,
                  });
                }
              } else {
                clearInterval(enactProgressTimer);
              }
            }, 3000);

            child.stdout.on("data", async (data) => {
              let outData = logger.replaceAnsiColor(data.toString("utf8"));

              // if done
              if (
                outData.includes("Failed to compile") ||
                outData.includes("Compiled with ") ||
                outData.includes("Compiled successfully")
              ) {
                if (dpContext.isPreviewUrlSent) {
                  // await ares.launchClose(dp_appInfo["id"], targetDevice.name, 0);
                  // await ares.launch(dp_appInfo["id"], targetDevice.name, undefined, 0);

               
                } else {
                  if (socketClient) {
                    if (enactProgressTimer) {
                      clearInterval(enactProgressTimer);
                    }

                    dpContext.isPreviewUrlSent = true;
                    socketClient.emit("preview_progress", {
                      statusText: "App Launch : Loading App",
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
                statusText: "App Launch : Loading App",
                progress: 100,
              });

              dpContext.isPreviewUrlSent = true;
              socketClient.emit("app_url_resp", { url: url });
            }
            let isAppReloading = false;
            dpContext.appFileWatcher = watch(
              userAppDir,
              { recursive: true },
              async (evt, name) => {
                let param = {
                  SOCKET_SERVER_IP: `${dpContext.socketIp}`,
                  SOCKET_SERVER_PORT: `${dpContext.socketPort}`,
                };

                if(!isWebappExcludedFiles(name) && !isAppReloading){
                  isAppReloading = true;
                  await ares.relaunch(
                    dp_appInfo["id"], targetDevice.name, param, 0
                  ).then(()=>{
                    isAppReloading = false;
                  })
                  .catch( async(errMsg)=>{
                    isAppReloading = false;
                
                  });
                }
                

                
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
function isWebappExcludedFiles(fileName){
  let pathArray = fileName.split(".")
  if(pathArray.length>0 && (pathArray[pathArray.length-1] =="json" || pathArray[pathArray.length-1] =="ipk")){
    return true
  }
 
    return false

  
}

async function stopServerAndClearResources(context, isFromCommand) {
  dp_appInfo = getRunWithoutInstallAppId(context);

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

  // clear all the process

  clearProcess();

  if (isFromCommand) {
    if (targetDevice) {
      let deviceName = targetDevice.name;

      let isDeviceOnline = await updateDeviceStatus(targetDevice.name);
      if (!isDeviceOnline) {
        vscode.window.showErrorMessage(
          `Error Connecting Device.  ${targetDevice.name}`
        );
        return;
      }

      await ares
        .installRemove(dp_appInfo["id"], deviceName)
        .then(async () => {
          vscode.window.showInformationMessage(
            "Application Launch on Device has been stoped."
          );
        })
        .catch((err) => {
          console.log("Error on removing  Launch App on " + deviceName);
          vscode.window.showErrorMessage(
            "Error on removing  Launch App on " + deviceName
          );
        });
    } else {
      if (isFromCommand)
        vscode.window.showErrorMessage(
          `Unable to connect to device to stop App Launch `
        );
    }
  }
  resetDpContext();
}
function resetDpContext() {
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
    socketPort: "",
    socketIp: "",
  };
}
function clearProcess() {
  // clear all the process
  if (dpContext.previewProcess != null) {
    dpContext.previewProcess.stdin.pause();
    kill(dpContext.previewProcess.pid);
  }
  if (dpContext.appFileWatcher != null) {
    dpContext.appFileWatcher.close();
  }
  if (http) {
    http.close();
    io.removeAllListeners("connection");
    io.close();
  }
}

/* async function runWithoutInstall(selectedDir) {
  const title = 'Run Application without Installation';
  const prompt = 'Enter Directory Path to Run';
  const device = await getDefaultDevice() || await getDevice(title);
  const appDir = selectedDir || await getAppDir(title, prompt);
  const hostIp = await getHostIp() || await _getHostIp(title);

  // ares-launch --hosted --host-ip
  ares.launchHosted(appDir, device, hostIp)
      .then(() => {
          vscode.window.showInformationMessage(`Success! ${appDir} is running on ${device}.`);
      }).catch((err) => {
          let errMsg = `Failed to run ${appDir} on ${device}.`;
          if (typeof err === 'string' && err.includes(`Unknown method`) && err.includes(`for category "/dev"`)) {
              errMsg = `Please make sure the 'Developer Mode' is on.`;
          } else if (typeof err === 'string' && err.includes(`Connection time`)) {
              errMsg = `Please check ${device}'s IP address or port.`;
          }
          vscode.window.showErrorMessage(`Error! ${errMsg}`);
      });
}; */

module.exports = {
  runWithoutInstall: runWithoutInstall,
  stopServerAndClearResources: stopServerAndClearResources
};
