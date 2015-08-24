angular.module('angularfire-resource')

.factory 'AssociationFactory', ($injector, $firebaseUtils) ->

  class AssociationsFactory

    publicKey = (name) -> '$' + name
    privateKey = (name) -> '$$' + name

    setAttrIfDifferent = (attr, value, cb) ->
      if @[attr] == value
        $firebaseUtils.resolve()
      else
        def = $firebaseUtils.defer()
        @$ref().child(attr).set value, $firebaseUtils.makeNodeResolver(def)
        def = def.promise.then(cb) if cb
        def

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

    inverseOf: (name) ->
      assoc = null
      for key, opts of @map
        if opts.inverseOf == name
          assoc = opts
          break
      assoc

    createHasMany: (name, opts, cb) ->
      @Resource::[publicKey name ] = (updateRef) ->
        if updateRef or not @[privateKey name]
          @[privateKey name].$destroy() if @[privateKey name]
          @[privateKey name] = new fireCollection this, name, opts, updateRef or cb
        else
          @[privateKey name]

    createHasOne: (name, opts) ->
      # $association , association getter
      @Resource::[publicKey name] = () ->
        klass = $injector.get opts.className
        if @[opts.foreignKey]
          @[privateKey name] or= new klass klass.$ref().child @[opts.foreignKey]
        else
          null

      # $createAssociation (Record the new instance and link it to the current one)
      @Resource::[publicKey('create' + name.camelize(true))] = (data) ->
        klass = $injector.get(opts.className)
        klass.$create(data).then (resource) =>
          @[publicKey('set' + name.camelize(true))](resource)

      # $setAssociation (Record the foreign key of the associated instance, and call the inverse setter)
      @Resource::[publicKey('set' + name.camelize(true))] = (resource) ->
        setAttrIfDifferent.call this, opts.foreignKey, resource.$id, =>
          klass = $injector.get(opts.className)
          reverseSetter = publicKey 'set' + klass._assoc.inverseOf(name).name.camelize(true)
          resource[reverseSetter](this)

    createBelongsTo: (name, opts) ->
      # Set the foreignKey of the child with the parent_id, then $add the child to the parent collection
      @Resource::[publicKey "set#{name.camelize(true)}"] = (resource) ->
        setAttrIfDifferent.call this, opts.foreignKey, resource.$id, =>
          resource[publicKey opts.inverseOf]().$add this

