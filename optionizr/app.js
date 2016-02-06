/**
* Optionizr 2016 all rights reserved
* Author : guillaume.didier@optionizr.com
**/

/**
 * Module dependencies.
 */

var util = require("util");
var express = require('express');
var cookieParser = require('cookie-parser');
var compress = require('compression');
var session = require('express-session');
var bodyParser = require('body-parser');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var methodOverride = require('method-override');
var assert = require("assert");
var _ = require('lodash');
var flash = require('express-flash');
var path = require('path');
var expressValidator = require('express-validator');
var connectAssets = require('connect-assets');
var request = require("request");

/**
 * Configuration.
 */
var config = require('./config/config.js');

/**
 * Create Express server.
 */
var app = express();


/**
 * Express configuration.
 */

app.set('port', process.env.PORT);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


var domain = require('domain');

app.use(function(req, res, next) {
    var requestDomain = domain.create();
    requestDomain.add(req);
    requestDomain.add(res);
    requestDomain.on('error', next);
    requestDomain.run(next);
});

app.use(compress());
app.use(connectAssets({
  paths: [path.join(__dirname, 'public/css'), path.join(__dirname, 'public/js')]
}));

app.use(logger('dev',{
	skip: function(req, res){
		function inDir(dirNameList){
			var pattern = "^\/"+dirNameList[0]+"\/";
			for(var i=1; i<dirNameList.length; i++){
				pattern += "|^\/"+dirNameList[i]+"\/";
			}
			return pattern;
		}
		var exclude = new RegExp(inDir(["css","js","img", "images", "fonts"]));
		return exclude.test(req.path);
	}
}));
app.use(bodyParser.json({limit:'3mb'}));
app.use(bodyParser.urlencoded({ extended: true }));


app.use(expressValidator());
app.use(methodOverride());
app.use(cookieParser());
app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: "myawesomesecrets"
}));

app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

app.use(flash());


app.use(function(req, res, next) {
  // Remember original destination before login.
   if (/css|fonts|images|img|js/i.test(path)){
    return next();
  }
  if(req.session) {
    req.session.returnTo = req.path;
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }));



/**
 * Controllers (route handlers).
 */

var demoController = require('./controllers/demoController');


/**
 * Main routes.
 */

app.get('/demo', demoController.getIndex);
app.post("/demo", demoController.postIndex);
app.get("/demo/pnr/:flightid/:productid", demoController.getFillPnr);

app.get('/getDepartures', demoController.GetDepartures);
app.get('/getDestinations/', demoController.GetDestinations);
app.get('/getDestinations/:destination', demoController.GetDestinations);

// redirect default index
app.get("/", demoController.getIndex);

/**
 * 500 Error Handler.
 */
app.use(errorHandler());


/**
 * Start Express server.
 */
 
app.listen(app.get('port'), function() {
	
  console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));

});
		
module.exports = app;
