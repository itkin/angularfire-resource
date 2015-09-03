# angularfire-resource
Resource factory built on top of AngularFire
>
> This library is under active development and currently not production ready 
>

FireResource instances are extended [firebaseObject](https://www.firebase.com/docs/web/libraries/angular/api.html), so you'll find everything you're used to with angularfire, plus 
+ createdAt / updatedAt timestamps
+ hooks (beforeCreate, afterCreate, beforeSave, afterSave)
+ ensure an instance is not retrieved 2 times from firebase
+ handle associations (hasOne and hasMany, returns respectively a firebaseObject instance or an association collection)


AssociationCollection instances are extended [firebaseArray](https://www.firebase.com/docs/web/libraries/angular/api.html), plus 
+ they are made of FireResource instances
+ they can preload some of their instances relations (using $include)
+ they deal nicely with the fireUtil librairy for pagination & infinite scrolling work

## Usage

Set up your relations into a model layer

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
      this.hasMany('messages', {storedAt: 'createdAtDesc' }, function(baseRef, init){ // customize the way you store foreign keys collection to be able to sort data within a relation
        init(new Firebase.util.Scroll(baseRef, '$value')).$next(5); // use firebase util to handle the pagination 
      });
      this.beforeCreate(function(){        // hooks
        this.createdAtDesc = - Date.now()
      });
    });
  })
  
  .factory('Message', function(FireResource, $firebase) {
    return FireResource($firebase.child('messages'), function(){
      this.hasOne('user', { inverseOf: false }); // no message foreign key into the user model
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

And now write some clean controllers :-)

```javascript
angular.module('myApp')

  // $currentUser is an instance of User retrieved from a resolve
  .controller('ExamplesController', function($scope, Message, $currentUser){
    
    // $query on all ( rootUrl/users ) 
    $scope.allUsers = User.$query()
    
    // $query on some customizing your ref
    $scope.someUsers = User.$query(function(baseRef, init){
      init(new Firebase.util.Scroll(baseRef, 'presence')).$next(10)
    });
    
    // use $next and $prev to access the scroll instance of your custom ref (if used)
    $scope.loadMoreUsers = function(){
      $scope.someUsers.$next(10)
    };

    // preload associations
    $scope.conversations = $currentUser.$conversations().$include('messages')
    
    $scope.newMessage = Message.$new()
    $scope.saveMessage = function(){
      angular.extend($scope.newMessage, { userId: $currentUser.$id });

      //add an instance to a collection
      $currentUser.$displayedConversation().$messages().$add($scope.newMessage)
      $scope.newMessage = Message.$new();
    };
    
    $scope.createConversationWith = function(user) {
      // do sequential operations
      return $currentUser.$conversations().$create()
        .then(function (conversation) {
          conversation.$users().$add(user);
        })
  })
    
```
## Demo

To have a more in depth look over a practical case, check out the demo

https://fireresourcetest.firebaseapp.com

## API

### FireResource

params : 

- firebase reference, 
- options 
- callback function called in the context of the defined resource (to add methods, relations, or override stuff)

#### Resource.hasMany

Set a relation one to many

params :
- name : name of the relation
- options
  - `className` : the targetted class name, default is `name.replace(/s$/,'').camelize(true)`
  - `inverseOf`: the inverse relation, default is `Resource.$ref().key().replace(/s$/,'')`, `false` not to maintain foreign key on the related model
  - `storedAt`: string, object, array of function specifiying how the related instance will be stored in the parent model. Per default it will maintain a set of childKey: true  

Defines the following methods into the parent class : 
- resource.$name() : get the association array

#### Resource.hasOne

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




