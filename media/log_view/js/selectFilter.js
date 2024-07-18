/*
 * Copyright (c) 2021-2024 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
function triggerClick(el) {
  var event = document.createEvent("MouseEvents");
  event.initEvent("click", true, false);
  el.dispatchEvent(event);
}

function triggerChange(el) {
  var event = document.createEvent("HTMLEvents");
  event.initEvent("change", true, false);
  el.dispatchEvent(event);
}

function triggerFocusIn(el) {
  var event = document.createEvent("FocusEvent");
  event.initEvent("focusin", true, false);
  el.dispatchEvent(event);
}

function triggerFocusOut(el) {
  var event = document.createEvent("FocusEvent");
  event.initEvent("focusout", true, false);
  el.dispatchEvent(event);
}

function triggerModalOpen(el) {
  var event = document.createEvent("UIEvent");
  event.initEvent("modalopen", true, false);
  el.dispatchEvent(event);
}

function triggerModalClose(el) {
  var search = document.querySelectorAll(".nice-select-search");
  if (search) {
    search.forEach(element => {
      element.value = ""
    });
  }
  var event = document.createEvent("UIEvent");
  event.initEvent("modalclose", true, false);
  el.dispatchEvent(event);
}

function triggerValidationMessage(el, type) {
  if (type == 'invalid') {
    addClass(this.dropdown, 'invalid');
    removeClass(this.dropdown, 'valid');
  } else {
    addClass(this.dropdown, 'valid');
    removeClass(this.dropdown, 'invalid');
  }
}

function attr(el, key) {

  if (el[key] != undefined) {
    return el[key];
  }
  return el.getAttribute(key);
}

function data(el, key) {
  return el.getAttribute("data-" + key);
}

function hasClass(el, className) {
  if (el) {
    return el.classList.contains(className);
  } else {
    return false;
  }
}

function addClass(el, className) {
  if (el) return el.classList.add(className);
}

function removeClass(el, className) {
  if (el) return el.classList.remove(className);
}

var defaultOptions = {
  data: null,
  searchable: false,
  showSelectedItems: false,
  selectType: "select"
};

function NiceSelect(element, options) {
  this.el = element;
  this.config = Object.assign({}, defaultOptions, options || {});
  this.data = this.config.data;
  this.selectedOptions = [];

  this.placeholder = attr(this.el, "placeholder") || this.config.placeholder || "Select an option";
  this.searchtext = attr(this.el, "searchtext") || this.config.searchtext || "Search";
  this.selectedtext = attr(this.el, "selectedtext") || this.config.selectedtext || "selected";

  this.dropdown = null;
  this.multiple = attr(this.el, "multiple");
  this.disabled = attr(this.el, "disabled");

  this.create();
}

NiceSelect.prototype.create = function () {
  this.el.style.opacity = "0";
  this.el.style.width = "0";
  this.el.style.padding = "0";
  this.el.style.height = "0";
  if (this.data) {
    this.processData(this.data);
  } else {
    this.extractData();
  }

  this.renderDropdown();
  this.bindEvent();
};

NiceSelect.prototype.processData = function (data) {
  var options = [];
  data.forEach(item => {
    options.push({
      data: item,
      attributes: {
        selected: !!item.selected,
        disabled: !!item.disabled,
        optgroup: item.value == 'optgroup'
      }
    });
  });
  this.options = options;
};

NiceSelect.prototype.extractData = function () {
  var options = this.el.querySelectorAll("option,optgroup");
  var data = [];
  var allOptions = [];
  var selectedOptions = [];

  options.forEach(item => {
    if (item.tagName == 'OPTGROUP') {
      var itemData = {
        text: item.label,
        value: 'optgroup'
      };
    } else {
      let text = item.innerText;
      if (item.dataset.display != undefined) {
        text = item.dataset.display;
      }

      var itemData = {
        text: text,
        value: item.value,
        selected: item.getAttribute("selected") != null,
        disabled: item.getAttribute("disabled") != null
      };
    }

    var attributes = {
      selected: item.getAttribute("selected") != null,
      disabled: item.getAttribute("disabled") != null,
      optgroup: item.tagName == 'OPTGROUP'
    };

    data.push(itemData);
    allOptions.push({ data: itemData, attributes: attributes });
  });

  this.data = data;
  this.options = allOptions;
  this.options.forEach(item => {
    if (item.attributes.selected) {
      selectedOptions.push(item);
    }
  });

  this.selectedOptions = selectedOptions;
};

NiceSelect.prototype.renderDropdown = function () {
  var classes = [
    "nice-select",
    attr(this.el, "class") || "",
    this.disabled ? "disabled" : "",
    this.multiple ? "has-multiple" : ""
  ];

  let searchHtml = ``;

  if (this.config.selectType == "text_search") {
    searchHtml = `<div class="nice-select-search-box" style="width:270px; display:flex">`;
    searchHtml += `<input type="text" class="nice-select-search" style="width:250px"  placeholder="${this.searchtext}..." title="search"/>`;
    searchHtml += `<div  class="nice-select-search-box-add" title="Add Keyword"> <i class="codicon codicon-add"></i></div>`
  } else {
    searchHtml = `<div class="nice-select-search-box">`;
    searchHtml += `<input type="text" class="nice-select-search"  placeholder="${this.searchtext}..." title="search"/>`;

  }
  searchHtml += `</div>`;
  let toobarHtml = "";
  if (this.config.selectType == "text_search") {
    if (!this.textSearchCond) {
      this.textSearchCond = "OR"
    }

    toobarHtml = `<div class="nice-select-toolbar"><div class ="select-all" title="Select All">✔ Select All</div><div class ="deselect-all" title="Clear All"><i class="codicon codicon-remove-close"></i><span style="vertical-align:top">Clear All</span></div><div class ="delete-all" title="Delete Keywords"> <i class="codicon codicon-trash"></i><span style="vertical-align:top">Delete Keywords</span></div> </div>
    
    <input value="${this.textSearchCond}" id ="key_condition" type ="text" style ="display:none"></input>
    <div  id ="keyword_condition" class ="keyword_condition" title="Keyword condition">

    <input type="radio" name="k_condition"  class ="k_condition" id="k_or" value="OR" ${this.textSearchCond == "OR" ? "checked" : ""}/>
    <label  id ="k_orlabel" for="k_or">OR</label>
    <input type="radio" name="k_condition"  class ="k_condition" id="k_and" value="AND" ${this.textSearchCond == "AND" ? "checked" : ""}/>
    <label  id ="k_orlabel" for="k_and">AND</label>

    </div>`
  } else {
    toobarHtml = `<div class="nice-select-toolbar"><div class ="select-all" title="Select All">✔ Select All</div><div class ="deselect-all" title="Clear All"><i class="codicon codicon-remove-close"></i><span style="vertical-align:top">Clear All</span></div></div>`

  }

  var html = `<div class="${classes.join(" ")}" tabindex="${this.disabled ? null : 0}">`;
  html += `<span class="${this.multiple ? "multiple-options" : "current"}"></span>`;
  html += `<div class="nice-select-dropdown">`;
  html += toobarHtml;
  html += `${this.config.searchable ? searchHtml : ""}`;
  html += `<div class="list-container"><ul class="list"></ul></div>`;
  html += `</div>`;
  html += `</div>`;

  this.el.insertAdjacentHTML("afterend", html);

  this.dropdown = this.el.nextElementSibling;
  this._renderSelectedItems();
  this._renderItems();
};

NiceSelect.prototype._renderSelectedItems = function () {
  if (this.multiple) {
    var selectedHtml = "";
    if (this.config.showSelectedItems || this.config.showSelectedItems || window.getComputedStyle(this.dropdown).width == 'auto' || this.selectedOptions.length < 2) {
      this.selectedOptions.forEach(() => {
        selectedHtml = `<span class="filterBadge">${this.selectedOptions.length}</span>` + ' ' + this.selectedtext;

      });

      selectedHtml = selectedHtml == "" ? this.placeholder : selectedHtml;
    } else {
      selectedHtml = `<span class="filterBadge">${this.selectedOptions.length}</span>` + ' ' + this.selectedtext;
    }

    this.dropdown.querySelector(".multiple-options").innerHTML = selectedHtml;
  } else {
    var html = this.selectedOptions.length > 0 ? this.selectedOptions[0].data.text : this.placeholder;

    this.dropdown.querySelector(".current").innerHTML = html;
  }
};

NiceSelect.prototype._renderItems = function () {
  var ul = this.dropdown.querySelector("ul");
  this.options.forEach(item => {
    ul.appendChild(this._renderItem(item));
  });
};

NiceSelect.prototype._renderItem = function (option) {
  var el = document.createElement("li");

  el.innerHTML = option.data.text;

  if (option.attributes.optgroup) {
    addClass(el, 'optgroup');
  } else {
    el.setAttribute("data-value", option.data.value);
    var classList = [
      "option",
      option.attributes.selected ? "selected" : null,
      option.attributes.disabled ? "disabled" : null,
    ];

    el.addEventListener("click", this._onItemClicked.bind(this, option));
    el.classList.add(...classList);
  }

  option.element = el;
  return el;
};

NiceSelect.prototype.update = function () {
  this.extractData();
  if (this.dropdown) {
    var open = hasClass(this.dropdown, "open");
    this.dropdown.parentNode.removeChild(this.dropdown);
    this.create();

    if (open) {
      triggerClick(this.dropdown);
    }
  }

  if (attr(this.el, "disabled")) {
    this.disable();
  } else {
    this.enable();
  }
};

NiceSelect.prototype.disable = function () {
  if (!this.disabled) {
    this.disabled = true;
    addClass(this.dropdown, "disabled");
  }
};

NiceSelect.prototype.enable = function () {
  if (this.disabled) {
    this.disabled = false;
    removeClass(this.dropdown, "disabled");
  }
};

NiceSelect.prototype.clear = function () {
  this.resetSelectValue();
  this.selectedOptions = [];
  this._renderSelectedItems();
  this.update();

  triggerChange(this.el);
};

NiceSelect.prototype.destroy = function () {
  if (this.dropdown) {
    this.dropdown.parentNode.removeChild(this.dropdown);
    this.el.style.display = "";
  }
};

NiceSelect.prototype.bindEvent = function () {

  this.dropdown.addEventListener("click", this._onClicked.bind(this));
  this.dropdown.addEventListener("focusin", triggerFocusIn.bind(this, this.el));
  this.dropdown.addEventListener("focusout", triggerFocusOut.bind(this, this.el));
  this.el.addEventListener("invalid", triggerValidationMessage.bind(this, this.el, 'invalid'));
  document.body.onclick = this._onClickedOutside.bind(this);
  if (this.config.searchable) {
    this._bindSearchEvent();
  }
  this._bindToolbarEvent()
};

NiceSelect.prototype._bindToolbarEvent = function () {
  var selectAllTB = this.dropdown.querySelector(".select-all");
  if (selectAllTB) {
    selectAllTB.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault()

      let allItems = this.el.querySelectorAll("option");
      allItems.forEach(element => {
        element.setAttribute("selected", true)
      });
      this.update()
      triggerChange(this.el);

    };
  }

  var deselectAllTB = this.dropdown.querySelector(".deselect-all");
  if (deselectAllTB) {
    deselectAllTB.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault()
      let allItems = this.el.querySelectorAll("option");
      allItems.forEach(element => {
        element.removeAttribute("selected")
      });
      this.update()
      triggerChange(this.el);
    };
  }
  var deleteAllTB = this.dropdown.querySelector(".delete-all");
  if (deleteAllTB) {
    deleteAllTB.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault()
      this.el.innerHTML = "";
      this.update()
      triggerChange(this.el);
    };
  }



}
NiceSelect.prototype._bindSearchEvent = function () {
  var searchBox = this.dropdown.querySelector(".nice-select-search");
  if (searchBox) {
    searchBox.addEventListener("click", function (e) {
      e.stopPropagation();
      return false;
    });
  }

  searchBox.addEventListener("input", this._onSearchChanged.bind(this));
  searchBox.addEventListener("keyup", this._onSearchKeyUp.bind(this));
  var searchBoxAdd = this.dropdown.querySelector(".nice-select-search-box-add");
  if (searchBoxAdd) {
    searchBoxAdd.addEventListener("click", function () {
      searchBox.dispatchEvent(new KeyboardEvent('keyup', { 'key': 'Enter' }))
    });
  }
  var keyword_condition = this.dropdown.querySelector(".keyword_condition");
  if (keyword_condition) {

    keyword_condition.onclick = (e) => {
      let checkedValue = "OR"
      if (document.getElementById("k_and").checked) {
        checkedValue = "AND"
      }
      if (e.srcElement.id == "k_orlabel") {
        checkedValue = "OR"
      } else if (e.srcElement.id == "k_andlabel") {
        checkedValue = "AND"
      }
      this.textSearchCond = checkedValue;
      document.getElementById("keyword_condition").innerHTML = `
  <input type="radio" name="k_condition"  class ="k_condition" id="k_or" value="OR" ${checkedValue == "OR" ? "checked" : ""} />
  <label id ="k_orlabel" for="k_or">OR</label>
  <input type="radio" name="k_condition" class ="k_condition" id="k_and" value="AND" ${checkedValue == "AND" ? "checked" : ""} />
  <label  id ="k_andlabel" for="k_and">AND</label>
  `

      e.preventDefault();
      e.stopPropagation();
      document.getElementById("key_condition").value = checkedValue
      triggerChange(document.getElementById("SEL_MESSAGE"));



    };
  }
};

NiceSelect.prototype._onClicked = function (e) {
  e.preventDefault();
  e.stopPropagation();
  if (!hasClass(this.dropdown, "open")) {
    //## close all open // 
    document.querySelectorAll('.open').forEach(element => {
      removeClass(element, "open");
      triggerModalOpen(element.previousElementSibling);
    });
    addClass(this.dropdown, "open");
    triggerModalOpen(this.el);
  } else {
    if (this.multiple) {
      if (e.target == this.dropdown.querySelector('.multiple-options')) {
        removeClass(this.dropdown, "open");
        triggerModalClose(this.el);
      }

    } else {
      removeClass(this.dropdown, "open");
      triggerModalClose(this.el);
    }
  }

  if (hasClass(this.dropdown, "open")) {
   
    var t = this.dropdown.querySelector(".focus");
    removeClass(t, "focus");
    t = this.dropdown.querySelector(".selected");
    addClass(t, "focus");
    this.dropdown.querySelectorAll("ul li").forEach(function (item) {
      item.style.display = "";
    });
  } else {
    this.dropdown.focus();
  }
};

NiceSelect.prototype._onItemClicked = function (option, e) {
  var optionEl = e.target;
  e.preventDefault();
  e.stopPropagation();

  if (!hasClass(optionEl, "disabled")) {
    if (this.multiple) {
      if (hasClass(optionEl, "selected")) {
        removeClass(optionEl, "selected");
        /// remove from selected option
        this.selectedOptions.forEach((element, index) => {
          if (element.data.value == option.data.value) {
            this.selectedOptions.splice(index, 1)
            return;
          }
        });
        this.el.querySelector(`option[value="${optionEl.dataset.value}"]`).removeAttribute('selected');
      } else {
        addClass(optionEl, "selected");
        this.selectedOptions.push(option);
      }
    } else {
      this.options.forEach(function (item) {
        removeClass(item.element, "selected");
      });
      this.selectedOptions.forEach(function (item) {
        removeClass(item.element, "selected");
      });

      addClass(optionEl, "selected");
      this.selectedOptions = [option];
    }

    this._renderSelectedItems();
    this.updateSelectValue();
  }
};

NiceSelect.prototype.updateSelectValue = function () {
  if (this.multiple) {
    var select = this.el;
    this.selectedOptions.forEach(function (item) {
      var el = select.querySelector(`option[value="${item.data.value}"]`);
      if (el) {
        el.setAttribute("selected", true);
      }
    });
  } else if (this.selectedOptions.length > 0) {
    this.el.value = this.selectedOptions[0].data.value;
  }
  triggerChange(this.el);
};

NiceSelect.prototype.resetSelectValue = function () {
  if (this.multiple) {
    var select = this.el;
    this.selectedOptions.forEach(function (item) {
      var el = select.querySelector(`option[value="${item.data.value}"]`);
      if (el) {
        el.removeAttribute("selected");
      }
    });
  } else if (this.selectedOptions.length > 0) {
    this.el.selectedIndex = -1;
  }

  triggerChange(this.el);
};

NiceSelect.prototype._onClickedOutside = function () {
  //## newly added
  document.querySelectorAll('.open').forEach(element => {
    removeClass(element, "open");
    triggerModalClose(element.previousElementSibling);
  });
  if (logScroller) {
    let menu = document.getElementById("toolBarCtxMenu")
    if (menu.style.display == "block") {
      logScroller.hideToolBarMenu();
    }

  }

};

NiceSelect.prototype._onKeyPressed = function (e) {
  // Keyboard events

  var focusedOption = this.dropdown.querySelector(".focus");

  var open = hasClass(this.dropdown, "open");

  // Enter
  if (e.keyCode == 13) {
    if (open) {
      triggerClick(focusedOption);
    } else {
      triggerClick(this.dropdown);
    }
  } else if (e.keyCode == 40) {
    // Down
    if (!open) {
      triggerClick(this.dropdown);
    } else {
      var next = this._findNext(focusedOption);
      if (next) {
        var t = this.dropdown.querySelector(".focus");
        removeClass(t, "focus");
        addClass(next, "focus");
      }
    }
    e.preventDefault();
  } else if (e.keyCode == 38) {
    // Up
    if (!open) {
      triggerClick(this.dropdown);
    } else {
      var prev = this._findPrev(focusedOption);
      if (prev) {
        var t = this.dropdown.querySelector(".focus");
        removeClass(t, "focus");
        addClass(prev, "focus");
      }
    }
    e.preventDefault();
  } else if (e.keyCode == 27 && open) {
    // Esc
    triggerClick(this.dropdown);
  } else if (e.keyCode === 32 && open) {
    // Space
    return false;
  }
  return false;
};

NiceSelect.prototype._findNext = function (el) {
  if (el) {
    el = el.nextElementSibling;
  } else {
    el = this.dropdown.querySelector(".list .option");
  }

  while (el) {
    if (!hasClass(el, "disabled") && el.style.display != "none") {
      return el;
    }
    el = el.nextElementSibling;
  }

  return null;
};

NiceSelect.prototype._findPrev = function (el) {
  if (el) {
    el = el.previousElementSibling;
  } else {
    el = this.dropdown.querySelector(".list .option:last-child");
  }

  while (el) {
    if (!hasClass(el, "disabled") && el.style.display != "none") {
      return el;
    }
    el = el.previousElementSibling;
  }

  return null;
};

NiceSelect.prototype._onSearchChanged = function (e) {
  var open = hasClass(this.dropdown, "open");
  var text = e.target.value;
  text = text.toLowerCase();

  if (text == "") {
    this.options.forEach(function (item) {
      item.element.style.display = "";
    });
  } else if (open) {
    var matchReg = new RegExp(text);
    this.options.forEach(function (item) {
      var optionText = item.data.text.toLowerCase();
      var matched = matchReg.test(optionText);
      item.element.style.display = matched ? "" : "none";
    });
  }

  this.dropdown.querySelectorAll(".focus").forEach(function (item) {
    removeClass(item, "focus");
  });

  var firstEl = this._findNext(null);
  addClass(firstEl, "focus");
};


NiceSelect.prototype._onSearchKeyUp = function (e) {
  if (this.config.selectType == "text_search") {

    if (e.key === 'Enter' || e.keyCode === 13) {


      var open = hasClass(this.dropdown, "open");
      var text = e.target.value;
      text = text.toLowerCase();

      if (text.trim() == "") {
        this.options.forEach(function (item) {
          item.element.style.display = "";
        });
      } else if (open) {
        let existingItem = false
        let optionState = {}
        this.options.forEach(function (item) {

          optionState[item.data.text] = item.element.classList.contains("selected") ? true : false;
          if (item.data.text.toLowerCase() == text.toLowerCase()) {
            optionState[item.data.text] = true;
            existingItem = true;
          }
        });
        if (!existingItem) {
          // add to list  and select
          optionState[e.target.value] = true;

        }
        // update the option list
        let optionHTML = ""
        Object.keys(optionState).forEach((k) => {
          optionHTML = optionHTML + `<option value ="${k}" ${optionState[k] ? "selected ='true'" : ""}  >${k}</option>`
        });
        this.el.innerHTML = optionHTML
        this.update()
        let msg = {
          command: "MESSAGE_FILTER_UPDATED",
          data: {
            "optionState": optionState
          }
        };
        vscode.postMessage(msg);
        triggerChange(this.el);

      }

    }
  }
};

function initSelectFilter(el, options) {
  return new NiceSelect(el, options);
}
function bind(el, options) {
  return new NiceSelect(el, options);
}