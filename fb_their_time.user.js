// ==UserScript==
// @name        fb_their_time
// @namespace   ovrhere.com
// @author      Jason J
// @description Provides a simple tool tip to display a contacts current time.
// @include     https://www.facebook.com/*
// @include     http://www.facebook.com/*
// @version     0.1.2
// ==/UserScript==

var DEBUGGING = true;

/** Convience function for debugging. */
 my_log = function (arg) { 
     if (DEBUGGING){
       unsafeWindow.console.log(arg); 
    }
};

/** Days of the week, ordered: Sunday is [0]. */
var DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];



///////////////////////////////////////////////////////////////////////////////////////////////////////////
///// Start storage object
///////////////////////////////////////////////////////////////////////////////////////////////////////////
/** Reads and writes objects to storage. 
 * It is worth noting this cannot be inspected by cookie manager.
 * 
 *  @version 0.1.0 */
storage = {
    /** The name of our localStore for encapsulation purposes. */
    id: 'fb_their_time_script',
    /** Erases all storage. */
    eraseStorage:function(){
        localStorage.removeItem(storage.id); 
        my_log("Erased");
    },
    /** Stores object to local storage.  
     * @param {String} key The key in the localStorage item.
     * @param {Object} object  The object to be stored.  */
    setObject:function(key, object){
        var value = localStorage.getItem(storage.id);         
        try{
            if (!value){
                value = JSON.stringify({});
            }
            var obj = JSON.parse(value);
            obj[key] = object;
            value = JSON.stringify(obj);
        } catch (e){
                my_log("Error occurred: " + e );                                
        } 
        localStorage.setItem(storage.id, value );
    },
    
    /** Retrieves an Object stored to local storage, parses and returns it.
     * @param {String} key The key of the session.  
     * @returns  The stored Object or <code>null</code>. */
    getObject:function(key) {  
        var value = localStorage.getItem(storage.id); 
        if (value){
            try{
                var obj = JSON.parse (value);
                return obj[key];
            } catch (e){
                my_log("Error occurred: " + e);
                return null;                
            }
        }
       return null;
    }
};


///////////////////////////////////////////////////////////////////////////////////////////////////////////
///// End storage
///////////////////////////////////////////////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////////////////////////////////////////////
///// Start myHttpRequests object
///////////////////////////////////////////////////////////////////////////////////////////////////////////

/** Handles httpRequests to facebook and google. 
 * @version 0.3.0 */
