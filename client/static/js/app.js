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

function getMinMax(scores){
	if (scores.length > 0) {
		var min = scores[scores.length-1].value;
		var max = scores[0].value;
		if (min > max) {
			var tmp = max;
			max = min;
			min = tmp;
		}
		min = min - 1;
		max = max + 1;
		if (min < 0) {
			min = 0;
		}
		if (max > 100) {
			max = 100;
		}
		return {min : min, max: max};
	}
	return {min: 0, max: 0};
}

function handleScores(scores, minMax, mode) {
	if (!mode) {
		mode = 'high';
	}
	for(var i = 0; i < scores.length; i++) {
		scores[i].type = getType(scores[i].value);
		scores[i].classCss = classDict[scores[i].class];
		if (mode === 'high') {
			scores[i].barValue = (scores[i].value - minMax.min) / (100 - minMax.min) * 100;
		}
		if (mode === 'low') {
			scores[i].barValue = (minMax.max - scores[i].value) / (minMax.max) * 100;
		}
	}
}

function handleClicks(clicks) {
	for(var i = 0; i < clicks.length; i++){
		clicks[i].classCss = classDict[clicks[i]._id.class];
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
}

angular.module('ruckus', ['ui.bootstrap', 'ngResource', 'ngAnimate', 'angularLoad', 'ngCookies'
]).factory('ApiService', function($resource){
	return {
		siteprefs: $resource('/api/siteprefs'),
		optimize: $resource('/api/optimize'),
		retrieve: $resource('/api/retrieve'),
		highscore: $resource('/api/highscore'),
		clicks: $resource('/api/clicks'),
		settings: $resource('/api/settings')
	}
}).controller('SiteCtrl', function($scope, $cookies, ApiService, angularLoad){
	ApiService.settings.get().$promise.then(function(response){
		$scope.settings = response.data;
		$scope.langCache = {};
		var html = angular.element('html');
		var content = angular.element('#content');
		function setLanguage(lang){
			function set(lang){
				$scope.strings = $scope.langCache[lang];
				$scope.lang = lang;
				$cookies.put('lang', lang);
			}
			if ($scope.langCache[lang]){
				set(lang);
			} else {
				var promise = angularLoad.loadScript('/static/js/strings.'+lang+'.js')
				html.addClass('waiting');
				promise.then(function(){
					$scope.langCache[lang] = strings;
					set(lang);
					html.removeClass('waiting');
					content.removeClass('lang-hide');
				});
			}
		}
		var cookieValue = $cookies.get('lang');
		// Init
		if (cookieValue) {
			setLanguage(cookieValue);
		} else {
			setLanguage($scope.settings.lang);
		}
		// public setLanguage
		$scope.setLanguage = function(lang){
			setLanguage(lang);
		}
		$scope.isActive = function(lang){
			return lang == $scope.lang;
		}
	});
}).controller('ClickCtrl', function($scope, ApiService){
	function refreshClicks(response){
		$scope.clicks = response.data.clicks;
		$scope.totalClicks= response.data.totalClicks;
		$scope.averages = response.data.averages;
		$scope.totalAverage = response.data.totalAverage;
		handleClicks($scope.clicks);
		handleClicks($scope.averages);
	}
	// Init clicks
	ApiService.clicks.get().$promise.then(function(response){
		refreshClicks(response);
		setInterval(function(){
			ApiService.clicks.get().$promise.then(function(response){
				refreshClicks(response);
			});
		}, 1000);
	});
}).controller('ScoreCtrl', function($scope, ApiService){
	function refreshScores(scores){
		// Get min and max values
		var minMaxHigh = getMinMax(scores.highscore);
		var minMaxLow = getMinMax(scores.lowscore);
		// Set/update scope scores
		if ($scope.scores){
			updateScores($scope.scores.highscore, scores.highscore);
			updateScores($scope.scores.lowscore, scores.lowscore);
		} else {
			$scope.scores = scores;
		}
		// Handle score css
		handleScores($scope.scores.highscore, minMaxHigh, 'high');
		handleScores($scope.scores.lowscore, minMaxLow, 'low');
	}
	// Init scores
	ApiService.highscore.get().$promise.then(function(response){
		refreshScores(response.data);
		// Set score load timer
		setInterval(function(){
			ApiService.highscore.get().$promise.then(function(response){
				refreshScores(response.data);
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