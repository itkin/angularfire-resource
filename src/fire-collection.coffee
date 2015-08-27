
angular.module('angularfire-resource')

.factory 'Collection', ($firebaseArray) ->
  class Collection
    constructor: (targetClass, ref) ->
      @$$targetClass = targetClass
      ref or= @$$targetClass.$ref().ref()

      return $firebaseArray.call this, ref

    # retrieve the associated resource
    $$added: (snap) ->
      result = $firebaseArray::$$added.apply(this, arguments)
      if result
        @$$targetClass.$find(snap.key()).$loaded()
      else
        result

    $next: (pageSize) ->
      if @$ref().scroll
        @$ref().scroll.next(pageSize)
      else
        false

  $firebaseArray.$extend Collection

.factory 'AssociationCollection', ($firebaseArray, $injector, Collection, $firebaseUtils) ->

  class AssociationCollection extends Collection

    constructor: (parentRecord, name, opts, cb) ->
      @$$options = opts
      @$$targetClass = $injector.get @$$options.className

      @$parentRecord = parentRecord
      @$name = name

      ref = @$parentRecord.$ref().child(@$name) if @$parentRecord
      ref = cb(ref) if cb?
      return $firebaseArray.call this, ref

    _setReverseAssociation: (action = 'add', resource) ->
      reverseAssoc = resource.constructor._assoc.get(@$$options.inverseOf)
      if action is 'add'
        reverseAssoc.reverseAssociationSet.call(resource, 'add', @$parentRecord)
      else if action is 'remove'
        reverseAssoc.reverseAssociationSet.call(resource, 'remove', @$parentRecord)


    # delegate to the parent klass constructor to create item and then add it to the collection
    $create: (data)->
      @$$targetClass.$create(data).then (resource) =>
        @$add(resource)

    # We do not use $save to save a $$notify cb
    $add: (resource) ->
      if @$indexFor(resource.$id) != -1
        $firebaseUtils.resolve(resource)
      else
        def = $firebaseUtils.defer()
        @$ref().child(resource.$id).set true, $firebaseUtils.makeNodeResolver(def)
        def.promise.then =>
          @_setReverseAssociation('add', resource)
          resource

    $remove: (resource) ->
      $firebaseArray::$remove.call(this, resource)
      .then =>
        @_setReverseAssociation('remove', resource)
      #resource not found (has already been return)
      .catch =>
#        console.log(this, arguments)
        resource


#    $destroy: ->
##      item.$destroy() for item in @$list
#      $firebaseArray::$destroy.apply(this, arguments)

    $$notify: ->
      console.log @$parentRecord.constructor.$name.camelize(true), @$parentRecord.$id, @$name, arguments
      $firebaseArray::$$notify.apply this, arguments

