# angularfire-resource
Resource factories built on top of AngularFire

> This library is under active development and currently not production ready yet

## Demo

https://fireresourcetest.firebaseapp.com

## Purpose

Allow this kind of candy coding

```javascript

angular.module('myApp')

  .factory('$firebase', function() {
    return new Firebase('https://fireresourcetest.firebaseio.com/');
  })

  .factory('User', function(FireResource, $firebase) {
    return FireResource($firebase.child('users'))
      .hasMany('conversations', {inverseOf: 'users'})
  })
  
  .factory('Conversation', function(FireResource, $firebase) {
    return FireResource($firebase.child('conversations'), function(){
      this.hasMany('users', {className: "User", inverseOf: 'conversations'});
      this.hasMany('messages', {className: "Message", inverseOf: 'conversation', storedAt: 'createdAtDesc' })
    });
  })
  
  .factory('Message', function(FireResource, $firebase) {
    return FireResource($firebase.child('messages'), function(){
      this.hasOne('user', { inverseOf: false });
      this.hasOne('conversation');
    });
  })
```

Maintain a deserialize database schema with duplicated foreign keys, to allow security enforcement and easy admin queries.

To continue on the above example : 

```
root
|_ users
| |_ userId1
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
|     |_ messageId1: true
|     |_ messageId2: true
|
|
|_ messages
  |_ messageId1
  | |_ userId: userId1
  | |_ conversationId1
  |_ messageId2
    |_ userId: userId2
    |_ conversationId1
    
```
  
## TODO

- Close the enhancement issues
- Write a readme
- Polish the demo
- Code some testing




