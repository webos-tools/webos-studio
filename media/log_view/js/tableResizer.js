
/*
 * Copyright (c) 2021-2022 LG Electronics Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
var colWidth = null;
var isTableInitilizing = false;
function resizableGrid(e) {
    setInitColWidth();
    var t = e.getElementsByTagName("tr")[0]
        , n = t ? t.children : void 0;
    if (n) {
        for (var i = e.offsetHeight, o = 0; o < n.length; o++) {
            var r = s(i);
            n[o].appendChild(r),
                n[o].style.position = "sticky",
                d(r)

            restoreColWidh(n[o]);
        }
    }
    function d(e) {
        var t, n, i, o, r;
        e.addEventListener("mousedown", function (e) {
            n = e.target.parentElement,
                i = n.nextElementSibling,
                t = e.pageX;
            var d = function (e) {
                if ("border-box" == l(e, "box-sizing"))
                    return 0;
                var t = l(e, "padding-left")
                    , n = l(e, "padding-right");
                return parseInt(t) + parseInt(n)
            }(n);
            o = n.offsetWidth - d,
                i && (r = i.offsetWidth - d)
        }),
            e.addEventListener("mouseover", function (e) {
                e.target.style.borderRight = "2px solid cornflowerblue"
            }),
            e.addEventListener("mouseout", function (e) {
                e.target.style.borderRight = ""
            }),
            document.addEventListener("mousemove", function (e) {
                if (n) {

                    var d = e.pageX - t;
                    // set min resize width
                    if ((i && r - d < 10) || (n && o + d < 10)) return

                    i && (i.style.width = r - d + "px") && (i.style.maxWidth = r - d + "px"),
                        n.style.width = o + d + "px",
                        n.style.maxWidth = o + d + "px"

                    setColWidth(n, i)

                }
            }),
            document.addEventListener("mouseup", function () {
                n = void 0,
                    i = void 0,
                    t = void 0,
                    r = void 0,
                    o = void 0
            })
    }
    function s(e) {
        var t = document.createElement("div");
        return t.style.top = 0,
            t.style.right = 0,
            t.style.width = "5px",
            t.style.position = "absolute",
            t.style.cursor = "col-resize",
            t.style.userSelect = "none",
            t.style.height = e + "px",
            t
    }
    function l(e, t) {
        return window.getComputedStyle(e, null).getPropertyValue(t)
    }
    function setColWidth(lc, rc) {

        let colValue = lc.getAttribute("data-colh");
        let allColTD = document.querySelectorAll(`td[data-col='${colValue}']`)

        allColTD.forEach(element => {
            element.style.width = lc.style.width;
            element.style.maxWidth = lc.style.width
            colWidth[colValue] = lc.style.width;

        });


        if (rc) {

            colValue = rc.getAttribute("data-colh");
            allColTD = document.querySelectorAll(`td[data-col='${colValue}']`)
            allColTD.forEach(element => {
                element.style.width = rc.style.width;
                element.style.maxWidth = rc.style.width
                colWidth[colValue] = rc.style.width;
            });
        }
    }

    function restoreColWidh(n) {

        let colValue = n.getAttribute("data-colh");
        if (colWidth[colValue]) {
            n.style.width = colWidth[colValue];
            n.style.maxWidth = colWidth[colValue];
            let allColTD = document.querySelectorAll(`td[data-col='${colValue}']`)
            allColTD.forEach(element => {
                element.style.width = n.style.width;
                element.style.maxWidth = n.style.width
                colWidth[colValue] = n.style.width;
            });
        }


    }
    function setInitColWidth() {
        if (colWidth == null) {
            colWidth = {};
            let outerContainer = document.getElementById("outerContainer")
            let rect = outerContainer.getBoundingClientRect();
            colWidth["col0"] = rect.width + "px"
            colWidth["col1"] = (rect.width * .15) + "px"
            colWidth["col2"] = (rect.width * .08) + "px"
            colWidth["col3"] = (rect.width * .15) + "px"
            colWidth["col4"] = (rect.width * .07) + "px"
            colWidth["col5"] = (rect.width * .55) + "px"




        }

    }
}

function initTableResizer() {
    isTableInitilizing = true;
    const allCutomElements = document.querySelectorAll("th > div")
    // remove the inner div created earlier for resizing
    allCutomElements.forEach(element => {
        if (element.getAttribute("class") != "filter") {
            element.remove()
        }

    }
    )
    resizableGrid(document.getElementById("scrollTable"));
    isTableInitilizing = false;
}
function resizeColOnWindowResize() {
    if (window.innerHeight < 10) return
    let tWidth = parseInt(colWidth["col1"]) + parseInt(colWidth["col2"]) + parseInt(colWidth["col3"]) + parseInt(colWidth["col4"]) + parseInt(colWidth["col5"])
    let outerContainer = document.getElementById("outerContainer")
    let rect = outerContainer.getBoundingClientRect();
    colWidth["col0"] = rect.width + "px"
    colWidth["col1"] = (rect.width * (parseInt(colWidth["col1"]) / tWidth)) + "px"
    colWidth["col2"] = (rect.width * (parseInt(colWidth["col2"]) / tWidth)) + "px"
    colWidth["col3"] = (rect.width * (parseInt(colWidth["col3"]) / tWidth)) + "px"
    colWidth["col4"] = (rect.width * (parseInt(colWidth["col4"]) / tWidth)) + "px"
    colWidth["col5"] = (rect.width * (parseInt(colWidth["col5"]) / tWidth)) + "px"

    this.initTableResizer();
}
