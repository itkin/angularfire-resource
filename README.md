# angularfire-resource
Resource factories built on top of AngularFire

> This library is under active development and currently not production ready yet

## Demo

https://fireresourcetest.firebaseapp.com

## Purpose

Allow this kind of candy coding

```coffee

angular.module('myApp')

.factory 'User', (fireResource, $firebase) ->

  User = fireResource($firebase.child('users'))

  User.hasMany 'messages', className: 'Message', inverseOf: 'user', (baseRef) ->
    new (Firebase.util.Scroll)(baseRef, '$key', maxCacheSize: 10)

  User

.factory 'Message', (fireResource, $firebase) ->
  
  Message = fireResource($firebase.child('messages'))
  
  Message.belongsTo 'user', className: 'User', inverseOf: 'messages', foreignKey: 'userId'
  
  Message

.controller 'MyController', (User, $stateParams) ->

  $scope.user = User.$find($stateParams.userId) # returns an instance of User, which inherited of all $firebaseObject
  
  $scope.user.$messages() # returns a $firebaseArray populated of Message instances
  
  $scope.messagesLoaded = false
  
  $scope.user.$messages().$loaded().then ->
    $scope.messagesLoaded = true
    
  $scope.loadMore = ->
    $scope.user.$messages().$next(10)
    
  $scope.createMessage = (data) ->
    $scope.user.$messages().$create(data).then (message) ->
      console.log 'message instance has been saved and associated with $scope.user'
    
```

Maintain a deserialize database schema, with duplicated foreign keys, to allow security enforcement and easy admin queries.
To continue on the above example : 

```
root
|_ users
| |_ userId1
|   |_ messages
|     |_ messageId1: true
|     |_ messageId1: true
|
|_ messages
  |_ messageId1
  | |_ userId: userId1
  |_ messageId2
    |_ userId: userId1

```
  
## TODO

- Close the enhancement issues
- Write a readme
- Polish the demo
- Code some testing




