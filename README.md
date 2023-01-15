# webOS Studio

This extension helps develop apps and services for [webOS Open Source Edition (OSE)](https://webosose.org).

> **IMPORTANT NOTICE:** If you installed the [webOS OSE](https://marketplace.visualstudio.com/items?itemName=webOSOSESDK.webosose) extension, please uninstall it first. Then install this extension.

---

**Table of Contents**

- [Prerequisites](#prerequisites)
- [Workspace Setup](#workspace-setup)
- [Basic Usage](#basic-usage)
    - [Creating an App/Service](#creating-an-appservice)
    - [Modifying the Source Code](#modifying-the-source-code)
    - [Adding Known Devices](#adding-known-devices)
    - [Packaging / Installing / Launching](#packaging--installing--launching)
    - [Debugging the App/Service](#debugging-the-appservice)
    - [Previewing the App (Web and Enact)](#previewing-the-app-web-and-enact)
    - [Running ESLint on the Enact App](#running-eslint-on-the-enact-app)
- [Other Features](#other-features)
    - [Project Wizard](#project-wizard)
    - [Auto-Completion](#auto-completion)
    - [Emulator Manager](#emulator-manager)
    - [IPK Analyzer](#ipk-analyzer)
- [Command Palette](#command-palette)
- [Miscellaneous Information](#miscellaneous-information)
- [References](#references)
- [Contributors](#contributors)
- [Copyright and License Information](#copyright-and-license-information)

---

> **Note:** Some features of this extension are originated from the [webOS TV extension](https://marketplace.visualstudio.com/items?itemName=webOSTVSDK.webostv).

## Prerequisites

- Microsoft Visual Studio Code v1.58.0 or higher
- Node.js from v8.12.0 to v14.15.1 (recommended)
- Python 3.6 or higher (Only for Emulator)
- VirtualBox (Only for Emulator)
- Basic understanding of webOS web app, Enact app, and JavaScript service development. Refer to [www.webosose.org/docs/tutorials/](https://www.webosose.org/docs/tutorials/).

## Workspace Setup

Before creating your first project, we recommend that you set a workspace &mdash; it's a kind of base directory of multiple projects &mdash; for all your webOS apps/services. All projects contained within the workspace are shown in the **APPS IN WORKSPACE** view. This will make managing your projects more effectively.

A workspace can be set up in one of two ways:

- Navigate to **File** > **Open Folder** and select a directory. This directory is set up as the workspace.
- When [creating an app/service](#creating-an-appservice) using this extension, the **Project Location** is automatically set up as the workspace.

## Basic Usage

This section explains a typical development flow of webOS apps and services using this extension.

### Creating an App/Service

> **Note:** If you failed to create an app or service, please do the followings:
> - Execute `webOS OSE: Install Global Packages` in the Command Palette (Ctrl + Shift + P).
> - Update `npm` to the latest version.

1. Click the **+** button in the **APPS IN WORKSPACE** view.
    
    ![Add button in the view](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/add-button-apps-in-workspace.png)

2. Select the project type in **Command Palette**, and enter the information depending on your type.

    ![Creating Enact App](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/creating-apps-services.gif)

    Some types need additional steps. Check the following table:

    | Type | Description |
    |------|-------------|
    | Enact app | For UI components for the Enact app, you can choose either [sandstone](https://enactjs.com/docs/modules/sandstone/ActionGuide/) or [moonstone](https://enactjs.com/docs/modules/moonstone/BodyText/) library. <br />![Select Enact Library](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/select-enact-library.jpg) |
    | JavaScript Service | A JavaScript service always needs an app to be packaged with. Choose an app or click **Choose a Different App**. <br />![Link an app to the service](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/link-an-app-to-the-service.jpg) |
    | Enact app & JavaScript service | If you want to [webos-service library](https://www.webosose.org/docs/reference/webos-service-library/webos-service-library-api-reference/) and the content assistant feature for the library, click **Yes**. <br />![Add webos-service library](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/add-webos-service-library.jpg) <br />Or you can add this library after you create the app or service. In the **APPS IN WORKPLACE** view, right-click your app or service and click **Install webOS NPM Library**. <br />![Install webos-service library using NPM](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/install-webos-service-library-using-npm.jpg) |
    | Hosted web app | Enter the URL to show. <br />![Enter the URL for a hosted web app](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/enter-the-url-for-hosted-web-app.jpg)|

### Modifying the Source Code

Now that the app or service is created, update (implement) the source code for the project. 

The extension also provides the content assist feature for Enact apps (for webOS LS2 APIs and Enact APIs) and JavaScript services (for webOS LS2 APIs). This means if the developer types a keyword, through the content-assist feature, the API syntax and documentation (if available) are shown:

![Content assistant feature](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/content-assist.png)

### Adding Known Devices

The known device is a webOS device that user can access to.

> **Note:** This step is required only once per device.

1. Click the **+** button in the **KNOWN DEVICE** view.

    ![Add the known device](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/add-known-device.png)

    > **Note:** By default, a dummy emulator device is listed in the view. If no emulator is available on your computer, see the guides in the [Emulator Manager](#emulator-manager) section.
    
2. Enter the name and IP address of your webOS device.

    ![Add the known device](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/add-known-device.gif)

3. Set the device as the default device. This ensures that all device operations are performed on that device.

    ![Set the default device](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/set-default-device.jpg)

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

Or You can uninstall the app manually using the [appInstallService](https://www.webosose.org/docs/reference/ls2-api/com-webos-appinstallservice) API or [webOS OSE CLI](https://www.webosose.org/docs/tools/sdk/cli/cli-user-guide/).

### Debugging the App/Service

You can debug web apps, Enact apps, and JavaScript services that are installed on the device (or emulator).

> **Note:** This guide only describes how to start a debugging session and its basic usage. For more details on how to debug on VS Code, refer to the [official guide](https://code.visualstudio.com/docs/editor/debugging).

#### Prerequisites

- Google Chrome browser must be available/installed on the local system.
- IP address of target device (or emulator) and IDE should be in the same network for debugging.

#### How to Start a webOS Debugging Session

Right-click an installed app or service and click **Debug App/Service**. After a while, a debugging session will be enabled.

![Debug the app](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/debug-the-app.gif)

In the **DEBUG CONSOLE** panel, you can check the console messages from the app or service.

![Debug console](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/debug-console.jpg)

After a while, the **Run and Debug** view is automatically opened. In the view, you can check variables, callstack, etc.

![Breakpoint](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/debug-breakpoint.jpg)

> **Note:** 
> - If the **Run and Debug** view is not opened, navigate to **View** > **Open View...** and select **Run and Debug**.
> - If the debugging session is not launched, close all running apps on the webOS device and re-try to click **Debug App/Service**.
> - (very unlikely to occur) You might get a notification indicating that a debug session is already active, even when all debug sessions are closed. To resolve this issue, restart the IDE and try debugging again.

### Previewing the App (Web and Enact)

You can preview web apps or Enact apps in your VS Code before installing it.

In the **APPS IN WORKSPACE** view, right-click the app and click **App Preview**.

![App preview](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/app-preview.jpg)

An **App Preview** page is automatically launched.

![Previewed web app](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/previewed-web-app.jpg)

> **Note:** Only one app can be previewed at the same time. If another app preview is launched, the new preview is launched in the existing tab.

### Running ESLint on the Enact App

ESLint statically analyzes files for potential errors (or warnings) and helps enforce a common coding style. For more information, check [ESLint Configurations](https://enactjs.com/docs/developer-tools/eslint-config-enact/).

In the **APPS IN WORKSPACE** view, right-click the React app and click **Run Lint**. The **PROBLEMS** panel shows the result messages.

![Run lint](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/run-lint.gif)

To clean the Lint messages from the panel, click **Clear Lint**.

![Clear lint](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/clear-lint.jpg)

## Other Features

### Project Wizard

You can generate various templates for webOS apps or services.

![How to use Project Wizard](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/how-to-use-project-wizard.gif)

> **Note:** To use [webos-service library](https://www.webosose.org/docs/reference/webos-service-library/webos-service-library-api-reference/) in JavaScript service or Enact app projects, check the **Yes** button for **Add webOS library**.
> 
> ![Add LS2 APIs to projects](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/add-ls2-apis.jpg)

### Auto-Completion

This features provides the auto-completion using the following trigger strings:

- `luna://`
- `new LS2Request`

#### 'luna://' Strings

Type one of the following texts to call [LS2 APIs](https://www.webosose.org/docs/guides/getting-started/introduction-to-ls2-api/).

- `luna://`
- `'luna://'`
- `"luna://"`

![Auto completion for LS2 APIs](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/auto-complete-ls2-apis.gif)

You can also use the **Tab** key to auto-complete input strings.

![Auto completion using the Tab key](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/auto-complete-tab-key.gif)

> **Note:** If the auto-completion with the **Tab** key doesn't work, please check the **Tab Completion** setting is on.
> ![Enable the tab completion feature](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/enable-tab-completion.jpg)

#### new LS2Request

Type `new LS2Request` to use [webos Library](https://enactjs.com/docs/modules/webos/LS2Request/) of Enact. Using the `Ctrl + Space` keys, you can check the list of supported methods.

![Auto completion for Enact library](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/auto-complete-enact.gif)  

### Emulator Manager

You can manage webOS emulator (VirtualBox) images in VS Code. By default, any webOS emulator images installed in VirtualBox are listed in the **EMULATOR MANAGER** view.

#### Prerequisites

- [VirtualBox](https://www.virtualbox.org/) must be installed on your computer. (Supported version: 6.1 or higher)
- webOS emulator image (`.vmdk`) is required. For how to make the image, refer to [Emulator User Guide](https://www.webosose.org/docs/tools/sdk/emulator/virtualbox-emulator/emulator-user-guide/).
- [Emulator Launcher](https://www.webosose.org/docs/tools/sdk/emulator/virtualbox-emulator/emulator-launcher/) is required. Enter the following command to install it:

    ``` bash
    python3 -m pip install --upgrade webos-emulator --force-reinstall
    ```

#### How to Manage Emulator Images

1. Click the **+** button in the **EMULATOR MANAGER** view.

    ![Add emulator button](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/add-emulator.png)

2. Fill in the input form. For the other system requirements, refer to [Emulator User Guide](https://www.webosose.org/docs/tools/sdk/emulator/virtualbox-emulator/emulator-user-guide/#system-requirements).

    ![Emulator input form](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/emulator-input-form.jpg)

3. Click **Add Instance** and the created instance is listed in the **EMULATOR MANAGER** view.

    ![Added emulator instance](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/added-emulator-instance.png)

4. Click the **Run App** button (triangle) to run the emulator. This action will launch a new a VirtualBox window.

    ![Start the emulator instance](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/start-emulator.png)

    To stop or close an emulator instance, close the running VirtualBox window.

> **Note:**
> - Multiple emulator instances cannot use the same VMDK file.
> - Only one emulator instance can be launched at the same time.
> - When deleting an emulator instance, the associated VMDK file is also **DELETED**. Make sure that the VMDK file is safely backed up.

### IPK Analyzer

You can analyze the file size of the app or services in the IPK file.

1. Open the **Command Palette** (Ctrl+Shift+P) and type **webOS OSE: IPK Analyzer**.
2. Click **Import IPK**.
3. Choose the IPK file to analyze. After the file is loaded, you can see the following screen:

    ![IPK analyzer](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/ipk-analyzer.jpg)

4. Click the **Compare IPK** button to load another IPK. (For example, the older version of the original file)

    ![Compare IPK files](https://webosose.s3.ap-northeast-2.amazonaws.com/tools/vs-code-extension-webos-studio/compare-ipks.jpg)

## Command Palette

| Category                   | Command                            | Description                                                         |
|----------------------------|------------------------------------|---------------------------------------------------------------------|
| Project Wizard             | webOS OSE: Create Project Wizard   | Generates source code templates.                                    |
| Developing apps/services   | webOS OSE: Install Global Packages | Installs essential global packages to run this extension.           |
|                            | webOS OSE: Generate Project        | Creates a web app, Enact App, JavaScript Service from a template.   |
|                            | webOS OSE: Package Application     | Packages the app into a package file (IPK).                         |
| Connecting devices         | webOS OSE: Set Up Device           | Adds, modifies, or removes devices from the device list.            |
| Testing apps on the device | webOS OSE: Install Application     | Installs an app on the device.                                      |
|                            | webOS OSE: Launch Application      | Runs an app installed on the device.                                |
| Batch commands             | webOS OSE: Run Application         | Package, Install, and Launch operations are executed sequentially.  |
|                            | webOS OSE: Debug Application       | Package, Install, and Inspect operations are executed sequentially. |
| Analyzing an IPK           | webOS OSE: IPK Analyzer            | Analyzes a selected IPK.                                            |

## Miscellaneous Information

- When the IDE is opened, a notification indicates the VirtualBox is not installed, even when VirtualBox is in fact installed and working properly. To resolve this, update the environment path variable to point to the VirtualBox installation directory.
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

Copyright (c) 2021-2022 LG Electronics, Inc.

All content, including all source code files and documentation files in this repository except otherwise noted are:

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

SPDX-License-Identifier: Apache-2.0