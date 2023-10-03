
'use strict';
function TreeGrid(treegridElem, doAllowRowFocus, doStartRowFocus) {
  function initAttributes() {
   
    setTabIndexOfFocusableElements(treegridElem, -1);

    var rows = getAllRows();
    var index = rows.length;
    var startRowIndex = doStartRowFocus ? 0 : -1;

    while (index--) {
      if (doAllowRowFocus) {
        rows[index].tabIndex = index === startRowIndex ? 0 : -1;
      } else {
        setTabIndexForCellsInRow(rows[index], -1);
        moveAriaExpandedToFirstCell(rows[index]);
      }
    }

    if (doStartRowFocus) {
      return;
    }

    var firstCell = getNavigableCols(rows[0])[0];
    setTabIndexForCell(firstCell);
  }

  function setTabIndexForCell(cell, tabIndex) {
    var focusable = getFocusableElements(cell)[0] || cell;
    focusable.tabIndex = tabIndex;
  }

  function setTabIndexForCellsInRow(row, tabIndex) {
    var cells = getNavigableCols(row);
    var cellIndex = cells.length;
    while (cellIndex--) {
      setTabIndexForCell(cells[cellIndex], tabIndex);
    }
  }

  function getAllRows() {
    var nodeList = treegridElem.querySelectorAll('tbody > tr');
    return Array.prototype.slice.call(nodeList);
  }

  function getFocusableElements(root) {
 
    var nodeList = root.querySelectorAll('a,button,input,td>[tabindex]');
    return Array.prototype.slice.call(nodeList);
  }

  function setTabIndexOfFocusableElements(root, tabIndex) {
    var focusableElements = getFocusableElements(root);
    var index = focusableElements.length;
    while (index--) {
      focusableElements[index].tabIndex = tabIndex;
    }
  }

  function getAllNavigableRows() {
    var nodeList = treegridElem.querySelectorAll(
      'tbody > tr:not([class~="hidden"])'
    );
  
    return Array.prototype.slice.call(nodeList);
  }

  function getNavigableCols(currentRow) {
    var nodeList = currentRow.getElementsByTagName('td');
    return Array.prototype.slice.call(nodeList);
  }

  function restrictIndex(index, numItems) {
    if (index < 0) {
      return 0;
    }
    return index >= numItems ? index - 1 : index;
  }

  function focus(elem) {
    elem.tabIndex = 0; // Ensure focusable
    elem.focus();
  }

  function focusCell(cell) {
  
    var focusableChildren = getFocusableElements(cell);
    focus(focusableChildren[0] || cell);
  }


  function onFocusIn(event) {
    var newTreeGridFocus =
      event.target !== window &&
      treegridElem.contains(event.target) &&
      event.target;

    // The last row we considered focused
    var oldCurrentRow = enableTabbingInActiveRowDescendants.tabbingRow;
    if (oldCurrentRow) {
      enableTabbingInActiveRowDescendants(false, oldCurrentRow);
    }
    if (
      doAllowRowFocus &&
      onFocusIn.prevTreeGridFocus &&
      onFocusIn.prevTreeGridFocus.localName === 'td'
    ) {
      
      onFocusIn.prevTreeGridFocus.removeAttribute('tabindex');
    }

    if (newTreeGridFocus) {
     
      if (oldCurrentRow) {
       
        oldCurrentRow.tabIndex = -1;
      }

    
      var currentRow = getRowWithFocus();
      if (currentRow) {
        currentRow.tabIndex = 0;
      
        enableTabbingInActiveRowDescendants(true, currentRow);
      }
    }

    onFocusIn.prevTreeGridFocus = newTreeGridFocus;
  }

  function enableTabbingInActiveRowDescendants(isTabbingOn, row) {
    if (row) {
      setTabIndexOfFocusableElements(row, isTabbingOn ? 0 : -1);
      if (isTabbingOn) {
        enableTabbingInActiveRowDescendants.tabbingRow = row;
      } else {
        if (enableTabbingInActiveRowDescendants.tabbingRow === row) {
          enableTabbingInActiveRowDescendants.tabbingRow = null;
        }
      }
    }
  }

  function getRowWithFocus() {
    return getContainingRow(document.activeElement);
  }

  function getContainingRow(start) {
    var possibleRow = start;
    if (treegridElem.contains(possibleRow)) {
      while (possibleRow !== treegridElem) {
        if (possibleRow.localName === 'tr') {
          return possibleRow;
        }
        possibleRow = possibleRow.parentElement;
      }
    }
  }

  function isRowFocused() {
    return getRowWithFocus() === document.activeElement;
  }

  function isEditableFocused() {
    var focusedElem = document.activeElement;
    return focusedElem.localName === 'input';
  }

  function getColWithFocus(currentRow) {
    if (currentRow) {
      var possibleCol = document.activeElement;
      if (currentRow.contains(possibleCol)) {
        while (possibleCol !== currentRow) {
          if (possibleCol.localName === 'td') {
            return possibleCol;
          }
          possibleCol = possibleCol.parentElement;
        }
      }
    }
  }

  function getLevel(row) {
    return row && parseInt(row.getAttribute('aria-level'));
  }

  function moveByRow(direction, requireLevelChange) {
    var currentRow = getRowWithFocus();
    var requiredLevel =
      requireLevelChange && currentRow && getLevel(currentRow) + direction;
    var rows = getAllNavigableRows();
    var numRows = rows.length;
    var rowIndex = currentRow ? rows.indexOf(currentRow) : -1;
    
    var maxDistance = requireLevelChange && direction === 1 ? 1 : NaN;

    do {
      if (maxDistance-- === 0) {
        return; 
      }
      rowIndex = restrictIndex(rowIndex + direction, numRows);
    } while (requiredLevel && requiredLevel !== getLevel(rows[rowIndex]));

    if (!focusSameColInDifferentRow(currentRow, rows[rowIndex])) {
      focus(rows[rowIndex]);
    }
  }

  function focusSameColInDifferentRow(fromRow, toRow) {
    var currentCol = getColWithFocus(fromRow);
    if (!currentCol) {
      return;
    }

    var fromCols = getNavigableCols(fromRow);
    var currentColIndex = fromCols.indexOf(currentCol);

    if (currentColIndex < 0) {
      return;
    }

    var toCols = getNavigableCols(toRow);
 
    focusCell(toCols[currentColIndex]);
    return true;
  }

  function moveToExtreme(direction) {
    var currentRow = getRowWithFocus();
    if (!currentRow) {
      return;
    }
    var currentCol = getColWithFocus(currentRow);
    if (currentCol) {
      moveToExtremeCol(direction, currentRow);
    } else {
    
      moveToExtremeRow(direction);
    }
  }

  function moveByCol(direction) {
    var currentRow = getRowWithFocus();
    if (!currentRow) {
      return;
    }
    var cols = getNavigableCols(currentRow);
    var numCols = cols.length;
    var currentCol = getColWithFocus(currentRow);
    var currentColIndex = cols.indexOf(currentCol);
  
    var newColIndex =
      currentCol || direction < 0 ? currentColIndex + direction : 0;
   
    if (doAllowRowFocus && newColIndex < 0) {
      focus(currentRow);
      return;
    }
    newColIndex = restrictIndex(newColIndex, numCols);
    focusCell(cols[newColIndex]);
  }

  function moveToExtremeCol(direction, currentRow) {
   
    var cols = getNavigableCols(currentRow);
    var desiredColIndex = direction < 0 ? 0 : cols.length - 1;
    focusCell(cols[desiredColIndex]);
  }

  function moveToExtremeRow(direction) {
    var rows = getAllNavigableRows();
    var newRow = rows[direction > 0 ? rows.length - 1 : 0];
    if (!focusSameColInDifferentRow(getRowWithFocus(), newRow)) {
      focus(newRow);
    }
  }

  function doPrimaryAction(event) {
    var currentRow = getRowWithFocus();
    if (!currentRow) {
      return;
    }


    
    
    if (!isExpandable(currentRow)) {
      focus(currentRow)
      return;
    }

      changeExpanded(!isExpanded(currentRow), currentRow);
 

    return
  
  
  }

  function toggleExpanded(row) {
    var cols = getNavigableCols(row);
    var currentCol = getColWithFocus(row);
    if (currentCol === cols[0] && isExpandable(row)) {
      changeExpanded(!isExpanded(row), row);
    }
  }

  function changeExpanded(doExpand, row) {
    var currentRow = row || getRowWithFocus();
    if (!currentRow) {
      return;
    }
    var currentLevel = getLevel(currentRow);
    var rows = getAllRows();
    var currentRowIndex = rows.indexOf(currentRow);
    var didChange;
    var doExpandLevel = [];
    doExpandLevel[currentLevel + 1] = doExpand;

    while (++currentRowIndex < rows.length) {
      var nextRow = rows[currentRowIndex];
      var rowLevel = getLevel(nextRow);
      if (rowLevel <= currentLevel) {
        break;
      }
    
      doExpandLevel[rowLevel + 1] =
        doExpandLevel[rowLevel] && isExpanded(nextRow);
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
      setAriaExpanded(currentRow, doExpand);
      return true;
    }
  }
  function moveAriaExpandedToFirstCell(row) {
    var expandedValue = row.getAttribute('aria-expanded');
    var firstCell = getNavigableCols(row)[0];
    if (expandedValue) {
      firstCell.setAttribute('aria-expanded', expandedValue);
      row.removeAttribute('aria-expanded');
    }
  }

  function getAriaExpandedElem(row) {
    return doAllowRowFocus ? row : getNavigableCols(row)[0];
  }

  function setAriaExpanded(row, doExpand) {
    var elem = getAriaExpandedElem(row);
    elem.setAttribute('aria-expanded', doExpand);
  }

  function isExpandable(row) {
    var elem = getAriaExpandedElem(row);
    return elem.hasAttribute('aria-expanded');
  }

  function isExpanded(row) {
    var elem = getAriaExpandedElem(row);
    return elem.getAttribute('aria-expanded') === 'true';
  }

  function onKeyDown(event) {
    var ENTER = 13;
    var UP = 38;
    var DOWN = 40;
    var LEFT = 37;
    var RIGHT = 39;
    var HOME = 36;
    var END = 35;
    var CTRL_HOME = -HOME;
    var CTRL_END = -END;

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
        moveByRow(1);
        break;
      case UP:
        moveByRow(-1);
        break;
      case LEFT:
        moveByRow(-1);
        break;

        // if (isEditableFocused()) {
        //   return; 
        // }
        // if (isRowFocused()) {
        //   changeExpanded(false) || moveByRow(-1, true);
        // } else {
        //   moveByCol(-1);
        // }
        // break;
      case RIGHT:
        moveByRow(1);
        break;
        // if (isEditableFocused()) {
        //   return; 
        // }

    
        // if (!isRowFocused() || !changeExpanded(true)) {
        //   moveByCol(1);
        // }
        // break;
      case CTRL_HOME:
        moveToExtremeRow(-1);
        break;
      case HOME:
        if (isEditableFocused()) {
          return; 
        }
        moveToExtreme(-1);
        break;
      case CTRL_END:
        moveToExtremeRow(1);
        break;
      case END:
        if (isEditableFocused()) {
          return; 
        }
        moveToExtreme(1);
        break;
      case ENTER:
        doPrimaryAction(event);
        break;
      default:
        return;
    }

    event.preventDefault();
    
  }



  function onClick(event) {
    var target = event.target;
    if (target.localName !== 'td') {
      return;
    }

    
    var row = getContainingRow(event.target);
   
    
    if (!isExpandable(row)) {
      focus(row)
      return;
    }

    var range = document.createRange();
    range.selectNodeContents(target.firstChild);
    var left = range.getBoundingClientRect().left;
    var EXPANDO_WIDTH = 20;

    // if (event.clientX < left && event.clientX > left - EXPANDO_WIDTH) {
      changeExpanded(!isExpanded(row), row);
    // }
  
  }

  function onDoubleClick(event) {
    var row = getContainingRow(event.target);
    // setReleaseNote(row,treegridElem)
    if (row) {
      if (isExpandable(row)) {
        changeExpanded(!isExpanded(row), row);
      }
      event.preventDefault();
    }
  }

  initAttributes();
  treegridElem.addEventListener('keydown', onKeyDown);
  treegridElem.addEventListener('click', onClick);
  // treegridElem.addEventListener('dblclick', onDoubleClick);
 
  window.addEventListener(
    window.onfocusin ? 'focusin' : 'focus',
    onFocusIn,
    true
  );
}

function getQuery() {
  if (!getQuery.cached) {
    getQuery.cached = {};
    const queryStr = window.location.search.substring(1);
    const vars = queryStr.split('&');
    for (let i = 0; i < vars.length; i++) {
      const pair = vars[i].split('=');
    
      getQuery.cached[pair[0]] = pair[1] && decodeURIComponent(pair[1]);
    }
  }
  return getQuery.cached;
}

document.addEventListener('DOMContentLoaded', function () {

  var cellParam = getQuery().cell;
  var doAllowRowFocus = cellParam !== 'force';
  var doStartRowFocus = doAllowRowFocus && cellParam !== 'start';
  TreeGrid(
    document.getElementById('treegrid__all'),
    doAllowRowFocus,
    doStartRowFocus
  );
 
});