myHttpRequests = {
    /** The Facebook class used to contain "about me" summaries on the front page. */
    aboutClass: '_4_ug',
    /** The Google query stub to determine a location's time. */
    googleQueryStub: 'current time in ', 
    /** The Google container class to find the time-answer in. 
     * If this does not exists the answer is not simple. */
    containerClass: 'obcontainer',
    
    /** 
     * Gathers the location from the DOM. 
     * @param {DOM} dom The dom the analise and check.       
     * @return {Object} An Object of the form:
     * { lives: "Lives in String", from: "From String"}. The default values are blank strings.
     * */
    fbLocationFromDOM:function(dom){
        var aboutPerson = dom.getElementsByClassName(myHttpRequests.aboutClass);
        var livesIn = ""; 
        var fromLoc = "";
        
        /** @TODO remove log */
        my_log("aboutPerson: " + aboutPerson + " " + aboutPerson.length); 
        
        for (var i = aboutPerson.length - 1; i >= 0; i--){
          var string = ""+aboutPerson[i].innerHTML;
          if (string.contains("Lives in", 0)){
            livesIn = aboutPerson[i].getElementsByTagName('a')[0].innerHTML;
          } else if (string.contains("From", 0)){
              fromLoc = aboutPerson[i].getElementsByTagName('a')[0].innerHTML;
          }
        };
        my_log(livesIn+fromLoc);
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
     * Parses facebook's page, strips the comments and exracts the location data.
     * @param {String} dest The facebook profile to GET. 
     * @param {Function} callback The action to perform on load.
     * Expects one parameter: Object/Associative array. Where the members are:
     * {lives: "Lives in String", from: "From String" }.
     * @param {Object} callbackContext (Optional). The context to perform the callback in 
     * (important for chaining).  
     *  
     * */
    facebookLocation:function(dest, callback, callbackContext) {
        /** @TODO remove log */
        my_log("trying "+dest); 
        
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
               
                if (callbackContext){    
                    callback.call(callbackContext, locs);
                } else
                  callback(locs);
                 
                /** @TODO remove log */ 
                my_log("fb check exiting... "); 
                   
            },
            
            onprogress:function(response){
                my_log("loading..."); /** @TODO remove log */
            },
            onerror: function(response){
                my_log("error!"); /** @TODO remove log */
            }
        }
        );        
    },
    
    /** 
     * Attempts to google the location to get the current time there.
     * 
     * @param {String} location The location to search and check the time of.
     * @param {Function} callback The action to perform on load. 
     * Will pass parameter {Object} of the form:
     * { time: "H:MMpm/am", timezone: "(PDT)", day: "Monday", dayIndex: 1 }, 
     * where the default values are blank strings. 
     * If no answer can be found it will pass the string: "No answer found."
     * @param {Object} callbackContext (Optional). The context to perform the callback in
     * (important for chaining).
     *   
     * */
    googleCurrentTime:function(location, callback, callbackContext) {
        var dest = "http://www.google.com/search?q=" +myHttpRequests.googleQueryStub + location;
        
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
                    responseXML = new DOMParser().parseFromString(response.responseText, "text/html"); 
                } else {
                    responseXML = response.responseXML;
                }
                var answer = responseXML.documentElement.getElementsByClassName(myHttpRequests.containerClass);
                if (answer && answer.length){                
                    var table = answer[0].getElementsByTagName('table'); //check first item
                    if (table && table.length){
                        var inner = "" + table[0].getElementsByTagName('td')[0].innerHTML;
                        var result = new Object();
                        result['time'] = "";
                        result['timezone'] = "";
                        result['day'] = "";
                        result['dayIndex'] = "";
                        
                        //gets first bold tag, typically time
                        result['time'] = table[0].getElementsByTagName('b')[0].innerHTML; 
                        //gets first bracketed data (minus brackets), typically timezone
                        result['timezone'] = inner.substring(inner.indexOf("(")+1, inner.indexOf(")") );
                        
                        
                        for(var i=0,j=DAYS_OF_WEEK.length; i<j; i++){
                            var index = inner.indexOf(DAYS_OF_WEEK[i]);
                            //Checks to see if it not only exists but that it refers to the day not the location.
                              
                            if (index > 0 && index < inner.length/2 ){                               
                              result['day'] = DAYS_OF_WEEK[i];
                              result['dayIndex'] = i;
                              break;
                          }                            
                        };                                        
                    }
                } else {
                    result= "No answer found.";                    
                }
                
                if (callbackContext){
                    callback.call(callbackContext, result);                    
                } else
                  callback(result);    
                  
               my_log("Google search exiting..."); /** @TODO remove log */
            },
        
            onprogress:function(response){
                my_log("loading..."); /** @TODO remove log */
            },
            onerror: function(response){
                my_log("error!"); /** @TODO remove log */
            }
        }
        ); 
    },
    
    foo:function(){}
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////
///// End myHttpRequests
///////////////////////////////////////////////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////////////////////////////////////////////
///// Start ProfileTime object
///////////////////////////////////////////////////////////////////////////////////////////////////////////

/** Creates a profile time object. 
 * To start the function getTime(callback) must be called.
 * It first attempts to fetch the time difference from localStorage. 
 * If it cannot determine it from localStorage (or the values have expired) 
 * it will attempt to fetch via HttpRequests. Once the time difference is acquired
 * the resulting time difference will be returned via the callback.
 * @version 0.2.1
 * @this ProfileTime
 * @param {String} profileUrl The facebook profile to check time of. */
function ProfileTime(profileUrl){
    var searchString = ".com/";
    var start = profileUrl.indexOf(searchString) + searchString.length;
    
    /** The facebook profile url. */
    this.url = profileUrl;
    /** The username for this profile account. Used as storage key. */
    this.username = profileUrl.substring(start); 
    
    
    
    /** How long is a stored date valid for. 
     * Note: 86400000 milliseconds in a day. */
    var expirationThreshold = 60000; //60 seconds 
    //30000; //30 seconds //300000; //5 minutes //604800000; //7 days
    
    /** This is the object that is placed/retrieved in/from storage. */
    this.timeStatus = {hoursDiff: null, expires: null, timezone: null, lastLocation: null };
    /** Set the expiration time for timeStatus. */ 
    this.setExpirationTime = function(){ this.timeStatus.expires= (new Date()).getTime() + expirationThreshold; }        
    
    /** Returns the current time from 1970 in milliseconds. */ 
    this.getCurrentAbsTime = function(){ return (new Date()).getTime(); };
    /** The callback to send back the time. */
    this.getTimeCallback = function(){};
    my_log(this.username);
}

/** Simple toString function for debugging purposes. */
ProfileTime.prototype.toString = function() {
  return "ProfileTime";
};

//Step 4: Finish
/** The action to perform once the time attributes have been gathered. 
 * Currently commits the timeStatus to storage and calls the call back. */
ProfileTime.prototype.timeStatusAcquired = function() {
    //commit attributes
    storage.setObject(this.username, this.timeStatus);
    /** @TODO remove log */
    my_log("store valid: timeStatus: " + 
            this.timeStatus.expires + " " + this.timeStatus.hoursDiff 
            + " " + this.timeStatus.timezone + " " + this.timeStatus.lastLocation);
    this.getTimeCallback();
};

