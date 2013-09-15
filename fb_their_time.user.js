// ==UserScript==
// @name        fb_their_time
// @namespace   ovrhere.com
// @author      Jason J
// @description Provides a simple tool tip to display a contacts current time.
// @include     https://www.facebook.com/*
// @include     http://www.facebook.com/*
// @version     0.1.1
// ==/UserScript==


 my_log = function (arg) { 
     unsafeWindow.console.log(arg); 
}

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
        var aboutPerson = dom.getElementsByClassName(myHttpRequests.aboutClass);
        var livesIn = ""; 
        var fromLoc = "";
        
        my_log("aboutPerson: " + aboutPerson + " " + aboutPerson.length); //TODO remove log
        
        for (var i = aboutPerson.length - 1; i >= 0; i--){
          var string = ""+aboutPerson[i].innerHTML
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
        my_log("trying "+dest); //TODO remove log
        GM_xmlhttpRequest({
          method: "GET",
          url: dest,
          headers: {
            "User-Agent": "Mozilla/5.0",    // If not specified, navigator.userAgent will be used.
            "Accept": "text/html"            // If not specified, browser defaults will be used.
          },
          onload: function(response) {
              var responseXML; 
                if (!response.responseXML) {                    
                  responseXML = new DOMParser()
                    .parseFromString( 
                        myHttpRequests.stripCommentTags(response.responseText), 
                        "text/html");
                                                
                } else {                    
                    responseXML = response.responseXML;
                }
                
                var locs = myHttpRequests.fbLocationFromDOM(responseXML.documentElement);
                my_log("tried "+dest); //TODO remove log
                if (callback){                    
                    callback(locs);
                }
                  
            },
        
            onprogress:function(response){
                my_log("loading..."); //TODO remove log
            },
            onerror: function(response){
                my_log("error!"); //TODO remove log
            }
        }
        );
        my_log("GM_httpReq? "+ GM_xmlhttpRequest); //TODO remove log
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
            "Accept": "text/html"            // If not specified, browser defaults will be used.
          },
          onload: function(response) {
              var responseXML; 
                if (!response.responseXML) {
                    my_log("parsing...");     //TODO Remove log
                    responseXML = new DOMParser().parseFromString(response.responseText, "text/html"); 
                } else {
                    my_log("recevied."); //TODO Remove log
                    responseXML = response.responseXML;
                }
                var answer = responseXML.documentElement.getElementsByClassName('obcontainer');
                //responseXML.documentElement.getElementsByClassName('vk_c vk_gy vk_sh');
                if (answer.length <= 0 ){
                  my_log("none found ");   //TODO Remove log
                  return;  
                } 
                my_log("answer? ");   //TODO Remove log
                var table = answer[0].getElementsByTagName('table');
                my_log("answer " + table.length)  //TODO Remove log
                
                for(var i=0,j=table.length; i<j; i++){
                    //if (table[i].getElementsByTagName[td].length == 1)
                        my_log("table "+i+" : "+table[i].innerHTML); //TODO Remove log
                };
                //my_log("Google result: " + answer[0].innerHTML); //TODO Remove log
            },
        
            onprogress:function(response){
                my_log("loading..."); //TODO Remove log
            },
            onerror: function(response){
                my_log("error!"); //TODO Remove log
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
    /** The chat pagelet container. */
    chatPagelet: 0, 
    
    /**The class that is checked in #checkChats().  */
    checkedClass: 'titlebarText',
    /** The pagelet's id to monitor. */
    chatPageletId: 'ChatTabsPagelet',
    
    /** Whether or not currently fetching. */
    fetching: false,
    /** Whether or not we are currently checking the chats. */
    isCheckingChats: false,
    
    /** Check every 500 milliseconds to register the paglet.
     * Once registered, we set event listeners to fire onDOMNodeInserted and onDOMNodeRemoved to  
     * call #pageMonitor.checkChats */
    registerPagelet:function(){
        my_log("registering..."); //TODO Remove log
        if (!pageMonitor.chatPaglet){
            var e = document.getElementById(pageMonitor.chatPageletId);
            if ( e ){
                pageMonitor.chatPaglet = e;        
                e.addEventListener ("DOMNodeInserted", function(){ pageMonitor.checkChats();}, false);
                e.addEventListener ("DOMNodeRemoved", function(){ pageMonitor.checkChats(); }, false);
                return; 
            }
        } 
        setTimeout(pageMonitor.registerPagelet, 500);
    },
    
    /** Checks to see current chat's open and registers/deregisters 
     * their 'onhover' events. */
    checkChats:function(){
        if(pageMonitor.isCheckingChats) return; 
        pageMonitor.isCheckingChats = true; //this prevents multiple calls running over each other
        my_log("checking chats..."); //TODO Remove log
        
        var checkedSet = document.getElementsByClassName(pageMonitor.checkedClass);
        
        if (!pageMonitor.chatSet){ //on first run
            my_log("setting")  //TODO Remove log
            //we slice to get a copy/clone rather than a reference
            pageMonitor.chatSet = [].slice.call(checkedSet);             
        } else {
            var changed = checkedSet.length != pageMonitor.chatSet.length ? true : false;
            for(var i=0,j=checkedSet.length; i<j; i++){               
              if ( checkedSet[i] != pageMonitor.chatSet[i] ){
                  my_log("different item at "+ i); //TODO Remove log
                  changed=true;
              }
            };
            //if changed, we recopy and continue
            if (changed){
                pageMonitor.chatSet = [].slice.call(checkedSet);
                my_log("new set!")            //TODO Remove log
            } else { //nothing has changed.
                pageMonitor.isCheckingChats = false;
                return;
            }
        }
        
        pageMonitor.isCheckingChats = false;        
        
        //changes happened so we do things
        for(var i=0,j=checkedSet.length; i<j; i++){
            myHttpRequests.facebookLocation(checkedSet[i].getAttribute("href"), pageMonitor.checkLocationTime);
        
            my_log("checkedSet name: " + checkedSet[i].innerHTML +
                  "url: " + checkedSet[i].getAttribute("href")  ); //TODO Remove log
        };
        
    },
    /** The action to perform once the fb check has completed. 
     * @param {Object} locations Expecting an object/associative array with two members; "from" and "lives". 
     * */
    checkLocationTime:function(locations){
        my_log("reached checkLocationTime: " + locations); //TODO Remove log
        my_log(locations.lives); //TODO Remove log
        my_log(locations.from); //TODO Remove log
        if (locations.lives){
            myHttpRequests.googleCurrentTime(locations.lives);
        } else if (locations.from) {
            myHttpRequests.googleCurrentTime(locations.from);
        } else {
            my_log("nothing available. =/") //TODO Remove log
        }
    },
    
    /** Starts the monitor. */ 
    start:function(){
        my_log("started"); //TODO Remove log
        //pageMonitor.registerPagelet();
        pageMonitor.checkInterval = setInterval(this.checkChats, this.checkFrequency, null);
    },
    /** Stops the monitor. */
    stop:function(){
        clearInterval(this.checkInterval);
    }
}

//start monitoring
pageMonitor.start();

