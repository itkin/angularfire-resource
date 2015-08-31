# angularfire-resource
Resource factory built on top of AngularFire

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
  | |_ conversationId: conversationId1
  |_ messageId2
    |_ userId: userId2
    |_ conversationId: conversationId1
    
```
## API

FireResources's instance are basically extended $firebaseObject ones, refer to the angularfire [documentation](https://www.firebase.com/docs/web/libraries/angular/api.html)

#FireResource
Set your class up
params : 
- firebase reference, 
- options 
- callback function called in the context of the defined resource (to add methods, relations, or override stuff)

#Resource.HasMany
Set a relation one to many
params :
- name : name of the relation
- options
  - `className` : the targetted class name, default is `name.replace(/s$/,'').camelize(true)`
  - `inverseOf`: the inverse relation, default is `Resource.$ref().key().replace(/s$/,'')`, `false` not to maintain foreign key on the related model
  - `storedAt`: string, object, array of function specifiying how the related instance will be stored in the parent model. Per default it will maintain a set of childKey: true  

Defines the following methods into the parent class : 
- resource.$name() : get the association array

#Resource.HasOne
Set a relation one to one or one to many
params :
- name : name of the relation
- options
  - `className` : the targetted class name, default is `name.replace(/s$/,'').camelize(true)`
  - `inverseOf`: the inverse relation, default is `Resource.$ref().key().replace(/s$/,'')`, `false` not to maintain foreign key on the related model
  - `foreignKey`: specify the property name where the related instance $id will be stored on the Resource instance, default is `name.replace(/s$/,'')+'Id'`

Defines the following function on the parent class prototype : 
- $#{name} : get the associated Resource
- $set#{name} : set the associated Resource


[to be continued]

## TODO

- Close the enhancement issues
- Write a readme
- Polish the demo
- Code some testing




