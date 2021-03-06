// ==UserScript==
// @name        fb_their_time
// @namespace   ovrhere.com
// @author      Jason J
// @description Provides a simple tool tip to display a contacts current time.
// @include     https://www.facebook.com/*
// @include     http://www.facebook.com/*
// @exclude     /^https?://www\.facebook\.com/((xti|ai)\.php|.*?\.php.*?[\dA-z_\-]{40})/
// @version     0.2.7
// @grant       GM_xmlhttpRequest
// @grant       unsafeWindow
// ==/UserScript==

/** 
 * Now excluding the xti.php, ai.php and all other very long query strings.
 * */

var DEBUGGING = false;
var VERBOSE = false;
var NO_CACHE = false;

/** Convience function for debugging. 
 * @param {string} message The message to output.
 * @param {bool} isVerbose Whether or not this message is to be considered verbose. 
 * Default is <code>false</code> 
 * @see DEBUGGING
 * @see VERBOSE */
 my_log = function (message, isVerbose) { 
    if (DEBUGGING){
        if (isVerbose && !VERBOSE ){ 
            //if verbose, but verbosity is off. 
            return;
        }
        unsafeWindow.console.log(message);         
    }
};
my_log('Logging turned on');
/** Days of the week as given by Google, ordered: Sunday is [0]. */
var DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];


/** Work around for the bug:<br/>
 * <b>Error: Greasemonkey access violation: unsafeWindow cannot call 
 * <code>GM_xmlhttpRequest</code></b>
 * @param {Object} content The request content to pass onto GM_xmlhttpRequest.
 */
//see: http://wiki.greasespot.net/Greasemonkey_access_violation
function myGM_xmlhttpRequest(content){
    setTimeout(function() {
       GM_xmlhttpRequest(content);
    }, 0);
 }

////////////////////////////////////////////////////////////////////////////////////////////////////////
///// Start storage object
////////////////////////////////////////////////////////////////////////////////////////////////////////
//fix for bug with Firefox 29.
// See: http://stackoverflow.com/questions/23269532/localstorage-in-firefox-extension-throws-the-operation-is-insecure-exception
var localStorage = unsafeWindow.localStorage;

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
        my_log("storage: Erased");
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
                my_log("storage: Error occurred: " + e );                                
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
                my_log("storage: Error occurred: " + e);
                return null;                
            }
        }
       return null;
    }
};


////////////////////////////////////////////////////////////////////////////////////////////////////////
///// End storage
////////////////////////////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////////////////////////////
///// Start myHttpRequests object
////////////////////////////////////////////////////////////////////////////////////////////////////////

/** Handles httpRequests to facebook and google. 
 * @version 0.6.1 */
