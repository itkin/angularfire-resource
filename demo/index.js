angular.module('myApp', ['firebase', 'angularfire-resource'])

  .factory('$firebase', function() {
    return new Firebase('https://fireresourcetest.firebaseio.com/');
    //return new Firebase('ws://127.0.1:5000');
  })
  .controller('TestController', function($scope, $firebase, $window, $timeout) {

    //$firebase.child('users/' + $window.user.$id).on('value', function(snap) {
    //  return $timeout(function() {
    //    return $scope.rawUser = snap.val();
    //  });
    //});
    //
    $scope.user = $window.user;
    //
    $scope.userLoaded = false;
    //
    $scope.polls = $scope.user.$polls();
    //
    $scope.polls.$loaded().then(function(polls) {
      return $scope.userLoaded = true;
    });

    //return $scope.$watch('user', function(newVal, oldVal) {
    //  return console.log(newVal);
    //});
  })
  .factory('User', function(fireResource, $firebase) {
    var User = fireResource($firebase.child('users'))
    User.hasMany('polls', {className: 'Poll', inverseOf: 'user'}, function(baseRef){
      return new Firebase.util.Scroll(baseRef, '$key', {maxCacheSize: 10});
    });
    User.hasMany('messages', {className: 'Message', inverseOf: 'user' });
    User.hasOne('girlfriend', {className: 'User', foreignKey: 'girlfriendId', inverseOf: 'boyfriend'});
    User.hasOne('boyfriend', {className: 'User', foreignKey: 'boyfriendId', inverseOf: 'girlfriend'});

    return User;
    //return fireResource($firebase.child('users'), {
    //  hasMany: {
    //    polls: {
    //      className: 'Poll', sortBy: 'age'
    //    }
    //  }
    //});
  })
  .factory('Message', function(fireResource, $firebase) {
    var Message = fireResource($firebase.child('messages'));
    Message.belongsTo('user', {className: 'User', inverseOf: "messages", foreignKey: "userId"});
    return Message;
  })
  .factory('Poll', function(fireResource, $firebase) {
    Poll = fireResource($firebase.child('polls'));
    Poll.belongsTo('user', {className: "User", foreignKey: 'userId', inverseOf: 'polls'});
    return Poll
  })
  .run(function($window, $rootScope, $firebase, $firebaseObject, $firebaseArray, User, fireCollection, Poll, $q) {
    $window.$firebase = $firebase;
    $window.$firebaseObject = $firebaseObject;
    $window.$firebaseArray = $firebaseArray;
    $window.User = User;
    $window.fireCollection = fireCollection;
    //$window.user = User.$find('-JxTmHHaQKFF4pubQDiB');
    $window.user = User.$find('-JxQLz-l-U_z4d2hy4Z9');
    $window.Poll = Poll;
    $window.$q= $q
  });