//Step 1: Start
/** Attempts to get the time by checking the cookies and parsing the time difference. 
 * If the difference is not available or too old, it is gathered from their profile page. 
 * @this ProfileTime 
 * @param {Function} callback (Optional). As the time gathering may or may not be asynchronous,
 * We do a callback to get the time. */
ProfileTime.prototype.getTime = function(callback) {
    if (callback){
        this.getTimeCallback = callback;
    }
    
    //Check to see if there's a store for this user.        
    var userStore = storage.getObject(this.username);
    if (userStore){
        this.timeStatus = userStore;
    }    
    
    if (userStore && this.checkIfTimeValid()){
        this.timeStatusAcquired();        
    } else {    
        myHttpRequests.facebookLocation(this.url, this.checkLocationTime, this);
    }    
};


/** Returns whether or not the the last retrieval was within the expirationThreshold. 
 * @return <code>true</code> if the time is still valid, 
 * <code>false</code> if expired. */
ProfileTime.prototype.checkIfTimeValid = function(){
    if (this.timeStatus){
        var expire = this.timeStatus.expires;
        var today = this.getCurrentAbsTime();
        /** @TODO remove log */
        my_log("today: " + this.getCurrentAbsTime() + "  expires: "+ this.timeStatus.expires  ); 
        return ( this.getCurrentAbsTime() < this.timeStatus.expires );            
    }    
    return false;
};


/** Returns if the location is the same as the stored location. 
 * @param {String} location The location to compare.
 * @return <code>true</code> if the location is the same. */  
ProfileTime.prototype.isSameLocation = function(location) {
    return this.timeStatus.lastLocation && 
            this.timeStatus.lastLocation === location;
};

//Step 2:
/** The action to perform once the fb check has completed. 
 * @this ProfileTime
 * @param {Object} locations Expecting an object/associative array with two members; "from" and "lives". 
 * */
ProfileTime.prototype.checkLocationTime = function(locations) {
    my_log("reached checkLocationTime: " + locations); /** @TODO remove log */
    var lives = locations.lives;
    var from = locations.from;
    my_log(lives); /** @TODO remove log */
    my_log(from); /** @TODO remove log */
    
    if (lives){
        if (this.isSameLocation(lives)){
            this.setExpirationTime();
            this.timeStatusAcquired();     
        } else {
            this.timeStatus.lastLocation = lives;
            myHttpRequests.googleCurrentTime(lives, this.processLocationTime, this);
        }
    } else if (from) {
        if (this.isSameLocation(from)){
            this.setExpirationTime();
            this.timeStatusAcquired();     
        } else {
            this.timeStatus.lastLocation = from;
            myHttpRequests.googleCurrentTime(from, this.processLocationTime, this);
        }
    } else {
        this.getTimeCallback("Location Unknown.");        
        my_log("Location Unknown."); /** @TODO remove log */
    }
};

//Step 3:
/** Processes the results of the location time search. 
 * @this ProfileTime 
 * @param {Object} results The results of the location time search. Typically of the form:
 * { time: "H:MMpm/am", timezone: "(PDT)", day: "Monday", dayIndex: 1}. 
 * @param {String} results This indicates there was no time available.  
 * */
ProfileTime.prototype.processLocationTime = function(results) {
    if (!(results instanceof Object) || !results.time ){
        this.getTimeCallback("Time Unknown.");
        my_log("Time Unknown."); /** @TODO remove log */
        return ;
    }
    my_log("reached processLocationTime");
    my_log("username still: " + this.username);
    my_log(results);    
    var today = new Date();
    var tDayIndex = today.getDay();
    
    var time = ""+results.time; 
    //Local hours & minutes.
    var lHours = time.substring(0, time.indexOf(":"));
    var lMinutes =  time.substr(time.indexOf(":")+1, 2);
    
    var minsDiff = lMinutes - today.getMinutes();
         
    if (time.toLowerCase().contains("pm") && parseInt(lHours) < 12){
        lHours = parseInt(lHours) + 12;
    } else if (lHours === 12){
        lHours = 0;
    }
    
    //whether *my* time is a day ahead (+1), behind(-1) or the same (0).
    var dayDifference = 0; 
    if (tDayIndex === results.dayIndex ){
    } else if ( tDayIndex > results.dayIndex || tDayIndex === 6 ){
        dayDifference = 1;
    } else if ( tDayIndex < results.dayIndex ||  results.dayIndex === 6){
        dayDifference = -1;
    }
    
    //-ve is behind, +ve is ahead.  
    var hoursDiff =  (today.getHours() - lHours + 24*dayDifference)%24;
    
    if (lMinutes > 50 && !today.getMinutes() ){
        //retrieved time is after 50, and the local time is on the hour
        hoursDiff -= 1; //reduce by one hour.
    }
    //reduce to either 30 or 0
    //minsDiff = Math.abs(minsDiff) > 20 ? 30 : 0;  
    this.timeStatus.hoursDiff = hoursDiff;
    this.timeStatus.timezone  = results.timezone;
    this.setExpirationTime();
    //this.timeStatus.lastLocation //set in checkLocationTime    
    
    my_log("24 hr: "+  results.day + " "+ lHours + ":" + lMinutes + " " + results.timezone);
    my_log("difference: " + hoursDiff +" hrs " + minsDiff +" minutes");
    this.timeStatusAcquired();
};


