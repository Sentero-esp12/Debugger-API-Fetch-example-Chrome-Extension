

var attachedTabs = {};
var version = "1.3";
var letsdo = null;
var debugID, tabIDD;

let debuggerEnabled = false;

var xC, yC;
chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    console.log(sender.tab ?
      "from a content script:" + sender.tab.url :
      "from the extension");
    if (request.greeting == "hello")
      sendResponse({ farewell: "goodbye" });
    console.log(request.x, request.y);
    xC = request.x; yC = request.y;
    if (request.mouse == "D") {
      console.log("D");
      chrome.debugger.sendCommand(debugID, "Input.dispatchMouseEvent", { type: "mousePressed", x: xC, y: yC, button: "left" }, function (e) { console.log('clickDown', e) });


    } else if (request.mouse == "U") {
      console.log("U");

      chrome.debugger.sendCommand(debugID, "Input.dispatchMouseEvent", { type: "mouseReleased", x: xC, y: yC, button: "left" }, function (e) { console.log('clickUp', e) });

    }

  });


chrome.debugger.onEvent.addListener(onEvent);
chrome.debugger.onDetach.addListener(onDetach);

chrome.browserAction.onClicked.addListener(function (tab) {
  var tabId = tab.id;
  tabIDD = tabId;
  var debuggeeId = { tabId: tabId };
  debugID = debuggeeId;

  //if (attachedTabs[tabId] == "pausing")
  // return;

  if (!attachedTabs[tabId])
    chrome.debugger.attach(debuggeeId, version, onAttach.bind(null, debuggeeId));
  else {
    // setTimeout(function(){
    chrome.debugger.sendCommand(debuggeeId, "Input.dispatchMouseEvent", { type: "mousePressed", x: x, y: y, button: "left" }, function (e) { console.log('11click', e) });
    chrome.debugger.sendCommand(debuggeeId, "Input.dispatchMouseEvent", { type: "mouseReleased", x: x, y: y, button: "left" }, function (e) { console.log('22click', e, x, y) });
    //},1000)
  }
  //else if (attachedTabs[tabId])
  //chrome.debugger.detach(debuggeeId, onDetach.bind(null, debuggeeId));
});

function onAttach(debuggeeId) {
  if (chrome.runtime.lastError) {
    alert(chrome.runtime.lastError.message);
    return;
  }

  var tabId = debuggeeId.tabId;
  chrome.browserAction.setIcon({ tabId: tabId, path: "debuggerPausing.png" });
  chrome.browserAction.setTitle({ tabId: tabId, title: "Pausing JavaScript" });
  attachedTabs[tabId] = "pausing";
  chrome.debugger.sendCommand(
    debuggeeId, "Debugger.enable", {},
    onDebuggerEnabled.bind(null, debuggeeId));
}
var x = 777;
var y = 368;

function onDebuggerEnabled(debuggeeId) {
  //if(letsdo){clearInterval(letsdo);}else{letsdo=null;}
  //letsdo = setInterval(function(){
  //setTimeout(function(){
  debuggerEnabled = true

  chrome.debugger.sendCommand(debuggeeId, "Input.dispatchMouseEvent", { type: "mousePressed", x: x, y: y, button: "left" }, function (e) { console.log('click', e, x, y) });
  chrome.debugger.sendCommand(debuggeeId, "Input.dispatchMouseEvent", { type: "mouseReleased", x: x, y: y, button: "left" }, function (e) { console.log('unclick', e, x, y) });
  //},300)
  //},1000)
}

function onEvent(debuggeeId, method, frameId, resourceType) {



  if (method === "Fetch.requestPaused") {
    console.log(debuggeeId, method, frameId, resourceType)
    console.log(frameId, frameId.request.url)
    proceedWithGettingRequestBody(debuggeeId, frameId)
  }


  var tabId = debuggeeId.tabId;
  if (method == "Debugger.paused") {
    attachedTabs[tabId] = "paused";
    chrome.browserAction.setIcon({ tabId: tabId, path: "debuggerContinue.png" });
    chrome.browserAction.setTitle({ tabId: tabId, title: "Resume JavaScript" });
  }
}

function onDetach(debuggeeId) {
  var tabId = debuggeeId.tabId;
  delete attachedTabs[tabId];
  chrome.browserAction.setIcon({ tabId: tabId, path: "debuggerPause.png" });
  chrome.browserAction.setTitle({ tabId: tabId, title: "Pause JavaScript" });
  debuggerEnabled = false
}

/* onCommitted
onBeforeNavigate */
chrome.webNavigation.onBeforeNavigate.addListener((data) => {
  if (typeof data && debuggerEnabled === true) {
    console.log(chrome.i18n.getMessage('inHandler'), data);

    chrome.debugger.sendCommand(
      debugID,
      "Fetch.enable",
      {
        patterns: [{
          requestStage: "Response",
          resourceType: "Document", urlPattern: '*lichess*'
        }]
      },
      function (e) {
        console.log('now will do response')
      });

  }

  else {
    console.error(chrome.i18n.getMessage('inHandlerError'));
  }
});


const disableFetch = () => {
  chrome.debugger.sendCommand(
    debugID, "Fetch.disable",
    function (e) {
      console.log(e)
    });
}

const fullfillRequest = (encodedHTML, debuggeeId, frameId) => {

  chrome.debugger.sendCommand(
    debugID, "Fetch.fulfillRequest",
    {
      requestId: frameId.requestId,
      responseCode: frameId.responseStatusCode,
      body: encodedHTML
    },
    function (e) {
      console.log(e)
      disableFetch();
    });

}


const proceedWithGettingRequestBody = (debuggeeId, frameId) => {

  let requestId = frameId.requestId

  chrome.debugger.sendCommand(
    debugID, "Fetch.getResponseBody",
    { requestId: String(requestId) },
    function (body, base64) {
      console.log(body, 'gotResponse')
      let decoded = atob(body.body)
      //console.log(decoded);

      let indexMetaCSP = decoded.indexOf('<meta http-e');
      let endMetaCSP = decoded.indexOf('<', indexMetaCSP + 1);

      let finalHTML = `
${decoded.substr(0, indexMetaCSP)}
${decoded.substr(endMetaCSP)}`

      console.log(finalHTML)
      let encodedHTML = btoa(finalHTML);

      fullfillRequest(encodedHTML, debuggeeId, frameId)


      //Fetch.getResponseBody
    });


}





