// ==UserScript==
// @name        fb_their_time
// @namespace   ovrhere.com
// @author      Jason J
// @description Provides a simple tool tip to display a contacts current time.
// @include     https://www.facebook.com/*
// @include     http://www.facebook.com/*
// @version     0.1.1
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


/** Handles httpRequests. 
 * @version 0.1.0 */
myHttpRequests = {
    /** The class used to contain "about me" summaries on the front page. */
    aboutClass: '_4_ug',
    /** The query stub to determine a location's time. */
    googleQueryStub: 'current time in ', 
    
    /** Gathers the location from the DOM. 
     * @param {Element} dom The dom the analise and check. 
     * @return {Object} An Object of the form:
     * { lives: "Lives in String", from: "From String"}. The default values are blank strings.
     * */
    fbLocationFromDOM:function(dom){
        var aboutPerson = dom.getElementsByClassName('_4_ug');
        var livesIn = ""; 
        var fromLoc = "";
        
        my_log("aboutPerson: " + aboutPerson + " " + aboutPerson.length);
        
        for (var i = aboutPerson.length - 1; i >= 0; i--){
          var string = ""+aboutPerson[i].innerHTML
          my_log("li["+i+"] :" + string);
          if (string.contains("Lives in", 0)){
            livesIn = aboutPerson[i].getElementsByTagName('a')[0].innerHTML;
          } else if (string.contains("From", 0)){
              fromLoc = aboutPerson[i].getElementsByTagName('a')[0].innerHTML;
          }
        };
        my_log(livesIn+fromLoc)
        return { lives: livesIn, from: fromLoc };
    },
    /** Facebook likes to pass around code with sections commented out. 
     * Let's strip those comment tags. 
     * @param {String} htmlText The html text to strip comments from. */
    stripCommentTags:function(htmlText){
        htmlText = htmlText.replace(/\<\!\-\-/gi, "");
        htmlText = htmlText.replace(/\-\-\>/gi, "");
        //my_log(htmlText);
        
        return htmlText;
    },
    /** 
     * Does not work. Gets the facebook page, but it is not signed in. 
     * Could pass password etc. But why not try injected script for same domain? 
     * 
     * 
     *Prints facebook location.
     * @param {String} dest The facebook profile to GET. 
     * @param {Function} callback (Optional.) If set, the action to perform on load. 
     * Expects one parameter: Object/Associative array. Where the members are:
     * lives: "Lives in String", from: "From String". 
     *  
     * */
    facebookLocation:function(dest, callback) {
        my_log("trying "+dest);
        GM_xmlhttpRequest({
          method: "GET",
          url: dest,
          headers: {
            "User-Agent": "Mozilla/5.0",    // If not specified, navigator.userAgent will be used.
            "Accept": "text/xml"            // If not specified, browser defaults will be used.
          },
          onload: function(response) {
              var responseXML; 
                if (!response.responseXML) {
                    my_log("parsing...");
                  responseXML = new DOMParser()
                    .parseFromString( 
                        myHttpRequests.stripCommentTags(response.responseText), 
                        "text/html");                        
                } else {
                    my_log("recevied.");
                    responseXML = response.responseXML;
                }
                var locs = myHttpRequests.fbLocationFromDOM(responseXML.documentElement);
                
                if (callback){
                    my_log("trying function: " + callback + locs);
                    callback(locs);
                }
                  
            },
        
            onprogress:function(response){
                my_log("loading...");
            },
            onerror: function(response){
                my_log("error!");
            }
        }
        );
    },
    
    /** Attempts to google the location to get the current time their.
     * @param {String} location The location to search and check the time of.
     * @param {Function} callback (Optional.) If set, the action to perform on load. 
     * Will pass parameter {Object} of the form:
     * { lives: "Lives in String", from: "From String"}, 
     * where the default values are blank strings.
     */
    googleCurrentTime:function(location, callback){
        var dest = "http://www.google.com/search?q=" +myHttpRequests.googleQueryStub + location;
        //postStub.replace(/ /gi, "\+"); //
        GM_xmlhttpRequest({
          method: "GET",
          url: dest,
          headers: {
            "User-Agent": "Mozilla/5.0",    // If not specified, navigator.userAgent will be used.
            "Accept": "text/xml"            // If not specified, browser defaults will be used.
          },
          onload: function(response) {
              var responseXML; 
                if (!response.responseXML) {
                    my_log("parsing...");                    
                  responseXML = new DOMParser().parseFromString(response.responseText, "text/html");
                  my_log("no error?...");                        
                } else {
                    my_log("recevied.");
                    responseXML = response.responseXML;
                }
                
                my_log("Google result: " + 
                responseXML.documentElement.getElementsByClassName('vk_c vk_gy vk_sh')[0].innerHTML);
            },
        
            onprogress:function(response){
                my_log("loading...");
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
    
    /** Checks to see current chat's open and registers/deregisters 
     * their 'onhover' events. */
    checkChats:function(){
        
        var checkedSet = document.getElementsByClassName(pageMonitor.checkedClass);
        
        if (pageMonitor.runonce) return;
        //var chatPaglet = document.getElementById('ChatTabsPagelet');        
        //chatPaglet.addEventListener ("DOMNodeInserted", function(){my_log("inserted")}, false);
        //chatPaglet.addEventListener ("DOMNodeRemoved", function(){my_log("removed")}, false); 
        //pageMonitor.runonce = true;                        
        //return;
        
        if (!pageMonitor.chatSet){
            pageMonitor.chatSet = checkedSet;            
        } else if (pageMonitor.chatSet != checkedSet){
            pageMonitor.chatSet = checkedSet;            
        }
        
        for(var i=0,j=checkedSet.length; i<j; i++){
            if (!pageMonitor.fetching){
                myHttpRequests.facebookLocation(checkedSet[i].getAttribute("href"), pageMonitor.checkLocationTime);
                pageMonitor.fetching = true;
            }      
              my_log("checkedSet name: " + checkedSet[i].innerHTML +
                      "url: " + checkedSet[i].getAttribute("href")  );
            };
        
    },
    /** The action to perform once the fb check has completed. 
     * @param {Object} locations Expecting an object/associative array with two members; "from" and "lives". 
     * */
    checkLocationTime:function(locations){
        my_log("reached checkLocationTime: " + locations);
        my_log(locations.lives);
        my_log(locations.from)
        
        myHttpRequests.googleCurrentTime(locations.lives);
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
CodeInjector().fullInjection(toBeInjected, "BEGIN_INJECTION", "END_INJECTION")