myHttpRequests = {
    /** The Facebook class used to contain "about me" summaries on the front page. */
    fb_aboutClass: '_50f3',
        
    
    /** The Google query stub to determine a location's time. */
    google_queryStub: 'current time in ', 
   
   /** The Google container class to find the time-answer in. 
     * If this does not exists the answer is not simple. */
    google_containerClass: 'g',
    /** The Google OLD container class to find the time-answer in. 
     * If this does not exists the answer is not simple. */
    google_containerClass1: 'obcontainer',
    
    /** 
     * Gathers the location from the DOM. 
     * @param {DOM} dom The dom the analise and check.       
     * @return {Object} An Object of the form:
     * { lives: "Lives in String", from: "From String"}. The default values are blank strings.
     * */
    fbLocationFromDOM:function(dom){
        var aboutPerson = dom.getElementsByClassName(myHttpRequests.fb_aboutClass);
        var livesIn = ""; 
        var fromLoc = "";
        
        my_log("fbLocationFromDOM: aboutPerson: " + 
                aboutPerson + " " + aboutPerson.length, true); 
        
        for (var i = aboutPerson.length - 1; i >= 0; i--){
          
	  my_log("fbLocationFromDOM: " + aboutPerson[i].innerHTML);
	  
	  if (0 === livesIn.length) { //if unset
	    livesIn = myHttpRequests.extractLocation(aboutPerson[i], "Lives in");
	  }
	  if (0 === fromLoc.length) { //if unset
	    fromLoc = myHttpRequests.extractLocation(aboutPerson[i], "From");
	    if (fromLoc.length === 0){
              //if STILL empty, try "Also from"
              fromLoc = myHttpRequests.extractLocation(aboutPerson[i], "Also from");
	    }
	  }	  
          
          if (fromLoc.length > 0 && livesIn.length > 0){
             //if non-empty locations; 
             break;
          }//at this point, we have them both
              
        };
        
        my_log("fbLocationFromDOM: lives->" +livesIn+", from->"+fromLoc, true);
        return { lives: livesIn, from: fromLoc };
    },
    
    /**
     * Extracts the location from the facebook dom.
     * 
     * @param {Element|Object} parentDom The parent dom object to check
     * @param {String} searchString The search string to look for;
     * e.g. "Lives in", "From", "Also from"
     * @returns {String} The location from the dom
     */
    extractLocation:function(parentDom, searchString){
        var string = "" + parentDom.innerHTML;
        
        if (string.contains(searchString, 0)){
            try {
              return parentDom.getElementsByTagName('a')[0].innerHTML;

            } catch (e){
              /* if we failed, there must be no link. 
               * Perhaps it's just one string? Try to split on search string.    */
              return string.split(searchString)[1]; 
            }
        }
        return "";
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
     * @param {BinaryCallback} callback Contains the functions to call on
     * success or failure. 
     * <br/>On success: 
     * Expects one parameter: Object/Associative array. Where the members are:
     * {lives: "Lives in String", from: "From String" }.
     * <br/>On failure; failure is called.
     *  
     * */
    facebookLocation:function(dest, callback) {
        my_log("facebookLocation: trying "+dest); 
                
        myGM_xmlhttpRequest({
          method: "GET",
          url: dest,
          headers: {
            "User-Agent": "Mozilla/5.0",    // If not specified, navigator.userAgent will be used.
            "Accept": "text/html"            // If not specified, browser defaults will be used.
          },
          onload: function(response) {
            my_log("facebookLocation: onload-starting response("+dest+")", true);            
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
                
                callback.onSuccess.call(callback, locs);               
                 
                my_log("facebookLocation: exiting... "); 
                   
            },
            
            onprogress:function(response){
                my_log("facebookLocation: loading...", true); 
            },
            onerror: function(response){
                my_log("facebookLocation: error!"); 
                callback.onFailure.call(callback);
            }
        }
        );  
    my_log("facebookLocation: GM_xmlhttpRequest sent ("+dest+")", true); 
    },
    
    /** 
     * Attempts to google the location to get the current time there.
     * 
     * @param {String} location The location to search and check the time of.
     * @param {BinaryCallback} callback Contains the functions to call on
     * success or failure. 
     * <br/>On success: 
     * Will pass parameter {Object} of the form:
     * { time: "H:MMpm/am", timezone: "(PDT)", day: "Monday", dayIndex: 1 }, 
     * where the default values are blank strings. 
     * May also pass a string if there are no results.
     * <br/>On failure; failure is called.
     *   
     * */
    googleCurrentTime:function(location, callback) {
        var dest = "http://www.google.com/search?q=" +myHttpRequests.google_queryStub + location;
        
        myGM_xmlhttpRequest({
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
                my_log('Loading Google request for: "' + location + '"');
                my_log("Full response: " + responseXML.documentElement.innerHTML, true);
                var result = new Object();
                var answer = responseXML.documentElement
                        .getElementsByClassName(myHttpRequests.google_containerClass);
                //for fallback reasons.
                var answer1 = responseXML.documentElement
                        .getElementsByClassName(myHttpRequests.google_containerClass1);
                
                if (answer && answer.length){
                    result = myHttpRequests.extractionMethod2(answer);                        
                } else if (answer1 && answer1.length){                
                    result = myHttpRequests.fallbackExtractionMethod1(answer1);
                } else {
                    result= "No answer found.";                    
                }
                
                callback.onSuccess.call(callback, result);                    
                  
                my_log("Google search exiting...");
            },
        
            onprogress:function(response){
                my_log("googleCurrentTime: loading...");
            },
            onerror: function(response){
                my_log("googleCurrentTime: error!"); 
                callback.onFailure.call(callback);                    
            }
        }
        ); 
    },
    /** New extraction method to deal with changes of the DOM.
     * No more tables.
     * @param {Array} answer Array of elements
     * @returns {myHttpRequests.extractionMethod2.result|Object}
     */
    extractionMethod2:function(answer, result){
        var result = new Object();
        var container = answer[0]; //first item

        //initialize
        result['time'] = "";
        result['timezone'] = "";
        result['day'] = "";
        result['dayIndex'] = "";

        //grabbing the time items via classes. Redundancy for robustness.
        var timeItem = container.getElementsByClassName('_rkc');
        var timeItem2 = container.getElementsByClassName('_Peb');

        if (timeItem && timeItem.length){
            result['time'] = timeItem[0].innerHTML;
        } else if (timeItem2 && timeItem.length){
            result['time'] = timeItem2[0].innerHTML;
        }
        var inner = container.innerHTML;
        
        //gets first bracketed data (minus brackets), typically timezone
        result['timezone'] = inner.substring(inner.indexOf("(")+1, inner.indexOf(")") );


        for(var i=0,j=DAYS_OF_WEEK.length; i<j; i++){
            var index = inner.indexOf(DAYS_OF_WEEK[i]);
            //Checks to see if it not only exists but that it refers to the day 
            // not a location by ensuring it does NOT occur in the last third.
            if (index > 0 && index < inner.length*0.66 ){                               
              result['day'] = DAYS_OF_WEEK[i];
              result['dayIndex'] = i;
              break;
          }                            
        }; 
        return result;
    },
    /** Deprecated. Major DOM changes have made this useless.
     * This was the first old method of extraction; kept as a fall-back.
     * @param {Array} answer Array of elements.   
     * @return {myHttpRequests.fallbackExtractionMethod1.result|Object} */
    fallbackExtractionMethod1:function(answer){
        var result = new Object();
        var table = answer[0].getElementsByTagName('table'); //check first item
        if (table && table.length){
            var inner = "" + table[0].getElementsByTagName('td')[0].innerHTML;
            
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
                //Checks to see if it not only exists but that it refers 
                //to the day not the location.

                if (index > 0 && index < inner.length/2 ){                               
                  result['day'] = DAYS_OF_WEEK[i];
                  result['dayIndex'] = i;
                  break;
              }                            
            };                                        
        }
        return result;
    },
    
    foo:function(){}
};

