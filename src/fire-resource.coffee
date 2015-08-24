angular.module('angularfire-resource')

.factory 'fireResource', ($firebaseObject, fireCollection, $firebaseUtils, $injector, utils) ->

  class RelConfig
    constructor: ->
      @_map = {}

    add: (type, name, opts) ->
      @_map[name] = angular.extend(name: name, type: type, opts)

    findInverseOf: (name) ->
      assoc = null
      for key, opts of @_map
        if opts.inverseOf == name
          assoc = opts
          break
      assoc

  (resourceRef, resourceOptions={}) ->

    resourceOptions.hasMany or= {}
    resourceOptions.name or= resourceRef.key().replace(/s$/,'')

    class Resource

      constructor: (ref) ->
        return $firebaseObject.call this, ref

      @_relations = new RelConfig()

      @_name = resourceOptions.name

      @_foreignKey = @_name + 'Id'

      @$ref: ->
        resourceRef

      @$create: (data) ->
#           new Resource(Resource.$ref().push(data)).$loaded()
        def = $firebaseUtils.defer()
        ref = Resource.$ref().push()
        ref.set $firebaseUtils.toJSON(data), $firebaseUtils.makeNodeResolver(def)
        def.promise.then ->
          new Resource(ref).$loaded()

      @$find: (key) ->
        new Resource(Resource.$ref().child(key))

      @hasMany: (name, opts={}, cb)->
        @_relations.add 'hasMany', name, opts
        Resource::['$' + name] = (updateRef) ->
          if updateRef or not @['$$' + name]
            @['$$' + name].$destroy() if @['$$' + name]
            @['$$' + name] = new fireCollection angular.extend({}, opts, parentRecord: this, name: name), updateRef or cb
          else
            @['$$' + name]

      @hasOne: (name, opts = {}) ->
        @_relations.add 'hasOne', name, opts
        Resource::['$' + name] = () ->
          klass = $injector.get(opts.className)
          if @[opts._foreignKey]
            @['$$' + name] or= new klass klass.$ref().child(@[opts._foreignKey])
          else
            null

        Resource::['$' + utils.toCamelCase("create-#{name}")] = (data) ->
          klass = $injector.get(opts.className)
          klass.$create(data).then (resource) =>
            @['$' + utils.toCamelCase("set-#{name}")](resource)

        Resource::['$' + utils.toCamelCase("set-#{name}")] = (resource) ->
          if @[opts.foreignKey] == resource.$id
            $firebaseUtils.resolve()
          else
            def = $firebaseUtils.defer()
            @$ref().child(opts.foreignKey).set(resource.$id, $firebaseUtils.makeNodeResolver(def))

            def.promise.then =>
              klass = $injector.get(opts.className)
              resource[utils.toCamelCase('$set-'+klass._relations.findInverseOf(name).name)](this)

      @belongsTo: (name, opts={}) ->
        @_relations.add 'belongsTo', name, opts

        # $setAssociation ( resource)
        # Set the foreignKey of the child with the parent_id
        # Then $add the child to the parent collection
        Resource::["$"+utils.toCamelCase("set-#{name}")] = (resource) ->
          if @[opts.foreignKey] == resource.$id
            $firebaseUtils.resolve()
          else
            def = $firebaseUtils.defer()
            @$ref().child(opts.foreignKey).set resource.$id, $firebaseUtils.makeNodeResolver(def)
            def.promise.then =>
              resource[ "$" + opts.inverseOf]().$add(this)


      $destroy: ->
        for key, params of resourceOptions.hasMany
          @['$$' + key].$destroy() if @['$$' + key]?
        $firebaseObject.prototype.$destroy.apply(this, arguments)

      $$notify: ->
        console.log 'resource', @$id, arguments
        $firebaseObject::$$notify.apply this, arguments

      #        for key, params of resourceOptions.hasMany
      #          Resource::['$' + key] = ->
      #            @['$$' + key] or= new fireCollection(this, key, angular.extend({}, params, foreignKey: @constructor._foreignKey))

      $firebaseObject.$extend Resource

