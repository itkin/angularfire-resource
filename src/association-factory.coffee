angular.module('angularfire-resource')

.factory 'AssociationFactory', ($injector, $firebaseUtils, AssociationCollection) ->

  getResourceId = (resource) ->
    if angular.isObject(resource)
      resource.$id
    else
      resource

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
      throwError(Resource, type, name, key) unless opts[key]?

    if type isnt 'HasMany' and not opts.foreignKey?
      throwError(Resource, type, name, 'foreignKey')
    true

  HasMany = (Resource, name, opts={}, cb) ->
    @type = 'HasMany'
    @name = name

    opts.inverseOf or= Resource.$name.replace(/s$/,'').camelize(true) unless opts.inverseOf == false
    opts.className or= name.replace(/s$/,'').camelize(true)

    ensure_options(Resource, @type, name, opts)

    @$$conf = angular.extend(name: name, opts)

    @reverseAssociation = ->
      $injector.get(opts.className)._assoc[opts.inverseOf] if opts.inverseOf

    self = this

    Resource::[publicKey name] = (updateRef) ->
      if updateRef or not @[privateKey name]
        @[privateKey name].$destroy() if @[privateKey name]
        @[privateKey name] = new AssociationCollection this, self, opts, (updateRef or cb)
      else
        @[privateKey name]

    @remove = (resource, params) ->
      def = $firebaseUtils.defer()
      Resource.$ref().child(getResourceId(params.from)).child(name).child(getResourceId(resource)).set(null, $firebaseUtils.makeNodeResolver(def))
      def.promise

    @add = (resource, params) ->
      def = $firebaseUtils.defer()
      Resource.$ref().child(getResourceId(params.to)).child(name).child(getResourceId(resource)).set(getResourceId(resource), $firebaseUtils.makeNodeResolver(def))
      def.promise

    this

  HasOne = (Resource, name, opts={}) ->
    @type = 'HasOne'
    @name = name

    opts.inverseOf  or= Resource.$name.camelize(true) unless opts.inverseOf == false
    opts.className  or= name.camelize(true)
    opts.foreignKey or= name + 'Id'

    ensure_options(Resource, @type, name, opts)

    @$$conf = angular.extend(name: name, opts)

    reverseAssociation = ->
      $injector.get(opts.className)._assoc[opts.inverseOf] if opts.inverseOf

    association = this

    @remove = (resource, params) ->
      def = $firebaseUtils.defer()
      Resource.$ref().child(getResourceId(params.from)).child(opts.foreignKey).once 'value', (snap)->
        if snap.val() isnt resource.$id
          snap.ref().set(null, $firebaseUtils.makeNodeResolver(def))
      def.promise

    @add = (resource, params) ->
      def = $firebaseUtils.defer()
      Resource.$ref().child(getResourceId(params.to)).child(opts.foreignKey).set(getResourceId(resource), $firebaseUtils.makeNodeResolver(def))
      def.promise

    Resource::[publicKey name] = ->
      klass = $injector.get opts.className
      if @[opts.foreignKey]?
        @[privateKey name] or= klass.$find(@[opts.foreignKey])
      else
        null

    # association builder (Record the new instance and link it to the current one)
    Resource::[publicKey "create#{name.camelize(true)}"] = (data) ->
      klass = $injector.get(opts.className)
      klass.$create(data).then (resource) =>
        @[publicKey "set#{name.camelize(true)}"](resource)

    Resource::[publicKey "set#{name.camelize(true)}"] = (newResource) ->
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
          reverseAssociation().remove(this, from: oldResourceId) if oldResourceId and reverseAssociation()

        #add new resource to this if new resource
        .then =>
          reverseAssociation().add(this, to: newResource) if newResource and reverseAssociation()

        .then =>
          newResource

        # when no change has to be made, just
        .catch ->
          newResource
    this

  HasOne:   HasOne
  HasMany:  HasMany

