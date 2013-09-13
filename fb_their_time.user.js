// ==UserScript==
// @name        fb_their_time
// @namespace   ovrhere.com
// @author      Jason J
// @description Provides a simple tool tip to display a contacts current time.
// @include     https://www.facebook.com/*
// @include     http://www.facebook.com/*
// @version     0.1.1
// ==/UserScript==

/**
 * Used to inject pieces of userscripts into the page 
 * (to circumvent to greasemonkey's sandbox isolating userscripts from page scripts)
 * and allowing the page to excute the scripts.
 * <br>
 * Usage:
 * <ul>
 * <li>Create a <code>function functionWrapper()</code> with <code>var startTag;</code> and <code>var endTag;</code></li>
 * <li>Call <code>CodeInjector().fullInjection(functionWrapper, 'startTag', 'endTag');</code></li>
 * </ul>
 * The code between the tags will be injected into the page from the userscript and be executed from its domain.
 * 
 * @this {CodeInjector}
 * @version 0.3.1
 */
 function CodeInjector()
 {
   var codeInjectorId = "my-injected-script";
   return {
     
     /**
      * Returns the passed script as a string.
      * @param {function} scriptContainer The script container to turn to a string.
      * @return {String} The function code as a string.
      */
     functionToString:function(scriptContainer)
     {
    return (new Function(scriptContainer)).toString()
     },
     
      /**
      * Uses string manipulation on the code for injection into the page. 
      * NOTE: Must use the format 'var [start];' and 'var [end];' 
      *   encapsulating the code to be injected.
      * @param {String} fullScript The fullscript to trime.
      * @param {String} start The starting tag of injected code.
      * @param {String} end The end tag of injected code.
      * @return {String} The code to be injected.
      */
      trimmer:function(fullScript, start, end)
      { 
          start     = 'var '+start+';';
          end   = 'var '+end+';';
          var index1 = fullScript.indexOf(start) + start.length;
          var index2 = fullScript.indexOf(end);
          return fullScript.substring(index1,index2);
      },

      /**
      * Injects code into the page giving it the id: "my-injected-script".
      * @param {String} inputScript to inject into page code.
      */
      syringe:function(inputScript)
      {  
          var id = codeInjectorId;
          for (var i = 0; document.getElementById(id) ; i++) 
            id = codeInjectorId + "-"  + i; //make the script unique 
          var script = document.createElement('script');
            script.setAttribute("type", "application/javascript"); 
            script.setAttribute("id", id);
          var scriptText = document.createTextNode(inputScript);
          script.appendChild(scriptText);
          document.getElementsByTagName('head')[0].appendChild(script);
      },
      
      /**
      * Parses the scriptContainer, trims it, and injects it into the page.
      * @param {function} scriptContainer The script container to turn to a string.
      * @param {String} start The starting tag of injected code.
      * @param {String} end The end tag of injected code.
      * @see CodeInjector.functionToString
      * @see CodeInjector.trimmer
      * @see CodeInjector.syringe
      */
      fullInjection:function(scriptContainer, start, end)
      {  
    this.syringe(  this.trimmer( this.functionToString(scriptContainer), start, end ) );
      }
   };

 }

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

