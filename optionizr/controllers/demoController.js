/**
* Optionizr 2016 all rights reserved
* Author : guillaume.didier@optionizr.com
**/

/**
* Demo controller, retrieve air france flights, sample code
**/

var request 	= require("request");
var moment 		= require("moment");
var util 		= require("util");


/**
* Index, render search form
**/
exports.getIndex = function(req, res)
{
	// clean previous session result
	exports.cleanSession(req);

	return res.render("index.ejs",{
		error: ""
	});
};

/**
* Index post search, launch air france request
**/
exports.postIndex = function(req, res)
{
	// clean previous session result
	exports.cleanSession(req);

	// check parameters in req.body
	var valid = true;
	valid &= req.body.from 				!= "";
	valid &= req.body.to 				!= "";
	valid &= req.body.number 			!= "";
	valid &= req.body.type 				!= "";
	valid &= req.body.passenger_type 	!= "";
	valid &= req.body.date 			!= "";
	if(!valid)
	{
		return res.render("index.ejs",{
			error:"Invalid fields"
		});
	}
	return exports.retrieveAirFranceFlightList(req, res, req.body);
};


/**
* HTTP Request, post search datas on Air France website
*
* Warning, on this target site datas must be pass through two consecutive pages.
**/
exports.retrieveAirFranceFlightList = function(req, res, data)
{
	console.log(req);
	// build body request string
	var bodyString = "outboundDate="+ 			data.date
				+"&"+"departure="+ 			data.from
				+"&"+"childCount=0"
				+"&"+"infantCount=0"
				+"&"+"adultCount="+ 		data.number
				+"&"+"oneway="+ 			data.type
				+"&"+"destination="+ 			data.to;
				// +"&"+"openDateOverview="+


				// +"&"+"departureType=AIRP"
				// +"&"+"nbAdults="+ 			data.number
				// +"&"+"paxTypoList="+ 		data.passenger_type
				// +"&"+"yearMonthDate="+ 		moment(data.date).format("YYYY")+moment(data.date).format("MM")

				// +"&"+"arrivalType=AIRP"
				// +"&"+"calendarSearch=1"
				// +"&"+"haul=SH"
				// +"&"+"familyTrip=NON"
				//+"&"+"pluOptions="
				//+"&"+"isUM=false"
				//+"&"+"selectCabin=on"
				//+"&"+"cabin=Y"
				//+"&"+"subCabin=MCHER";

	// build request data (body, headers)
	var requestData = {
		url: "https://www.airberlin.com/en-WW/site/start.php?gclid=CLnQwsLb3coCFQMcwwodZD0Aww&gclsrc=aw.ds", 				// endpoint url
		body: bodyString,																							// body data
		headers:{ 																									// http headers
			"Content-Type" 	: "application/x-www-form-urlencoded", 													// content type (form)
			"User-agent" 	: "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:42.0) Gecko/20100101 Firefox/42.0", 		// simulate browser
			"Referer" 		: "https://www.airberlin.com/en-WW/site/start.php?gclid=CLnQwsLb3coCFQMcwwodZD0Aww&gclsrc=aw.ds" 	// simulate request comes from airFrance
		}
	};

	// send request to first page (landing on redirect page, use cookie string to store session id in order to get access to second page)
	request.post(requestData, function(error, response, body){
		if(error || response.statusCode != 200)
		{
			return res.render("index.ejs",{
				error:"An error occurs, cannot retrieve flight list (page 1)"
			});
		}
		else
		{
			/**
			* WARNING!!
			*
			* Don't use request.jar() to auto-save set-cookie value, there's a bug on request lib, SEE END OF FILE
			*
			**/
			requestData.cookieString 		= exports.buildCookieString(response.headers["set-cookie"]);
			requestData.url 				= "https://www.airberlin.com/en-WW/booking/flight/vacancy.php?sid=17a61c583e24503663c1";
			requestData.headers["Referer"] 	= "https://www.airberlin.com/en-WW/site/start.php?gclid=CLnQwsLb3coCFQMcwwodZD0Aww&gclsrc=aw.ds";
			requestData.headers["Cookie"] 	= requestData.cookieString;

			request.post(requestData, function(error, response, body){
				if(error || response.statusCode != 200)
				{
					return res.render("index.ejs",{
						error:"An error occurs, cannot retrieve flight list (page 2)"
					});
				}
				else
				{
					return exports.parseAirFranceFlightList(req, res, body, requestData);
				}
			});
		}
	});
};

