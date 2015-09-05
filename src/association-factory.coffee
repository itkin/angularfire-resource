angular.module('angularfire-resource')

.factory 'AssociationFactory', [
  '$injector',
  '$firebaseUtils',
  'AssociationCollection',
  ($injector, $firebaseUtils, AssociationCollection) ->

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

    # @abstract Base association class
    #
    class Association
      reverseAssociation: ->
        @targetClass()._assoc[@inverseOf] if @inverseOf

      targetClass: ->
        $injector.get @className

      remove: ->

      add: ->

    # @note Instanciate by {Resource.hasMany}, for internal use only
    #
    class HasMany extends Association

      constructor: (Resource, name, opts={}, cb) ->
        @Resource = Resource
        @type = 'HasMany'
        @name = name
        self = this

        opts.inverseOf or= @Resource.$name.replace(/s$/,'') unless opts.inverseOf == false
        opts.className or= name.replace(/s$/,'').camelize(true)
        ensure_options(@Resource, @type, name, opts)
        angular.extend(this, opts)

        @Resource::[publicKey name] = (newCb) ->
          if newCb or not @[privateKey name]
            @[privateKey name].$destroy() if @[privateKey name]
            @[privateKey name] = new AssociationCollection self, this, (newCb or cb)
          else
            @[privateKey name]



      remove: (resource, params) ->
        def = $firebaseUtils.defer()
        @Resource.$ref().child(getResourceId(params.from)).child(name).child(getResourceId(resource))
          .set(null, $firebaseUtils.makeNodeResolver(def))
        def.promise.then -> resource

      # Add a resource to a parent's collection
      # @param resource {Resource} resource instance to be added
      # @param params {Object} point the parent
      # @option params {Resource} to parent instance holding the collection
      # @example
      # @$$association.add(resource, to: @$$parentRecord)
      add: (resource, params) ->
        def = $firebaseUtils.defer()

        getValue = (storedAt, parent, child) ->
          if angular.isArray(storedAt)
            value = {}
            value[key] = getValue(key, parent, child) for key in storedAt
            value
          else if angular.isFunction(storedAt)
            storedAt.call(parent, child)
          else if angular.isString(storedAt)
            if angular.isFunction(child[storedAt]) then child[storedAt](parent) else child[storedAt]
          else
            true

        @Resource.$ref().child(getResourceId(params.to)).child(@name).child(getResourceId(resource))
          .set  getValue(@storedAt, params.to, resource), $firebaseUtils.makeNodeResolver(def)

        def.promise.then -> resource


    # @note Instanciate by {Resource.hasOne}, for internal use only
    #
    class HasOne extends Association

      constructor: (Resource, name, opts={}) ->
        @Resource = Resource
        @type = 'HasOne'
        @name = name

        opts.inverseOf  or= Resource.$name unless opts.inverseOf == false
        opts.className  or= name.camelize(true)
        opts.foreignKey or= name + 'Id'

        ensure_options(Resource, @type, name, opts)

        angular.extend(this, opts)

        self = this

        Resource::[publicKey name] = ->
          if @[self.foreignKey]?
            @[privateKey name] or= self.targetClass().$find(@[self.foreignKey])
          else
            null

        # self builder (Record the new instance and link it to the current one)
        Resource::[publicKey "create#{name.camelize(true)}"] = (data) ->
          self.targetClass().$create(data).then (resource) =>
            @[publicKey "set#{name.camelize(true)}"](resource)

        Resource::[publicKey "set#{name.camelize(true)}"] = (newResource) ->
          oldResourceId = @[self.foreignKey]

          newResourceId = if angular.isObject(newResource) then newResource.$id else newResource

          newResource = if angular.isObject(newResource)
            newResource
          else if newResource?
            self.targetClass().$find(newResource)
          else
            null

          $firebaseUtils.resolve(oldResourceId == newResourceId)

          .then (same) ->
            $firebaseUtils.reject() if same

          #update the foreign key and the cached assoc
          .then =>
            @[self.foreignKey] = newResourceId
            @[privateKey name] = newResource #resource or null
            self.add(newResource, to: this)

          #remove this from old resource if old resource
          .then =>
            self.reverseAssociation().remove(this, from: oldResourceId) if oldResourceId and self.reverseAssociation()

          #add new resource to this if new resource
          .then =>
            self.reverseAssociation().add(this, to: newResource) if newResource and self.reverseAssociation()

          .then =>
            newResource

          # when no change has to be made, just
          .catch ->
            newResource

      remove: (resource, params) ->
        def = $firebaseUtils.defer()
        @Resource.$ref().child(getResourceId(params.from)).child(@foreignKey).once 'value', (snap)->
          if snap.val() isnt resource.$id
            snap.ref().set(null, $firebaseUtils.makeNodeResolver(def))
        def.promise.then -> resource

      add: (resource, params) ->
        def = $firebaseUtils.defer()
        @Resource.$ref().child(getResourceId(params.to)).child(@foreignKey)
          .set(getResourceId(resource), $firebaseUtils.makeNodeResolver(def))
        def.promise.then -> resource


    HasOne:   HasOne
    HasMany:  HasMany

  ]