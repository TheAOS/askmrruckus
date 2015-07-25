var Hapi = require('hapi');
var joi = require('joi');
var db = require('monk')('localhost/ruckus');
var Q = require('q');
var jsonfile = require('jsonfile');
var Request = require('request');

var highscore = db.get('highscore');

// Monkey patch for aggregates in monk courtesy of https://github.com/oO
// https://github.com/Automattic/monk/issues/56
highscore.aggregate = function(aggregation){
    var collection = this.col;
    var options = {};
    return function (callback){
        return collection.aggregate(aggregation, options, callback)
    }
}

var characterCache = db.get('characterCache');
var server = new Hapi.Server();

var config = jsonfile.readFileSync('config.json');

server.connection({
	port : config.port
});

server.route({
	method : 'GET',
	path : '/',
	handler : function(request, reply) {
		reply.file('client/static/index.html');
	}
});

// static
server.route({
	method : 'GET',
	path : '/static/{param*}',
	handler : {
		directory : {
			path : 'client/static'
		}
	}
});

server.route({
	method : 'GET',
	path : '/js/strings.js',
	handler : function(request, reply) {
		reply.file('client/static/js/strings.' + config.lang + '.js');
	}
});

server.route({
	method : 'GET',
	path : '/{path*}',
	handler : function(request, reply) {
		reply.redirect('/');
	}
});

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min)) + min;
}

function getHighscores(){
	return highscore.find({}, { limit: 10, sort: { value: -1 }});
}

function getLowscores(){
	return highscore.find({}, { limit: 10, sort: { value: 1 }});
}

server.route({
	method : 'POST',
	path : '/api/retrieve',
	config : {
		validate : {
			payload : {
				name : joi.string().required().min(3).alphanum(),
				realm : joi.string().required().min(3).alphanum()
			}
		}
	},
	handler : function(request, reply) {
		// Find in cache, if not too old
		var characterPromise = characterCache.findOne({name: request.payload.name, realm: request.payload.server}, 'name realm class lastGet');
		
		characterPromise.on('complete', function(err, character){
			if (!err && character) {
				console.log(character);
				if (((new Date) - character.lastGet) < config.character_cache_timeout * 60 * 1000){
					// Character cache is not expired
					delete character.lastGet;
					reply({data: character});
					return
				} else {
					// Character cache is expired
					characterCache.remove({ _id : character._id });
				}
			}
			// Build url
			var url = config.bliz_region_url + 'wow/character/' + request.payload.realm + '/' + request.payload.name;
			url += '?locale=' + config.bliz_locale + '&apikey=' + config.bliz_api_key;
			
			// Get character info
			Request(url, function(error, response, body){
				if (!error && response.statusCode == 200) {
					// set cache time
					var char = JSON.parse(body);
					char.lastGet = new Date();
					characterCache.insert(char);
					delete char.lastGet;
					reply({
						data:
							{
								name: char.name,
								realm: char.realm,
								class: char.class
							}
					});
				} else {
					// Reply with blizz message to client cause why not?
					reply({data: JSON.parse(body)});
				}
			});
		});
		
	}
})

server.route({
	method : 'POST',
	path : '/api/optimize',
	config : {
		validate : {
			payload : {
				name : joi.string().required().min(3),
				realm : joi.string().required().min(3),
				class : joi.number().required()
			}
		}
	},
	handler : function(request, reply) {
		var character = request.payload;
		character.possiblePresses = getRandomInt(10000, 100000);
		character.actualPresses = getRandomInt(0, character.possiblePresses + 1);
		character.value = character.actualPresses/character.possiblePresses * 100;
		character.date = new Date();
		
		highscore.insert(character).then(function(){
			reply({
				data: character
			});
		}, console.error);
	}
});

server.route({
	method : 'GET',
	path : '/api/highscore',
	handler : function(request, reply) {
		var promise = Q.all([ getHighscores(), getLowscores() ]);
		promise.then(function(results){
			reply({
				data: {
					highscore: results[0],
					lowscore: results[1]
				}
			});
		}, console.error);
	}
});

server.route({
	method : 'GET',
	path : '/api/clicks',
	handler : function(request, reply) {
		highscore.aggregate([{
			$group: {
				_id: { name: "$name", class: "$class", realm: "$realm" },
				count: { $sum: 1 }
			}
		},{
			$sort: {
				count: -1
			}
		},{
			$limit : 20
		}])(function(err, docs){
			highscore.aggregate([{
				$group: {
					_id: null,
					count: { $sum: 1 }
				}
			}])(function(err2, docs2){
				var count = 0;
				if (docs2.length > 0) {
					count = docs2[0].count;
				}
				reply({
					data: {
						clicks: docs,
						totalClicks: count
					}
				})
			});
		});
	}
});

server.start();