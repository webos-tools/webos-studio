const vscode = require('vscode');

let resourceMonitoringPanelCnt = 0;
let process_influxdb;
let process_grafana;

let isStartingGrafana = false;

function isRunning(processName) {
    let command = 'ps -ef';
    if (require("os").type().includes("Windows")) {
        command = 'tasklist';
    }
    const execSync = require('child_process').execSync;
    const stdout = execSync(command);
    if (stdout.includes(processName)) {
        return true;
    } else {
        return false;
    }
}

function isExistPath(path) {
    const fs = require('fs')
    return fs.existsSync(path);
}

function launchCommand(cmd, args) {
    const _spawn = require('child_process').spawn;
    const _process = _spawn(cmd, args);

    return _process;
}

function replaceStringFromFile(readPath, writePath, oriStr, destStr) {
    for (var i = 0; i < arguments.length; i++) {
        if (arguments[i].length == 0) {
            return;
        }
    }
    if (oriStr.length != destStr.length)
        return;

    const fs = require('fs');
    let allFileContents = fs.readFileSync(readPath, 'utf-8');
    oriStr.forEach(function (item, index) {
        let re = new RegExp(item, "gm");
        allFileContents = allFileContents.replace(re, destStr[index]);
    });
    fs.writeFileSync(writePath, allFileContents, 'utf-8');
}

function getGrafanaHTML() {
    var tmpStr = `<!DOCTYPE html>
    <html lang="en">
    <head>
    <title>Resource Monitoring</title>
    <style>
        body{
            margin: 0;
        }
        iframe{
            display: block;
            height: 100vh;
            width: 98vw;
            border: none;
        }
    </style>
    </head>
    <body style="background-color: black;">
        <iframe src="http://localhost:3000"></iframe>
    </body>
    </html>`;
    resourceMonitoringPanelCnt += 1;
    return tmpStr;
}

