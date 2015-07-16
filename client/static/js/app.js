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

//function updateScores(oldScores, newScores) {
//	// Handle empty oldScores
//	if (oldScores.length == 0) {
//		oldScores.splice(0, 0, newScores);
//	} else {// Insert into oldScores
//		for (var i = 0; i < newScores.length; i++) {
//			// Insert new scores at end of list
//			if (i >= oldScores.length){
//				oldScores.push(newScores[i]);
//			} else if (newScores[i]._id !== oldScores[i]._id) { // Insert new scores at location
//				angular.copy(newScores[i], oldScores[i]);
//			}
//		}
//	}
//	handleScores(oldScores);
//}

angular.module('ruckus', ['ui.bootstrap', 'ngResource', 'ngAnimate'
]).factory('OptimizeService', function($resource){
	return {
		optimize: $resource('/api/optimize'),
		highscore: $resource('/api/highscore')
	};
}).controller('AppCtrl', function($scope, $http, OptimizeService){
	// Init scores
	$scope.enabled = true;
	OptimizeService.highscore.get().$promise.then(function(response){
		$scope.scores = response.data;
		handleScores($scope.scores.highscore);
		handleScores($scope.scores.lowscore);
		// Set score timer
		setInterval(function(){
			OptimizeService.highscore.get().$promise.then(function(response){
				updateScores($scope.scores.highscore, response.data.highscore);
				updateScores($scope.scores.lowscore, response.data.lowscore);
				$scope.enabled = true;
			});
		}, 1000);
	});
	
	// Optimize function
	$scope.optimize = function(character){
		$scope.enabled = false;
		OptimizeService.optimize.save(character).$promise.then(function(response){
			$scope.optimized = response.data;
			$scope.optimized.type = getType($scope.optimized.value);
		});
	};
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