////////////////////////////////////////////////////////////////////////////////////////////////////////
///// End myHttpRequests
////////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////////
///// Start CallbackInterface object
////////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Creates a new BinaryCallback object; where there is a callback for
 * success or failure.
 * 
 * @param {Object} context The callback context for the two functions.
 * @param {Function} onSuccess The callback for success. can receive ONE argument.
 * @param {Function} onFailure The callback for failure. can received ONE argument.
 *
 * @version 0.1.0
 * @this CallbackInterface
 */
function BinaryCallback(context, onSuccess, onFailure){
    this.callbackContext = context;
    this.successCallback = onSuccess;
    this.failureCallback = onFailure;
}

/** Simple toString function for debugging purposes. */
BinaryCallback.prototype.toString = function() {
    return "BinaryCallback("+this.callbackContext+")";
};

/** The function called on success. Accepts <b>one</b> parameter.
 * @param {Object} param (Optional). The parameter to send back. 
 */
BinaryCallback.prototype.onSuccess = function(param) {
    this.successCallback.call(this.callbackContext, param);
};

/** The function called on failure. Accepts <b>one</b> parameter.
 * @param {Object} param (Optional). The parameter to send back. 
 */
BinaryCallback.prototype.onFailure = function(param) {
    this.failureCallback.call(this.callbackContext, param);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////
///// End Callback object
////////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////////
///// Start ProfileTime object
////////////////////////////////////////////////////////////////////////////////////////////////////////

/** Creates a profile time object. 
 * To start the function getTime(callback) must be called.
 * It first attempts to fetch the time difference from localStorage. 
 * If it cannot determine it from localStorage (or the values have expired) 
 * it will attempt to fetch via HttpRequests. Once the time difference is acquired
 * the resulting time difference will be returned via the callback.
 * @version 0.3.0
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
    var expirationThreshold = 604800000; //7 days
    //30000; //30 seconds //300000; //5 minutes //604800000; //7 days
    
    /** The callback after facebook location is found. BinaryCallback. */
    this.facebookLocationCallback = 
            new BinaryCallback(
                this, 
                this.checkLocationTime, 
                function(){this.onFailure("'Facbook location check' failed");});
    this.locationTimeCallback = 
            new BinaryCallback(
                this, 
                this.processLocationTime, 
                function(){this.onFailure("'Location time check' failed");});                
    
    /** This is the object that is placed/retrieved in/from storage. */
    this.timeStatus = {
        /** Expects +ve if the timezone is behind:
         * -8am here, 4am there --> -4. 
         * @type number */
        hoursDiff: null, 
        /** Expects +ve if the timezone is behind:
         * -8am here, 4am there --> -240.
         * @type number */
        totalMinsDiff: null, 
        /** When the time will expire. 
         * @type number */
        expires: null, 
        /*** @type string The timezone to show */
        timezone: null, 
        /** @type string The last known location. */
        lastLocation: null 
    };
    /** Set the expiration time for timeStatus. */ 
    this.setExpirationTime = function(){ 
        this.timeStatus.expires= (new Date()).getTime() + expirationThreshold; 
    };        
    
    /** Returns the current time from 1970 in milliseconds. */ 
    this.getCurrentAbsTime = function(){ return (new Date()).getTime(); };
    /** The callback to send back the time. 
     * @type BinaryCallback */
    this.getTimeCallback = {};
    
    my_log("ProfileTime:"+ this.username);
}

