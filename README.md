# angularfire-resource

Resource factory built on top of AngularFire

> Alpha release, feedback apreciated 

## Abstract

Resource instances are extended [firebaseObject](https://www.firebase.com/docs/web/libraries/angular/api.html), so you'll find everything you're used to with firebase object, plus 
+ createdAt / updatedAt timestamps
+ hooks (beforeCreate, afterCreate, beforeSave, afterSave)
+ a global instances map for each resource to ensure an instance is not retrieved 2 times from firebase
+ associations (hasOne, hasMany, hasAndBelongsToMany returning respectively a firebaseObject instance or association collections)

AssociationCollection instances are extended [firebaseArray](https://www.firebase.com/docs/web/libraries/angular/api.html), plus 
+ they are made of Resource instances
+ they can preload their own instances associations
+ they deal nicely with the [firebase-util librairy](https://github.com/firebase/firebase-util) for pagination & infinite scrolling work

## Install

```
bower install angularfire-resource --save
```
or

```
npm install angularfire-resource --save
```

## Usage

Add the 'angularfire-resource' module as a dependency to your application module, and then define your model classes and their relations 
through the FireResource factory

```javascript

angular.module('myApp', ['angularfire-resource'])

  .factory('$firebase', function() {
    return new Firebase('https://fireresourcetest.firebaseio.com/');
  })

  .factory('User', function(FireResource, $firebase) {
    return FireResource($firebase.child('users'))
      .hasMany('conversations')
      .hasOne('displayedConversation', {className: 'Conversation', inverseOf: false, foreignKey: 'displayedConversationId' })
  })
  
  .factory('Conversation', function(FireResource, $firebase) {
    return FireResource($firebase.child('conversations'), function(){
      this.hasMany('users');
      // customize the way you store foreign keys to be able to sort your association collection
      this.hasMany('messages', {storedAt: 'createdAtDesc' }, function(baseRef, init){
        // use firebase util to handle the pagination
        init(new Firebase.util.Scroll(baseRef, '$value')).$next(5);  
      });
      // use hooks
      this.beforeCreate(function(){        
        this.createdAtDesc = - Date.now()
      });
    });
  })
  
  .factory('Message', function(FireResource, $firebase) {
    return FireResource($firebase.child('messages'), function(){
      // define one sided association (ie here no message foreign key will be set into the user model)
      this.hasOne('user', { inverseOf: false }); 
      this.hasOne('conversation');
    });
  })
  
```

The above code will maintain a deserialized data model with duplicated foreign keys, to allow security enforcement and easy admin queries.

```
root
|_ users
| |_ userId1
| | |_ displayedConversationId: conversationId1
| | |_ conversations
| |   |_ conversationId1: true
| |_ userId2
|   |_ conversations
|     |_ conversationId1: true
|
|
|_ conversations
| |_ conversationId1
|   |_users
|   | |_ userId1: true
|   | |_ userId2: true
|   |_ messages
|     |_ messageId1: aCustomValue 
|     |_ messageId2: aCustomValue
|
|
|_ messages
  |_ messageId1
  | |_ userId: userId1
  | |_ conversationId: conversationId1
  |_ messageId2
    |_ userId: userId2
    |_ conversationId: conversationId1
    
```

And now you can write some clean controllers :-)

```javascript

angular.module('myApp')

  // Let's asume $currentUser is an instance of User retrieved from a resolve
  .controller('ExamplesController', function($scope, User, Message, $currentUser){
    
    // get a resource from its key
    $scope.user = User.$find($currentUser.$id)
    
    // each instance is retrieved only once from firebase, then synced thanks to the angularfire ObjectSyncManager
    $scope.user === $currentUser
     
    // get all instances of (will query on rootUrl/users ) 
    $scope.allUsers = User.$query()
    
    // get some instances, customizing the ref
    $scope.someUsers = User.$query(function(baseRef, init){
      init(new Firebase.util.Scroll(baseRef, 'presence')).$next(10)
    });
    
    // use $next and $prev functions to access the scroll instance of your custom ref (if firebase util is used)
    $scope.loadMoreUsers = function(){
      $scope.someUsers.$next(10)
    };
    
    // get associated instances collection
    $scope.conversations = $currentUser.$conversations()
    
    // preload 2nd level associations
    $scope.conversations = $currentUser.$conversations().$include('messages')
    
    // Instanciate new model 
    $scope.newMessage = Message.$new()
    $scope.saveMessage = function(){
      angular.extend($scope.newMessage, { userId: $currentUser.$id });

      // save a new instance by adding it to a collection 
      $currentUser.$displayedConversation().$messages().$add($scope.newMessage)
      $scope.newMessage = Message.$new();
    };
    
    // do sequential operations
    $scope.createConversationWith = function(user) {
      // create an instance and add it into a collection
      return $currentUser.$conversations().$create()
        .then(function (conversation) {
          // then add it to an other collection
          conversation.$users().$add(user);
        })
  })
    
```
## Demo

To have a more in depth look over a practical case, [check out the demo](http://itkin.github.io/angularfire-resource/demo/index.html)

## API / Documentation

[In progress here](http://itkin.github.io/angularfire-resource/doc/index.html)
 