function toBeInjected(){
var BEGIN_INJECTION;
my_log = console.log;
myHttpRequests = {
    
    /** Request object. */
    xmlhttp: new XMLHttpRequest(),
    
    /** The class used to contain "about me" summaries on the front page. */
    aboutClass: '_4_ug',    
    
    /** Gathers the location from the DOM. 
     * @param {Element} dom The dom the analise and check. 
     * @return {String} The location in the "Lives in " string
     * or, if not available, the location inf the "From " string. 
     * If neither are available returns "". */
    fbLocationFromDOM:function(dom){
        var aboutPerson = dom.getElementsByClassName(this.aboutClass)
        var loc1 = ""; //the "lives in " location
        var loc2 = ""; //the "from" location
        my_log("aboutPerson: " + aboutPerson + " " + aboutPerson.length);
        var trying = dom.innerHTML;
        my_log("check: " + dom);
        my_log("check: " + trying);
        my_log("check: " + trying.constains("Etienne"));
        for (var i = aboutPerson.length - 1; i >= 0; i--){
          var string = ""+aboutPerson[i].innerHTML;
          if (string.contains("Lives in", 0)){
            loc1 = aboutPerson[i].innerHTML.getElementsByTagName('a')[0].innerHTML;    
          } else if (string.contains("From", 0)){
              loc2 = aboutPerson[i].innerHTML.getElementsByTagName('a')[0].innerHTML;
          }
        };
        return loc1 ? loc1 : ( loc2 ? loc2 : "");
    },
    /** 
     * 
     *Prints facebook location.
     * @param {String} dest The facebook profile to GET. 
     * 
     * TODO Return faceook location 
     * */
    facebookLocation:function(dest) {
        my_log("trying "+dest);
        this.xmlhttp.onreadystatechange=function(){
            var xmlHttp = myHttpRequests.xmlhttp;
            //if complete and ok
            if (xmlHttp.readyState == 4 && xmlHttp.status==200 ){
                var text =   xmlHttp.responseText;
                xmlHttp.responseXML = new DOMParser()
                    .parseFromString(text, "text/html");
                my_log("response: " + xmlHttp.responseXML + " " +  text);
                my_log("location?: " + text.contains("Lives in") + " " +  text.contains("From"));
                var dom = xmlHttp.responseXML.documentElement;
                myHttpRequests.fbLocationFromDOM(dom);
            }
            if (xmlHttp.readyState == 3) //processing
                console.log("(injected) Loading..."); 
        }
        this.xmlhttp.open("GET", dest, true);
        //this.xmlhttp.send();   
    }
}

//myHttpRequests.facebookLocation(""); 

var END_INJECTION;    
}

/** Handles httpRequests. */
myHttpRequests = {
    /** The class used to contain "about me" summaries on the front page. */
    aboutClass: '_4_ug',
    
    /** Gathers the location from the DOM. 
     * @param {Element} dom The dom the analise and check. 
     * @return {String} The location in the "Lives in " string
     * or, if not available, the location inf the "From " string. 
     * If neither are available returns "". */
    fbLocationFromDOM:function(dom){
        var aboutPerson = dom.getElementsByClassName('_4_ug');//myHttpRequests.aboutClass)
        //dom.getElementsByTagName('li')
        var loc1 = ""; //the "lives in " location
        var loc2 = ""; //the "from" location
        my_log()
        my_log("aboutPerson: " + aboutPerson + " " + aboutPerson.length);
        
        var trying = dom.innerHTML;
        
        my_log("check: " + trying.contains("Etienne"));
        for (var i = aboutPerson.length - 1; i >= 0; i--){
          var string = ""+aboutPerson[i].innerHTML
          my_log("li["+i+"] :" + string);
          if (string.contains("Lives in", 0)){
            loc1 = aboutPerson[i].getElementsByTagName('a')[0].innerHTML;
          } else if (string.contains("From", 0)){
              loc2 = aboutPerson[i].getElementsByTagName('a')[0].innerHTML;
          }
        };
        my_log("loc1 " + loc1);
        my_log("loc2 " + loc2);
        return loc1 ? loc1 : ( loc2 ? loc2 : "");
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
                my_log("Trying "+ responseXML.documentElement);
                my_log("Trying "+ responseXML.documentElement.getElementsByTagName('script').length);
                my_log("Trying "+myHttpRequests.fbLocationFromDOM(responseXML.documentElement));
                
                
                /*
                my_log([
                                  response.status,
                                  response.statusText,
                                  response.readyState,
                                  response.responseHeaders,
                                  response.responseText,
                                  response.finalUrl,
                                  responseXML].join("\n")); */
                  
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
CodeInjector().fullInjection(toBeInjected, "BEGIN_INJECTION", "END_INJECTION")
