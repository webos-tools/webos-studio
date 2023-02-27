class DevPreview {
  constructor() {
    // this.dp_app_iframe = document.getElementById("dp_app_iframe");
    this.dp_subtitle_status = document.getElementById("dp_subtitle_status");
    this.dp_home = document.getElementById("dp_home");
    this.dp_status_box = document.getElementById("dp_status_box");
    this.progress_bar = document.getElementById("progress_bar");
    
  }
  init() {
    // this.dp_app_iframe.style.display = "none";
    this.dp_home.style.display = "block";
    this.dp_status_box.classList.add("dp_status_box_offline");
    this.setStatus(false);
    this.dp_subtitle_status.innerText ="Connecting User m/c .."
    this.unloadApp();
    this.connectUserMC();
  }
  loadApp(url) {
    // this.dp_app_iframe.style.display = "block";
    // this.dp_home.style.display = "none";
    // this.dp_app_iframe.src ="#;"
    // this.dp_app_iframe.src = url;
    window.location.href =url

  }
  unloadApp() {
    // this.dp_app_iframe.style.display = "none";
    // this.dp_app_iframe.src = "#";
    this.dp_home.style.display = "block";
  }
  setStatus(isOnline) {
    if (isOnline) {
      this.dp_status_box.classList.remove("dp_status_box_offline");
      this.dp_status_box.classList.add("dp_status_box_online");
      this.dp_status_box.title = "Online";
    } else {
      this.dp_status_box.classList.remove("dp_status_box_online");
      this.dp_status_box.classList.add("dp_status_box_offline");
      this.dp_status_box.title = "offline";
    }
  }

  connectUserMC() {
    var url = "http://" + SOCKET_SERVER_IP + ":" + SOCKET_SERVER_PORT;
    var options = {
      reconnection: false,
      reconnectionAttempts: 2,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 5000,
      autoConnect: false,
      transports: ["websocket"],
    };

    let socket = io(url, options);

    socket.on("connect_error",  (err)=> {
      // alert(`Connect Error(${url}): ${err.message}`);
  
    });

    socket.on("connection_resp",  (data)=> {
  
      console.log("socket on::::connection_resp", data);
      if (data.status == "connected") {
        this.setStatus(true)
        this.dp_subtitle_status.innerText ="App Preview : Loading"
        socket.emit("app_url_req", {
          orgin: "onConnection",
        });
      }
    
    });
    socket.on("app_url_resp",  (data)=> {
    
      console.log("socket on::::app_url_resp", data);
      this.dp_subtitle_status.innerText ="App Preview : Loaded";
      this.progress_bar.value =100;
      this.loadApp(data.url)
    
    });
    socket.on("preview_progress",  (data)=> {
    
      console.log("socket on::::app_url_resp", data);
      this.dp_subtitle_status.innerText =data.statusText
      this.progress_bar.value =data.progress
    
    });
    
    // socket.on('disconnect', function () {
    //   console.log(' disconnect, id =  ' + socket.id);
    //   toggleConnectInfo(DISCONNECTED);
    //   socket.disconnect(true);
    //   socket.close();
    //   if (isLoadingContents) {
    //     alert('Failed to load Content Application');
    //     tizen.application.getCurrentApplication().exit();
    //   }
    // });

    // socket.on('push_progress', function (info) {
    //   console.log('socket on::::push_progress');
    //   isLoadingContents = true;
    //   loadingElem.innerHTML =
    //     'loading : ' +
    //     info.progressRate +
    //     ' (' +
    //     info.load +
    //     '/' +
    //     info.total +
    //     ')';
    //   loadingElem.style.width = info.progressRate;
    // });

    // socket.on('push_completed', function () {
    //   console.log('socket on::::push_completed');
    //   stopIconDimAnimation();
    //   loadContent(CONTENT_SRC);
    //   isLoadingContents = false;
    // });

    // socket.on('push_failed', function () {
    //   console.log('socket on::::push_failed');
    //   alert('Failed to load Content Application');
    //   tizen.application.getCurrentApplication().exit();
    // });

    // socket.on('changed', function () {
    //   reloadContent();
    // });

    // socket.on('remove', function (path) {
    //   tizen.filesystem.resolve(
    //     path,
    //     function (data) {
    //       if (data.isDirectory) {
    //         data.parent.deleteDirectory(
    //           data.fullPath,
    //           true,
    //           function () {
    //             console.log('Directory Deleted');
    //             reloadContent();
    //           },
    //           function (e) {
    //             console.log('Error to Delete Directory.' + e.message);
    //           }
    //         );
    //       } else {
    //         data.parent.deleteFile(
    //           data.fullPath,
    //           function () {
    //             console.log('file Deleted');
    //             reloadContent();
    //           },
    //           function (e) {
    //             console.log('Error to Delete file.' + e.message);
    //           }
    //         );
    //       }
    //     },
    //     function (e) {
    //       console.log('Error: ' + e.message);
    //     },
    //     'rw'
    //   );
    // });
    socket.open();
  }
}
window.onload = function () {
  let dp = new DevPreview();
  dp.init();
};
