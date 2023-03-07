
const vscode = require("vscode");
let  outputChannel;

const createOutPutChannel = ()=> {
     outputChannel = vscode.window.createOutputChannel("WebOS Studio","Log");
     outputChannel.show(true);
     log("WebOS Studio Initialized...");
};

const removeOutputChannel = () => {
    if(outputChannel){
        outputChannel.dispose();
    }   
};

function replaceAnsiColor(data){
    return data.toString('utf8').replace(
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

function error(data) {
    if(outputChannel){
        outputChannel.appendLine("[Error] "+replaceAnsiColor(data));
    }
    
}

function warn(data) {
    if(outputChannel){
        outputChannel.appendLine("[Warning] "+replaceAnsiColor(data));
    }
}

function log(data) {
    if(outputChannel){
        outputChannel.appendLine( replaceAnsiColor(data));
    }
}
function info(data) {
    if(outputChannel){
        outputChannel.appendLine("[Info] "+ replaceAnsiColor(data));
    }
}

function debug(data) {
    if(outputChannel){
        outputChannel.appendLine("[Debug] "+replaceAnsiColor(data));
    }
}
function run(data) {
    if(outputChannel){
        outputChannel.appendLine("[Executing] "+replaceAnsiColor(data));
    }
}

const logger = {
    error,
    warn,
    log,
    debug,
    info,
    run,
    replaceAnsiColor
};

module.exports = {
    createOutPutChannel,
    removeOutputChannel,
    logger
};
