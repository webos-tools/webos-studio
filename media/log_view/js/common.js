/*
 * Copyright (c) 2021-2022 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
const vscode = acquireVsCodeApi();
let logScroller = null;

class LogScroller {
  constructor() {
    this.logRowObserver = null;
    this.rowHeight = 21;
    this.pageSize = 25;
    this.bufferSpace = 25;
    this.logTable = null
    this.isSingleRow = false;
    this.isInitBulkReceived = false;
    this.isArrowKeyDown = false;
    this.isWaitingScrollRows
    this.hasScrollInQ = false;
    this.isProcessStoped = false
    this.isliveLoaderActive = true;
    this.filterDDObj = {}
    this.filterDDObjOptionToUpdate = {}

    this.currentPageRowStartIndex = 0;
    this.currentLogType = ""
  }
  init() {
    window.onmessage = this.handleMsg.bind(this);
    this.SetTableFormat();
    if (!this.isSingleRow) {
      initTableResizer();
      onresize = () => {
        resizeColOnWindowResize();
        this.lastScrollTop = this.lastScrollTop + 1
        this.doScroll();

      };

    }
    this.initScroll();
    this.initInterSectionObservers();
    this.initTableEvents();
    this.getInitialBulk();
    this.initFilter();
    this.toolBarInit();

  }
  toolBarReset() {
    document.getElementById("logFinderInput").value = "";
    this.toolBarInit();
  }
  toolBarInit() {
    this.isToolBarExpanded = false;
    this.isToolBarMenuVisible = false;

    this.currentFindRowIndex = -1
    this.currentFindColIndex = -1

    document.getElementById("logFindResult").innerHTML = "No results"
    this.isFindOn = false;
    this.findKeyword = ""
    this.totalFound = 0;
    this.currentFoundCount = 0; // focused  count
    document.getElementById("toolBarMenu").onclick = this.toolBarMenuClick.bind(this)
    let menu_switchLog = document.getElementById("menu_switchLog")
    let menu_exportLog = document.getElementById("menu_exportLog")
    let menu_importLog = document.getElementById("menu_importLog")
    let menu_stopLog = document.getElementById("menu_stopLog")
    let menu_startLog = document.getElementById("menu_startLog")

    let importRowSelector_select = document.getElementById("importRowSelector_select")
    menu_stopLog.onclick = () => {
      let msg = {
        command: "STOP_LOG",
        data: {}
      };
      vscode.postMessage(msg);
      document.getElementById("menu_startLog").style.display = "block"
      document.getElementById("menu_stopLog").style.display = "none"
    }
    menu_startLog.onclick = () => {
      document.getElementById("menu_stopLog").style.display = "block"
      document.getElementById("menu_startLog").style.display = "none"
      this.clearAllFilter()
      let msg = {
        command: "RESTART_LOG",
        data: {}
      };
      vscode.postMessage(msg);
      document.getElementById("menu_switchLog").style.display = "block";
    }


    menu_switchLog.onclick = () => {
      let msg = {
        command: "SWITCH_LOG",
        data: {}
      };
      vscode.postMessage(msg);
      this.hideToolBarMenu()
    }

    menu_exportLog.onclick = () => {
      let fileName = this.getExportFileName()
      let msg = {
        command: "EXPORT_LOG",
        data: {
          fileName: fileName,
          logType: this.currentLogType
        }
      };
      vscode.postMessage(msg);

      this.hideToolBarMenu()
    }
    menu_importLog.onclick = () => {

      let fileName = this.getExportFileName()
      let msg = {
        command: "IMPORT_LOG",
        data: {
          fileName: fileName,
          logType: this.currentLogType
        }
      };
      vscode.postMessage(msg);
      this.hideToolBarMenu()

    }
    importRowSelector_select.onchange = () => {
      let msg = {
        command: "IMPORT_SELECTED",

        data: { zipFile: this.importInfo.zipFile, importingFileIndex: parseInt(importRowSelector_select.value) }
      };
      vscode.postMessage(msg);

    }

    document.getElementById("logFinderInput").onsearch = (e) => {

      if (e.currentTarget.value != "") {

        if (this.isFindOn && this.totalFound > 0) {
          let msg = {
            command: "FIND_NEXT",
            data: {
              "SEQ_IDX": this.currentFindRowIndex,
              "colIndex": this.currentFindColIndex,
              "startCount": this.currentFoundCount
            }
          };

          vscode.postMessage(msg);
        }


      }

    }
    document.getElementById("logFinderInput").oninput = (e) => {

      if (e.currentTarget.value != "") {
        // start find
        this.sendStartFind(e.currentTarget.value)

      } else {
        // stop
        this.sendStopFind();
      }


    }
    document.getElementById("findUp").onclick = () => {
      if (this.isFindOn && this.totalFound > 0) {
        let msg = {
          command: "FIND_PREVIOUS",
          data: {
            "SEQ_IDX": this.currentFindRowIndex,
            "colIndex": this.currentFindColIndex,
            "startCount": this.currentFoundCount
          }
        };

        vscode.postMessage(msg);
      }
    }
    document.getElementById("findDown").onclick = () => {
      if (this.isFindOn && this.totalFound > 0) {
        let msg = {
          command: "FIND_NEXT",
          data: {
            "SEQ_IDX": this.currentFindRowIndex,
            "colIndex": this.currentFindColIndex,
            "startCount": this.currentFoundCount

          }
        };

        vscode.postMessage(msg);
      }
    }

  }
  getExportFileName() {
    let fileName = this.currentLogType + "Log";

    if (
      this.filterDDObj["SEL_PRIORITY"].selectedOptions.length > 0 ||
      this.filterDDObj["SEL_SYSLOG_IDENTIFIER"].selectedOptions.length > 0 ||
      this.filterDDObj["SEL_SYSLOG_PID"].selectedOptions.length > 0 ||
      this.filterDDObj["SEL_MESSAGE"].selectedOptions.length > 0
    ) {
      fileName = fileName + "_" + "Filtered";
    }
    const d = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];



    fileName = fileName + "_" + d.getFullYear() + monthNames[d.getMonth()] + d.getDate() + "_" + d.getHours() + "-" + d.getMinutes() + "-" + d.getSeconds();
    return fileName
  }
  sendStartFind(keyword) {



    this.conv_findKeyword = keyword.replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]").replaceAll("^", "\\^")
      .replaceAll("$", "\\$").replaceAll(".", "\\.").replaceAll("|", "\\|").replaceAll("?", "\\?").replaceAll("*", "\\*")
      .replaceAll("+", "\\+").replaceAll("(", "\\(").replaceAll(")", "\\)").replaceAll("{", "\\{").replaceAll("}", "\\}")
    let msg = {
      command: "START_FIND",
      data: {
        "keyword": this.conv_findKeyword,
        "SEQ_IDX": this.currentPageRowStartIndex,

      }
    };

    vscode.postMessage(msg);
    this.findKeyword = keyword;
    this.isFindOn = true;

  }
  sendStopFind() {
    let msg = {
      command: "STOP_FIND",
      data: {

      }
    };
    vscode.postMessage(msg);

    this.currentFindRowIndex = -1
    this.currentFindColIndex = -1

    document.getElementById("logFindResult").innerHTML = "No results"

    this.totalFound = 0;
    this.currentFoundCount = 0;
    this.findKeyword = ""
    this.conv_findKeyword = ""
    this.isFindOn = false

    this.sendRowReqOnFindStartAndStop(this.currentPageRowStartIndex)


  }
  hideToolBarMenu() {
    this.isToolBarMenuVisible = false;
    let menu = document.getElementById("toolBarCtxMenu")
    menu.style = `display:none`
  }
  showToolBarMenu() {
    this.isToolBarMenuVisible = true;
    let menu = document.getElementById("toolBarCtxMenu")
    menu.style = `display:block;top:28px;right:35px`

  }
  toolBarMenuClick(event) {
    event.preventDefault()
    event.stopPropagation();
    if (this.isToolBarMenuVisible) {
      this.hideToolBarMenu();
    } else {
      this.showToolBarMenu();
    }

  }



  initFilter() {

    this.pidOptions = ""
    this.identifierOptions = "";

    this.initPriorityFilter()
    this.initPIDFilter();
    this.initIdentifierFilter();
    this.initMessageFilter()
  }
  initPriorityFilter() {
    var options = {
      searchable: true,
      placeholder: 'Priority',
      searchtext: 'Search',
      selectedtext: 'Priority',
      selectType: "select"
    };
    this.filterDDObj["SEL_PRIORITY"] = initSelectFilter(document.getElementById("SEL_PRIORITY"), options);
    document.getElementById("SEL_PRIORITY").onchange = this.sendFilterReq.bind(this)

  }

  initIdentifierFilter() {
    var options = {
      searchable: true,
      placeholder: 'Identifier',
      searchtext: 'Search',
      selectedtext: 'Identifier',
      selectType: "select"
    };

    this.filterDDObj["SEL_SYSLOG_IDENTIFIER"] = initSelectFilter(document.getElementById("SEL_SYSLOG_IDENTIFIER"), options);
    document.getElementById("SEL_SYSLOG_IDENTIFIER").onchange = this.sendFilterReq.bind(this)
    document.getElementById("SEL_SYSLOG_IDENTIFIER").addEventListener("modalclose", this.reloadDD.bind(this));

  }
  initPIDFilter() {
    var options = {
      searchable: true,
      placeholder: 'Process',
      searchtext: 'Search',
      selectedtext: 'Process',
      selectType: "select"
    };

    this.filterDDObj["SEL_SYSLOG_PID"] = initSelectFilter(document.getElementById("SEL_SYSLOG_PID"), options);
    document.getElementById("SEL_SYSLOG_PID").onchange = this.sendFilterReq.bind(this)
    document.getElementById("SEL_SYSLOG_PID").addEventListener("modalclose", this.reloadDD.bind(this));

  }
  initMessageFilter() {
    var options = {
      searchable: true,
      placeholder: 'Message',
      searchtext: 'Search or Press enter to add keyword',
      selectedtext: 'Message',
      selectType: "text_search"
    };

    this.filterDDObj["SEL_MESSAGE"] = initSelectFilter(document.getElementById("SEL_MESSAGE"), options);
    document.getElementById("SEL_MESSAGE").onchange = this.sendFilterReq.bind(this)
    document.getElementById("SEL_MESSAGE").addEventListener("modalclose", this.reloadDD.bind(this));


  }
  initTableEvents() {
    this.logTable = document.getElementById("scrollTable")
    this.logTable.onclick = this.onClick.bind(this);
    this.logTable.onkeydown = this.onKeyDown.bind(this)
    this.logTable.onkeyup = this.onKeyUp.bind(this)
    document.body.onkeydown = this.onBodyKeyDown.bind(this)
  }
  reloadDD(event) {
    event.preventDefault();
    event.stopPropagation();

    if (this.filterDDObjOptionToUpdate[event.currentTarget.id] && this.filterDDObjOptionToUpdate[event.currentTarget.id] != "") {
      let ddKeys = this.filterDDObjOptionToUpdate[event.currentTarget.id]
      let newOptions = {}
      Object.keys(ddKeys).forEach((k) => {
        let isSelected = false;

        this.filterDDObj[event.currentTarget.id].selectedOptions.forEach(option => {
          if (k == option["data"]["value"]) {
            isSelected = true;
            return;
          }

        });
        newOptions[k] = isSelected

      });



      let optionHTML = ""
      Object.keys(newOptions).forEach((k) => {
        optionHTML = optionHTML + `<option value ="${k}" ${newOptions[k] ? "selected ='true'" : ""}  >${k}</option>`
      });
      document.getElementById(event.currentTarget.id).innerHTML = optionHTML

      this.filterDDObj[event.currentTarget.id].update()
      this.filterDDObjOptionToUpdate[event.currentTarget.id] = "";
    }

  }
  onClick(event) {

    var row = this.getContainingRow(event.target);

    this.focus(row)
  }
  getContainingRow(start) {
    var possibleRow = start;
    if (this.logTable.contains(possibleRow)) {
      while (possibleRow !== this.logTable) {
        if (possibleRow.localName === 'tr') {
          return possibleRow;
        }
        possibleRow = possibleRow.parentElement;
      }
    }
  }
  focus(elem) {
    if (!elem) return;
    if (elem.id == "topRow" || elem.id == "bottomRow") return;
    elem.tabIndex = 0; // Ensure focusable
    elem.focus();
  }
  isEndRowsWithIn(isNext, withIn) {
    let currentRow = this.getRowWithFocus();
    if (!currentRow) return false;
    for (let i = 1; i <= withIn; i++) {
      if (isNext) {
        if (currentRow.nextElementSibling.id == "bottomRow") {
          return true;
        } else {
          currentRow = currentRow.nextElementSibling
        }
      } else {
        if (currentRow.previousElementSibling.id == "topRow") {
          return true;
        } else {
          currentRow = currentRow.previousElementSibling
        }
      }

    }
    return false;

  }
  onKeyUp(event) {
    let key = event.keyCode;

    if (key == 38 || key == 40) {
      this.isArrowKeyDown = false;
      this.removeExpiredRows();
    }
  }
  onBodyKeyDown(event) {
    let STOP = 67;
    let FIND = 70;
    let key = event.keyCode;
    switch (key) {
      case STOP: {
        if (this.isLiveLog) {
          if (event.ctrlKey && window.getSelection().toString() == "") {
            let msg = {
              command: "STOP_LOG",
              data: {}
            };
            vscode.postMessage(msg);

            document.getElementById("menu_startLog").style.display = "block"
            document.getElementById("menu_stopLog").style.display = "none"
          }
        }
      }
        break;
      case FIND: {
        if (event.ctrlKey) {
          event.preventDefault();
          event.stopPropagation();

        }
      }
        break;
    }
  }
  onKeyDown(event) {

   
    let UP = 38;
    let DOWN = 40;
    let key = event.keyCode;
    switch (key) {
      // case ENTER:
      case DOWN: {
        document.documentElement.scrollTop = document.documentElement.scrollTop + this.rowHeight
      }
        this.isArrowKeyDown = true;
        break;

      case UP:
        {
          document.documentElement.scrollTop = document.documentElement.scrollTop - this.rowHeight
        }
        this.isArrowKeyDown = true;
        break;
      default:
        return;
    }

  }

  getRowWithFocus() {
    return this.getContainingRow(document.activeElement);
  }

  initScroll() {
    this.initScrollBarDrag();
    document.body.onscroll = this.doOnScroll.bind(this)
    window.onscrollend = this.doScroll.bind(this)

  }
  initScrollBarDrag() {
    this.isMouseDown = false;
    window.onmousedown = () => {
      this.isMouseDown = true

    }
    window.onmouseup = () => {
      this.isMouseDown = false

    }

  }
  doOnScroll(event) {
    setTimeout(() => {
      if (this.isMouseDown || this.isArrowKeyDown || event.type == "scroll") {
        this.doScroll();

      }
    }, 100);

  }
  doScroll() {
    if (isTableInitilizing) return;
    let scrollDir = "DOWN";
    if (this.lastScrollTop && this.lastScrollTop > document.documentElement.scrollTop) {
      scrollDir = "UP";
    }

    // check it is horizontal scroll

    if (this.lastScrollTop == document.documentElement.scrollTop) {
      return
    }
    else {
      this.lastScrollTop = document.documentElement.scrollTop
    }

    if (this.isWaitingScrollRows) {
      this.hasScrollInQ = true;
      return;
    }
    if (!this.isWaitingScrollRows) {

      let rowIndex = parseInt(document.documentElement.scrollTop / this.rowHeight)

      this.hasScrollInQ = false;
      this.isWaitingScrollRows = true;

      let scrollContainer = document.getElementById("outerContainer")
      let rect = scrollContainer.getBoundingClientRect();


      let msg = {
        command: "GET_ROWS_ON_SCROLL",
        data: {
          rowsCount: parseInt(rect.height / this.rowHeight),
          rowIndex: rowIndex,
          scrollDir: scrollDir
        }
      };
      vscode.postMessage(msg);

    }

  }





  removeExpiredRows() {
    let logRows = document.querySelectorAll("tr[data-isexpired]")
    logRows.forEach(logRow => {
      this.logRowObserver.unobserve(logRow)
      logRow.remove();
    });

  }
  removeAllLogRows() {
    let logRows = document.querySelectorAll("tr[data-islogrow]")
    logRows.forEach(logRow => {
      this.logRowObserver.unobserve(logRow)
      logRow.remove();
    });
  }
  setLiveLoaderPosition(rows) {
    let liveLoaderElement = document.getElementById("liveLoaderElement")
    liveLoaderElement.style.top = this.isSingleRow ? (rows * this.rowHeight) + "px" : (rows * this.rowHeight) + this.rowHeight + this.bufferSpace + "px"
    document.getElementById("liveLoaderElementText").style.top = liveLoaderElement.style.top

    liveLoaderElement.style.display = this.isProcessStoped ? "none" : "block";
    let processStopedLine = document.getElementById("processStopedLine")
    processStopedLine.style.top = this.isSingleRow ? (rows * this.rowHeight) + "px" : (rows * this.rowHeight) + this.rowHeight + this.bufferSpace + "px"

  }
  isLiveLoading() {
    if (this.isliveLoaderActive) {
      return true;
    }
    // initial loading this may not right so exectuting below

    let liveLoaderElement = document.getElementById("liveLoaderElement")
    let isLiveLoaderActive = this.elementInViewport(liveLoaderElement);
    if (isLiveLoaderActive) {
      return true;
    } else {
      return false;
    }
  }
  setScrollSize(rowsCount) {
    this.stackSize = rowsCount

    document.getElementById("scrolldiv").style.height = (rowsCount * this.rowHeight) + 50 + "px"
    document.getElementById("tbody").style.height = (rowsCount * this.rowHeight) + 50 + "px"
    // set live loder position


    if (this.isLiveLoading()) {
      document.documentElement.scrollTop = (rowsCount * this.rowHeight) + 50;

    }
    this.setLiveLoaderPosition(rowsCount)


  }
  elementInViewport(el) {
    var top = el.offsetTop;
    var left = el.offsetLeft;
    var width = el.offsetWidth;
    var height = el.offsetHeight;

    while (el.offsetParent) {
      el = el.offsetParent;
      top += el.offsetTop;
      left += el.offsetLeft;
    }

    return (
      top >= window.pageYOffset &&
      left >= window.pageXOffset &&
      (top + height) <= (window.pageYOffset + window.innerHeight) &&
      (left + width) <= (window.pageXOffset + window.innerWidth)
    );
  }
  addRowToBottom(rowObj) {
    let rowElement = this.generateRowElement(rowObj);
    let refElement = document.getElementById("bottomRow");
    refElement.parentNode.insertBefore(rowElement, refElement);
    this.logRowObserver.observe(rowElement)

  }
  addRowToTop(rowObj) {
    let rowElement = this.generateRowElement(rowObj);
    let refElement = document.getElementById("topRow");
    refElement.parentNode.insertBefore(rowElement, refElement.nextElementSibling);
    this.logRowObserver.observe(rowElement)

  }


  generateRowElement(rowObj) {
    let regEx = new RegExp(this.conv_findKeyword, "ig");
    let row = document.createElement('tr');
    row.setAttribute("data-islogRow", "true");

    row.classList.add("absrow");
    row.style.top = this.isSingleRow ? (rowObj.SEQ_IDX * this.rowHeight) + "px" : (rowObj.SEQ_IDX * this.rowHeight) + this.rowHeight + this.bufferSpace + "px"

    row.style.height = this.rowHeight + "px"

    if (parseInt(rowObj.PRIORITY) <= 3) {
      row.classList.add("trError");
    } else if (parseInt(rowObj.PRIORITY) == 4) {
      row.classList.add("trWarning");
    }
    row.setAttribute("SEQ_IDX", rowObj.SEQ_IDX)
    row.setAttribute("tabindex", "0")
    let priorityString = ""
    switch (rowObj.PRIORITY) {
      case "0":
        priorityString = "Emergency"
        break;
      case "1":
        priorityString = "Alert"
        break;
      case "2":
        priorityString = "Critical"
        break;
      case "3":
        priorityString = "Error"
        break;
      case "4":
        priorityString = "Warning"
        break;
      case "5":
        priorityString = "Notice"
        break;
      case "6":
        priorityString = "Info"
        break;
      case "7":
        priorityString = "Debug"
        break;
    }
    let colHtml =
      `<td  data-col ="col0" ${this.isSingleRow ? "class='otherCol'" : "class='hidden_td otherCol'"}> </td> 
    <td  data-col ="col1" ${this.isSingleRow ? "class='hidden_td otherCol'" : "class='otherCol'"}> ${this.isFindOn ? rowObj.SYSLOG_TIMESTAMP.replace(regEx, `<span  class="logText logText_found">${this.findKeyword}</span>`) : rowObj.SYSLOG_TIMESTAMP}</td>
    <td  data-col ="col2" ${this.isSingleRow ? "class='hidden_td otherCol'" : "class='otherCol'"}> ${this.isFindOn ? priorityString.replace(regEx, `<span  class="logText logText_found">${this.findKeyword}</span>`) : priorityString}</td>
    <td  data-col ="col3" ${this.isSingleRow ? "class='hidden_td otherCol'" : "class='otherCol'"}> ${this.isFindOn ? rowObj.SYSLOG_IDENTIFIER.replace(regEx, `<span  class="logText logText_found">${this.findKeyword}</span>`) : rowObj.SYSLOG_IDENTIFIER}</td>
    <td  data-col ="col4" ${this.isSingleRow ? "class='hidden_td otherCol'" : "class='otherCol'"}> ${this.isFindOn ? rowObj.SYSLOG_PID.replace(regEx, `<span  class="logText logText_found">${this.findKeyword}</span>`) : rowObj.SYSLOG_PID}</td>
    <td  data-col ="col5" ${this.isSingleRow ? "class='hidden_td lastCol'" : "class='lastCol'"}> </td>
    
    `

    row.innerHTML = colHtml;
    if (this.isSingleRow) {
      row.firstElementChild.innerText = `${rowObj.SYSLOG_TIMESTAMP} ${rowObj.SYSLOG_IDENTIFIER}[${rowObj.SYSLOG_PID}]${rowObj.MESSAGE}`
    } else {
      row.lastElementChild.innerHTML = this.isFindOn ? rowObj.MESSAGE.replace("<", " ").replace(">", " ").replace(regEx, `<span   class="logText logText_found">${this.findKeyword}</span>`) : rowObj.MESSAGE
    }

    if (rowObj.SEQ_IDX == this.currentFindRowIndex && this.isFindOn) {
      // this the focus row for the find operation
      let allFoundSpan = row.querySelectorAll(".logText");
      if (allFoundSpan.length > 0 && allFoundSpan[this.currentFindColIndex]) {
        allFoundSpan[this.currentFindColIndex].classList.replace("logText_found", "logText_found_focused");

      }
    }



    return row;


  }
  handleMsg(event) {
    const message = event.data; // The json data that the extension sent
    switch (message.command) {
      case "STACK_SIZE": {
        this.setScrollSize(message.data.stackSize)
      }
        break;

      case "INITIAL_BULK": {
        document.getElementById("outerContainer").style.display = "flex"
        message.data.rows.forEach(rowObj => {
          this.addRowToBottom(rowObj)
        });
        this.setLiveLoaderPosition(message.data.rows.length)
        this.isInitBulkReceived = true;


        this.receiveTillBlinker();



      }
        break;
      case "NEW_ROWS": {

        message.data.rows.forEach(rowObj => {
          if (message.data.isNext) {
            this.addRowToBottom(rowObj)
          } else {
            this.addRowToTop(rowObj)
          }

        });

      }
        break;
      case "ROWS_ON_SCROLL": {
        this.isWaitingScrollRows = false;
        this.removeAllLogRows()
        this.currentPageRowStartIndex = message.data.rowIndex

        message.data.rows.forEach(rowObj => {
          this.addRowToBottom(rowObj)
        });

        // execute the next scroll in que
        if (this.hasScrollInQ) {
          this.doScroll();
        }
        /// align newly added rows to col
        if (!this.isSingleRow) {
          initTableResizer();

        }


      }
        break;

      case "LOG_STOPED":
        {
          this.showHideNoLogEntry(false, 0)
          this.stopUI()
          document.getElementById("menu_startLog").style.display = "block"
          document.getElementById("menu_stopLog").style.display = "none"
          document.getElementById("menu_switchLog").style.display = "none";
        }
        break;
      case "VIEW_RELOADED": {
        this.isProcessStoped = false;
        let processStopedLine = document.getElementById("processStopedLine")
        processStopedLine.style.display = "none";
        this.removeAllLogRows();
        this.resetFilter();
        this.toolBarReset()

        let liveLoaderElement = document.getElementById("liveLoaderElement")
        liveLoaderElement.style.display = "block";
        let scrollContainer = document.getElementById("outerContainer")
        let rect = scrollContainer.getBoundingClientRect();
        this.setLiveLoaderPosition(parseInt(rect.height / this.rowHeight))
        this.setScrollSize(parseInt(rect.height / this.rowHeight))

        this.receiveTillBlinker();

        document.getElementById("menu_startLog").style.display = "none"
        document.getElementById("menu_stopLog").style.display = "block"
        document.getElementById("menu_switchLog").style.display = "block";


      }
        break;
      case "DEVICE_ERROR":
        document.getElementById("menu_startLog").style.display = "block"
        document.getElementById("menu_stopLog").style.display = "none"
        document.getElementById("menu_switchLog").style.display = "none";
        break;
      case "SYSLOG_IDENTIFIERS_DD": {
        this.updateDD(message.data.dd, "SEL_SYSLOG_IDENTIFIER")

      }
        break;

      case "SYSLOG_PID_DD": {
        this.updateDD(message.data.dd, "SEL_SYSLOG_PID")

      }
        break;
      case "FILTER_DONE":
        {
          this.removeAllLogRows();

          if (message.data.rowsFound == 0) {
            this.showHideNoLogEntry(true, 2);
          }
          else {
            this.showHideNoLogEntry(false, 0);
            // in this case it wont scroll
            let scrollContainer = document.getElementById("outerContainer")
            let rect = scrollContainer.getBoundingClientRect();
            this.receiveTillBlinker()
            let msg = {
              command: "GET_ROWS_ON_SCROLL",
              data: {
                rowsCount: parseInt(rect.height / this.rowHeight),
                rowIndex: message.data.rowsFound - 1,
                scrollDir: "DOWN"
              }
            };
            vscode.postMessage(msg);

          }
        }
        break;
      case "LOCATION_CHANGED":
        {
          this.isInitBulkReceived = true;
          this.reCreateDDWithState(message.data.ddState.SYSLOG_IDENTIFIERS, "SEL_SYSLOG_IDENTIFIER")
          this.reCreateDDWithState(message.data.ddState.SYSLOG_PID, "SEL_SYSLOG_PID")
          this.reCreateDDWithState(message.data.ddState.PRIORITY, "SEL_PRIORITY")
          this.reCreateDDWithState(message.data.ddState.MESSAGE, "SEL_MESSAGE")

          this.isProcessStoped = !message.data.isProcessRunning;
          this.setScrollSize(message.data.stackSize)
          this.setLiveLoaderPosition(message.data.stackSize)


          setTimeout(() => {
            let scrollContainer = document.getElementById("outerContainer")
            let rect = scrollContainer.getBoundingClientRect();
            this.setLiveLoaderPosition(message.data.stackSize < this.stackSize ? this.stackSize : message.data.stackSize)
            document.documentElement.scrollTop = message.data.stackSize * this.rowHeight
            let msg = {
              command: "GET_ROWS_ON_SCROLL",
              data: {
                rowsCount: parseInt(rect.height / this.rowHeight),
                rowIndex: message.data.stackSize - 1,
                scrollDir: "DOWN"
              }
            };
            vscode.postMessage(msg);
            if (!message.data.isProcessRunning) {
              let processStopedLine = document.getElementById("processStopedLine")
              processStopedLine.style.display = "block";
            }
            if (message.data.stackSize == 0) {
              this.showHideNoLogEntry(true, 2)
            }

          }, 500);
        }
        break;
      case "BLINKER_LOADING": {
        document.getElementById("liveLoaderElementText").style.display = "block"
        document.getElementById("liveLoaderElementText").innerHTML = "Loading.."
      }
        break;
      case "BLINKER_LOADING_DONE": {
        document.getElementById("liveLoaderElementText").style.display = "none";
        document.getElementById("liveLoaderElementText").innerHTML = "";

        break;
      }
      case "FIND_SUMMARY":
        this.updateFindSummary(message)
        break
      case "FIND_SCROLL_TO":
        this.onFindScrollTo(message)

        break;
      case "CURRENT_LOGGER":

        this.setCurrentLogger(message)
        break
      case "PREPARE_LOG_SWITCH":
        {
          this.removeAllLogRows();
          this.clearAllFilter()
          this.resetFilter();
          this.toolBarReset()
          this.showHideNoLogEntry(false, 0)
          let liveLoaderElement = document.getElementById("liveLoaderElement")
          liveLoaderElement.style.display = "none"
          document.getElementById("liveLoaderElementText").style.display = "none";
          document.getElementById("liveLoaderElementText").innerHTML = "";
          let processStopedLine = document.getElementById("processStopedLine")
          processStopedLine.style.display = "none"
          document.getElementById("scrolldiv").style.height = (1 * this.rowHeight) + 50 + "px"
          document.getElementById("tbody").style.height = (1 * this.rowHeight) + 50 + "px"
        }

        break;

      case "IMPORT_DONE":
        {
          let liveLoaderElement = document.getElementById("liveLoaderElement")
          liveLoaderElement.style.display = "none"
          document.getElementById("liveLoaderElementText").style.display = "none";
          document.getElementById("liveLoaderElementText").innerHTML = "";
          let processStopedLine = document.getElementById("processStopedLine")
          processStopedLine.style.display = "none";

          setTimeout(() => {
            let scrollContainer = document.getElementById("outerContainer")
            let rect = scrollContainer.getBoundingClientRect();
            document.documentElement.scrollTop = message.data.stackSize * this.rowHeight
            let msg = {
              command: "GET_ROWS_ON_SCROLL",
              data: {
                rowsCount: parseInt(rect.height / this.rowHeight),
                rowIndex: message.data.stackSize - 1,
                scrollDir: "DOWN"
              }
            };
            vscode.postMessage(msg);
          }, 500);
        }
        break;
      case "LOGGER_MODE":
        {
          this.isLiveLog = message.data.isLive
        }
        break;
      case "CLEAR_IMPORTINFO":
        this.importInfo = null;
        document.getElementById("importRowSelector_select").innerHTML = ""
        document.getElementById("importRowSelector").style.display = "none"
        break;


      case "IMPORT_ON_GOING": {
        this.importInfo = message.data.importInfo
        this.isProcessStoped = false;
        let processStopedLine = document.getElementById("processStopedLine")
        processStopedLine.style.display = "none";
        this.removeAllLogRows();
        this.resetFilter();
        this.toolBarReset()


        let scrollContainer = document.getElementById("outerContainer")
        let rect = scrollContainer.getBoundingClientRect();
        this.setLiveLoaderPosition(parseInt(rect.height / this.rowHeight))
        this.setScrollSize(parseInt(rect.height / this.rowHeight))

        this.receiveTillBlinker();
        this.showImportInfo(message)



      }
        break;
    }
  }
  showImportInfo(message) {


    let optionText = ""
    message.data.importInfo.logInfoJson.files.forEach((element, index) => {
      optionText = optionText + `<option value="${index}" ${message.data.importInfo.importingFileIndex == index ? "selected" : ""}>${(element.start + 1) + " - " + (element.end + 1)}</option>`

    });
    document.getElementById("importRowSelector_select").innerHTML = optionText
    document.getElementById("importRowSelector").style.display = "block"

    document.getElementById("menu_startLog").style.display = "block"
    document.getElementById("menu_stopLog").style.display = "none";
    document.getElementById("menu_switchLog").style.display = "none";

    this.setCurrentLogger({ data: { logType: message.data.importInfo.logInfoJson.log_type } })

  }
  setCurrentLogger(message) {
    this.currentLogType = message.data.logType
    if (this.currentLogType == "PM") {
      document.getElementById("menu_switchLog").innerHTML = "Switch to Journal Log "
      document.getElementById("toolBar_title").innerHTML = "PM Log"

    } else {
      document.getElementById("menu_switchLog").innerHTML = "Switch to PM Log "
      document.getElementById("toolBar_title").innerHTML = "Journal Log"

    }

  }
  onFindScrollTo(message) {

    if (this.isFindOn) {
      this.currentFindRowIndex = message.data.SEQ_IDX
      this.currentFindColIndex = message.data.colIndex
      this.sendRowReqOnFindStartAndStop(message.data.SEQ_IDX)
      //set message
      this.currentFoundCount = message.data.startCount
      document.getElementById("logFindResult").innerHTML = this.currentFoundCount + " of " + this.totalFound
    }
  }
  sendRowReqOnFindStartAndStop(rowIndex) {
    this.hasScrollInQ = false;
    this.isWaitingScrollRows = true;
    let scrollContainer = document.getElementById("outerContainer")
    let rect = scrollContainer.getBoundingClientRect();


    let msg = {
      command: "GET_ROWS_ON_SCROLL",
      data: {
        rowsCount: parseInt(rect.height / this.rowHeight),
        rowIndex: rowIndex,
        scrollDir: this.currentPageRowStartIndex >= rowIndex ? "UP" : "DOWN"
      }
    };
    vscode.postMessage(msg);
    if (this.totalFound > 0) {
      document.documentElement.scrollTop = rowIndex * this.rowHeight

    }
  }
  updateFindSummary(message) {
    this.totalFound = message.data.totalFindCount
    if (this.totalFound == 0) {
      document.getElementById("logFindResult").innerHTML = "No results"
    } else {
      if (this.isFindOn) {
        document.getElementById("logFindResult").innerHTML = this.currentFoundCount + " of " + this.totalFound

      }

    }

  }
  resetFilter() {

    let allItems = document.querySelectorAll('#SEL_PRIORITY option, #SEL_SYSLOG_IDENTIFIER option,#SEL_SYSLOG_PID option,#SEL_MESSAGE option ');//"option"
    allItems.forEach(element => {
      element.removeAttribute("selected")
    });


    this.filterDDObj["SEL_PRIORITY"].update()
    this.filterDDObj["SEL_SYSLOG_IDENTIFIER"].update()
    this.filterDDObj["SEL_SYSLOG_PID"].update()
    this.filterDDObj["SEL_MESSAGE"].update();


  }
  clearAllFilter() {

    let allItems = document.querySelectorAll('#SEL_SYSLOG_IDENTIFIER,#SEL_SYSLOG_PID,#SEL_MESSAGE');//"option"
    allItems.forEach(element => {
      element.innerHTML = ""
    });


  }
  showHideNoLogEntry(isShow, status) {
    let liveLoaderElement = document.getElementById("liveLoaderElement")
    let noLogEntryFound = document.getElementById("noLogEntryFound")
    noLogEntryFound.style.top = liveLoaderElement.style.top;
    noLogEntryFound.style.display = isShow ? "block" : "none"
    if (status == 1) {
      // filtering
      noLogEntryFound.innerHTML = "Filtering..."
    } else if (status == 2) {
      noLogEntryFound.innerHTML = "No log entries found."
      document.documentElement.scrollTop = 1;
    }
    else {
      noLogEntryFound.innerHTML = ""
    }
  }
  updateDD(ddKeys, fieldId) {
    let newOptions = {}
    Object.keys(ddKeys).forEach((k) => {
      let isSelected = false;

      this.filterDDObj[fieldId].selectedOptions.forEach(option => {
        if (k == option["data"]["value"]) {
          isSelected = true;
          return;
        }

      });
      newOptions[k] = isSelected

    });

    let isDDOpened = document.getElementById(fieldId).nextElementSibling.classList.contains("open")
    if (!isDDOpened) {
      let optionHTML = ""
      Object.keys(newOptions).forEach((k) => {
        optionHTML = optionHTML + `<option value ="${k}" ${newOptions[k] ? "selected ='true'" : ""}  >${k}</option>`
      });
      document.getElementById(fieldId).innerHTML = optionHTML

      this.filterDDObj[fieldId].update()
    } else {
      // post it for update after close
      this.filterDDObjOptionToUpdate[fieldId] = newOptions

    }

  }
  reCreateDDWithState(ddKeys, fieldId) {
    let optionHTML = ""
    Object.keys(ddKeys).forEach((k) => {
      optionHTML = optionHTML + `<option value ="${k}" ${ddKeys[k].isSelected == true ? "selected ='true'" : ""}>${ddKeys[k].text}</option>`
    });
    document.getElementById(fieldId).innerHTML = optionHTML

    this.filterDDObj[fieldId].update()

  }
  sendFilterReq() {
    setTimeout(() => {
      let filterObj = {}
      filterObj["SEL_SYSLOG_IDENTIFIER"] = this.getFilterDDValues("SEL_SYSLOG_IDENTIFIER")
      filterObj["SEL_PRIORITY"] = this.getFilterDDValues("SEL_PRIORITY")
      filterObj["SEL_SYSLOG_PID"] = this.getFilterDDValues("SEL_SYSLOG_PID")
      filterObj["SEL_MESSAGE"] = this.getFilterDDValues("SEL_MESSAGE") ////ToDo

      this.showHideNoLogEntry(true, 1);


      let msg = {
        command: "FILTER_LOG",
        data: {
          filter: filterObj,
          msgCondition: filterObj["SEL_MESSAGE"].length > 1 ? document.getElementById("key_condition").value : ""
        }
      };
      vscode.postMessage(msg);
    }, 100);



  }
  getFilterDDValues(fieldId) {
    let selectedValues = []
    this.filterDDObj[fieldId].selectedOptions.forEach(option => {
      selectedValues.push(option["data"]["value"])
    });
    return selectedValues;
  }

  stopUI() {
    this.receiveTillBlinker();
    let liveLoaderElement = document.getElementById("liveLoaderElement")
    let processStopedLine = document.getElementById("processStopedLine");
    document.getElementById("liveLoaderElementText").innerHTML = "";
    document.getElementById("liveLoaderElementText").style.display = "none";
    processStopedLine.style.top = liveLoaderElement.style.top + this.bufferSpace; //(message.data.stackSize * this.rowHeight )+15+"px"
    liveLoaderElement.style.display = "none"
    processStopedLine.style.display = "block"
    this.isProcessStoped = true;


  }
  getInitialBulk() {
    let scrollContainer = document.getElementById("outerContainer")
    let rect = scrollContainer.getBoundingClientRect();
    let msg = {
      command: "GET_INITIAL_BULK",
      data: {
        rows: parseInt(rect.height / this.rowHeight) + 2
      }
    };
    vscode.postMessage(msg);

  }
  receiveTillBlinker() {
    let liveLoaderElement = document.getElementById("liveLoaderElement")

    if (document.documentElement.scrollTop != parseInt(liveLoaderElement.style.top)) {
      document.documentElement.scrollTop = parseInt(liveLoaderElement.style.top)
    }
  }

  initInterSectionObservers() {
    let scrollContainer = document.getElementById("scrollContainer")
    let options = { "root": scrollContainer }

    this.logRowObserver = new IntersectionObserver((entries) => {
      entries.forEach(logRow => {
        if (logRow.intersectionRatio == 0) {
          logRow.target.setAttribute("data-isexpired", "true")
        } else {
          logRow.target.removeAttribute("data-isexpired")
        }

      });

    }, options);

    this.liveLoadObserver = new IntersectionObserver((entries) => {
      if (entries[0].intersectionRatio != 0) {
        this.isliveLoaderActive = true;
      } else {
        this.isliveLoaderActive = false;
      }
    });
    this.liveLoadObserver.observe(document.getElementById("liveLoaderElement"));


  }
  getNextRows(isNext) {
    let gateElement = null;
    let refElement = null
    if (isNext) {
      gateElement = document.getElementById("bottomRow")
      refElement = gateElement.previousElementSibling
    } else {
      gateElement = document.getElementById("topRow")
      refElement = gateElement.nextElementSibling
    }
    let msg = {
      command: "GET_NEXT_ROWS",
      data: {
        rowCount: this.pageSize,
        isNext: isNext,
        SEQ_IDX: parseInt(refElement.getAttribute("SEQ_IDX"))
      }
    };

    vscode.postMessage(msg);
  }

  SetTableFormat() {
    if (this.isSingleRow) {
      // show single row
      let els = document.querySelectorAll("th[colType='single']")
      els[0].classList.remove("hiddenCol");
      //hide all other Column
      els = document.querySelectorAll("th[colType='tabular']")
      for (let i = 0; i < els.length; i++) {
        els[i].classList.add("hiddenCol");
      }
      document.getElementById("scrollTable").querySelector("thead").style.display = "none"

    } else {
      // hide  single column
      let els = document.querySelectorAll("th[colType='single']")
      els[0].classList.add("hiddenCol");
      //show all other Column
      els = document.querySelectorAll("th[colType='tabular']")
      for (let i = 0; i < els.length; i++) {
        els[i].classList.remove("hiddenCol");
      }
      document.getElementById("scrollTable").querySelector("thead").style.display = null

    }
  }

}




function init() {
  logScroller = new LogScroller();
  logScroller.init();
}


init();
document.addEventListener('contextmenu', event => event.preventDefault());
