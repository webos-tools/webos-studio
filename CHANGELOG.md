# Changelog

All notable changes to the "webOS Studio" extension will be documented in this file.

> This extension is based on the [webOS OSE extension](https://marketplace.visualstudio.com/items?itemName=webOSOSESDK.webosose).

## [2.1.0] [2024-07-31]

- New features
  - Providing a list of the latest SDK versions in PACKAGE MANAGER
  - Importing apps/services from outside of the current workspace
  - Adjusting resolution in the app preview
- Improve UI
  - PACKAGE MANAGER, SIMULATOR MANAGER, IPK Analyzer
- Change PACKAGE MANAGER to only show SDKs of the current profile
- Change the naming rule of the target device
- Change webOS Studio to not open the OUTPUT panel by default when it starts
- Update README.md
- TV profile
  - Support auto-completion
- OSE profile
  - Support LS2 API level 29
  - Add a new feature: Log Viewer
- Bug fix
  - Fixed a bug where KNOWN DEVICE was not updated properly
  - Fixed a bug where icons in KNOWN DEVICE were not displayed properly in the 'Light High Contrast' theme

## [2.0.2] [2024-04-06]

- Change Simulator name and order in sidebar
- Remove webOS Emulator Launcher install prompt pop-up
- Update webOS Studio UI text
- Update TV Simulator 6.0
- Update README.md
- Bug fix
  - Global package installation progress notification and an OSE/TV CLI deletion notification occur simultaneously

## [2.0.1] [2024-03-28]

- Change API Level string in project wizard for TV profile
- Change TV simulator version notation on notification window
- Change Debug sub menu name and function
- Remove auto focus of webOS Studio extension on start and do not show display numbers for TV profile
- Remove beanviser in the Package Manager
- Disable auto focus to Output log
- Set WEBOS_CLI_TV variable to launch TV Emulator
- Update TV Simulators to v1.4.1
- Fix following bugs
  - Default target information is displayed as null when install or run app
  - Can't launch or use TV emulator
  - Color theme bug for the Package Manager
  - Show information error in TV profile
  - There is no Debug Application menu on ipk file
  - TV emulator v1.2.0 does not run
  - TV emulator is not running on fresh linux environment

## [2.0.0] [2024-03-05]

This is an integrated release for OSE and TV of the webOS Studio extension.

- Introducing Device Profile for OSE and TV as a command, webOS: Set Device Profile
- Adding new features
  - Device profiles
  - Package Manager
  - Resource Monitoring
  - Using integrated CLI
- Integrating common commands between OSE and TV as follows:
  - webOS: Create ProjectWizard
  - webOS: Install Global Packages
  - webOS: Install Emulator Launcher
  - webOS: Auto Reload
  - webOS: Package Application
  - webOS: Set Up Device
  - webOS: Install Application
  - webOS: Launch Application
  - webOS: Debug
  - webOS: IPK Analyzer
  - webOS: Run Application
- OSE only features
  - Resource Monitoring
- TV only features
  - webOS TV: Set Up SSH Key
  - webOS TV: Run on Simulator
- Others
  - Updated webOS Emulator Launcher as v0.9.4

## [1.1.4] [2023-11-08]

- Update webOS OSE API Level 27

## [1.1.3] [2023-10-24]

- Update webOS OSE API Level 24 and 25

## [1.1.2] [2023-08-04]

- Disable Package Manager as it is POC version
- Fix package.json change notification issue

## [1.1.1] [2023-06-26]

- Fix broken URLs for images in README.md
- Update package-lock.json with node v18.12.1 and npm 8.19.2

## [1.1.0] [2023-06-12]

- Improve logging output for user's perspective
- Add a new command: `webOS: Install Emulator Launcher`

## [1.0.8] [2023-05-15]

- Enhance the Auto-completion feature
  - Suggest parameters based on user input
  - Provide descriptions for LS2 API services, methods, and parameters
  - Manage the API level of projects using `.webosstudio.config`
- Support live reloading in preview
- Provide operation logs in the OUTPUT panel
- Support debugging in VS Code

## [1.0.1] [2022-12-28]

- Add a notice for restriction in README.md

## [1.0.0] [2022-12-27]

This is an initial release of the webOS Studio extension. Key features are as follows:

- Creating apps and services from templates
- Packaging, installing, launching, and debugging apps and services
- Running ESLint on Enact apps
- Assisting the use of webOS-related APIs through content assist and auto-completion
- Supporting app preview (Web and Enact)
- Managing connected webOS devices
- Managing images for VirtualBox Emulator
- Analyzing IPK files
- Project Wizard
