/**
 * Optionizr 2016 all rights reserved
 * Author : guillaume.didier@optionizr.com
 **/

/**
 * Demo controller, retrieve air france flights, sample code
 **/

var requestt = require('request-sync');
var request = require("request");
var moment = require("moment");
var util = require("util");
var cookie = require("cookies");


/**
 * Get departures
 */
exports.GetDepartures = function(req, res) {
    var jsonString = requestt("https://www.airberlin.com/fr-FR/site/json/suggestAirport.php?searchfor=departures&searchflightid=0&departures%5B%5D=&destinations%5B%5D=Johannesburg&suggestsource%5B0%5D=activeairports&withcountries=0&withoutroutings=0&promotion%5Bid%5D=&promotion%5Btype%5D=&get_full_suggest_list=true&routesource%5B0%5D=airberlin&routesource%5B1%5D=partner", {method: 'GET'}).body.toString();
    var parsed = JSON.parse(jsonString);
    var object = new Object();
    for (var i=0; i<parsed.fullSuggestList.length; i++) {
        if (object[parsed.fullSuggestList[i].countryCode] == undefined) {
            object[parsed.fullSuggestList[i].countryCode] = new Array();
        }
        object[parsed.fullSuggestList[i].countryCode].push(parsed.fullSuggestList[i])
    }

    return res.json(object);
};

exports.GetDestinations = function(req, res) {
    var destination = req.param('destination') !== undefined ? req.param('destination') : '';
    var jsonString = requestt('https://www.airberlin.com/fr-FR/site/json/suggestAirport.php?searchfor=destinations&searchflightid=0&departures%5B%5D='+destination+'&destinations%5B%5D=&suggestsource%5B0%5D=activeairports&withcountries=0&withoutroutings=0&promotion%5Bid%5D=&promotion%5Btype%5D=&get_full_suggest_list=false&routesource%5B0%5D=airberlin&routesource%5B1%5D=partner', {method: 'GET'}).body.toString();
    var parsed = JSON.parse(jsonString);
    var object = new Object();
    for (var i=0; i<parsed.suggestList.length; i++) {
        if (object[parsed.suggestList[i].countryCode] == undefined) {
            object[parsed.suggestList[i].countryCode] = new Array();
        }
        object[parsed.suggestList[i].countryCode].push(parsed.suggestList[i])
    }

    return res.json(object);
}

/**
 * Index, render search form
 **/
exports.getIndex = function (req, res) {
    // clean previous session result

    return res.render("index.ejs", {
        error: ""
    });
};

/**
 * Index post search, launch air france request
 **/
exports.postIndex = function (req, res) {
    var date = req.body.date.toString();
    var formated_date = '20' + date[6] + date[7] + '-' + date[0] + date[1] + '-' + date[3] + date[4];
    req.body.date = formated_date;
    var response = requestt('https://www.airberlin.com/fr-FR/booking/flight/vacancy.php?departure=' + req.body.from.toString() + '&destination=' + req.body.to.toString() + '&outboundDate=' + req.body.date.toString() + '&returnDate=' + req.body.date.toString() + '&oneway=1&openDateOverview=0&adultCount=' + req.body.number.toString() + '&childCount=0&infantCount=0', {method: 'GET'});
    var string = response.headers["location"];
    var rePattern = new RegExp(/sid=(.{20})/);
    var arrMatches = string.match(rePattern);
    var cookie = exports.buildCookieString(response.headers["set-cookie"]);

    exports.retrieveAirBerlinFlightList(res, arrMatches[1], cookie, req.body);

    //res.send(arrMatches[1]);
};

/**
 * HTTP Request, post search datas on Air France website
 *
 * Warning, on this target site datas must be pass through two consecutive pages.
 **/
