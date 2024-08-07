# webOS Studio

**webOS Studio** helps the users develop apps or services for [webOS Open Source Edition (OSE)](https://webosose.org) and [webOS TV](https://webostv.developer.lge.com).
- **webOS TV** is a web-centric smart TV platform that has powered LG Smart TVs for over a decade. It not only verified its reliable and stable performance across the globe but also demonstrated the potential and qualification of becoming a leading player in the linux-based smart display platforms competition.
- **webOS OSE** is the open source project of webOS launched in  March 2018 under the philosophy of open platform, open partnership, and open connectivity. On top of the core architecture of webOS, webOS OSE offers additional features that allow extension to more diverse industry verticals.

> **IMPORTANT NOTICE:** 
> - If you installed the [webOS OSE extension](https://marketplace.visualstudio.com/items?itemName=webOSOSESDK.webosose) or [webOS TV extension](https://marketplace.visualstudio.com/items?itemName=webOSTVSDK.webostv), **UNINSTALL** those before installing this extension.
> - Make sure that you read the [Setup](#setup) section.
> - This extension collects usage data to understand how the extension performs, where improvements are needed, and how features are being used. We don't collect any personal data, but if you don't want to, go to the settings and uncheck **webOS: Enable User Data Collection**.

---

**Table of Contents**

- [System Requirements](#system-requirements)
- [Setup](#setup)
- [How to Use](#how-to-use)
- [Command Palette](#command-palette)
- [Miscellaneous Information](#miscellaneous-information)
- [Known Issues](#known-issues)
- [Other Resources](#other-resources)
- [Contributors](#contributors)
- [Copyright and License Information](#copyright-and-license-information)

---

> This extension was developed based on the [webOS TV extension](https://marketplace.visualstudio.com/items?itemName=webOSTVSDK.webostv).

## System Requirements

### Hardware

Emulator-related features are not supported in Apple Silicon Mac.

### Software

| Software                      | Required Version                                       |
| ----------------------------- | ------------------------------------------------------ |
| Microsoft Visual Studio Code  | 1.58.0 or higher                                       |
| Node.js                       | v14.15.1 or higher (verified on v14.15.1 and v16.20.2) |
| Python                        | 3.6 or higher                                          |
| VirtualBox                    | 6.1                                                    |

## Setup

To use the webOS Studio, you have to set up the followings:

- [Workspace](#workspace)
- [Global Packages](#global-packages)
- [Device Profile](#device-profile)

### Workspace

**Workspace** is the root directory for all your webOS apps/services. All commands of webOS Studio will be executed based on the workspace.

Navigate to **File** > **Open Folder** and select a directory. This directory will be your a new workspace.

![Selecting the workspace folder](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/webos-studio/selecting-the-workspace-folder.png)

> **Note:** The workspace of webOS Studio is different from that of VS Code. webOS Studio can only have one workspace at a time.

### Global Packages

Global packages are essential packages to run webOS Studio. This extension supports a command to install this packages at once, and which only needs to be run once initially.

1. Open the Command Palette (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>).
2. Execute `webOS: Install Global Packages`.

![Installing global packages](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/webos-studio/install-global-packages.png)

Or you can also do the same job with the following command:

``` bash
npm install -g @enact/cli @webos-tools/cli patch-package
```

### Device Profile

webOS Studio supports multiple webOS platforms. So, you need to set the proper profile for your webOS device.

1. Go to the Command Palette (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>).
2. Execute `webOS: Set Device Profile`.
3. Select the profile of your target webOS device.

## How to Use

For more detailed user guide, see each platform's website.

- [webOS OSE website](https://www.webosose.org/docs/tools/sdk/vs-code-extension)
- [webOS TV website](https://webostv.developer.lge.com/develop/tools/webos-studio-dev-guide)

## Command Palette

webOS Studio supports the following commands:

| Command                                   | TV  | OSE | Description                                                         |
| ----------------------------------------- |:---:|:---:| ------------------------------------------------------------------- |
| webOS: Set Device Profile                 |  v  |  v  | Sets the target platform of webOS Studio (webOS OSE of webOS TV).   |
| webOS: Create Project Wizard              |  v  |  v  | Generates source code templates.                                    |
| webOS: Install Global Packages            |  v  |  v  | Installs essential global packages to run this extension.           |
| webOS: Install Emulator Launcher          |  v  |  v  | Installs webOS Emulator Launcher.                                   |
| webOS: Package Application                |  v  |  v  | Packages an app into a package file (IPK).                          |
| webOS: Set Up Device                      |  v  |  v  | Adds, modifies, or removes devices from the device list.            |
| webOS: Install Application                |  v  |  v  | Installs an app on the device.                                      |
| webOS: Launch Application                 |  v  |  v  | Launches an installed app.                                          |
| webOS: Launch Application with Parameters |  v  |  v  | Launches an installed app with parameters.                          |
| webOS: Run Application                    |  v  |  v  | Packages, install, and launches an app sequentially.                |
| webOS: Debug                              |  v  |  v  | Packages, install, and inspects an app sequentially.                |
| webOS: IPK Analyzer                       |  v  |  v  | Analyzes a specific IPK.                                            |
| webOS: Auto Reload                        |  v  |  v  | Auto Reload.                                                        |
| webOS OSE: Start Log Viewer               |     |  v  | Start Log Viewer.                                                   |
| webOS OSE: Stop Log Viewer                |     |  v  | Stop Log Viewer.                                                    |
| webOS OSE: Launch Resource Monitoring     |     |  v  | Launches Resource Monitoring window.                                |
| webOS TV: Set Up SSH Key                  |  v  |     | Sets up ssh key for webOS TV                                        |
| webOS TV: Run on Simulator                |  v  |     | Runs an app on the [webOS TV Simulator](https://webostv.developer.lge.com/develop/tools/simulator-introduction). |

## Miscellaneous Information

- When VS Code starts, a notification pop-up might says that VirtualBox is not installed, even when VirtualBox is already installed properly. To resolve this, add the VirtualBox installation directory to your environment variable (`$PATH`).
- If you want to report bugs or suggest some features, use **Issue Reporter**. (**Help** > **Report Issue**)

## Known Issues

- Log Viewer feature is supported only on webOS OSE.
- Web app and JS service debuggings by "Debug On -> VS Code" are not supported for old webOS targets.

## Other Resources

If you want to know more about webOS developments, see the following documents:

- [webOS TV Guides](https://webostv.developer.lge.com/develop/guides)
- [webOS OSE Tutorials](https://www.webosose.org/docs/tutorials/)

If you have any questions, refer to the following links:

- [webOS TV Forum](https://forum.webostv.developer.lge.com/)
- [webOS OSE Forum](https://forum.webosose.org/)

## Contributors

- dongwook23.kim@lge.com
- haeun3.park@lge.com
- heeam.shin@lge.com
- heegoo.han@lge.com
- sajanv.chacko@lgepartner.com
- santhosh.muthu@lge.com
- ye0607.kim@lge.com
- yunkwan.kim@lge.com

## Copyright and License Information

Unless otherwise specified, all content, including all source code files and documentation files in this repository are:

Copyright (c) 2021-2024 LG Electronics, Inc.

All content, including all source code files and documentation files in this repository except otherwise noted are:

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

SPDX-License-Identifier: Apache-2.0
