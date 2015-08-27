angular.module('angularfire-resource')

.factory 'AssociationFactory', ($injector, $firebaseUtils, AssociationCollection) ->

  class AssociationsFactory

    publicKey = (name) -> '$' + name
    privateKey = (name) -> '$$' + name

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
      @_ResourceAdd name, (updateRef) ->
        if updateRef or not @[privateKey name]
          @[privateKey name].$destroy() if @[privateKey name]
          @[privateKey name] = new AssociationCollection this, name, opts, (updateRef or cb)
        else
          @[privateKey name]

      @map[name].reverseAssociationSet = (action = 'add', record) ->
        if action is 'add'
          @[publicKey name ]().$add record
        else if action is 'remove'
          @[publicKey name ]().$remove record


    createHasOne: (name, opts) ->
      # association getter
      @_ResourceAdd name, ->
        klass = $injector.get opts.className
        if @[opts.foreignKey]?
          @[privateKey name] or= klass.$find(@[opts.foreignKey])
        else
          null

      setIfDifferent = (instance, foreignKey, oldResource, newResource) ->

      @_ResourceAdd "set#{name.camelize(true)}", (newResource) ->
        oldResource = @[publicKey name]()

        $firebaseUtils.resolve(oldResource == newResource)

          .then (same) ->
            $firebaseUtils.reject() if same

          #update the foreign key and the cached assoc
          .then =>
            @[privateKey name] = newResource #resource or null
            def = $firebaseUtils.defer()
            @$ref().child(opts.foreignKey).set(
              if newResource then newResource.$id else null,
              $firebaseUtils.makeNodeResolver(def)
            )
            def.promise

          #remove this from old resource if old resource
          .then =>
            oldResource.constructor._assoc.get(opts.inverseOf).reverseAssociationSet.call(oldResource, 'remove', this) if oldResource

          #add new resource to this if new resource
          .then =>
            newResource.constructor._assoc.get(opts.inverseOf).reverseAssociationSet.call(newResource, 'add', this) if newResource

          .then =>
            newResource

          # when no change has to be made, just
          .catch ->
            $firebaseUtils.resolve(newResource)


      # association builder (Record the new instance and link it to the current one)
      @_ResourceAdd "create#{name.camelize(true)}" , (data) ->
        klass = $injector.get(opts.className)
        klass.$create(data).then (resource) =>
#          @map.get(name).reverseSet.call(this, resource)
          @['$set' + name.camelize(true)](resource)

      @map[name].reverseAssociationSet = (action = 'add', record) ->
        if action is 'add'
          @['$set' + name.camelize(true)](record)
        else if action is 'remove'
          @['$set' + name.camelize(true)](null)
