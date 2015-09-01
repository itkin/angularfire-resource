
angular.module('angularfire-resource')

.factory 'Collection', ($firebaseArray, $firebaseUtils, $timeout) ->
  class Collection
    constructor: (targetClass, ref) ->
      @$$targetClass = targetClass
      ref or= @$$targetClass.$ref().ref()

      return $firebaseArray.call this, ref

    $loaded: ->
      $firebaseArray::$loaded.apply(this, arguments).then =>
        itemsPromises = []
        itemsPromises.push item.$loaded() for item in @$list
        $firebaseUtils.allPromises(itemsPromises)

    # retrieve the associated resource
    $$added: (snap) ->
      result = $firebaseArray::$$added.apply(this, arguments)
      if result
        @$$targetClass.$find(snap.key()) #.$loaded()
      else
        result

    #no update (they are done via the instance)
    $$updated: (snap) ->
      false

    $next: (pageSize) ->
      if @$ref().scroll
        def = $firebaseUtils.defer()
        if @$ref().scroll.hasNext()
          @$ref().once 'value', =>
            @$loaded().then -> def.resolve()
          @$ref().scroll.next(pageSize)
        else
          def.resolve()
        def.promise
      else
        false

    $prev: (pageSize) ->
      if @$ref().scroll
        @$ref().scroll.prev(pageSize)
        @$loaded()
      else
        false

  $firebaseArray.$extend Collection

.factory 'AssociationCollection', ($firebaseArray, $injector, Collection, $firebaseUtils) ->

  class AssociationCollection extends Collection

    constructor: (parentRecord, association, opts, cb) ->
      @$$options = opts
      @$$targetClass = $injector.get @$$options.className
      @$$association = association
      
      @$parentRecord = parentRecord

      ref = @$parentRecord.$ref().child(@$$association.name) if @$parentRecord
      ref = cb(ref) if cb?
      return $firebaseArray.call this, ref

    # delegate to the parent klass constructor to create item and then add it to the collection
    $create: (data)->
      @$$targetClass.$create(data).then (resource) =>
        @$add(resource)


    # We do not use $save to save a $$notify cb
    $add: (resource) ->
      @$$association.add(resource, to: @$parentRecord)
        .then (resource) =>
          @$$association.reverseAssociation().add(@$parentRecord, to: resource) if @$$association.reverseAssociation()
        .then -> resource

    $remove: (resource) ->
      $firebaseArray::$remove.call(this, resource)
      .then =>
        @$$association.reverseAssociation().remove(@$parentRecord, from: resource) if @$$association.reverseAssociation()
      .then ->
        resource
      .catch =>
        console.log @$$association.name.camelize(true), @$parentRecord.$id, @$$association.name, arguments
        resource


#    $destroy: ->
##      item.$destroy() for item in @$list
#      $firebaseArray::$destroy.apply(this, arguments)

    $$notify: ->
      console.log @$parentRecord.constructor.$name.camelize(true), @$parentRecord.$id, @$$association.name, arguments[0], arguments[1]
      $firebaseArray::$$notify.apply this, arguments

