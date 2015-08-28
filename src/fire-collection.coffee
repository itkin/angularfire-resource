
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



    # delegate to the parent klass constructor to create item and then add it to the collection
    $create: (data)->
      @$$targetClass.$create(data).then (resource) =>
        @$add(resource)

    # We do not use $save to save a $$notify cb
    $add: (resource) ->
      def = $firebaseUtils.defer()
      @$ref().child(resource.$id).set true, $firebaseUtils.makeNodeResolver(def)
      def.promise
        .then =>
          resource.constructor._assoc[@$$options.inverseOf].add(@$parentRecord, to: resource)
        .then ->
          resource

    $remove: (resource) ->
      $firebaseArray::$remove.call(this, resource)
      .then =>
        resource.constructor._assoc[@$$options.inverseOf].remove(@$parentRecord, from: resource)
      .then ->
        resource
      .catch =>
        resource


#    $destroy: ->
##      item.$destroy() for item in @$list
#      $firebaseArray::$destroy.apply(this, arguments)

    $$notify: ->
      console.log @$parentRecord.constructor.$name.camelize(true), @$parentRecord.$id, @$name, arguments[0], arguments[1]
      $firebaseArray::$$notify.apply this, arguments

