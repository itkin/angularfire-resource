angular.module('angularfire-resource')

.factory 'FireResource', ($firebaseObject, $firebaseUtils, Collection, AssociationFactory) ->

  (resourceRef, resourceOptions={}, callback) ->
    if angular.isFunction(resourceOptions)
      callback = resourceOptions
      resourceOptions = {}

    class Resource

      map = {}
      constructor: (ref) ->
        map[ref.key()]= this

        $firebaseObject.call this, ref

        @$$isNew = false


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


      @$new: (data={}) ->
        instance = new this(@$ref().push())
        instance.$$isNew = true
        angular.extend instance, data
        instance

      @$create: (data={}) ->
        @$new(data).$save()

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

      for name in ['beforeCreate', 'beforeSave', 'afterSave', 'afterCreate']
        @['_'+name]= []
        @[name]= (cb) ->
          @['_'+name].push cb
          this

      $isNew: ->
        @$$isNew

      $loaded: ->
        $firebaseObject::$loaded.apply(this, arguments)

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

        # state prop value to update eventually
        @$$isNew = false if @$$isNew and snap.val()
        @$$loaded = true

        # Update cached instance for hasOne assoc if loaded and changed server side
        old = $firebaseUtils.toJSON(this)
        result = $firebaseObject::$$updated.apply(this, arguments)
        for name, assoc of @constructor._assoc
          if assoc.type is 'HasOne' and @["$$#{name}"]? and @[assoc.$$conf.foreignKey] isnt old[assoc.$$conf.foreignKey]
            @["$$#{name}"] = null
            @["$#{name}"]()
        result

      # wrap the original angularfire $save function into the callback chain
      $save: ->
        $firebaseUtils.resolve()
        .then =>
          @$$runCallbacks('beforeCreate') if @$isNew()
        .then =>
          @$$runCallbacks('beforeSave')
        .then =>
          @createdAt = Firebase.ServerValue.TIMESTAMP if @$isNew()
          @updatedAt = Firebase.ServerValue.TIMESTAMP
        .then =>
          $firebaseObject::$save.apply(this, arguments)
        .then =>
          @$$runCallbacks('afterCreate') if @$isNew()
        .then =>
          @$$runCallbacks('afterSave')
        .then =>
          this

      $$runCallbacks: (name) ->
        promise = $firebaseUtils.resolve()
        for cb in @constructor['_' + name]
          cb = @[cb] if angular.isString(cb)
          promise = promise.then => cb.call(this)
        promise

      $$notify: ->
        console.log @constructor.$name.camelize(true), @$id, "updated"
        $firebaseObject::$$notify.apply this, arguments

      $firebaseObject.$extend Resource

      callback.call(this) if callback?

      Resource