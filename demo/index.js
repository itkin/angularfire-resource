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
    timezone: 'Europe/London' // optional
  })
  .factory('$firebase', function() {
    return new Firebase('https://fireresourcetest.firebaseio.com/');
  })
  .factory('User', function(FireResource, $firebase) {
    return FireResource($firebase.child('users'), function(){
      this.hasMany('conversations', {inverseOf: 'users'});
      this.hasMany('activeConversations', {className: 'Conversation', inverseOf: 'activeAtUsers' });
      this.hasOne('displayedConversation', {className: 'Conversation', inverseOf: 'displayedAtUsers', foreignKey: 'displayedConversationId' });
      this.prototype.$conversationWith = function(user){
        if (!this.$$conversations){
          throw '$conversationWith bad call: messages need to be preloaded first'
        } else {
          return _.find(this.$conversations(), function (conv) {
            return (conv.users || [])[user.$id] ? true : false
          });
        }
      }
    })
  })
  .factory('Conversation', function(FireResource, $firebase) {
    return FireResource($firebase.child('conversations'), function(){
      this.hasMany('users', {className: "User", inverseOf: 'conversations'});
      this.hasMany('messages', {className: "Message", inverseOf: 'conversation', storedAt: 'createdAtDesc' }, function(baseRef){
        return new Firebase.util.Scroll(baseRef, '$value')
      });
      this.hasMany('activeAtUsers', {className: 'User', inverseOf: 'activeConversations' });
      this.hasMany('displayedAtUsers', {className: 'User', inverseOf: 'displayedConversation' });
      //fixme : messages need to be preloaded
      this.prototype.$userUnreadMessages = function(user){
        if (!this.$$messages){
          throw '$userUnreadMessages bad call: messages need to be preloaded first'
        } else{
          return _.filter(this.$messages(), function (message) {
            return message.userId != user.$id && !message.$redAtBy(user)
          });
        }
      }
    });
  })
  .factory('Message', function(FireResource, $firebase) {
    var Message = FireResource($firebase.child('messages'), function(){
      this.hasOne('user', { inverseOf: false });
      this.hasMany('redByUsers', {className: 'User', inverseOf: false, storedAt: function(){return Firebase.ServerValue.TIMESTAMP}} )
      this.hasOne('conversation');
      this.prototype.$redAtBy = function(user){
        return (this.redByUsers||{})[user.$id]
      }
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
          },
          preloadConversations: function($currentUser, Conversation){
            //todo developp the include option to preload stuff
            $currentUser.$conversations().$watch(function(opts){
              if (opts.event == 'child_added'){
                Conversation.$find(opts.key).$messages().$next(5);
              }
            });
            $currentUser.$conversations().$loaded()
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
  .controller('MainController', function($scope, $rootScope, $state, $cookies, $firebase, $currentUser, $presenceCheck, $window, preloadConversations){
    $window.user = $currentUser;
    $scope.$currentUser = $currentUser;

    $scope.logout = function(){
      $currentUser.$update({presence: 0});
      $firebase.unauth();
      $cookies.remove('authToken');
      $state.go('chat', {}, {reload: true});
    };

    $scope.$watch('$currentUser.name', function(oldVal, newVal){
      if (oldVal != newVal){
        $currentUser.$save()
      }
    });

    $rootScope.windowIsFocused = true;
    $($window).focus(function(){
      $rootScope.$apply(function(){
        $rootScope.windowIsFocused = true;
      });
    }).blur(function(){
      $rootScope.$apply(function() {
        $rootScope.windowIsFocused = false
      });
    });


  })
  .directive('scroller', function($timeout){
    return function($scope, element){
      function broadCastScrollEvent(){
        $scope.$broadcast('scroll', element[0].scrollTop, element[0].clientHeight)
      }
      $scope.$on('child-appended', function(){
        $timeout(function(){
          element[0].scrollTop = element[0].scrollHeight;
          broadCastScrollEvent()
        }, 100);
      });
      $(element).scroll(function(){
        $scope.$evalAsync(function(scope){
          broadCastScrollEvent()
        })
      });
    }
  })
  .directive('message', function($rootScope, $timeout){
    return {
      scope:{
        message: '=',
        user: '=',
        last: '=',
        conversation: '=',
      },
      link: function($scope, element, attrs, ngRepeat){
        // ask scroller directive to scroll down
        if ($scope.last){
          $scope.$emit('child-appended', $scope.conversation.$id)

        }
        // message is not read yet
        if ($scope.message.userId != $scope.user.$id && !$scope.message.$redAtBy($scope.user) ){
          var $elt = $(element);
          var height = $elt.height();
          var querying = false;

          // set the message as read if displayed to the client view
          var process = function(event, scrollTop, clientHeight){
            $timeout(function(){
              if (
                !querying &&
                $scope.conversation.$$displayed &&
                $elt.position().top + (height / 2) < $elt.parent()[0].scrollTop + $elt.parent()[0].clientHeight
              ){
                querying = true;
                $scope.message.$redByUsers().$add($scope.user)
                  .then(function(){
                    offTabActive();
                    offScroll();
                    $scope.$emit('message-red', $scope.conversation.$id);
                  })
                  .catch(function(){
                    querying = false
                  })
              }
            });
          };
          var offTabActive = $scope.$on('tab.active', process);
          var offScroll = $scope.$on('scroll', process);
        }
      }
    }
  })
  .directive('unreadMessages', function($timeout){
    return {
      scope:{
        conversation: '=',
        user: '=',
      },
      restrict: 'AE',
      template: '<span class="label label-danger" ng-if="unreadMessages"><span>{{unreadMessages}}</span> <span class="glyphicon glyphicon-envelope"></span></span>',
      link: function($scope, element, attrs){
        $scope.unreadMessages = 0;
        var timeout = null;
        if ($scope.conversation){
          $scope.$on('recalculate-unread-messages', function(event, conversationId){
            if (conversationId == $scope.conversation.$id) {
              var nb = $scope.conversation.$userUnreadMessages($scope.user).length;
              if (nb > 0){
                $timeout.cancel(timeout);
                timeout = $timeout(function(){
                  $scope.unreadMessages = nb >= 5 ? '+' + nb : nb
                },500)
              } else{
                $timeout.cancel(timeout);
                $scope.unreadMessages = nb >= 5 ? '+' + nb : nb
              }
            }
          });
        }
      }
    }
  })
  .directive('autoFocus', function($timeout){
    return function($scope, element){
      function focus() {
        $timeout(function(){
          element[0].focus()
        },10);
      }
      $scope.$watch('windowIsFocused', function(newVal){
        if ($(element).is(':visible') && newVal){
          focus()
        }
      });
      $scope.$on('tab.active', focus)
    }
  })
  .run(function($rootScope){
    $rootScope.$on('message-red', function(event, conversationId){
      $rootScope.$broadcast('recalculate-unread-messages', conversationId)
    });
    $rootScope.$on('child-appended', function(event, conversationId){
      $rootScope.$broadcast('recalculate-unread-messages', conversationId)
    });

  })
  .controller('ChatController', function($scope, $filter, $state, $timeout, $firebase, $q, User, Conversation, $window, $timeout, $firebaseArray, $currentUser) {

    $scope.users = User.$query(function(baseRef){
      return new Firebase.util.Scroll(baseRef, 'presence')
    })

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
      //if (!conversation.$$messages){
      //  conversation.$messages().$next(5)
      //}
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
      $q.resolve($currentUser.$conversationWith(user))
        .then(function (conversation) {
          if (conversation){
            return conversation
          } else {
            return $q.reject() ;
          }
        })
        .catch(function () {
          return $currentUser.$conversations().$create().then(function (conversation) {
            conversation.$users().$add(User.$find(user.$id)).then(function () {
              return conversation
            });
            return conversation
          })
        })
        .then(function (conversation) {
          conversation.$$displayed = true;
          return $currentUser.$activeConversations().$add(conversation)
        })
        .then(function (conversation) {
          user.$activeConversations().$add(conversation);
        })
    };

    if ($currentUser.$displayedConversation()){
      $currentUser.$displayedConversation().$$displayed = true;
    }

    //todo : include
    $scope.users.$next(10)
    $scope.newMessage = {};

  })
  .run(function($window, $timeout, $rootScope, $firebase, $firebaseObject, $firebaseArray, User,  $q, Message, Conversation) {
    $window.$timeout = $timeout
    $window.$firebase = $firebase;
    $window.$firebaseObject = $firebaseObject;
    $window.$firebaseArray = $firebaseArray;
    $window.User = User;
    $window.Message = Message
    $window.Conversation = Conversation
    $window.conversation = Conversation.$find("-Jy3XUBmCEaxiW4_x9HN")
    //$window.user = User.$find('-JxTmHHaQKFF4pubQDiB');
    //$window.user = User.$find('-JxQLz-l-U_z4d2hy4Z9');
    $window.$q= $q
  });