/** Simple toString function for debugging purposes. */
ProfileTime.prototype.toString = function() {
  return "ProfileTime("+this.username+")";
};

/** Generic failure of the request. 
 * @param {string} message The failure message. */
ProfileTime.prototype.onFailure = function(message) {
    my_log("failure:  " +message);
};

//Step 4: Finish
/** The action to perform once the time attributes have been gathered. 
 * Currently commits the timeStatus to storage and calls the call back. */
ProfileTime.prototype.timeStatusAcquired = function() {
    //commit attributes
    storage.setObject(this.username, this.timeStatus);
    
    my_log("ProfileTime: store valid: timeStatus: " + 
            this.timeStatus.expires + " " + this.timeStatus.hoursDiff + " "+ 
            this.timeStatus.totalMinsDiff + " " + 
            this.timeStatus.timezone + " " + this.timeStatus.lastLocation,
            true);
    
    var minsDiff = parseInt(this.timeStatus.totalMinsDiff);
    var hoursDiff = Math.floor(parseInt(this.timeStatus.totalMinsDiff)/60);
    minsDiff = minsDiff - 60* hoursDiff;
    var now = new Date();
    var date = new Date();
    date.setHours(now.getHours() + hoursDiff);
    date.setMinutes(now.getMinutes() + minsDiff);
    var result = {
        date: date,
        hoursDiff: hoursDiff, 
        minsDiff: minsDiff, 
        timezone: this.timeStatus.timezone
    };
    my_log(result);
    if (this.getTimeCallback){
        this.getTimeCallback.onSuccess.call(this.getTimeCallback, result);  
    }
};

//Step 1: Start
/** Attempts to get the time by checking the cookies and parsing the time difference. 
 * If the difference is not available or too old, it is gathered from their profile page. 
 * <br/><br/>
 * The time is returned in the callback in the form: 18:45 PST
 * 
 * @this ProfileTime 
 * @param {BinaryCallback} callback As the time gathering is asynchronous,
 * We do a callback to get the time. 
 * 
 * Callback either expects string or object with the form:
 * {date: Date, hoursDiff: 0, minsDiff: 0, timezone: 'string'}. */
ProfileTime.prototype.getTime = function(callback) {
    if (callback){
        this.getTimeCallback = callback;
    }
    
    //Check to see if there's a store for this user.        
    var userStore = storage.getObject(this.username);
    if (userStore){
        this.timeStatus = userStore;
    }    
    
    if (userStore && this.checkIfTimeValid() && !NO_CACHE){
        this.timeStatusAcquired();        
    } else {    
        myHttpRequests.facebookLocation(this.url, this.facebookLocationCallback);
    }    
};


/** Returns whether or not the the last retrieval was within the expirationThreshold. 
 * @return <code>true</code> if the time is still valid, 
 * <code>false</code> if expired. */
