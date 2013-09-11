// ==UserScript==
// @name        fb_their_time
// @namespace   ovrhere.com
// @author      Jason J
// @description Provides a simple tool tip to display a contacts current time.
// @include     https://www.facebook.com/*
// @include     http://www.facebook.com/*
// @version     0.1.0
// ==/UserScript==


 my_log = function (arg) { unsafeWindow.console.log(arg); }

/** Not implemented. Reads and writies objects to storage. 
 *  @version 0.1.0 */
storage = {
    /** Stores object to local storage.  
     * @param {String} key The key of the temporary session.
     * @param {Object} object  The JSON object to be stored.  */
    setObject:function(key, object){ 
       // sessionStorage.setItem(key, JSON.stringify(object) ); 
    },
    /** Retrieves an Object stored to local storage, parses and returns it.
     * @param {String} key The key of the session.  
     * @returns  The store JSON Object. */
    getObject:function(key) {  
        //return JSON.parse ( sessionStorage.getItem(key) ); 
    }
}

/** Handles httpRequests. */
myHttpRequests = {
    
    /** 
     * 
     *Prints facebook location.
     * @param dest The facebook profile to GET. 
     * 
     * TODO Return faceook location 
     * */
    facebookLocation:function(dest) {
        my_log("trying "+dest);
        GM_xmlhttpRequest({
          method: "GET",
          url: dest,
          headers: {
            "User-Agent": "Mozilla/5.0",    // If not specified, navigator.userAgent will be used.
            "Accept": "text/xml"            // If not specified, browser defaults will be used.
          },
          onload: function(response) {
                if (!response.responseXML) {
                  responseXML = new DOMParser()
                    .parseFromString(response.responseText, "text/xml");
                }
                my_log([
                  response.status,
                  response.statusText,
                  response.readyState,
                  response.responseHeaders,
                  response.responseText,
                  response.finalUrl,
                  responseXML].join("\n"));   
            },
        
        onprogress:function(response){
            my_log("loading..");
        },
        onerror: function(response){
            my_log("error!");
        }
        }
        );
    }
}    

/* NOTE: 
 * -class="fbChatTab" defines the entire chat window 
 * -class="titlebarText" defines <a href> objects for the actual name
 * in chat windows.
 */ 
 
/** Responsible for checking the page for changes and attaching events.
 * @version 0.1.0 */
pageMonitor = {
    /** Check frequency in milliseconds. */
    checkFrequency: 5000,
    /** Used for canceling the checking. */
    checkInterval: 0,
    /** The current chat set. */
    chatSet: 0,
    /**The class that is checked in #checkChats().  */
    checkedClass: 'titlebarText',
    /** Whether or not currently fetching. */
    fetching: false,
    
    /** Checks the cookies. */
    checkChats:function(){
        
        var checkedSet = document.getElementsByClassName(pageMonitor.checkedClass);                          
        
        if (!pageMonitor.chatSet){
            pageMonitor.chatSet = checkedSet;            
        } else if (pageMonitor.chatSet != checkedSet){
            pageMonitor.chatSet = checkedSet;            
        }
        
        for(var i=0,j=checkedSet.length; i<j; i++){
            if (!pageMonitor.fetching){
                myHttpRequests.facebookLocation(checkedSet[i].getAttribute("href"));
                pageMonitor.fetching = true;
            }      
              my_log("checkedSet name: " + checkedSet[i].innerHTML +
                      "url: " + checkedSet[i].getAttribute("href")  );
            };
        
    },
    /** Starts the monitor. */ 
    start:function(){
        my_log("started");
        this.checkInterval = setInterval(this.checkChats, this.checkFrequency, null);
    },
    /** Stops the monitor. */
    stop:function(){
        clearInterval(this.checkInterval);
    }
}

//start monitoring
pageMonitor.start();
