angular.module('angularfire-resource')

.factory 'fireResource', ($firebaseObject, $firebaseUtils, fireCollection, AssociationFactory) ->

  (resourceRef, resourceOptions={}) ->

    class Resource

      constructor: (ref) ->
        return $firebaseObject.call this, ref

      @_assoc: new AssociationFactory(Resource)

      @$name: resourceOptions.name or resourceRef.key().replace(/s$/,'')

      @$ref: ->
        resourceRef

      @$create: (data) ->
        # new Resource(Resource.$ref().push(data)).$loaded()
        def = $firebaseUtils.defer()
        ref = Resource.$ref().push()
        ref.set $firebaseUtils.toJSON(data), $firebaseUtils.makeNodeResolver(def)
        def.promise.then ->
          new Resource(ref).$loaded()

      @$find: (key) ->
        new Resource(Resource.$ref().child(key))

      @hasMany: (name, opts={}, cb)->
        @_assoc.create 'hasMany', name, opts, cb

      @hasOne: (name, opts = {}) ->
        @_assoc.create 'hasOne', name, opts

      @belongsTo: (name, opts = {}) ->
        @_assoc.create 'belongsTo', name, opts

      $destroy: ->
        @['$$' + name].$destroy() if @['$$' + name]? for name, opts of @_assoc.map
        $firebaseObject.prototype.$destroy.apply(this, arguments)

      $$notify: ->
        console.log 'resource', @$id, arguments
        $firebaseObject::$$notify.apply this, arguments

      $firebaseObject.$extend Resource