exports.retrieveAirBerlinFlightList = function (res, sid, cookie, body) {
    var bodyString = "_ajax[templates][]=dateoverview"+
    "&_ajax[templates][]=main"+
    "&_ajax[templates][]=priceoverview"+
    "&_ajax[templates][]=infos"+
    "&_ajax[templates][]=flightinfo"+
    "&_ajax[requestParams][departure]=" + body.from.toString() +
    "&_ajax[requestParams][destination]=" + body.to.toString() +
    "&_ajax[requestParams][returnDeparture]=" +
    "&_ajax[requestParams][returnDestination]=" +
    "&_ajax[requestParams][outboundDate]=" + body.date.toString() +
    "&_ajax[requestParams][returnDate]=" + body.date.toString() +
    "&_ajax[requestParams][adultCount]=" + body.number.toString() +
    "&_ajax[requestParams][childCount]=0"+
    "&_ajax[requestParams][infantCount]=0"+
    "&_ajax[requestParams][openDateOverview]="+
    "&_ajax[requestParams][oneway]=1";
    var requestData = {
        url: "https://www.airberlin.com/fr-FR/booking/flight/vacancy.php?sid=" + sid,
        body: bodyString,  // body data
        headers: {
            //http headers"
            "Content-Type": "application/x-www-form-urlencoded", // content type (form)
            "User-agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:42.0) Gecko/20100101 Firefox/42.0", // simulate browser
            "Cookie": cookie,
            "Referer": "https://www.airberlin.com/fr-FR/booking/flight/vacancy.php?sid=" + sid // simulate request comes from airFrance
        },
        cookieString: cookie
    };

    request.post(requestData, function (error, response) {
        var full_body = JSON.parse(response.body);
        var content = full_body["templates"]["main"];
        console.log(exports.parseAirBerlinFlightList(content)['outbound']);
        res.send(content);
        //res.render("test_flightlist.ejs",{
        //    list: 	exports.parseAirBerlinFlightList(content)['outbound'],		// flight list
        //});
    });
};

/**
 *
 * Search request ended with success, now parse text response in order to extract air france flight list.
 * In order to simplify process we keep only direct flight (no change, 1 flight segment)
 *
 **/
exports.parseAirBerlinFlightList = function (html) {
        var string = html;
        var reg = /<tr class="flightrow">([^.]*)<\/tr>/g
        var resultAllFlights = [], found;

        while (found = reg.exec(string)) {
            resultAllFlights.push(found[0]);
        }

        var finalObject = {};
        finalObject['outbound'] = {};
        finalObject['return'] = {};

        var out = 0;
        var ret = 0;
        for (i in resultAllFlights) {
            var ft = flightType(resultAllFlights[i].toString());
            if (ft == "outbound") {
                finalObject['outbound'][out] = flightInformations(resultAllFlights[i]);
                out++;
            } else if (ft == "return") {
                finalObject['return'][ret] = flightInformations(resultAllFlights[i]);
                ret++;
            }
        }
        return finalObject;
};

function isOdd(num) {return num % 2;}

function flightType(string) {
    var reg = /(outboundFareId)/g
    var resultOutbound = [], found;
    while (found = reg.exec(string)) {
        resultOutbound.push(found[0]);
    }


    var reg = /(returnFareId)/g
    var resultReturn = [], found;
    while (found = reg.exec(string)) {
        resultReturn.push(found[0]);
    }


    if (resultOutbound.length > 0)
        return "outbound";
    else if (resultReturn.lengt > 0)
        return "return";
    else return "fail";
}

function flightInformations(string) {
    var array = [];
    var found;

    // GET PRICES
    array['price'] = [];
    var reg = /<span id="price-.{13}">(.{1,10})<\/span>/g
    var i = 0;
    while (found = reg.exec(string)) {
        if (isOdd(i))
            array['price'].push(found[1]);
        i++;
    }

    // GET HORAIRES
    array['time'] = [];
    var reg = /<time>(.{3,10})<\/time>/g
    var i = 0;
    while (found = reg.exec(string)) {
        array['time'].push(found[1]);
        i++;
    }

    // GET ESCALES
    array['escale'] = [];
    var reg = /<td>(.{1})<\/td>/g
    var i = 0;
    while (found = reg.exec(string)) {
        array['escale'].push(found[1]);
        i++;
    }


    return array;
}

