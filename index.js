var Hapi = require('hapi');
var joi = require('joi');
var db = require('monk')('localhost/ruckus');
var Q = require('q');
var jsonfile = require('jsonfile');

var highscore = db.get('highscore');
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
	path : '/api/optimize',
	config : {
		validate : {
			payload : {
				name : joi.string().required().min(3)
			}
		}
	},
	handler : function(request, reply) {
		var character = request.payload;
		character.possiblePresses = getRandomInt(10000, 100000);
		character.actualPresses = getRandomInt(0, character.possiblePresses + 1);
		character.value = character.actualPresses/character.possiblePresses * 100;
		
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

server.start();