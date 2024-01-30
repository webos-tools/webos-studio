# webOS Studio

This extension helps develop apps and services for [webOS Open Source Edition (OSE)](https://webosose.org) and [webOS TV](https://webostv.developer.lge.com).

> **IMPORTANT NOTICE:** 
> - If you installed the [webOS OSE extension](https://marketplace.visualstudio.com/items?itemName=webOSOSESDK.webosose), please uninstall it first. Then install this extension.
> - Read [Requirements](#requirements) and [Setup](#setup) sections.
> - This extension collects usage data of webOS Studio features to understand how it is performing, where improvements need to be made, and how features are being used.<br />
>   It doesn't contain any persnal data, but if you don't want to send, uncheck Settings - **Webosose: Enable User Data Collection**, then it won't send any usage data.

---

**Table of Contents**

- [Requirements](#requirements)
  - [Hardware](#hardware)
  - [Software](#software)
- [Setup](#setup)
  - [Selecting a Workspace Folder](#selecting-a-workspace-folder)
  - [Installing Global Packages](#installing-global-packages)
- [Basic Usage](#basic-usage)
  - [Creating an App/Service](#creating-an-appservice)
  - [Editing the Source Code](#editing-the-source-code)
  - [Adding Known Devices](#adding-known-devices)
  - [Previewing with Live Reload](#previewing-with-live-reload)
  - [Packaging / Installing / Launching](#packaging--installing--launching)
  - [Debugging](#debugging)
  - [Running ESLint on the Enact App](#running-eslint-on-the-enact-app)
- [Other Features](#other-features)
  - [Auto-Completion](#auto-completion)
  - [Emulator Manager](#emulator-manager)
  - [IPK Analyzer](#ipk-analyzer)
  - [Process Log](#process-log)
- [Command Palette](#command-palette)
- [Miscellaneous Information](#miscellaneous-information)
- [References](#references)
- [Contributors](#contributors)
- [Copyright and License Information](#copyright-and-license-information)

---

> Some features of this extension are originated from the [webOS TV extension](https://marketplace.visualstudio.com/items?itemName=webOSTVSDK.webostv).

## Requirements

This extension helps the users develop webOS web apps, Enact apps, and JavaScript services. So the users need a basic understanding of webOS developments. If you are not familiar with webOS, please refer to [www.webosose.org/docs/tutorials/](https://www.webosose.org/docs/tutorials/).

### Hardware

Emulator-related features are not supported in Apple Silicon Mac.

### Software


| Software | Required version |
|----------|------------------|
| Microsoft Visual Studio Code | 1.58.0 or higher |
| Node.js | 8.12.0 ~ 14.15.1 (Recommended) |
| Python | 3.6 or higher |
| VirtualBox | 6.1 or higher |

## Setup

Before creating your first project, do the following tasks to set up your webOS Studio.

### Selecting a Workspace Folder

The workspace is a base directory for all your webOS apps/services. All actions in webOS Studio are based to this folder. 

Navigate to **File** > **Open Folder** and select a directory. This directory is set up as the workspace.

> **Note:** The workspace in webOS Studio is different from that of VS Code. webOS Studio can only have one root directory as a workspace at a time.

### (TBM) Installing Global Packages

Execute `webOS: Install Global Packages` in the Command Palette (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>). This task is only required the first time you install the webOS Studio extension.

![Installing global packages](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/install-global-packages.png)

Or you can install the global packages using the following command in the terminal:

``` bash
npm install -g @enact/cli @webosose/ares-cli patch-package
```

## Basic Usage

This section explains a typical development flow of webOS apps and services using this extension.

### Selecting Device Profile

You can select Device Profile as webOS OSE or webOS TV by command webOS: Set Device Profile

### Creating an App/Service

You can create an app or service using the project wizard. Click the **+** button in the **APPS IN WORKSPACE** view or execute `webOS: Create ProjectWizard` in the **Command Palette**.

![Creating an app](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/creating-an-app.gif)

| Item | Description |
|------|-------------|
| API Version | This is an API level of webOS OSE. webOS OSE supports many useful features through [LS2 API](https://www.webosose.org/docs/reference/#ls2-api). And the API level is a unique indicator for managing LS2 APIs. See [LS2 API Index](https://www.webosose.org/docs/reference/ls2-api/ls2-api-index/). |
| Supported Types | <p>Supported types are as follows:</p> <dl> <dt>Basic Web App</dt><dd>A basic web app for webOS.</dd> <dt>Hosted Web App</dt><dd>A hosted web app.</dd> <dt>Web App Info</dt><dd>Configuration file for a web app (<code>appinfo.json</code>). See <a href="https://www.webosose.org/docs/guides/development/configuration-files/appinfo-json/">appinfo.json</a>.</dd> <dt>JS Service</dt><dd>A JavaScript service for webOS. <strong>This service must be packaged and installed with an app.</strong></dd> <dt>JS Service Info</dt><dd>Configuration files for a JS service (<code>services.json</code> and <code>package.json</code>). See <a href="https://www.webosose.org/docs/guides/development/configuration-files/services-json/">services.json</a>.</dd> <dt>Sandstone, Moonstone</dt><dd>Enact apps with the Sandstone library or the Moonstone library. For more details about Enact apps, visit <a href="https://enactjs.com/">the Enact website</a>.</dd> </dl> |

To use [webos-service library](https://www.webosose.org/docs/reference/webos-service-library/webos-service-library-api-reference/) in JavaScript service or Enact app projects, check the **Yes** button for **Add webOS library**.
 
![Add LS2 APIs to projects](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/add-ls2-apis.jpg)

Or install it in the **APP IN WORKSPACE** view.

![Install webos-service library using NPM](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/install-webos-npm-library.png)

### Editing the Source Code

Now it's time to implement your own features on the created apps or services.

webOS Studio supports a powerful content-assist feature called *Auto-Completion*. Auto-completion includes API suggestions and automatically completes method names, helping users implement webOS features more easily.

For more details about the auto-completion feature, see [Auto-Completion](#auto-completion).

![Auto Compleation Example](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/auto-completion-example.jpg)

### Adding Known Devices

The known device is a webOS device that the user can access.

> **Note:** This step is required only once per device.

1. Click the **+** button in the **KNOWN DEVICE** view.

    ![Add the known device](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/add-known-device.png)

    > **Note:** By default, a dummy emulator device is listed in the view. If no emulator is available on your computer, see the guides in the [Emulator Manager](#emulator-manager) section.
    
2. Enter the name and IP address of your webOS device.

    ![Add the known device](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/add-known-device.gif)

3. Set the device as the default device. This ensures that all device operations are performed on that device.

    ![Set the default device](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/set-default-device.jpg)

### Previewing with Auto Reload

You can preview web apps or Enact apps before installing them.

In the **APPS IN WORKSPACE** view, right-click the app and click **Preview Application [Device]** or **Preview Application [Local]**. The preview of the app is automatically launched on the target device (device) or IDE (local).

![Start the app preview](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/app-preview-local.png)

In the preview, you can modify the source codes and check the results instantly.

![Live reload the previewing app](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/app-preview-live-reload.gif)

### Packaging / Installing / Launching

Typical steps to install webOS apps are as follows:

1. Package the source code into an `.ipk` file.
2. Install the IPK file.
3. Launch the installed app.

The above three steps are triggered sequentially by clicking the **Run App** button in the **APPS IN WORKSPACE** view.

![The run app button](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/run-app-button.jpg)

Then, enter the information about the app.

![Package, install, and launch an app](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/package-install-launch-app.gif)

> **Note:** A JavaScript service is always packaged with an app. If you want to install a JavaScript service, select the service in the **Service directory to pack with App** step.
> 
> ![Select JS service](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/select-js-service.jpg)

You can uninstall the apps in the **KNOWN DEVICE** view.

![Uninstall the app](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/uninstall-the-app.jpg)

Or You can uninstall the app manually using the [appInstallService](https://www.webosose.org/docs/reference/ls2-api/com-webos-appinstallservice) API or [webOS CLI](https://www.webosose.org/docs/tools/sdk/cli/cli-user-guide/).

### Debugging

You can debug apps or services that are installed on [the known devices](#adding-known-devices). Supported types are as follows:

- Web app
- Enact app
- JavaScript service

![Start a debugging session](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/start-debugging-session.gif)

In the debugging session, you can set breakpoints, check variables, callstack, etc.

![Breakpoint example](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/debug-breakpoint.jpg)

#### Prerequisites

- Apps or services that are installed on target devices or emulators
    - The target devices or emulators should be registered as [the known devices](#adding-known-devices).
- (For inspector debugging) Chromium-based browser

#### Start a Debugging Session - App 

1. Right-click an installed app.
2. Click **Debug on**. 
3. Click **inspector** or **VS Code**. 
    
    **[inspector]**

    Enter a path for the browser executable.
    
    ![Enter a broweser executable path](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/enter-browser-executable-path.png)

    Then the debugging session will be activated in the browser.

    ![Debugging an app with browser](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/debugging-app-with-browser.png)

    **[VS Code]**
        
    The **DEBUG CONSOLE** panel will be activated automatically. In the panel, you can check the console messages from the app or service.

    ![Debug console](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/debug-console.jpg)

#### Start a Debugging Session - Service 

1. Right-click an installed service.
2. Click **Debug on**. 
3. Click **inspector** or **VS Code**. 
    
    **[inspector]**

    1. After clicking the **inspector** button, a URL for the debugging session will be displayed in the **OUTPUT** panel. Copy the URL.
    
        ![URL for debugging service](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/url-for-debugging-service.png)

    2. Open your browser and go to `chrome://inspect`. Configure the URL as follows:
   
        ![Configure the debugging URL](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/configure-debugging-url.png)

        > **Note:** Microsoft Edge browser automatically redirects `chrome://inspect` to `edge://inspect`.

    3. Click `inspect`.

        ![Click the inspect button](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/click-the-inspect-button.png)

        This opens a new window for the debugging session.

        ![Debugging a service with browser](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/debugging-service-with-browser.png)

    **[VS Code]**
        
    The **DEBUG CONSOLE** panel will be activated automatically.

    ![Debugging a service with IDE](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/debugging-service-with-ide.png)

> **Note:** Every time you restart a debug session, the packaged app will be closed on the target device. If you want to check the behavior of the app, relaunch the app manually.
>
> ![Relaunch the app](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/relaunch-the-app.png)

#### Trouble Shooting Guide for Debugging

<dl>
  <dt>The <b>Run and Debug</b> view is not opened</dt>
  <dd>
    <p>Click <b>View > Open View... > Run and Debug</b>.</p>
  </dd>
  <dt>The debugging session is not launched</dt>
  <dd>
    <p>Close all running apps on the webOS device and re-try to click <b>Debug on</b>.</p>
  </dd>
  <dt>(Very rare to happen) A notification says the debugging session is already activated</dt>
  <dd>
    <p>If you get this notification, even when all debug sessions are closed, restart the VS Code and try to start a debugging session again.</p>
  </dd>
</dl>

> **Note:** 
> See also the following guides:
> - [VS Code official debugging guide](https://code.visualstudio.com/docs/editor/debugging)
> - [Debug JavaScript on the Chrome browser](https://developer.chrome.com/docs/devtools/javascript/)

### Running ESLint on the Enact App

ESLint statically analyzes files for potential errors (or warnings) and helps enforce a common coding style. For more information, check [ESLint Configurations](https://enactjs.com/docs/developer-tools/eslint-config-enact/).

In the **APPS IN WORKSPACE** view, right-click the React app and click **Run Lint**. The **PROBLEMS** panel shows the result messages.

![Run lint](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/run-lint.gif)

To clean the Lint messages from the panel, click **Clear Lint**.

![Clear lint](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/clear-lint.jpg)

## Other Features

### Auto-Completion

Auto-completion suggests a list of available [LS2 APIs](https://www.webosose.org/docs/guides/getting-started/introduction-to-ls2-api/) based on the project's API level. 

![Auto completion Overview](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/auto-completion-overview.jpg)

#### Features

Key features are as follows:

- Auto-complete API strings using the <kbd>Tab</kbd> key
- Provide a list of available LS2 APIs (services, methods, and parameters)
- Provide descriptions for each LS2 API
- Provide links to API documentation webpages

> **Note:** If you have trouble using the auto-completion, check the [Trouble Shooting Guide](#trouble-shooting-guide-for-auto-completion).

#### How to Use

To use auto-completion, type one of the following trigger strings:

- `luna://`
- `new LS2Request`

**luna://**

To start the auto-completion feature, enter one of the following strings:

- `luna://`
- `'luna://'`
- `"luna://"`

![Auto completion for LS2 APIs](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/auto-completion-example-ls2api.gif)

You can print the list of available services, methods, and parameters using the following trigger strings:

| Item | Trigger String |
|------|----------------|
| Service | `luna://` | 
| Method | Enter the <kbd>/</kbd> right after `luna://<service name>` | 
| Parameter | <kbd>Ctrl</kbd> + <kbd>Space</kbd> after `luna://<service>/<method>` | 

**new LS2Request**

Type `new LS2Request` to use [Enact webos Library](https://enactjs.com/docs/modules/webos/LS2Request/). Using <kbd>Ctrl</kbd> + <kbd>Space</kbd>, you can use the auto-completion.

![Auto completion for LS2Request](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/auto-completion-example-ls2request.gif)

#### Trouble Shooting Guide for Auto-Completion

<dl>
  <dt>Q) Auto-completing using the <kbd>Tab</kbd> key doesn't work</dt>
  <dd>
    <p>Check the <strong>Tab Completion</strong> setting is on.</p>
    <img src="https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/enable-tab-completion.jpg" alt="Enable the tab completion feature">
  </dd>
  <dt>Q) I entered the trigger strings, but it didn't show a list</dt>
  <dd>
    <p>To use auto-completion, <code>.webosstudio.config</code> file should be in the project root folder. This file contains information about the API level.</p>
    <p>This file will be automatically generated if you generate a project using the <a href="#project-wizard">Project Wizard</a>. In case you don't have this file, generate the file as follows:</p>
    <ol>
      <li>
        <p>Type <code>luna://</code>.</p>
        <p>This invokes a notification to generate the config file. Click <strong>Yes</strong>.</p>
        <img src="https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/notification-generating-config-file.jpg" alt="Notification to generated the config file">
      </li>
      <li>
        <p>Then a Quick Pick pop-up appears at the top of VS Code.</p>
        <p>Enter the API level you want.</p>
        <img src="https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/quick-pick-pop-up.jpg" alt="Quick pick pop-up for selecting the API level">
      </li>
      <li>
        <p>The config file is generated in your project folder. You can check the API level in the config file.</p>
        <img src="https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/generated-config-file.jpg" alt="Generated config file">
      </li>
    </ol>
  </dd>
</dl>

### Emulator Manager

You can manage webOS emulator (VirtualBox) images in VS Code. By default, any webOS emulator images installed in VirtualBox are listed in the **EMULATOR MANAGER** view.

#### Prerequisites

- [VirtualBox](https://www.virtualbox.org/) must be installed on your computer. (Supported version: 6.1 or higher)
- webOS emulator image (`.vmdk`) is required. For how to make the image, refer to [Emulator User Guide](https://www.webosose.org/docs/tools/sdk/emulator/virtualbox-emulator/emulator-user-guide/).
- [Emulator Launcher](https://www.webosose.org/docs/tools/sdk/emulator/virtualbox-emulator/emulator-launcher/) is required. Execute `webOS: Install Emulator Launcher` in the Command Palette (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>).

#### How to Manage Emulator Images

1. Click the **+** button in the **EMULATOR MANAGER** view.

    ![Add emulator button](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/add-emulator.png)

2. Fill in the input form. For the other system requirements, refer to [Emulator User Guide](https://www.webosose.org/docs/tools/sdk/emulator/virtualbox-emulator/emulator-user-guide/#system-requirements).

    ![Emulator input form](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/emulator-input-form.jpg)

3. Click **Add Instance** and the created instance is listed in the **EMULATOR MANAGER** view.

    ![Added emulator instance](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/added-emulator-instance.png)

4. Click the **Run App** button (triangle) to run the emulator. This action will launch a new VirtualBox window.

    ![Start the emulator instance](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/start-emulator.png)

    To stop or close an emulator instance, close the running VirtualBox window.

> **Note:**
> - Multiple emulator instances cannot use the same VMDK file.
> - Only one emulator instance can be launched at the same time.
> - When deleting an emulator instance, the associated VMDK file is also **DELETED**. Make sure that the VMDK file is safely backed up.

### IPK Analyzer

You can analyze the file size of the app or services in the IPK file.

1. Open the **Command Palette** (Ctrl+Shift+P) and type **webOS: IPK Analyzer**.
2. Click **Import IPK**.
3. Choose the IPK file to analyze. After the file is loaded, you can see the following screen:

    ![IPK analyzer](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/ipk-analyzer.jpg)

4. Click the **Compare IPK** button to load another IPK. (For example, the older version of the original file)

    ![Compare IPK files](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/compare-ipks.jpg)

### Process Log

webOS Studio has many internal utility commands including ares-cli, enact-cli, and VirtualBox utility. In the **OUTPUT** panel, you can check the output logs of these commands. Developers might find out helpful information to debug their apps or services.

![Process log in the output panel](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/output-panel.png)

## Command Palette

| Category                   | Command                            | Description                                                         |
|----------------------------|------------------------------------|---------------------------------------------------------------------|
| Project Wizard             | webOS: Create Project Wizard   | Generates source code templates.                                    |
| Developing apps/services   | webOS: Install Global Packages | Installs essential global packages to run this extension.           |
|                            | webOS: Install Emulator Launcher | Installs webOS Emulator Launcher.                                 |
|                            | webOS: Package Application     | Packages the app into a package file (IPK).                         |
| Connecting devices         | webOS: Set Up Device           | Adds, modifies, or removes devices from the device list.            |
| Testing apps on the device | webOS: Install Application     | Installs an app on the device.                                      |
|                            | webOS: Launch Application      | Runs an app installed on the device.                                |
| Batch commands             | webOS: Run Application         | Package, Install, and Launch operations are executed sequentially.  |
|                            | webOS: Debug       | Package, Install, and Inspect operations are executed sequentially. |
| Analyzing an IPK           | webOS: IPK Analyzer            | Analyzes a selected IPK.                                            |

## Miscellaneous Information

- When the IDE is opened, a notification indicates that VirtualBox is not installed, even when VirtualBox is already installed and working properly. To resolve this, update the environment path variable to point to the VirtualBox installation directory.
- If you want to report bugs or suggest some features, use **Issue Reporter**. (**Help** > **Report Issue**)

## References

- [FAQ](https://www.webosose.org/docs/tools/sdk/vs-code-extension/vs-code-extension-overview/#faqs)
- [Forum](https://forum.webosose.org/)

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

Copyright (c) 2021-2023 LG Electronics, Inc.

All content, including all source code files and documentation files in this repository except otherwise noted are:

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

SPDX-License-Identifier: Apache-2.0