function getLoadingHTML() {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
    <title>Resource Monitoring</title>
    <style>
        body{
            margin: 0;
        }
    </style>
    </head>
    <body style="background-color: black;">
        <td style="width:100%; height:100%;">
        <h1 style="position:absolute;top: 40%; left: 40%; color:white;">Starting services...</h1>
        </td>
    </body>
    </html>`
}

module.exports = function launchResourceMonitoring(extensionPath, context) {
    // Check remote ssh
    if (typeof vscode.env.remoteName !== 'undefined') {
        vscode.window.showErrorMessage('Cannot launch Resource Monitoring in ssh-remote');
        return;
    } else if (resourceMonitoringPanelCnt == 0) {
        if (isStartingGrafana) {
            vscode.window.showInformationMessage('Grafana service is starting...');
            return;
        }
        if (isRunning("grafana")) {
            vscode.window.showErrorMessage('Please terminate the external "grafana" process.');
            return;
        }
        if (isRunning("influxd")) {
            vscode.window.showErrorMessage('Please terminate the external "influxd" process.');
            return;
        }
    }

    // Prepare for each hosts
    const hostOS = require("os").type();
    console.log("hostOS : " + hostOS);
    console.log("extensionPath : " + extensionPath);
    console.log("remoteName : " + vscode.env.remoteName);
    let influxdbBinFile = "influxd";
    let influxdbConfFile = "influxdb.conf";
    let grafanaBinFile = "bin/grafana";
    let grafanaConfFile = "conf/defaults.ini";
    if (hostOS.includes("Windows")) {
        influxdbBinFile = influxdbBinFile + ".exe";
        grafanaBinFile = grafanaBinFile + ".exe";
    }

    const webosose_config = vscode.workspace.getConfiguration('webosose');
    // Check influxdb install path
    let influxdb_install_path = webosose_config.get('resourceMonitoring.influxdbInstallPath');
    if (influxdb_install_path == null) {
        vscode.window.showErrorMessage('InfluxDB Install Path is empty.');
        return;
    }
    influxdb_install_path = influxdb_install_path.replace(/\\/g, "/") + "/";
    if (!isExistPath(influxdb_install_path)
        || !isExistPath(influxdb_install_path + influxdbBinFile)
        || !isExistPath(influxdb_install_path + influxdbConfFile)) {
        influxdbBinFile = "/usr/bin/" + influxdbBinFile;
        influxdbConfFile = "/etc/influxdb/" + influxdbConfFile;
        if (!isExistPath(influxdb_install_path + influxdbBinFile)
            || !isExistPath(influxdb_install_path + influxdbConfFile)) {
            vscode.window.showErrorMessage('InfluxDB Install Path is wrong.');
            return;
        }
    }
    // Check grafana install path
    let grafana_install_path = webosose_config.get('resourceMonitoring.grafanaInstallPath');
    if (grafana_install_path == null) {
        vscode.window.showErrorMessage('Grafana Install Path is empty.');
        return;
    }
    grafana_install_path = grafana_install_path.replace(/\\/g, "/") + "/";
    if (!isExistPath(grafana_install_path)
        || !isExistPath(grafana_install_path + grafanaBinFile)
        || !isExistPath(grafana_install_path + grafanaConfFile)) {
        vscode.window.showErrorMessage('Grafana Install Path is wrong.');
        return;
    }

    // Create webview panel
    let resourceMonitoringPanel = vscode.window.createWebviewPanel('resourceMonitoring', 'Resource Monitoring', vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
            vscode.Uri.file(extensionPath)
        ]
    });
    resourceMonitoringPanel.onDidDispose(
        () => {
            resourceMonitoringPanelCnt -= 1;
            if (resourceMonitoringPanelCnt == 0) {
                var kill = require('tree-kill');
                kill(process_influxdb.pid);
                kill(process_grafana.pid);
            }
        },
        null,
        context.subscriptions
    );

    if (!isRunning("influxd")) {
        // Edit configuration for vscode
        replaceStringFromFile(influxdb_install_path + influxdbConfFile,
            influxdb_install_path + influxdbConfFile + ".vscode",
            ['dir = "/var/lib/influxdb'],
            ['dir = "' + influxdb_install_path + 'var/lib/influxdb']);
        // Launch influxdb and grafana
        const influxdbArgs = ["-config", influxdb_install_path + influxdbConfFile + ".vscode"];
        process_influxdb = launchCommand(influxdb_install_path + influxdbBinFile, influxdbArgs);
        process_influxdb.stderr.on("data", function (data) {
            // console.error("influxdb stderr : " + data.toString());
        });
        process_influxdb.stdout.on("data", function (data) {
            // console.error("influxdb stdout : " + data.toString());
        });
    }
    if (!isRunning("grafana")) {
        // Edit configuration for vscode
        replaceStringFromFile(grafana_install_path + grafanaConfFile,
            grafana_install_path + grafanaConfFile + ".vscode",
            ["allow_embedding = false", "# enable anonymous access\r?\nenabled = false", "# specify role for unauthenticated users\r?\norg_role = Viewer"],
            ["allow_embedding = true", "# enable anonymous access\r\nenabled = true", "# specify role for unauthenticated users\r\norg_role = Admin"]);
        isStartingGrafana = true;
        const grafanaArgs = ["server", "--homepath", grafana_install_path, "--config", grafana_install_path + grafanaConfFile + ".vscode"];
        process_grafana = launchCommand(grafana_install_path + grafanaBinFile, grafanaArgs);
        process_grafana.stderr.on("data", function (data) {
            // console.error("grafana stderr : " + data.toString());
        });
        // Change webview panel to grafana after loading grafana service
        process_grafana.stdout.on("data", function (data) {
            if (data.toString().includes("msg=\"HTTP Server Listen\"")) {
                resourceMonitoringPanel.webview.html = getGrafanaHTML();
                process_grafana.stdout.removeAllListeners();
                isStartingGrafana = false;
            }
        });
        resourceMonitoringPanel.webview.html = getLoadingHTML();
    } else {
        resourceMonitoringPanel.webview.html = getGrafanaHTML();
    }
    require('./ga4Util').mpGa4Event("LaunchResourceMonitor", {category:"Commands"});
}