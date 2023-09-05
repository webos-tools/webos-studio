const vscode = require("vscode");

var outputChannel;
let extInit = false;
let extInitMessage ="";

var logLevel = 4; //( 1-error,2-error and warn, 3, error ,war, info, 4, - all)
const setLogLevel = (logLvl) => {
  switch (logLvl) {
    case "Error":
      logLevel = 1;
      break;
    case "Warning":
      logLevel = 2;
      break;
    case "Info":
      logLevel = 3;
      break;
    case "All":
      logLevel = 4;
      break;
  }

  logAny("Current log level enabled for - " + getLogLevelText(logLevel));
};
const createOutPutChannel = () => {
  outputChannel = vscode.window.createOutputChannel("webOS Studio", "Log");
  outputChannel.show(true);
  logAny("webOS Studio initializing.");
  // logAny("Current log level enabled for - " + getLogLevelText(logLevel));
  // logAny(
  //   "To change the log level, select 'Set log level' option from command prompt"
  // );
};
const getLogLevelText = (logLevel) => {
  let logLevelText = "";
  switch (logLevel) {
    case 1 || "Error":
      logLevelText = "Error";
      break;
    case 2 || "Warning":
      logLevelText = "Error and Warning";
      break;
    case 3 || "Info":
      logLevelText = "Error, Warning and Info";
      break;
    case 4 || "All":
      logLevelText = "All(Error, Warning, Info and Command Running Status)";
      break;
  }
  return logLevelText;
};

const removeOutputChannel = () => {
  if (outputChannel) {
    outputChannel.dispose();
  }
};

function replaceAnsiColor(data) {

  return data
    .toString("utf8")
    .replace(
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      ""
    );
}
function error(data) {
  if (outputChannel && logLevel >= 1) {
    if(logger.extInit == false){
      var str = data.toString("utf8").replace(/Error|failed|ERR|Fail|Failure/gi, "");
      outputChannel.appendLine("[Warning] " + replaceAnsiColor(str));
    }
    else
      outputChannel.appendLine("[Error] " + replaceAnsiColor(data));
  }
}

function warn(data) {
  if (outputChannel && logLevel >= 2) {
    outputChannel.appendLine("[Warning] " + replaceAnsiColor(data));
  }
}

function log(data) {
  if (outputChannel && logLevel >= 4) {
    outputChannel.appendLine(replaceAnsiColor(data));
  }
}
function info(data) {
  if (outputChannel && logLevel >= 3) {
    outputChannel.appendLine("[Info] " + replaceAnsiColor(data));
  }
}

function logAny(data) {
  if (outputChannel) {
    outputChannel.appendLine(replaceAnsiColor(data));
  }
}
function run(data) {
  if (outputChannel && logLevel >= 4) {
    outputChannel.appendLine("[Executing] " + replaceAnsiColor(data));
  }
}

const logger = {
  error,
  warn,
  log,
  logAny,
  info,
  run,
  replaceAnsiColor,
  setLogLevel,
  extInit,
  extInitMessage
};

module.exports = {
  createOutPutChannel,
  removeOutputChannel,
  logger
};
