var SOCKET_SERVER_IP ="127.0.0.1";
var SOCKET_SERVER_PORT ="8000";

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
  
   window.location.href =url
  //window.open(url,"_blank")

  }
  unloadApp() {

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
   
  
    });

    socket.on("connection_resp",  (data)=> {
  
      console.log("socket on::::connection_resp", data);
      if (data.status == "connected") {
        this.setStatus(true)
        this.dp_subtitle_status.innerText ="Auto Reload Application : Loading"
        socket.emit("app_url_req", {
          orgin: "onConnection",
        });
      }
    
    });
    socket.on("app_url_resp",  (data)=> {
    
      console.log("socket on::::app_url_resp", data);
      this.dp_subtitle_status.innerText ="Auto Reload Application : Loaded";
      this.progress_bar.value =100;
      this.loadApp(data.url)
    
    });
    socket.on("preview_progress",  (data)=> {
    
      console.log("socket on::::app_url_resp", data);
      this.dp_subtitle_status.innerText =data.statusText
      this.progress_bar.value =data.progress
    
    });
    
    socket.on('disconnect',  ()=> {
      this.setStatus(false);
      socket.disconnect(true);
      socket.close();
  
    });

    socket.open();
  }
}

// window.onload = function () {
//   let inData= {'SOCKET_SERVER_IP':'192.168.29.169','SOCKET_SERVER_PORT':'8003'}
//   SOCKET_SERVER_IP = inData.SOCKET_SERVER_IP
//   SOCKET_SERVER_PORT = inData.SOCKET_SERVER_PORT
//   let dp = new DevPreview();
//   dp.init();

// };
// webOSLaunch event
document.addEventListener('webOSLaunch', function(inData) {


  SOCKET_SERVER_IP = inData.detail.SOCKET_SERVER_IP
  SOCKET_SERVER_PORT = inData.detail.SOCKET_SERVER_PORT

  let dp = new DevPreview();
  dp.init();
 

}, true);


