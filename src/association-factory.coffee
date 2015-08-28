angular.module('angularfire-resource')

.factory 'AssociationFactory', ($injector, $firebaseUtils, AssociationCollection) ->

  class AssociationsFactory

    publicKey = (name) -> '$' + name
    privateKey = (name) -> '$$' + name

    getResourceId = (resource) ->
      if angular.isObject(resource)
        resource.$id
      else
        resource

    throwError = (Resource, type, name, key) ->
      throw "Exception : #{Resource.$name.camelize(true)} #{type} #{name}, #{key} is mandatory"

    ensure_options = (Resource, type, name, opts) ->
      for key in ['className', 'inverseOf']
        throwError(Resource, type, name, key) unless opts[key]

      if type isnt 'hasMany' and not opts.foreignKey?
        throwError(Resource, type, name, 'foreignKey')
      true

    constructor: (Resource) ->
      @Resource = Resource
      @map = {}

    _addToMap: (type, name, opts) ->
      ensure_options(@Resource, type, name, opts)
      @map[name] = angular.extend(name: name, type: type, opts)

    create: (type, name, opts, cb) ->
      @_addToMap(type, name, opts)
      @['create' + type.camelize(true)](name, opts, cb)
      @Resource

    inverseOf: (name) ->
      assoc = null
      for key, opts of @map
        if opts.inverseOf == name
          assoc = opts
          break
      assoc

    get: (name) ->
      @map[name]

    _ResourceAdd: (name, cb) ->
      @Resource::[publicKey name] = cb

    createHasMany: (name, opts, cb) ->
      Resource = @Resource
      @map[name].remove = (resource, params) ->
        def = $firebaseUtils.defer()
        Resource.$ref().child(getResourceId(params.from)).child(name).child(getResourceId(resource)).set(null, $firebaseUtils.makeNodeResolver(def))
        def.promise

      @map[name].add = (resource, params) ->
        def = $firebaseUtils.defer()
        Resource.$ref().child(getResourceId(params.to)).child(name).child(getResourceId(resource)).set(resource.$id, $firebaseUtils.makeNodeResolver(def))
        def.promise

      @_ResourceAdd name, (updateRef) ->
        if updateRef or not @[privateKey name]
          @[privateKey name].$destroy() if @[privateKey name]
          @[privateKey name] = new AssociationCollection this, name, opts, (updateRef or cb)
        else
          @[privateKey name]

    createHasOne: (name, opts) ->

      reverseAssociation = ->
        $injector.get(opts.className)._assoc.get(opts.inverseOf)

      association = @map[name]


      Resource = @Resource

      @map[name].remove = (resource, params) ->
        def = $firebaseUtils.defer()
        Resource.$ref().child(getResourceId(params.from)).child(opts.foreignKey).once 'value', (snap)->
          if snap.val() isnt resource.$id
            snap.ref().set(null, $firebaseUtils.makeNodeResolver(def))
        def.promise

      @map[name].add = (resource, params) ->
        def = $firebaseUtils.defer()
        Resource.$ref().child(getResourceId(params.to)).child(opts.foreignKey).set(resource.$id, $firebaseUtils.makeNodeResolver(def))
        def.promise

      # association getter
      @_ResourceAdd name, ->
        klass = $injector.get opts.className
        if @[opts.foreignKey]?
          @[privateKey name] or= klass.$find(@[opts.foreignKey])
        else
          null


      @_ResourceAdd "set#{name.camelize(true)}", (newResource) ->
        oldResourceId = @[opts.foreignKey]

        newResourceId = if angular.isObject(newResource) then newResource.$id else newResource

        newResource = if angular.isObject(newResource)
                        newResource
                      else if newResource?
                        $injector.get(opts.className).$find(newResource)
                      else
                        null



        $firebaseUtils.resolve(oldResourceId == newResourceId)

          .then (same) ->
            $firebaseUtils.reject() if same

          #update the foreign key and the cached assoc
          .then =>
            @[opts.foreignKey] = newResourceId
            @[privateKey name] = newResource #resource or null
            association.add(newResource, to: this)

          #remove this from old resource if old resource
          .then =>
            reverseAssociation().remove(this, from: oldResourceId) if oldResourceId

          #add new resource to this if new resource
          .then =>
            reverseAssociation().add(this, to: newResource) if newResource

          .then =>
            newResource

          # when no change has to be made, just
          .catch ->
            newResource


      # association builder (Record the new instance and link it to the current one)
      @_ResourceAdd "create#{name.camelize(true)}" , (data) ->
        klass = $injector.get(opts.className)
        klass.$create(data).then (resource) =>
          @['$set' + name.camelize(true)](resource)



