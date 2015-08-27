angular.module('angularfire-resource')

.factory 'FireResource', ($firebaseObject, $firebaseUtils, Collection, AssociationFactory) ->

  (resourceRef, resourceOptions={}) ->

    class Resource

      map = {}

      constructor: (ref) ->

        map[ref.key()]= this

        $firebaseObject.call this, ref

      @_assoc: new AssociationFactory(Resource)

      @clearMap: ->
        for key, instance of map
          instance.$destroy()

      @$name: resourceOptions.name or resourceRef.key().replace(/s$/,'')

      @$query: (ref) ->
        ref = ref(@$ref()) if typeof ref is 'function'
        new Collection Resource, ref

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
        if map[key]
          map[key]
        else
          new Resource Resource.$ref().child(key)

      @hasMany: (name, opts={}, cb)->
        @_assoc.create 'hasMany', name, opts, cb

      @hasOne: (name, opts = {}) ->
        @_assoc.create 'hasOne', name, opts

      $destroy: ->
        for name, opts of @constructor._assoc.map
          @['$$' + name].$destroy() if @['$$' + name]?
        $firebaseObject.prototype.$destroy.apply(this, arguments)
        delete map[@$id]

      $update: (data) ->
        angular.extend this, data
        @$save()

      $save: ->
        $firebaseObject.prototype.$save.apply(this, arguments).then =>
          this


      $$notify: ->
        console.log 'resource', @$id, arguments
        $firebaseObject::$$notify.apply this, arguments

      $firebaseObject.$extend Resource

