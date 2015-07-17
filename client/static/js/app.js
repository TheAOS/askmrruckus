var classDict = {
	0 : 'none',
	1 : 'warrior-text',
	2 : 'paladin-text',
	3 : 'hunter-text',
	4 : 'rogue-text',
	5 : 'priest-text',
	6 : 'death-knight-text',
	7 : 'shaman-text',
	8 : 'mage-text',
	9 : 'warlock-text',
	10 : 'monk-text',
	11 : 'druid-text'
};

function getType(value) {
	if (value < 25) {
		return 'danger';
	} else if (value < 50) {
		return 'warning';
	} else if (value < 75) {
		return 'info';
	}
	return 'success';
}

function handleScores(scores) {
	for(var i = 0; i < scores.length; i++) {
		scores[i].type = getType(scores[i].value);
		scores[i].classCss = classDict[scores[i].class];
	}
}

function updateScores(oldScores, newScores) {
	// Handle empty oldScores
	if (oldScores.length == 0) {
		oldScores.splice(0, 0, newScores);
	} else {// Insert into oldScores
		for (var i = 0; i < newScores.length; i++) {
			// Insert new scores at end of list
			if (i >= oldScores.length){
				oldScores.push(newScores[i]);
			} else if (newScores[i]._id !== oldScores[i]._id) { // Insert new scores at location
				oldScores.splice(i, 0, newScores[i]);
			}
		}
	}
	// Delete excessive entries
	while (oldScores.length > newScores.length) {
		delete oldScores[oldScores.length - 1];
		oldScores.length = oldScores.length - 1;
	}
	handleScores(oldScores);
}

angular.module('ruckus', ['ui.bootstrap', 'ngResource', 'ngAnimate'
]).factory('ApiService', function($resource){
	return {
		siteprefs: $resource('/api/siteprefs'),
		optimize: $resource('/api/optimize'),
		retrieve: $resource('/api/retrieve'),
		highscore: $resource('/api/highscore')
	}
}).controller('SiteCtrl', function($scope, ApiService){
	$scope.strings = strings;
}).controller('ScoreCtrl', function($scope, ApiService){
	// Init scores
	ApiService.highscore.get().$promise.then(function(response){
		$scope.scores = response.data;
		handleScores($scope.scores.highscore);
		handleScores($scope.scores.lowscore);
		// Set score timer
		setInterval(function(){
			ApiService.highscore.get().$promise.then(function(response){
				updateScores($scope.scores.highscore, response.data.highscore);
				updateScores($scope.scores.lowscore, response.data.lowscore);
			});
		}, 1000);
	});
}).controller('OptimizeCtrl', function($scope, ApiService){
	$scope.optimizeEnabled = true;
	$scope.retrieveEnabled = true;
	// Optimize function
	$scope.retrieve = function(character){
		if ($scope.retrieveEnabled) {
			$scope.retrieveEnabled = false;
			ApiService.retrieve.save(character).$promise.then(function(response){
				if (response.data.status && response.data.status === 'nok'){
					$scope.errorMsg = response.data.reason;
				} else {
					$scope.loadedCharacter = response.data;
					$scope.classCss = classDict[response.data.class];
					$scope.optimize($scope.loadedCharacter, true);
					$scope.errorMsg = null;
				}
				setTimeout(function(){
					$scope.retrieveEnabled = true;
				}, 1000);
			});
		}
	};
	$scope.optimize = function(character, override){
		if ($scope.optimizeEnabled || override) {
			// Disable button
			if (!override){
				$scope.optimizeEnabled = false;
			}
			ApiService.optimize.save(character).$promise.then(function(response){
				if (!$scope.optimized){
					$scope.optimized = {};
				}
				$scope.optimized.possiblePresses = response.data.possiblePresses;
				$scope.optimized.actualPresses = response.data.actualPresses;
				$scope.optimized.value = response.data.value;
				// Reenable button after 0.5 sec
				if (!override){
					setTimeout(function(){
						$scope.optimizeEnabled = true;
					}, 500);
				}
			});
		}
	};
	$scope.reset = function(){
		if ($scope.optimizeEnabled) {
			delete $scope.optimized;
			delete $scope.loadedCharacter;
		}
	}
}).directive('scorelist', function(){
	return {
		restrict: 'E',
		scope: {
			scoreList: '=scores',
			animation: '=animation'
		},
		templateUrl: 'static/scorelist.html'
	}
}).directive('score', function(){
	return {
		restrict: 'E',
		scope: {
			score: '=score',
			animation: '=animation'
		},
		templateUrl: 'static/score.html'
	}
});