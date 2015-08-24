
angular.module('angularfire-resource')

.factory 'fireCollection', ($firebaseArray, $injector, $firebaseUtils, $q, utils) ->

  class Collection

    constructor: (opts, cb) ->
      @_opts = opts
      @_parentRecord = @_opts.parentRecord
      @_targetClass = $injector.get(@_opts.className)

      ref = @_parentRecord.$ref().child(@_opts.name)
      ref = cb(ref) if cb?
      return $firebaseArray.call this, ref

    $next: (pageSize)->
      if @$ref().scroll
        @$ref().scroll.next(pageSize)
      else
        false


    # delegate to the parent klass constructor to create item and then add it to the collection
    $create: (data)->
      @_targetClass.$create(data).then (resource) =>
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


    _setInverseAssociation: (resource) ->
      resource[utils.toCamelCase('$set-' + @_opts.inverseOf)].call(resource, @_parentRecord)

    # retrieve the associated resource
    $$added: (snap) ->
      result = $firebaseArray::$$added.apply(this, arguments)
      if result
        @_targetClass.$find(snap.key()).$loaded()
      else
        result

    $destroy: ->
      item.$destroy() for item in @$list
      $firebaseArray.prototype.$destroy.apply(this, arguments)

    $$notify: ->
      console.log 'collection', arguments
      $firebaseArray::$$notify.apply this, arguments

    $firebaseArray.$extend Collection