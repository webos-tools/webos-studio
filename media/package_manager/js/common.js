function setReleaseNote(row, treegridElem) {
  
  let rowObj = row.getAttribute("data-rowobj");
 
  let rNoteElement = null;
  switch (treegridElem.id) {
    case "treegrid_tv_components":
      rNoteElement = document.getElementById("tvnotecontent");
      break;
    case "treegrid_ose_components":
      rNoteElement = document.getElementById("osenotecontent");

      break;
  }
  if (rowObj == null) {
    // clear release note
    rNoteElement.innerText ="";
  }else{
    rNoteElement.innerText  = JSON.parse(atob(rowObj))["releaseNote"]
  }
}
