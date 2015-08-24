
angular.module('angularfire-resource')

.factory 'fireCollection', ($firebaseArray, $injector, $firebaseUtils) ->

  class Collection

    constructor: (parentRecord, name, opts, cb) ->
      @$$options = opts
      @$$targetClass = $injector.get @$$options.className

      @$parentRecord = parentRecord
      @$name = name

      ref = @$parentRecord.$ref().child(@$name) if @$parentRecord
      ref = cb(ref) if cb?
      return $firebaseArray.call this, ref

    _setInverseAssociation: (resource) ->
      resource['$set' + @$$options.inverseOf.camelize(true)].call(resource, @$parentRecord)

    $next: (pageSize) ->
      if @$ref().scroll
        @$ref().scroll.next(pageSize)
      else
        false

    # delegate to the parent klass constructor to create item and then add it to the collection
    $create: (data)->
      @$$targetClass.$create(data).then (resource) =>
        @$add(resource)

    # We do not use $save to save a $$notify cb
    $add: (resource) ->
      if @$indexFor(resource.$id) != -1
        $firebaseUtils.resolve()
      else
        def = $firebaseUtils.defer()
        @$ref().child(resource.$id).set true, $firebaseUtils.makeNodeResolver(def)
        def.promise.then =>
          @_setInverseAssociation(resource)

    # retrieve the associated resource
    $$added: (snap) ->
      result = $firebaseArray::$$added.apply(this, arguments)
      if result
        @$$targetClass.$find(snap.key()).$loaded()
      else
        result

    $destroy: ->
      item.$destroy() for item in @$list
      $firebaseArray::$destroy.apply(this, arguments)

    $$notify: ->
      console.log 'collection', arguments
      $firebaseArray::$$notify.apply this, arguments

    $firebaseArray.$extend Collection