/**
*
* Search request ended with success, now parse text response in order to extract air france flight list.
* In order to simplify process we keep only direct flight (no change, 1 flight segment)
*
**/
exports.parseAirFranceFlightList = function(req, res, body, requestData)
{
	// make sure we're landing on good page
	if(body && body.indexOf("getUpsellForPreSelectedDate") > -1)
	{
		// extract flight list with regex
		var regular_expression = /getUpsellForPreSelectedDate\((.*), indexTabSelected,.*?\);/;
		var regular_expression_result = regular_expression.exec(body);

		// if match result string in regular_expression_result[1]
		if(regular_expression_result && regular_expression_result.length == 2)
		{
			// JSON.parse throw exception on fail
			try
			{
				var json = JSON.parse(regular_expression_result[1]);
				var flightList = json ? json.upsellList : null;

				// to inspect datas console.log(util.inspect(flightList));
				if(flightList && flightList.length > 0)
				{
					// in order to simplify process we manage only direct flight, other results are removed from list
					var validFlights = [];
					for(var i = 0; i<flightList.length; i++)
					{
						// check that is direct flight and there's only one flight segment
						if(flightList[i].isDirectFlight && flightList[i].listFlightFeatures.length == 1)
						{
							// store session cookie in each travel
							flightList[i].cookieString = requestData.cookieString;

							validFlights.push(flightList[i]);
						}
					}

					// empty results must throw an error
					if(validFlights.length > 0)
					{

						/**
						* We don't want to repost all request on each visited page to retrieve session id, result and cookies in session
						**/
						req.session.airFrance = {
							fares : json.fareFamilies,
							list : validFlights
						};

						// display flight list
						return res.render("flightlist.ejs",{
							error: 		"",					// error
							list: 		validFlights,		// flight list
							fares: 		json.fareFamilies 	// product type
						});
					}
					else
					{
						console.log("No valid flights found")
					}
				}
				else
				{
					console.log("No flights found");
				}
			}
			catch(e){
				console.log(util.inspect(e));
				console.log("JSON parsing error");
			}
		}
	}
	else
	{
		console.log("Wrong request");
	}

	// if here an error occurs
	return res.render("index.ejs",{
		error:"An error occurs, cannot parse datas"
	});
};

/**
* Next page, not done, ... just a sample !
**/
exports.getFillPnr = function(req, res)
{
	// retrieve flight and product then simulate product validation
	var flightid = parseInt(req.params.flightid);
	var productid = parseInt(req.params.productid);

	// check if session still exists
	if(req.session && req.session.airFrance && req.session.airFrance.list)
	{
		// check if parameters are valid
		var list = req.session.airFrance.list;
		if(flightid >= 0 && flightid < list.length && productid >= 0 && productid < list[flightid].listPrices.length)
		{
			var current_flight = list[flightid];
			var current_product = list[productid];

			// cookie stirng containing session id to pass to request
			var cookieString = current_flight.cookieString;

			// now select product on air france website "https://www.airfrance.fr/FR/en/local/process/standardbooking/UpdateCustomPageActionDallas.do", send pnr, etc...
			exports.cleanSession(req);
			return res.render("index.ejs",{
				success:true
			});
		}
		exports.cleanSession(req);
		return res.render("index.ejs",{
			error:"Invalid parameters"
		});

	}
	exports.cleanSession(req);
	return res.render("index.ejs",{
		error:"Session has expired"
	});
};


/**
* Helper, transform cookies array from response.headers["set-cookie"] to cookie string. String must be pass to request headers after to keep session on target site
**/
exports.buildCookieString = function(array)
{
	var value = "";
	if(!array) return "";

	var first = true;
	for(var i = 0; i < array.length; i++)
	{
		var cv = array[i];
		var sp = cv.split(";");
		if(sp && sp.length >= 1)
		{
			if(!first)
				value += " ";
			value += sp[0]+";";
			first = false;
		}
	}
	return value;
};

/**
* Helper, clean session result
**/
exports.cleanSession = function(req)
{
	if(req.session && req.session.airFrance)
	{
		delete req.session.airFrance;
	}
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
