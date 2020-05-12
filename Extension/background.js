

var attachedTabs = {};
var version = "1.3";
var letsdo = null;
var debugIdGlobal;

let debuggerEnabled = false;


chrome.debugger.onEvent.addListener(onEvent);
chrome.debugger.onDetach.addListener(onDetach);

chrome.browserAction.onClicked.addListener(function (tab) {
  var tabId = tab.id;
  var debuggeeId = { tabId: tabId };
  debugIdGlobal = debuggeeId;

  if (!attachedTabs[tabId]){
    chrome.debugger.attach(debuggeeId, version, onAttach.bind(null, debuggeeId));
}
else {
  chrome.debugger.detach(debuggeeId, onDetach.bind(null, debuggeeId));
}

});

function onAttach(debuggeeId) {
  if (chrome.runtime.lastError) {
    alert(chrome.runtime.lastError.message);
    return;
  }

  tabId = debuggeeId.tabId;
  chrome.browserAction.setIcon({ tabId: tabId, path: "debuggerPause.png" });
  chrome.browserAction.setTitle({ tabId: tabId, title: "pause debugger" });
  attachedTabs[tabId] = "working";
  chrome.debugger.sendCommand(
    debuggeeId, "Debugger.enable", {},
    onDebuggerEnabled.bind(null, debuggeeId));
}


function onDebuggerEnabled(debuggeeId) {
  debuggerEnabled = true



  chrome.debugger.sendCommand(
    debuggeeId,
    "Fetch.enable",
    {
      patterns: [{
        requestStage: "Response",
        resourceType: "Document", urlPattern: '*lichess*'
      }]
    },
    function (e) {
      console.log('now will wait for a request')
    });



}

function onDebuggerDisabled(debuggeeId) {
  debuggerEnabled = false
  disableFetch(debuggeeId)   //disabling Fetch

}

function onEvent(debuggeeId, method, frameId, resourceType) {

  tabId = debuggeeId.tabId;
  if (method == "Debugger.paused") {
    attachedTabs[tabId] = "paused";
    chrome.browserAction.setIcon({ tabId: tabId, path: "debuggerStart.png" });
    chrome.browserAction.setTitle({ tabId: tabId, title: "Resume debugging" });
  }

  if (method === "Fetch.requestPaused") {   //request paused and ready to be intercepted
    console.log(debuggeeId, method, frameId, resourceType)
    console.log(frameId,frameId.request.url)
    proceedWithGettingRequestBody(debuggeeId, frameId)
  }

}

function onDetach(debuggeeId) {
  var tabId = debuggeeId.tabId;
  chrome.debugger.sendCommand(
    debuggeeId, "Debugger.disable", {},
    onDebuggerDisabled.bind(null, debuggeeId));
  delete attachedTabs[tabId];
  chrome.browserAction.setIcon({ tabId: tabId, path: "debuggerStart.png" });
  chrome.browserAction.setTitle({ tabId: tabId, title: "Resume debugging" });
  debuggerEnabled = false
}



//onCommitted
//onBeforeNavigate   
//perhaps it's better to use webNavigation to implement it, 
//but for me it resulted in the request not being paused the first time, 
//so I enable Fetch together with the debugger and disable it when 
//the debugger is disabled

/* chrome.webNavigation.onBeforeNavigate.addListener((data) => {
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
 */

const disableFetch = (debuggeeId) => {
  chrome.debugger.sendCommand(
    debuggeeId, "Fetch.disable",
    function (e) {
      console.log(e)
    });
}

const fullfillRequest = (encodedHTML, debuggeeId, frameId) => {
  chrome.debugger.sendCommand(
    debuggeeId, "Fetch.fulfillRequest",
    {
      requestId: frameId.requestId,
      responseCode: frameId.responseStatusCode,
      body: encodedHTML
    },
    function (e) {
      console.log(e)
     // disableFetch();
    });
}


const proceedWithGettingRequestBody = (debuggeeId, frameId) => {
  let requestId = frameId.requestId
  chrome.debugger.sendCommand(
    debuggeeId, "Fetch.getResponseBody",
    { requestId: String(requestId) },
    function (body, base64) {


      console.log(body, 'got Response and modifying it')
      let encodedHTML = body.body;
      let decoded = atob(body.body)
      

      if (decoded.indexOf(`http-equiv="Content-Security-Policy"`)!==-1) 
{
      let indexMetaCSP = decoded.indexOf('<meta http-equiv="Content-Security-Policy');
      let endMetaCSP = decoded.indexOf('<', indexMetaCSP + 1);

      let finalHTML =`
${decoded.substr(0, indexMetaCSP)}
${decoded.substr(endMetaCSP)}`
      console.log(finalHTML);
      encodedHTML = btoa(finalHTML);
      
//finally fullFill a modified request
fullfillRequest(encodedHTML, debuggeeId, frameId)
}
else {
  //if no CSP in the header, send an unmodified request: 
  fullfillRequest(encodedHTML, debuggeeId, frameId)
}
    });


}


