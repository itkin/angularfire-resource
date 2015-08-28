angular.module('angularfire-resource')

.factory 'FireResource', ($firebaseObject, $firebaseUtils, Collection, AssociationFactory) ->

  (resourceRef, resourceOptions={}) ->

    class Resource

      map = {}
      @map = map
      constructor: (ref) ->

        map[ref.key()]= this

        $firebaseObject.call this, ref

        this

      @_assoc: {}

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
        @_assoc[name] = new AssociationFactory.HasMany(this, name, opts, cb)
        this

      @hasOne: (name, opts = {}) ->
        @_assoc[name] = new AssociationFactory.HasOne(this, name, opts)
        this

      $destroy: ->
        for name, assoc of @constructor._assoc
          @['$$' + name].$destroy() if @['$$' + name]?
        $firebaseObject.prototype.$destroy.apply(this, arguments)
        delete map[@$id]

      $update: (data) ->
        angular.extend this, data
        @$save()

      # Update cached instance for hasOne assoc if changed server side
      $$updated: (snap) ->
        old = $firebaseUtils.toJSON(this)
        result = $firebaseObject::$$updated.apply(this, arguments)
        for name, assoc of @constructor._assoc when assoc.type is 'HasOne'
          if @["$$#{name}"]? and @[assoc.$$conf.foreignKey] != old[assoc.$$conf.foreignKey]
            @["$$#{name}"] = null
            @["$#{name}"]()
        result

      $save: ->
        $firebaseObject.prototype.$save.apply(this, arguments).then =>
          this


      $$notify: ->
        console.log @constructor.$name.camelize(true), @$id, "updated"
        $firebaseObject::$$notify.apply this, arguments

      $firebaseObject.$extend Resource

