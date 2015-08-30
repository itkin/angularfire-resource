angular.module('myApp', [
    'ui.router',
    'ngCookies',
    'ui.bootstrap',
    'zInfiniteScroll',
    'firebase',
    'angularfire-resource',
    'angularMoment'
  ])
  .constant('angularMomentConfig', {
    //preprocess: 'unix', // optional
    timezone: 'Europe/London' // optional
  })
  .factory('$firebase', function() {
    return new Firebase('https://fireresourcetest.firebaseio.com/');
    //return new Firebase('ws://127.0.1:5000');
  })
  .factory('User', function(FireResource, $firebase) {
    return FireResource($firebase.child('users'))
      .hasMany('conversations', {inverseOf: 'users'})
      .hasMany('activeConversations', {className: 'Conversation', inverseOf: 'activeAtUsers' })
      .hasOne('displayedConversation', {className: 'Conversation', inverseOf: 'displayedAtUsers', foreignKey: 'displayedConversationId' })
  })
  .factory('Conversation', function(FireResource, $firebase) {
    return FireResource($firebase.child('conversations'), function(){
      this.hasMany('users', {className: "User", inverseOf: 'conversations'});
      this.hasMany('messages', {className: "Message", inverseOf: 'conversation', storedAt: 'createdAtDesc' }, function(baseRef){
        var ref = new Firebase.util.Scroll(baseRef, '$value')
        ref.scroll.next(5)
        return ref
      });
      this.hasMany('activeAtUsers', {className: 'User', inverseOf: 'activeConversations' })
      this.hasMany('displayedAtUsers', {className: 'User', inverseOf: 'displayedConversation' });
    });
  })
  .factory('Message', function(FireResource, $firebase) {
    var Message = FireResource($firebase.child('messages'), function(){
      this.hasOne('user', { inverseOf: false });
      this.hasOne('conversation');
    });
    var originalCreate = Message.$create;
    Message.$create = function(data){
      data = data || {};
      data['createdAtDesc'] = - Date.now()
      return originalCreate.apply(this, [data]);
    }
    return Message
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
                $currentUser.$ref().onDisconnect().update({presence: 0, disconnectedAt: Firebase.ServerValue.TIMESTAMP});
                $currentUser.$ref().update({presence: -1});
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
  .directive('scrollParentToLastElement', function($timeout){
    return {
      link: function($scope, element, attrs){
        if ($scope.$last){
          $timeout(function(){
            $(element).parent().scrollTop($(element).parent()[0].scrollHeight);
          }, 100);
        }
      }
    }
  })
  .controller('ChatController', function($scope, $filter, $state, $timeout, $firebase, $q, User, Conversation, $window, $timeout, $firebaseArray, $currentUser) {

    $scope.users = User.$query(function(baseRef){
      return new Firebase.util.Scroll(baseRef, 'presence')
    });

    $scope.loadUsers = function(){
      return function(){
        $scope.users.$next(10)
      }
    };
    $scope.loadMore = function(conversation){
      return function(){
        return conversation.$messages().$next(5)
      }
    };
    $scope.sendMessage = function(){
      $currentUser.$displayedConversation().$messages().$create(angular.extend({},$scope.newMessage, {userId: $currentUser.$id}))
      $scope.newMessage = {};
    };

    $scope.selectConversation = function(conversation){
      $currentUser.$setDisplayedConversation(conversation);
    };

    $scope.closeConv = function($event, conv){
      $currentUser.$activeConversations().$remove(conv);
      return false
    };

    $scope.talkTo = function(user) {
      if ($currentUser.$id == user.$id){
        return
      }
      $currentUser.$conversations().$loaded()

        .then(function (conversations) {
          return _.find(conversations, function (conv) {
            return (conv.users || [])[user.$id] ? true : false
          }) || $q.reject()
        })
        .catch(function (conv) {
          return $currentUser.$conversations().$create().then(function (conversation) {
            return conversation.$users().$add(User.$find(user.$id)).then(function () {
              return conversation
            });
          })
        })
        .then(function (conversation) {
          return $currentUser.$activeConversations().$add(conversation)
        })
        .then(function (conversation) {
          conversation.$$displayed = true;
          user.$activeConversations().$add(conversation);
        })
    };

    if ($currentUser.$displayedConversation()){
      $currentUser.$displayedConversation().$$displayed = true;
    }
    $scope.users.$next(10);
    $scope.newMessage = {};


  })
  .run(function($window, $timeout, $rootScope, $firebase, $firebaseObject, $firebaseArray, User,  $q, Message) {
    $window.$timeout = $timeout
    $window.$firebase = $firebase;
    $window.$firebaseObject = $firebaseObject;
    $window.$firebaseArray = $firebaseArray;
    $window.User = User;
    $window.Message = Message
    //$window.user = User.$find('-JxTmHHaQKFF4pubQDiB');
    //$window.user = User.$find('-JxQLz-l-U_z4d2hy4Z9');
    $window.$q= $q
  });
