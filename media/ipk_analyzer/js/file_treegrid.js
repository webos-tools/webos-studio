
/*
 * Copyright (c) 2021-2022 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

class FileTreeGrid {
  constructor(gridId, doAllowRowFocus, doStartRowFocus, otherGridId, isLeftGrid) {
    this.treegridElem = document.getElementById(gridId);
    this.doAllowRowFocus = doAllowRowFocus;
    this.doStartRowFocus = doStartRowFocus;
    this.otherGridElem = document.getElementById(otherGridId);
    this.isLeftGrid = isLeftGrid;
    this.otherGridObj = null;
    this.initAttributes();
    this.treegridElem.onkeydown = this.onKeyDown.bind(this);
    this.treegridElem.onclick = this.onClick.bind(this);
    this.treegridElem.ondblclick = this.onDoubleClick.bind(this);
    this.treegridElem.oncontextmenu = this.onRightClick.bind(this)
  }
  setOtherGridObj(otherGridObj) {
    this.otherGridObj = otherGridObj
  }

  initAttributes() {

    this.setTabIndexOfFocusableElements(this.treegridElem, -1);

    var rows = this.getAllRows();
    var index = rows.length;
    var startRowIndex = this.doStartRowFocus ? 0 : -1;

    while (index--) {
      if (this.doAllowRowFocus) {
        rows[index].tabIndex = index === startRowIndex ? 0 : -1;
      }

    }

    if (this.doStartRowFocus) {
      return;
    }
  }


  getAllRows() {
    var nodeList = this.treegridElem.querySelectorAll('tbody > tr');
    return Array.prototype.slice.call(nodeList);
  }

  getFocusableElements(root) {

    var nodeList = root.querySelectorAll('a,button,input,td>[tabindex]');
    return Array.prototype.slice.call(nodeList);
  }

  setTabIndexOfFocusableElements(root, tabIndex) {
    var focusableElements = this.getFocusableElements(root);
    var index = focusableElements.length;
    while (index--) {
      focusableElements[index].tabIndex = tabIndex;
    }
  }

  getAllNavigableRows() {
    var nodeList = this.treegridElem.querySelectorAll(
      'tbody > tr:not([class~="hidden"])'
    );

    return Array.prototype.slice.call(nodeList);
  }


  focus(elem) {
    if (!elem) return;
    elem.tabIndex = 0; // Ensure focusable
    elem.focus();
    let selectedRows = this.treegridElem.getElementsByClassName("focusedRow");
    for (let i = 0; i < selectedRows.length; i++) {
      selectedRows[i].classList.remove("focusedRow");
    }
    elem.classList.add("focusedRow");
    this.focusRowOnOtherGrid(elem)

  }
  focusRowOnOtherGrid(elem) {

    let selectedRows = this.otherGridElem.getElementsByClassName("focusedRow");
    for (let i = 0; i < selectedRows.length; i++) {
      selectedRows[i].classList.remove("focusedRow");
    }

    let otherGridElemRow = this.otherGridElem.querySelector(`[key="${elem.getAttribute("key")}"]`)
    if (otherGridElemRow) {
      otherGridElemRow.classList.add("focusedRow");
      otherGridElemRow.focus()
      elem.focus();
    }


  }
  expandParentRows(currentRow) {
    var rows = this.getAllRows();
    var rowIndex = currentRow ? rows.indexOf(currentRow) : -1;
    var index = rowIndex - 1;
    if (index >= 0) {
      if (!this.isExpanded(rows[index])) {
        this.changeExpanded(true, rows[index]);
        this.expandParentRows(rows[index])
      }
    }


  }


  getRowWithFocus() {
    return this.getContainingRow(document.activeElement);
  }

  getContainingRow(start) {
    var possibleRow = start;
    if (this.treegridElem.contains(possibleRow)) {
      while (possibleRow !== this.treegridElem) {
        if (possibleRow.localName === 'tr') {
          return possibleRow;
        }
        possibleRow = possibleRow.parentElement;
      }
    }
  }
  getLevel(row) {
    return row && parseInt(row.getAttribute('aria-level'));
  }

  moveByRow(direction) {
    var currentRow = this.getRowWithFocus();
    var rows = this.getAllNavigableRows();
    var rowIndex = currentRow ? rows.indexOf(currentRow) : -1;

    var index = direction === 1 ? rowIndex + 1 : rowIndex - 1;
    this.focus(rows[index]);
  }

  doPrimaryAction(event) {
    var currentRow = this.getRowWithFocus();
    if (!currentRow) {
      return;
    }

    if (!this.isExpandable(currentRow)) {
      this.focus(currentRow)
      this.onDoubleClick(event)
      return;
    }

    this.changeExpanded(!this.isExpanded(currentRow), currentRow);
    this.otherGridObj.doPrimaryAction_otherObj(currentRow)
  }
  doPrimaryAction_otherObj(srcRow) {
    let tarRow = this.treegridElem.querySelector(`[key="${srcRow.getAttribute("key")}"]`)
    if (tarRow) {
      this.changeExpanded(!this.isExpanded(tarRow), tarRow);

    }

  }


  changeExpanded(doExpand, row) {
    var currentRow = row || this.getRowWithFocus();
    if (!currentRow) {
      return;
    }
    var currentLevel = this.getLevel(currentRow);
    var rows = this.getAllRows();
    var currentRowIndex = rows.indexOf(currentRow);
    var didChange;
    var doExpandLevel = [];
    doExpandLevel[currentLevel + 1] = doExpand;

    while (++currentRowIndex < rows.length) {
      var nextRow = rows[currentRowIndex];
      var rowLevel = this.getLevel(nextRow);
      if (rowLevel <= currentLevel) {
        break;
      }

      doExpandLevel[rowLevel + 1] =
        doExpandLevel[rowLevel] && this.isExpanded(nextRow);
      var willHideRow = !doExpandLevel[rowLevel];
      var isRowHidden = nextRow.classList.contains('hidden');

      if (willHideRow !== isRowHidden) {
        if (willHideRow) {
          nextRow.classList.add('hidden');
        } else {
          nextRow.classList.remove('hidden');
        }
        didChange = true;
      }
    }
    if (didChange) {
      this.setAriaExpanded(currentRow, doExpand);
      return true;
    }
  }

  getAriaExpandedElem(row) {
    return row;
  }

  setAriaExpanded(row, doExpand) {
    var elem = this.getAriaExpandedElem(row);
    elem.setAttribute('aria-expanded', doExpand);
  }

  isExpandable(row) {
    var elem = this.getAriaExpandedElem(row);
    return elem.hasAttribute('aria-expanded');
  }

  isExpanded(row) {
    var elem = this.getAriaExpandedElem(row);
    return elem.getAttribute('aria-expanded') === 'true';
  }

  onKeyDown(event) {

    var ENTER = 13;
    var UP = 38;
    var DOWN = 40;

    var numModifiersPressed =
      event.ctrlKey + event.altKey + event.shiftKey + event.metaKey;

    var key = event.keyCode;

    if (numModifiersPressed === 1 && event.ctrlKey) {
      key = -key;
    } else if (numModifiersPressed) {
      return;
    }

    switch (key) {
      case DOWN:
        this.moveByRow(1);
        break;
      case UP:
        this.moveByRow(-1);
        break;
      case ENTER:
        this.doPrimaryAction(event);
        break;
      default:
        return;
    }

    event.preventDefault();

  }



  onClick(event) {
   

    var row = this.getContainingRow(event.target);

    this.focus(row)
    this.changeExpanded(!this.isExpanded(row), row);
    this.otherGridObj.doClick_otherObj(row)
  }
  doClick_otherObj(srcRow) {
    let tarRow = this.treegridElem.querySelector(`[key="${srcRow.getAttribute("key")}"]`)
    if (tarRow) {
      this.changeExpanded(!this.isExpanded(tarRow), tarRow);

    }

  }
  onRightClick(event) {
  

    var row = this.getContainingRow(event.target);
    this.focus(row)
    if (row) {
      if (row.getAttribute("isfolder") == "false") {
        event.preventDefault()
        let menuCompare = document.getElementById("menu_compareFile")
        let menuView = document.getElementById("menu_viewFile")
        let menu = document.getElementById("ctxmenu")
        let otherSelectedRows = this.otherGridElem.getElementsByClassName("focusedRow");
        if (row.getAttribute("row_status") == "1" || otherSelectedRows.length > 0) {

          menuCompare.setAttribute("class", "ctxmenu_item_active")
          menuCompare.onclick = () => {
            menu.style = "display:none"
            this.menuClickHanlder(row, false)
          }
        } else {
          menuCompare.setAttribute("class", "ctxmenu_item")
          menuCompare.onclick = () => {
            menu.style = "display:none"
          }
        }
        menuView.onclick = () => {
          menu.style = "display:none"
          this.menuClickHanlder(row, true)
        }

        menu.style = `display:block;top:${event.pageY - 10}px;left:${event.pageX - 10}px`
        menu.onmouseleave = () => menu.style = "display:none"

      }


    }


  }
  menuClickHanlder(row, isFileView) {
    if (row) {
      let leftRow = null
      let rightRow = null;
      let selectedRows = this.treegridElem.getElementsByClassName("focusedRow");
      if (selectedRows.length > 0) {
        leftRow = selectedRows[0]
      }
      selectedRows = this.otherGridElem.getElementsByClassName("focusedRow");
      if (selectedRows.length > 0) {
        rightRow = selectedRows[0]
      }
      if (!isFileView) {

        if (leftRow && rightRow) {
          // open comapre
          // if clicked row on right then swap
          if (!this.isLeftGrid) {
            let temp = leftRow;
            leftRow = rightRow;
            rightRow = temp;
          }

          let msg = {
            command: "COMPARE_FILES",
            data: {
              leftPath: leftRow.getAttribute("path"),
              rightPath: rightRow.getAttribute("path"),
              openToSide: false,
              preview: false
            }
          };
          vscode.postMessage(msg);
        }
      }
      else {
        let row = leftRow ? leftRow : rightRow
        let msg = {
          command: "OPEN_FILE",
          data: {
            uri: row.getAttribute("path"),
            openToSide: false,
            preview: false
          }
        };
        vscode.postMessage(msg);

      }


    }

  }


  onDoubleClick(event) {
    var row = this.getContainingRow(event.target);
    if (row) {
      if (row.getAttribute("isFolder") == "false") {
        let leftRow = null
        let rightRow = null;
        let selectedRows = this.treegridElem.getElementsByClassName("focusedRow");
        if (selectedRows.length > 0) {
          leftRow = selectedRows[0]
        }
        selectedRows = this.otherGridElem.getElementsByClassName("focusedRow");
        if (selectedRows.length > 0) {
          rightRow = selectedRows[0]
        }
        if (leftRow && rightRow) {
          // open comapre
          // if clicked row on right then swap
          if (!this.isLeftGrid) {
            let temp = leftRow;
            leftRow = rightRow;
            rightRow = temp;
          }

          let msg = {
            command: "COMPARE_FILES",
            data: {
              leftPath: leftRow.getAttribute("path"),
              rightPath: rightRow.getAttribute("path"),
              openToSide: false,
              preview: false
            }
          };
          vscode.postMessage(msg);
        } else {
          let row = leftRow ? leftRow : rightRow
          let msg = {
            command: "OPEN_FILE",
            data: {
              uri: row.getAttribute("path"),
              openToSide: false,
              preview: false
            }
          };
          vscode.postMessage(msg);


        }


      }
      event.preventDefault();
    }
  }


}


function initGrid(lGridId, rGridId,) {
  var doAllowRowFocus = true;
  var doStartRowFocus = false;

  let lGird = new FileTreeGrid(
    lGridId,
    doAllowRowFocus,
    doStartRowFocus,
    rGridId,
    true
  );
  let rGird = new FileTreeGrid(
    rGridId,
    doAllowRowFocus,
    doStartRowFocus,
    lGridId,
    false
  );
  lGird.setOtherGridObj(rGird);
  rGird.setOtherGridObj(lGird);

}