/**
 * Next page, not done, ... just a sample !
 **/
exports.getFillPnr = function (req, res) {
    // retrieve flight and product then simulate product validation
    var flightid = parseInt(req.params.flightid);
    var productid = parseInt(req.params.productid);

    // check if session still exists
    if (req.session && req.session.airFrance && req.session.airFrance.list) {
        // check if parameters are valid
        var list = req.session.airFrance.list;
        if (flightid >= 0 && flightid < list.length && productid >= 0 && productid < list[flightid].listPrices.length) {
            var current_flight = list[flightid];
            var current_product = list[productid];

            // cookie stirng containing session id to pass to request
            var cookieString = current_flight.cookieString;

            // now select product on air france website "https://www.airfrance.fr/FR/en/local/process/standardbooking/UpdateCustomPageActionDallas.do", send pnr, etc...
            return res.render("index.ejs", {
                success: true
            });
        }
        return res.render("index.ejs", {
            error: "Invalid parameters"
        });

    }
    return res.render("index.ejs", {
        error: "Session has expired"
    });
};


/**
 * Helper, transform cookies array from response.headers["set-cookie"] to cookie string. String must be pass to request headers after to keep session on target site
 **/
exports.buildCookieString = function (array) {
    var value = "";
    if (!array) return "";

    var first = true;
    for (var i = 0; i < array.length; i++) {
        var cv = array[i];
        var sp = cv.split(";");
        if (sp && sp.length >= 1) {
            if (!first)
                value += " ";
            value += sp[0] + ";";
            first = false;
        }
    }
    return value;
};

/**
 * COOKIE JAR ERROR IN REQUEST :
 * Cookie jar in request:
 * request.post({.... jar:request.jar()}) --> cookie is a json object like :
 * { _jar:
   { enableLooseMode: true,
     store:
      { idx: { 'www.airfrance.fr':
         { '/':
            { targetPath_b2c: Cookie="targetPath_b2c=b2c_b; Domain=www.airfrance.fr; Path=/; hostOnly=false; aAge=199ms; cAge=2718ms",
              JSESSIONID: Cookie="JSESSIONID=15339EFE4C9EA956454B00E66D17155A.a61s1; Path=/; HttpOnly; hostOnly=true; aAge=2701ms; cAge=2715ms",
              ASID: Cookie="ASID=.a61s1; Path=/; hostOnly=true; aAge=2702ms; cAge=2715ms" }
            }
          }
       }
    }
  }
 *
 *
 *
 *
 *  When storing jar in session, then rendering a view, then retrieving cookie jar from session cookie is like, node  Serialize-deserialize session, cookie jar stored in session is modified...  :
 { _jar:
    { version: 'tough-cookie@2.2.1',
      storeType: 'MemoryCookieStore',
      rejectPublicSuffixes: true,
      cookies: [ { key: 'targetPath_b2c',
     value: 'b2c_b',
     domain: 'www.airfrance.fr',
     path: '/',
     hostOnly: false,
     creation: '2016-01-27T14:43:18.899Z',
     lastAccessed: '2016-01-27T14:43:21.380Z' },
   { key: 'JSESSIONID',
     value: '15339EFE4C9EA956454B00E66D17155A.a61s1',
     domain: 'www.airfrance.fr',
     path: '/',
     httpOnly: true,
     hostOnly: true,
     creation: '2016-01-27T14:43:18.900Z',
     lastAccessed: '2016-01-27T14:43:18.912Z' },
   { key: 'ASID',
     value: '.a61s1',
     domain: 'www.airfrance.fr',
     path: '/',
     hostOnly: true,
     creation: '2016-01-27T14:43:18.901Z',
     lastAccessed: '2016-01-27T14:43:18.912Z' } ] } }


 *
 *
 * Cookie jar is now unreadable by request.
 * Use hand function exports.buildCookieString(response.headers["set-cookie"]); when there's a modification in cookie instead, then pass the string through request headers.
 *
 *
 **/