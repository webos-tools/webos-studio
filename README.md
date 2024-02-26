# webOS Studio

**webOS Studio** helps the users develop apps or services for [webOS Open Source Edition (OSE)](https://webosose.org) and [webOS TV](https://webostv.developer.lge.com).

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
- [Other Resources](#other-resources)
- [Contributors](#contributors)
- [Copyright and License Information](#copyright-and-license-information)

---

> This extension was developed vased on the [webOS TV extension](https://marketplace.visualstudio.com/items?itemName=webOSTVSDK.webostv).

## System Requirements

### Hardware

Emulator-related features are not supported in Apple Silicon Mac.

### Software

| Software                      | Required version                  |
| ----------------------------- | --------------------------------- |
| Microsoft Visual Studio Code  | 1.58.0 or higher                  |
| Node.js                       | v14.15.1 ~ v16.20.2               |
| Python                        | 3.6 or higher                     |
| VirtualBox                    | 6.1 or higher                     |

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
npm install -g @enact/cli @webos-sdk/cli patch-package
```

### Emulator Launcher

Emulator Launcher is a command-line based tool which helps users set up the webOS emulator more easier.

You can install the Emulator Launcher with the following command:

``` bash
python3 -m pip install --upgrade webos-emulator --force-reinstall
```

> For Windows users, use `python` instead of `python3`.

### Device Profile

webOS Studio supports multiple webOS platforms. So, you need to set the proper profile for your webOS device.

1. Go to the Command Palette (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>).
2. Execute `webOS: Set Device Profile`.
3. Select the profile of your target webOS device.

### Package Manager

Package Manager feature enables the developers to install all required tools for the developement of webOS TV and webOS OSE App Development.
There are  two  main sections in Package Manager,  TV SDK and OSE SDK
Under TV SDK list of all the supported versions of Emulator, Simulator and Beanviser are listed
User can install on uninstall the components by clicking on the respective icons
Simlar to TV SDK, under OSE SDK  lists Emulator , Workflow Designer and Resource monitor

In order to Launch the Package Manager in windows, VSCode has to be open in Administrator permission. On Mac and Ubuntu while installing components system prompt for the root user password

On opening the Package Manager on first time , user has to select a directory to configure the package manager. When user install any of the listed components, it installs the components in respective subdirectory(Config, Downloads, OSE, Tools and TV ) under the above selected directory
 
Some of the components requried additional software(Pre-requisites) to be installed, Ex. to install Emulator,  Virtualbox to be available in the system.
So while installing Emulator, Package Manager checks is Virtualbox(Pre-Requisite) is availabe, if not, it will start download, extract, install and configure (silent Installtion) virtual box before installing  emulator
  
On installing the the components , if the component required any prerequisites and it is not installed in the system it will prompt user to confirm the installation 

List of  prequsites sowtware required/installed during each componets installation are below
1. TV Emulator
- jre  version >=1.5.0 					-- 
- virtualbox:  version >=6.1.0

2. TV Simulator
- No prerequisites

3. TV Beanviser
- No prerequisites

4. OSE Emulator 
- python3 version >=3.0
- virtualbox version  >=6.1.0
- webos-emulator-launcher  version >=0.8.8

5.  OSE workflow Designer
- No prerequisites

6. Resource Monitor
- No prerequisites

## How to Use

For more detailed user guide, see each platform's website.

- [webOS OSE website](https://www.webosose.org/docs/tools/sdk/vs-code-extension)
- [webOS TV website](https://webostv.developer.lge.com/develop/tools/webos-studio-dev-guide)

## Command Palette

webOS Studio supports the following commands:

| Command                               | TV  | OSE | Description                                                         |
| ------------------------------------- |:---:|:---:| ------------------------------------------------------------------- |
| webOS: Set Device Profile             |  v  |  v  | Sets the target platform of webOS Studio (webOS OSE of webOS TV).   |
| webOS: Create Project Wizard          |  v  |  v  | Generates source code templates.                                    |
| webOS: Install Global Packages        |  v  |  v  | Installs essential global packages to run this extension.           |
| webOS: Install Emulator Launcher      |  v  |  v  | Installs webOS Emulator Launcher.                                   |
| webOS: Package Application            |  v  |  v  | Packages an app into a package file (IPK).                          |
| webOS: Set Up Device                  |  v  |  v  | Adds, modifies, or removes devices from the device list.            |
| webOS: Install Application            |  v  |  v  | Installs an app on the device.                                      |
| webOS: Launch Application             |  v  |  v  | Runs an app installed on the device.                                |
| webOS: Run Application                |  v  |  v  | Packages, install, and launches an app sequentially.                |
| webOS: Debug                          |  v  |  v  | Packages, install, and inspects an app sequentially.                |
| webOS: IPK Analyzer                   |  v  |  v  | Analyzes a specific IPK.                                            |
| webOS: Auto Reload                    |  v  |  v  | Auto Reload                                                         |
| webOS OSE: Launch Resource Monitoring |     |  v  | Launches Resource Monitoring window.                                |
| webOS TV: Set Up SSH Key              |  v  |     | Sets up ssh key for webOS TV                                        |
| webOS TV: Run on Simulator            |  v  |     | Runs an app on the webOS TV Simulator.                              |

## Miscellaneous Information

- When VS Code starts, a notification pop-up might says that VirtualBox is not installed, even when VirtualBox is already installed properly. To resolve this, add the VirtualBox installation directory to your environment variable (`$PATH`).
- If you want to report bugs or suggest some features, use **Issue Reporter**. (**Help** > **Report Issue**)

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