ProfileTime.prototype.checkIfTimeValid = function(){
    if (this.timeStatus){
        my_log("ProfileTime: today: " + this.getCurrentAbsTime() + 
                "  expires: "+ this.timeStatus.expires  ); 
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
    my_log("ProfileTime: reached checkLocationTime: " + locations);
    var lives = locations.lives;
    var from = locations.from;
    my_log(lives, true);
    my_log(from, true); 
    
    //We prefer to get the time on where they live, but if not, where they are from
    if (lives){
        if (this.isSameLocation(lives)){ //if same location, we are finish.
            this.setExpirationTime();
            this.timeStatusAcquired();  
        } else {//if new location, get a new time.
            this.timeStatus.lastLocation = lives;
            myHttpRequests.googleCurrentTime(lives, this.locationTimeCallback);
        }
    } else if (from) {
        if (this.isSameLocation(from)){
            this.setExpirationTime();
            this.timeStatusAcquired();     
        } else {
            this.timeStatus.lastLocation = from;
            myHttpRequests.googleCurrentTime(from, this.locationTimeCallback);
        }
    } else {
        this.failedRequest("Location Unknown.");    
        my_log(''+this+": Location Unknown."); 
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
        this.failedRequest("Time Unknown.");  
        my_log(''+this+": Time Unknown."); 
        return ;
    }
    my_log(''+this+": reached processLocationTime");
    my_log(results, true);    
    
    var today = new Date();
    var tDayIndex = today.getDay();
    
    //my time.
    var time = ""+results.time; 
    //Their hours & minutes.
    var theirHours = time.substring(0, time.indexOf(":"));
        theirHours = parseInt(theirHours);
    var theirMinutes =  time.substr(time.indexOf(":")+1, 2);
        theirMinutes = parseInt(theirMinutes);
    
         
    //Convert to 24 time.
    if (time.toLowerCase().contains("pm") ){
        if (theirHours < 12){
            theirHours = theirHours + 12;
        }   //let 12pm be 12pm.
    } else if (theirHours === 12){
        theirHours = 0;
    }
    
    //whether *my* time is a day ahead (+1), behind(-1) or the same (0).
    var dayDifference = 0; 
    if (tDayIndex === results.dayIndex ){
    } else if ( tDayIndex > results.dayIndex || 6 === tDayIndex ){
        //if Saturday here, or here is "tomorrow".
        dayDifference = 1;
    } else if ( tDayIndex < results.dayIndex || 6 === results.dayIndex){
        //if Saturday *there*, or *there* is "tomorrow"
        dayDifference = -1;
    }
    
    //-ve is behind, +ve is ahead.  
    var hoursDiff =  (today.getHours() - theirHours + 24*dayDifference)%24;
    if (theirMinutes > 55 && today.getMinutes() === 0 ){
        //retrieved time is after 55, and the local time is on the hour
        hoursDiff -= 1; //reduce by one hour, as they are at xx:59
    }
    
    var theirTotalMins = (theirHours + 24*dayDifference)%24 * 60 + theirMinutes;
    var myTotalMins = today.getHours() * 60 + today.getMinutes();
    
    my_log("difference: theirTotalMins=" + theirTotalMins +" myTotalMins=" + myTotalMins +" ");
    
    //-ve is behind, +ve is ahead.  
    var minsDiff = myTotalMins - theirTotalMins ;
    //Round mins difference to closest 5, keeping sign.
    minsDiff = (minsDiff < 0 ? -1 : 1) * Math.ceil(Math.abs(minsDiff)/5)*5; 
    
    this.timeStatus.totalMinsDiff = -1*minsDiff;
    this.timeStatus.hoursDiff = -1*hoursDiff;
    this.timeStatus.timezone  = results.timezone;
    this.setExpirationTime();
    //this.timeStatus.lastLocation //set in checkLocationTime    
    
    my_log("24 hr: "+  results.day + " "+ theirHours + ":" + theirMinutes + " " + results.timezone);
    my_log("difference: " + -1*hoursDiff +" hrs " + -1*minsDiff +" minutes");
    this.timeStatusAcquired();
};
/**
 * Safe way of calling failure callback.
 * @param {String} message The message to pass on to onFailure.
 */
ProfileTime.prototype.failedRequest = function(message){
    if (this.getTimeCallback){
        this.getTimeCallback.onFailure.call(this.getTimeCallback, message);    
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////
///// End ProfileTime
////////////////////////////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
//// Start Util object
////////////////////////////////////////////////////////////////////////////
/**
 * A singleton object containing helpful utility functions.
 * @type Utils (Static)
 * @version 0.1.0
 */
util = {
    /**
     * 
     * @param {node} child
     * @param {string} classname
     * @param {number} depth The number of ancestors to check before giving up.
     * <= 0 will go until it reaches <code>body</code>. Default is 10.
     * @returns {node} The ancestor if found or 0 if not found
     */
    getAncestorByClassName:function(child, classname, depth){
        if (typeof depth === 'undefined') {
            depth = 10;
        }
        my_log("getAncestorByClassName: "+child.innerHTML);
        var classRegEx = new RegExp("(^| )"+classname+"( |$)");
        var parent = child.parentNode;
        if (depth <= 0){
            do {
                if (classRegEx.test(parent.getAttribute('class'))){
                    return parent;
                }
                parent = parent.parentNode;
            } while(parent.tagName.toLowerCase() !== 'body');
        } else {
            for (var parentCount = depth; parentCount >= 0; parentCount--){
                if (classRegEx.test(parent.getAttribute('class'))){
                    return parent;
                }
                parent = parent.parentNode;
            }
        }
        return 0;
    },
    /**
     * Returns the passed number as a zero padded number. 
     * @param {number/string} number The number to pad with leading zeroes
     * @param {number} length The amount of numbers to have.
     * @returns {string} The padded number as a string.
     */
    leadingZeroPad:function(number, length){
        var result = ''; 
        number = ''+number;
        for(var zeroes = 0, SIZE = length - number.length ; zeroes < SIZE; zeroes++){
            result+='0';
        }
        return result + number;
    }
};

////////////////////////////////////////////////////////////////////////////
//// End util object
////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////////
///// Start TimeToolTip object
////////////////////////////////////////////////////////////////////////////////////////////////////////

/** 
 * Fetches and displays the local time of the passed namelink. 
 * Times are shown by hovering over the chatbox.
 * <br/>
 * Currently uses facebook's tooltip, can always fall back to the title 
 * solution (2.3) in a pinch.
 * <br/>
 * The initial state of the tool tip is to display: 
 * "Bob's time: Loading..." and upon successfully getting a time:
 * "Bob's time: 23:00 CET"
 * <br/>
 * On failure it reads: "Cannot determine Bob's time =(".
 * <br/>
 * The time is acquired via ProfileTime.
 * <br/>
 * 
 * @version 0.3.2
 * @this TimeToolTip
 * @param {node} nameLink The DOM object with their profile link and name. */
function TimeToolTip(nameLink){
    var hrefUrl = nameLink.getAttribute("href");
    
    var name = "";
    var nameDom = nameLink; 
    while (nameDom.getElementsByTagName('span').length > 0) {
	nameDom = nameDom.getElementsByTagName('span')[0];
    }
    //bottom span, now get the name.
    name = nameDom.innerHTML;
    nameDom = 0;
    
    //To say "Bob's time: " or "Jess' time: "
    this.firstNamePossessive = name.substring(0, name.indexOf(" ")); 
    if (this.firstNamePossessive.indexOf("s") === this.firstNamePossessive.length -1){
        this.firstNamePossessive += "'"; // Jess' time
    } else {
        this.firstNamePossessive += "'s"; //Bob's time
    }
        
    /** @type number The difference in the local Date from their date in milliseconds. 
     * That is: <code>new Date().getTime()  - Foreign.getTime()</code>.
     * Default is <code>false</code> Can be 0.. */
    this.datedifference = 0;          
    /** @type String The current timezome for this chatbox. Default is 0. */
    this.timezone = 0;
    
    /** @type String Public reference to the url. */           
    this.url = hrefUrl;
    /** @type node The chat container parent. */
    this.chatContainer = util.getAncestorByClassName(nameLink, 'fbNub', 20);
    /** The title bar of the chat window when open. Default 0.
     * @type node */
    this.chatTitleOpen = 0;
    /** The title bar of the chat window when minimized. Default 0.
     * @type node */
    this.chatTitleMin = 0;
  
    
    /** The interval reference. Default is 0. */
    this.updateTimeInterval = 0;
    var mouseoverfunc = function() {
                                my_log("mouseoverfunc", true); 
                                /* This updates the DOM but does not update the visible text. 
				 * this._TimeToolTip.startTimeUpdateInterval(); */
				  this._TimeToolTip.timeUpdate();
                            };
    var mouseoutfunc = function() {
                                my_log("mouseoutfunc", true);
                            };
    
    if (this.chatContainer ){
        this.chatContainer['_TimeToolTip'] = this;
        this.chatContainer.addEventListener(
                            'mouseover', 
                            mouseoverfunc, 
                            false);
	this.chatContainer.addEventListener(
                            'mouseout', 
                            mouseoutfunc,
                            false);
	
       var cTitleOpen =   this.chatContainer.getElementsByClassName('titlebarTextWrapper');
       if (cTitleOpen.length > 0){
           this.chatTitleOpen = cTitleOpen[0];
       }
       var cTitleMin =   this.chatContainer.getElementsByClassName('name');
       if (cTitleMin.length > 0){
           //we want the grandparent, and this is the fastest route.
           this.chatTitleMin = cTitleMin[0].parentNode.parentNode;
       }
    } else {
        my_log(this+": No chat container found");
    }
    var timecallback = new BinaryCallback(
            this,
            function(param){
                my_log("success!: ");
                this.datedifference = new Date().getTime() - param['date'].getTime();
                this.timezone = param['timezone'];
                my_log(this.date);
                my_log(this.timezone);
                this.timeUpdate();
            },
            function(param){
                if ( this.chatContainer){
                    this.chatContainer.removeEventListener('mouseover',
                            mouseoverfunc);
		    this.chatContainer.removeEventListener('mouseout',
                            mouseoutfunc);
                }
                this.updateTimePhrase("Cannot determine "+this.firstNamePossessive+" time =(");                
            }
    );
    
    var time = new ProfileTime(hrefUrl);
        time.getTime(timecallback);
    
    //Show or hide a styled tool tip at the mouse location.
    /* nameLink.parentNode
            .addEventListener(
                'mouseover', 
                function(evt) {
                    my_log("event: "+evt.target);
                    my_log("event: "+evt.clientX +","+evt.clientY);
                }, false); */    
}
/**Simple toString function for debugging purposes.
 *  @returns {String} The class name and url for this object.
 */
TimeToolTip.prototype.toString = function(){
    return "TimeToolTip["+this.url+"]";
};

/**
 * Starts the time interval to update the time display. */
TimeToolTip.prototype.startTimeUpdateInterval = function(){
    var self = this;
    this.updateTimeInterval = setInterval(
            function(){
	      
                //if the chat window still exists.
                if(self.chatContainer){
                    my_log(self + "startTimeUpdateInterval - update", true);
                    self.timeUpdate();
                } else {		  
                    my_log(self + "startTimeUpdateInterval - cancel", true);
                    //if not, we have no need to update time.
                    clearInterval(self.updateTimeInterval);
                }
            },
            1000
            );
};

/**
 * Updates the time display.  */
TimeToolTip.prototype.timeUpdate = function(){
    //if the chat window still exists.
    if(this.chatContainer){
        my_log(this + ": trying to update time", true);
        var timePhrase = this.firstNamePossessive + " time: ";
        if (this.datedifference !== false && this.timezone){
            //We subtract as we subtracted in this order before. 
            var date = new Date(new Date().getTime() - this.datedifference);
            timePhrase+= 
                    util.leadingZeroPad(date.getHours(), 2)+":"+
                    util.leadingZeroPad(date.getMinutes(), 2)+":"+
                    util.leadingZeroPad(date.getSeconds(), 2)+
                    " "+this.timezone;
        } else {
            timePhrase+= " Loading...";
        }
        this.updateTimePhrase(timePhrase);
    } else {
        my_log(this + ": cannot update time", true);
    }
};
/**
 * Updates the timephrase where ever it is displayed.
 * @param {String} timePhrase The time phrase to update.
 */
TimeToolTip.prototype.updateTimePhrase = function(timePhrase){
    if (this.chatContainer){
        /** @todo insert image for time and attach tooltip to that. */
        //this.chatContainer.setAttribute('title', timePhrase);
        this.chatTitleMin.setAttribute('title', timePhrase);
        //this.chatTitleMin.setAttribute('aria-label', timePhrase);
        //this.chatTitleMin.setAttribute('data-hover', 'tooltip');
        this.chatTitleOpen.setAttribute('aria-label', timePhrase);
        this.chatTitleOpen.setAttribute('data-hover', 'tooltip');
        my_log(this + ": updateTimePhrase - " +timePhrase, true);
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////
///// End TimeToolTip
////////////////////////////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////////////////////////////
///// Start pageMonitor
////////////////////////////////////////////////////////////////////////////////////////////////////////    


/* NOTE: 
 * -class="fbChatTab" defines the entire chat window 
 * -class="titlebarText" defines <a href> objects for the actual name
 * in chat windows.
 */ 
 
/** Singleton.
 * Responsible for checking the page for changes and attaching events.
 * @version 0.2.4 */
pageMonitor = {
    /** Check frequency in milliseconds. */
    checkFrequency: 5000,
    /** Used for canceling the checking. */
    checkInterval: 0,
    
    /** The current chat set. */
    chatSet: 0,
    /** The chat pagelet container. */
    chatPagelet: 0, 
    
    /** Mirror classes to maxChat's; contains the minimized names.  */
    minChatClass: 'name',
    /**The class that is checked in #checkChats(). 
     * Contains the names (Maximized)  */
    maxChatClass: 'titlebarText',
    /** The pagelet's id to monitor. */
    chatPageletId: 'ChatTabsPagelet',
    
    /** Whether or not currently fetching. */
    fetching: false,
    /** Whether or not we are currently checking the chats. */
    isCheckingChats: false,
    
    /** 
     * Once registered, we set event listeners to fire onDOMNodeInserted and onDOMNodeRemoved to  
     * call #pageMonitor.checkChats 
     * @param Object|pageMonitor parent (optional) Used as an accurate reference,
     * for recursive calls. If unset, sets it. */
    registerPagelet:function(parent){
        if (!parent){
            parent = pageMonitor;
        }
        my_log('location test: ' + window.location);
        if (!parent.chatPagelet){
            var e = document.getElementById(parent.chatPageletId);
            if ( e && !e.pageMonitor_registered_and_checked){
                parent.chatPagelet = e;  
                /** @todo Dom mutation events are deprecated; replace with dom mutations. */
                e.addEventListener ("DOMNodeInserted", function(){ parent.checkChats();}, false);
                e.addEventListener ("DOMNodeRemoved", function(){ parent.checkChats(); }, false);
                my_log('registerPagelet: event added');
                parent.checkChats();
                e.pageMonitor_registered_and_checked = true;
                return; 
            } else { //in case the page has yet to load.
                //window.addEventListener('load', function() {pageMonitor.registerPagelet(); my_log('registerPagelet: On load');}, false);
                //chats are not inserted on page load; keep checking. 
                setTimeout(function() {parent.registerPagelet(parent); 
                            my_log('registerPagelet: On load');}, 800);                
            }
        } 
        
    },
    
    /** Checks to see current chat's open and registers/deregisters 
     * their 'onhover' events. */
    checkChats:function(){
        if(pageMonitor.isCheckingChats) return; 
        //this prevents multiple calls running over each other when using intervals.
        pageMonitor.isCheckingChats = true; 
        my_log("checkChats: start..."); 
        
        var checkedSet = document.getElementsByClassName(pageMonitor.maxChatClass);
        
        if (!pageMonitor.chatSet){ //on first run
            my_log("setting", true); 
            //we slice to get a copy/clone rather than a reference.
            pageMonitor.chatSet = [].slice.call(checkedSet);             
        } else {
            my_log("comparing sets... (" + checkedSet.length+") " +
                    " ("+pageMonitor.chatSet.length+")",
                    true);
            var changed = checkedSet.length !== pageMonitor.chatSet.length ? true : false;
            for(var index=0,SIZE=checkedSet.length; index<SIZE; index++){               
              if ( checkedSet[index] !== pageMonitor.chatSet[index] ){
                  my_log("different item at "+ index, true);
                  changed=true;
              }
            };
            
            //if changed, we recopy and continue.
            if (changed){
                pageMonitor.chatSet = [].slice.call(checkedSet);
                my_log("new set!", true);        
            } else { //nothing has changed.
                pageMonitor.isCheckingChats = false;
                return;
            }
            
        }
        
        pageMonitor.isCheckingChats = false;        
                
        my_log('checkedSet length: '+ checkedSet.length);
        //we have new chat windows, so we have work to do.
        for(var index=0,SIZE=checkedSet.length; index<SIZE; index++){
            try {
                my_log('Index['+index+ ']: attempting: attemptToolTip', true);
                pageMonitor.attemptToolTip(checkedSet[index], 600);
            } catch (e){
                my_log('Index['+index+ '] An error occured : ' + e);
            }           
        };
    },
    /**
     * Attempts to create tool tip, if not found retries in retryTime
     * @param {Element} checkedLink The &lt;a&gt; element
     * @param {Number} retryTime The delay before retring in milliseconds
     * @returns {undefined}
     */
    attemptToolTip: function(checkedLink, retryTime){
        var hrefUrl = checkedLink.getAttribute("href");
        var name = "" +checkedLink.innerHTML; 

        my_log('attemptToolTip: '+ checkedLink.outerHTML);
        if (!hrefUrl || !name){
            //we have blanks, so we must retry.
            setTimeout(function(){pageMonitor.attemptToolTip(checkedLink, retryTime);}, retryTime);
        } else {
            new TimeToolTip(checkedLink);
        }
    },
    
    
    /** Starts the monitor. */ 
    start:function(){
        pageMonitor.registerPagelet();
        //pageMonitor.checkInterval = setInterval(this.checkChats, this.checkFrequency, null);
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