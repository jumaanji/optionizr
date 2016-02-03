/**
* Optionizr 2016 all rights reserved
* Author : guillaume.didier@optionizr.com
**/

module.exports = function(){
	var config = {
		port: 9000
	};
	// override some globals
	process.env.PORT = config.port;
	return config;
}();

