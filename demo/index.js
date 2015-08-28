angular.module('myApp', [
    'ui.router',
    'ngCookies',
    'ui.bootstrap',
    'infinite-scroll',
    'firebase',
    'angularfire-resource'
  ])
  .factory('$firebase', function() {
    return new Firebase('https://fireresourcetest.firebaseio.com/');
    return new Firebase('ws://127.0.1:5000');
  })
  .factory('User', function(FireResource, $firebase) {
    return FireResource($firebase.child('users'))
      .hasMany('conversations', {className: 'Conversation', inverseOf: 'users' })
      .hasMany('messages', {className: 'Message', inverseOf: "user" })
      .hasMany('activeConversations', {className: 'Conversation', inverseOf: 'activeAtUsers' })
      .hasOne('displayedConversation', {className: 'Conversation', inverseOf: 'displayedAtUsers', foreignKey: 'displayedConversationId' })
  })
  .factory('Conversation', function(FireResource, $firebase) {
    Conversation = FireResource($firebase.child('conversations'))
      .hasMany('users', {className: "User", inverseOf: 'conversations'})
      .hasMany('messages', {className: "Message", inverseOf: 'conversation'}, function(baseRef){
        //return new Firebase.util.Scroll(baseRef, '$key')
        return baseRef
      })
      .hasMany('activeAtUsers', {className: 'User', inverseOf: 'activeConversations' })
      .hasMany('displayedAtUsers', {className: 'User', inverseOf: 'displayedConversation' });

    return Conversation

  })
  .factory('Message', function(FireResource, $firebase) {
    return FireResource($firebase.child('messages'))
      .hasOne('user', {className: 'User', inverseOf: "messages", foreignKey: "userId"})
      .hasOne('conversation', {className: 'Conversation', inverseOf: "messages", foreignKey: "conversationId"})
  })
  .factory('$auth', function($firebaseAuth, $firebase){
    return $firebaseAuth($firebase)
  })
  .config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/chat');

    $stateProvider
      .state('main',{
        abstract: true,
        controller: 'MainController',
        templateUrl: 'main.html',
        resolve: {
          $currentUser: function ($q, $firebase, User, $firebaseUtils, $auth, $cookies) {
            var storedToken = $cookies.get('authToken')
            return $q.resolve(storedToken)
              .then(function(storedToken){
                return storedToken ? storedToken : $q.reject('NO_SESSION')
              })
              .then(function(storedToken){
                return $auth.$authWithCustomToken(storedToken)
              })
              .then(function(authData) {
                var def = $q.defer()
                $firebase.child('mappings').child(authData.uid).once('value',function(snap) {
                  var userId = snap.val();
                  if (userId) {
                    User.$find(userId).$loaded().then(function(user){
                      def.resolve(user)
                    })
                  } else {
                    def.reject({code: 'NO_USER', message: 'No user found for this authentication session'})
                  }
                });
                return def.promise
              })
              .catch(function(err) {
                if (err.code != 'NO_SESSION'){
                  //alert(err.message)
                }
                console.log(err)
                $cookies.remove('authToken');
                return $q.resolve($auth.$authAnonymously())
                  .then(function (authData) {
                    return User.$create({name: 'Anonymous'})
                      .then(function (user) {
                        var def = $firebaseUtils.defer();
                        $firebase.child('mappings').child(authData.uid).set(user.$id, $firebaseUtils.makeNodeResolver(def))
                        return def.promise.then(function(){ return user })
                      })
                      .then(function(user){
                        $cookies.put('authToken', authData.token);
                        return user
                      })
                  });
              });
          },
          $presenceCheck: function($q, $firebase, $currentUser){
            var amOnline = $firebase.child('.info/connected');
            amOnline.on('value', function(snap){
              if (snap.val()){
                $currentUser.$ref().onDisconnect().update({presence: false});
                $currentUser.presence = true;
                $currentUser.$save();
              }
            });
          }
        }
      })
      .state('chat', {
        parent: 'main',
        url: '/chat',
        templateUrl: 'chat.html',
        controller: 'ChatController'
      })
  })
  .controller('MainController', function($scope, $state, $cookies, $firebase, $currentUser, $presenceCheck, $window){
    $window.user = $currentUser;
    $scope.$currentUser = $currentUser;

    $scope.logout = function(){
      $firebase.unauth();
      $cookies.remove('authToken');
      $state.go('chat', {}, {reload: true});
    };

    $scope.$watch('$currentUser.name', function(oldVal, newVal){
      if (oldVal != newVal){
        $currentUser.$save()
      }
    });

  })
  .directive('fillWindow', function($rootScope, $window){
    $rootScope.windowHeight = $window.innerHeight;
    $($window).resize(function(){
      $rootScope.$apply(function(){
        $rootScope.windowHeight = $window.innerHeight
      });
    });
    return {
      restrict: 'A',
      link: function($scope, element, attrs){
        var $elt = $(element);
        $scope.$watch('windowHeight', function(newVal, old){
          var val = newVal - $elt.offset().top + $scope.$eval(new Function('return '+attrs.fillWindow));
          if (val > 0){
            element.css({height: val+ 'px'});
          }
        })
      }
    }
  })
  .controller('ChatController', function($scope, $filter, $state, $firebase, $q, User, Conversation, $window, $timeout, $firebaseArray, $currentUser) {

    $scope.users = User.$query(function(baseRef){
      return new Firebase.util.Scroll(baseRef, 'presence')
    });

    $scope.users.$next(5);

    $scope.newMessage = {};

    $scope.sendMessage = function(){
      $currentUser.$displayedConversation().$messages().$create(angular.extend({},$scope.newMessage, {userId: $currentUser.$id}))
        .then(function(message){
          $scope.newMessage = {}
          message.$setUser($currentUser)
        })
    };

    $scope.selectConversation = function(conversation){
      conversation._display = true
      $currentUser.$setDisplayedConversation(conversation)
        //.then(function(conversation){
        //  conversation.$messages() .$next(5)
        //})
    };

    $scope.closeConv = function($event, conv){
      $event.preventDefault();
      $event.stopImmediatePropagation();
      $currentUser.$activeConversations().$remove(conv);
      if ($currentUser.$displayedConversation() == conv ){
        $currentUser.$setDisplayedConversation(null)
      }
    };
    $scope.talkTo = function(user){
      $q.resolve(_.find($currentUser.$conversations(), function(conv){ return (conv.users||[])[user.$id] ? true : false }))
        .then(function(conv){
          if (conv) { return conv }
          else {
            return $currentUser.$conversations().$create().then(function(conversation){
              return conversation.$users().$add(User.$find(user.$id)).then(function(){ return conversation });
            })
          }
        })
        .then(function(conversation){
          return $currentUser.$activeConversations().$add(conversation)
        })
        .then(function(conversation){
          $scope.selectConversation(conversation)
        });
    };
  });
  //.run(function($window, $rootScope, $firebase, $firebaseObject, $firebaseArray, User,  $q) {
  //  $window.$firebase = $firebase;
  //  $window.$firebaseObject = $firebaseObject;
  //  $window.$firebaseArray = $firebaseArray;
  //  $window.User = User;
  //  //$window.user = User.$find('-JxTmHHaQKFF4pubQDiB');
  //  $window.user = User.$find('-JxQLz-l-U_z4d2hy4Z9');
  //  $window.$q= $q
  //});
