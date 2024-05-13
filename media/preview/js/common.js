

class PeviewApp {
    constructor() {
        this.currentRes = "FTW" //FTW,FHD,HD,RATIO
        this.currentRatio = null
        this.isToolBarMenuVisible = false;
        this.init();
        this.currentScale = 1;
    }
    init() {
        window.addEventListener('message', event => {
            const message = event.data; // The JSON data our extension sent
            switch (message.command) {
                case 'reload': {
                    let iframeElement = document.getElementById("previewEle");
                    let url = iframeElement.getAttribute("src")
                    iframeElement.setAttribute("src", url + "?couter=" + Math.random());
                }
                    break;

            }
        });
        window.addEventListener('resize', (event) => {
            if (this.currentRes == "FTW") {
                this.setSize();
            }

        }, true);
        this.setSize();
        document.getElementById("prv_resTitle").onclick = (event) => {
            if (this.isToolBarMenuVisible) {
                this.hideToolBarMenu()
            } else {
                this.showToolBarMenu()
            }
            event.stopPropagation();
            event.preventDefault()
        }
        document.getElementById("prv_ddmenu").onclick = document.getElementById("prv_resTitle").onclick
        document.getElementById("prv_zoomin").onclick = () => {
            this.appScrollToCenter();
            document.getElementById("previewEle").classList.add("previewEleTrans")
            if (this.currentScale + .1 <= 1) {
                this.currentScale = this.currentScale + .1;
            } else {
                this.currentScale = .1;
            }
            document.getElementById("previewEle").style.transform = `scale(${this.currentScale})`;
        }
        document.getElementById("prv_zoomout").onclick = () => {
            this.appScrollToCenter();
            document.getElementById("previewEle").classList.add("previewEleTrans")
            if (this.currentScale - .1 > 0) {
                this.currentScale = this.currentScale - .1;
            } else {
                this.currentScale = 1;
            }
            document.getElementById("previewEle").style.transform = `scale(${this.currentScale})`;


        }
        // <p class="prv_toolBarCtxMenu_item" id="prv_menu_fitToWindows">Fit to Windows</p>
        // <p class="prv_toolBarCtxMenu_item" id="prv_menu_fhd">FHD - 1920x1080</p>
        // <p class="prv_toolBarCtxMenu_item" id="prv_menu_hd">HD - 1280x720</p>
        document.getElementById("prv_menu_fitToWindows").onclick = (event) => {
            let iframeElement = document.getElementById("previewEle");
            iframeElement.classList.remove("previewEleTrans")
            this.setSize();
            this.currentRes = "FTW"
            this.currentRatio = null;
            this.setResTitle("Fit to Windows")
            this.hideToolBarMenu()

            this.currentScale = 1
            iframeElement.style.transform = `scale(${this.currentScale})`;
        }
        document.getElementById("prv_menu_fhd").onclick = (event) => {
            let iframeElement = document.getElementById("previewEle");
            iframeElement.classList.remove("previewEleTrans")
            this.currentScale = 1
            iframeElement.style.transform = `scale(${this.currentScale})`;
            iframeElement.style.width = "1920px";
            iframeElement.style.height = "1080px";
            this.currentRes = "FHD"
            this.currentRatio = null;
            this.setResTitle("FHD - 1920 X 1080")
            this.hideToolBarMenu();
            this.appScrollToCenter()


        }
        document.getElementById("prv_menu_hd").onclick = (event) => {
            let iframeElement = document.getElementById("previewEle");
            iframeElement.classList.remove("previewEleTrans")
            this.currentScale = 1
            iframeElement.style.transform = `scale(${this.currentScale})`;
            iframeElement.style.width = "1280px";
            iframeElement.style.height = "720px";
            this.currentRes = "HD"
            this.currentRatio = null;
            this.setResTitle("HD - 1280 X 720")
            this.hideToolBarMenu();
            this.appScrollToCenter()
        }
        document.getElementById("prv_menu_16-9").onclick = (event) => {
            this.setResolutionByRatio(16, 9)
        }
        document.getElementById("prv_menu_4-3").onclick = (event) => {
            this.setResolutionByRatio(4, 3)
        }


        document.body.onclick = () => {
            this.hideToolBarMenu()
        }

    }
    appScrollToCenter() {
        document.getElementById('previewEle').scrollIntoView({
            behavior: 'auto',
            block: 'center',
            inline: 'center'
        });
    }
    setResTitle(title) {
        if (this.currentRatio == null) {
            document.getElementById("prv_resTitle").innerHTML = "Resolution - " + title
        }
        else {
            document.getElementById("prv_resTitle").innerHTML = "Screen Ratio - " + title
        }

    }
    setSize() {
        let iframeElement = document.getElementById("previewEle");
        iframeElement.style.height = (window.innerHeight - 10) + "px";
        iframeElement.style.width = "100%";

    }
    hideToolBarMenu() {
        this.isToolBarMenuVisible = false;
        let menu = document.getElementById("prv_toolBarCtxMenu")
        menu.style = `display:none`
    }
    showToolBarMenu() {
        this.isToolBarMenuVisible = true;
        let menu = document.getElementById("prv_toolBarCtxMenu")
        menu.style = `display:block;top:28px;right:35px`

    }
    getRationValue(w, h) {
        let divValue = h
        if (w > h) {
            divValue = w
        }
        let hUnit = window.innerHeight / divValue
        let wUnit = window.innerWidth / divValue
        let unit = hUnit
        if (wUnit > hUnit) {
            unit = wUnit
        }
        return unit;

    }
    setResolutionByRatio(w, h) {
        
        let unit = this.getRationValue(w, h)
        let iframeElement = document.getElementById("previewEle");
        iframeElement.classList.remove("previewEleTrans")
        iframeElement.style.width = unit * w + "px";
        iframeElement.style.height = unit * h + "px";
        this.currentRes = `RATIO`
        this.currentRatio = { w: w, h: h }
        this.setResTitle(`${w}:${h}`)
        this.hideToolBarMenu();
        this.currentScale = 1
        this.appScrollToCenter()
    }
}
let peviewApp = new PeviewApp();