///////////////////////////////////////////////////////////////////////////////////////////////////////////
///// End ProfileTime
///////////////////////////////////////////////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////////////////////////////////////////////
///// Start TimeToolTip object
///////////////////////////////////////////////////////////////////////////////////////////////////////////

/** Creates a time tooltip to display time.
 * The initial state of the tool tip is to display: 
 * 
 * The time is acquired via ProfileTime.
 * 
 * @version 0.1.0
 * @this ProfileTime
 * @param {Element} nameLink The DOM object with their profile link and name. */
function TimeToolTip(nameLink){
    var url = nameLink.getAttribute("href");
    var name = "" + nameLink.innerHTML;
    //To say "Bob's time: " or "Jess' time: "
    var firstNamePossessive = name.substring(0, name.indexOf(" ")); 
    if (firstNamePossessive.indexOf("s") === firstNamePossessive.length -1){
        firstNamePossessive += "'"; // Jess' time
    } else {
        firstNamePossessive += "'s" //Bob's time
    }
    
    var colour = "red";
    var toopTipStyle =  "border: 10px "+colour+" solid;" + 
                        "border-radius: 10px; background:"+ colour +"; font: white;"
    var timeStyle = "font-style: italic;"
    var bottomTriangleStyle =   "border-left: 10px transparent solid; "+
                                "border-right: 10px transparent solid; "+
                                "border-top: 10px "+colour+" solid; width: 0px;";
     
    var toolTip = document.createElement("div");
        toolTip.setAttribute("style", toopTipStyle);
        toolTip.innerHTML = firstNamePossessive + " time:";
        /** @TODO add tooltip triangle */
    var timeElement = document.createElement("span");
        timeElement.setAttribute("style", timeStyle);
        
        timeElement.innerHTML = "Loading...";
        
        toolTip.appendChild(timeElement);
    
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////
///// End TimeToolTip
///////////////////////////////////////////////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////////////////////////////////////////////
///// Start pageMonitor
///////////////////////////////////////////////////////////////////////////////////////////////////////////    


/* NOTE: 
 * -class="fbChatTab" defines the entire chat window 
 * -class="titlebarText" defines <a href> objects for the actual name
 * in chat windows.
 */ 
 
/** Responsible for checking the page for changes and attaching events.
 * @version 0.2.0 */
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
        my_log("registering..."); /** @TODO remove log */
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
        pageMonitor.isCheckingChats = true; //this prevents multiple calls running over each other.
        my_log("checking chats..."); /** @TODO remove log */
        
        var checkedSet = document.getElementsByClassName(pageMonitor.checkedClass);
        
        if (!pageMonitor.chatSet){ //on first run
            my_log("setting"); /** @TODO remove log */
            //we slice to get a copy/clone rather than a reference.
            pageMonitor.chatSet = [].slice.call(checkedSet);             
        } else {
            var changed = checkedSet.length !== pageMonitor.chatSet.length ? true : false;
            for(var i=0,j=checkedSet.length; i<j; i++){               
              if ( checkedSet[i] !== pageMonitor.chatSet[i] ){
                  my_log("different item at "+ i); /** @TODO remove log */
                  changed=true;
              }
            };
            //if changed, we recopy and continue.
            if (changed){
                pageMonitor.chatSet = [].slice.call(checkedSet);
                my_log("new set!");           /** @TODO remove log */
            } else { //nothing has changed.
                pageMonitor.isCheckingChats = false;
                return;
            }
        }
        
        pageMonitor.isCheckingChats = false;        
        
        //changes happened so we do things
        for(var i=0,j=checkedSet.length; i<j; i++){
           // myHttpRequests.facebookLocation(checkedSet[i].getAttribute("href"), pageMonitor.checkLocationTime);
           var time = new ProfileTime(checkedSet[i].getAttribute("href"));
           time.getTime();
        
            my_log("checkedSet name: " + checkedSet[i].innerHTML +
                  "url: " + checkedSet[i].getAttribute("href")  ); /** @TODO remove log */
        };
        
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
};

//start monitoring
pageMonitor.start();
//Reset script
//storage.eraseStorage();
